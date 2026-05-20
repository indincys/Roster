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
      model: "gpt-5.4-mini",
      isDefault: true,
      apiKey
    });

    expect(saved.provider).toBe("openai");
    expect(saved.kind).toBe("text");
    expect(saved.model).toBe("gpt-5.4-mini");
    expect(saved.isDefault).toBe(true);
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
      imageProviderConfigs: expect.arrayContaining([
        expect.objectContaining({ id: "mock", adapter: "mock", defaultModel: "mock-image", enabled: true }),
        expect.objectContaining({ id: "openai", adapter: "openai-image", defaultModel: "gpt-image-1.5", enabled: false })
      ]),
      llmProviderConfigs: expect.arrayContaining([
        expect.objectContaining({ id: "deepseek", adapter: "openai-compatible", defaultModel: "deepseek-chat", enabled: false }),
        expect.objectContaining({ id: "qwen", adapter: "openai-compatible", defaultModel: "qwen-plus", enabled: false })
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

  it("stores multiple API keys per provider and keeps only one default", async () => {
    const userDataPath = await makeTempRoot("roster-user-data-");
    const db = await ConfigDatabase.open(userDataPath);

    const first = await db.saveApiKey({
      provider: "deepseek",
      label: "DeepSeek 主账号",
      model: "deepseek-chat",
      isDefault: true,
      apiKey: "sk-deepseek-primary-1234567890"
    });
    const second = await db.saveApiKey({
      provider: "deepseek",
      label: "DeepSeek 备用账号",
      model: "deepseek-reasoner",
      isDefault: true,
      apiKey: "sk-deepseek-backup-1234567890"
    });

    const keys = db.listApiKeys().filter((key) => key.provider === "deepseek");
    expect(keys).toHaveLength(2);
    expect(keys.find((key) => key.id === first.id)?.isDefault).toBe(false);
    expect(keys.find((key) => key.id === second.id)).toMatchObject({
      label: "DeepSeek 备用账号",
      model: "deepseek-reasoner",
      isDefault: true
    });
    db.close();
  });

  it("keeps default API keys isolated by credential type", async () => {
    const userDataPath = await makeTempRoot("roster-user-data-");
    const db = await ConfigDatabase.open(userDataPath);

    const textKey = await db.saveApiKey({
      kind: "text",
      provider: "openai",
      label: "OpenAI 文本",
      model: "gpt-5.4-mini",
      isDefault: true,
      apiKey: "sk-openai-text-1234567890"
    });
    const imageKey = await db.saveApiKey({
      kind: "image",
      provider: "openai",
      label: "OpenAI 图片",
      model: "gpt-image-1.5",
      isDefault: true,
      apiKey: "sk-openai-image-1234567890"
    });

    const keys = db.listApiKeys().filter((key) => key.provider === "openai");
    expect(keys.find((key) => key.id === textKey.id)).toMatchObject({ kind: "text", isDefault: true });
    expect(keys.find((key) => key.id === imageKey.id)).toMatchObject({ kind: "image", isDefault: true });
    db.close();
  });

  it("sanitizes secret-looking provider configs before returning settings", async () => {
    const userDataPath = await makeTempRoot("roster-user-data-");
    const db = await ConfigDatabase.open(userDataPath);

    db.saveSettings({
      llmProviderConfigs: [
        {
          id: "deepseek",
          label: "DeepSeek",
          vendor: "DeepSeek",
          adapter: "openai-compatible",
          baseUrl: "https://api.deepseek.com/v1",
          defaultModel: "deepseek-chat",
          enabled: true,
          isBuiltin: true
        },
        {
          id: "leaked",
          label: "Leaked",
          vendor: "Leaked",
          adapter: "openai-compatible",
          baseUrl: "https://api.example.com/v1",
          defaultModel: "sk-2576628c6e1f4a08805a22ab97050000",
          enabled: true,
          isBuiltin: false
        }
      ]
    });

    const settings = db.getSettings();
    expect(settings.llmProviderConfigs.map((config) => config.id)).toEqual(["deepseek"]);
    expect(JSON.stringify(settings)).not.toContain("sk-2576628c");
    db.close();
  });
});
