import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ConfigDatabase } from "@roster/db";
import { WORKSPACE_DIRECTORIES } from "@roster/shared-types";

const tempRoots: string[] = [];

async function makeTempRoot(prefix: string): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), prefix));
  tempRoots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("ConfigDatabase workspace lifecycle", () => {
  it("creates config.db, workspace.db, metadata, activation config, and required directories", async () => {
    const userDataPath = await makeTempRoot("roster-user-data-");
    const workspaceRoot = path.join(await makeTempRoot("roster-workspace-parent-"), "暖心生活");
    const db = await ConfigDatabase.open(userDataPath);

    const state = await db.createWorkspace({
      name: "暖心生活",
      rootPath: workspaceRoot,
      macRootPath: workspaceRoot,
      winRootPath: "D:/CloudSync/暖心生活"
    });

    expect(state.activeWorkspaceId).toBeTruthy();
    expect(state.workspaces).toHaveLength(1);
    expect(state.workspaces[0]?.winRootPath).toBe("D:\\CloudSync\\暖心生活");

    for (const directory of WORKSPACE_DIRECTORIES) {
      const directoryStat = await stat(path.join(workspaceRoot, directory));
      expect(directoryStat.isDirectory()).toBe(true);
    }

    await expect(stat(path.join(workspaceRoot, "workspace.db"))).resolves.toBeTruthy();
    await expect(stat(path.join(workspaceRoot, "workspace.json"))).resolves.toBeTruthy();
    await expect(stat(path.join(workspaceRoot, "workspace.lock"))).resolves.toBeTruthy();
    await expect(stat(path.join(workspaceRoot, "skills_config", "activation.json"))).resolves.toBeTruthy();

    const workspaceJson = JSON.parse(await readFile(path.join(workspaceRoot, "workspace.json"), "utf8")) as { name: string };
    expect(workspaceJson.name).toBe("暖心生活");

    db.close();
  });

  it("switches active workspace and persists the last active id in config.db", async () => {
    const userDataPath = await makeTempRoot("roster-user-data-");
    const parent = await makeTempRoot("roster-workspaces-");
    const db = await ConfigDatabase.open(userDataPath);

    const first = await db.createWorkspace({
      name: "品牌 A",
      rootPath: path.join(parent, "A"),
      macRootPath: path.join(parent, "A"),
      winRootPath: "D:\\CloudSync\\A"
    });
    const firstId = first.activeWorkspaceId;

    const second = await db.createWorkspace({
      name: "品牌 B",
      rootPath: path.join(parent, "B"),
      macRootPath: path.join(parent, "B"),
      winRootPath: "D:\\CloudSync\\B"
    });
    const secondId = second.activeWorkspaceId;
    expect(secondId).not.toBe(firstId);

    if (!firstId) {
      throw new Error("first workspace id missing");
    }
    const switched = db.switchWorkspace(firstId);
    expect(switched.activeWorkspaceId).toBe(firstId);

    db.close();
    const reopened = await ConfigDatabase.open(userDataPath);
    expect(reopened.getRuntimeState().activeWorkspaceId).toBe(firstId);
    reopened.close();
  });

  it("encrypts API keys so plaintext is not present in config.db", async () => {
    const userDataPath = await makeTempRoot("roster-user-data-");
    const db = await ConfigDatabase.open(userDataPath);
    const apiKey = "sk-test-secret-value-1234567890";

    const saved = await db.saveApiKey({
      provider: "openai",
      label: "测试 Key",
      apiKey
    });

    expect(saved.provider).toBe("openai");
    expect(db.listApiKeys()).toHaveLength(1);
    const configDbBytes = await readFile(path.join(userDataPath, "config.db"));
    expect(configDbBytes.toString("latin1")).not.toContain(apiKey);
    await expect(db.auditApiKeyStorage()).resolves.toMatchObject({ plaintextFound: false });
    db.close();
  });

  it("persists app settings in preferences with defaults", async () => {
    const userDataPath = await makeTempRoot("roster-user-data-");
    const db = await ConfigDatabase.open(userDataPath);

    expect(db.getSettings()).toMatchObject({
      scanFrequency: "manual",
      backupScope: "all",
      backupRetentionCount: 7,
      providerRetryCount: 3,
      llmProviderConfigs: expect.arrayContaining([
        expect.objectContaining({ id: "deepseek", adapter: "openai-compatible", defaultModel: "deepseek-chat" }),
        expect.objectContaining({ id: "qwen", adapter: "openai-compatible", defaultModel: "qwen-plus" })
      ])
    });
    const saved = db.saveSettings({
      scanFrequency: "interval",
      scanIntervalMinutes: 15,
      excelFieldNaming: "en",
      backupScope: "database",
      backupRetentionCount: 3,
      providerRetryCount: 2,
      llmProviderConfigs: [
        {
          id: "custom",
          label: "Custom API",
          vendor: "Custom",
          adapter: "openai-compatible",
          baseUrl: "https://api.example.com/v1",
          defaultModel: "custom-chat",
          enabled: true,
          isBuiltin: false
        }
      ]
    });
    expect(saved).toMatchObject({
      scanFrequency: "interval",
      scanIntervalMinutes: 15,
      excelFieldNaming: "en",
      backupScope: "database",
      backupRetentionCount: 3,
      providerRetryCount: 2,
      llmProviderConfigs: [expect.objectContaining({ id: "custom", baseUrl: "https://api.example.com/v1" })]
    });
    db.close();

    const reopened = await ConfigDatabase.open(userDataPath);
    expect(reopened.getSettings()).toMatchObject(saved);
    reopened.close();
  });
});
