import crypto from "node:crypto";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ConfigDatabase } from "@roster/db";

const tempRoots: string[] = [];

async function makeTempRoot(prefix: string): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), prefix));
  tempRoots.push(root);
  return root;
}

async function createWorkspace(db: ConfigDatabase, parent: string, name: string): Promise<string> {
  const rootPath = path.join(parent, name);
  const state = await db.createWorkspace({
    name,
    rootPath,
    macRootPath: rootPath,
    winRootPath: `D:\\Roster\\${name}`
  });
  if (!state.activeWorkspaceId) {
    throw new Error("workspace id missing");
  }
  return state.activeWorkspaceId;
}

function sha256(value: string): string {
  return crypto.createHash("sha256").update(Buffer.from(value, "utf8")).digest("hex");
}

function makeMarketFetcher(files: Record<string, string>): (url: string) => Promise<Buffer> {
  return async (url: string) => {
    const parsed = new URL(url);
    const fileName = path.basename(parsed.pathname);
    const fullPath = decodeURIComponent(parsed.pathname);
    const content = files[url] ?? files[fullPath] ?? files[fileName];
    if (content === undefined) {
      throw new Error(`missing market file: ${url}`);
    }
    return Buffer.from(content, "utf8");
  };
}

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("ConfigDatabase skill store", () => {
  it("saves user and copy skills into the global skill pool", async () => {
    const userDataPath = await makeTempRoot("roster-user-data-");
    const db = await ConfigDatabase.open(userDataPath);

    const userSkill = await db.saveSkill({
      skillId: "title-general",
      displayName: "标题通用 Skill",
      type: "title",
      sourceType: "user",
      version: "0.1.0",
      content: "标题规则\n{{include: examples.md}}"
    });
    const copySkill = await db.saveSkill({
      skillId: "official-title-copy",
      displayName: "官方标题副本",
      type: "title",
      sourceType: "copy",
      version: "1.0.0",
      content: "副本规则",
      origin: {
        skillId: "official-title",
        version: "1.0.0"
      }
    });

    expect(userSkill.isEditable).toBe(true);
    expect(copySkill.isRestorable).toBe(true);
    await expect(stat(path.join(userDataPath, "skills", "user", "title-general", "meta.json"))).resolves.toBeTruthy();
    await expect(stat(path.join(userDataPath, "skills", "user", "title-general", "SKILL.md"))).resolves.toBeTruthy();
    expect((await db.listSkills()).map((skill) => skill.id)).toEqual(
      expect.arrayContaining(["title-general", "official-title-copy"])
    );
    db.close();
  });

  it("generates sequential type-prefixed skill IDs when creating user skills", async () => {
    const userDataPath = await makeTempRoot("roster-user-data-");
    const db = await ConfigDatabase.open(userDataPath);

    const firstTitle = await db.saveSkill({
      displayName: "标题 Skill A",
      type: "title",
      sourceType: "user",
      content: "标题规则 A"
    });
    const secondTitle = await db.saveSkill({
      displayName: "标题 Skill B",
      type: "title",
      sourceType: "user",
      content: "标题规则 B"
    });
    const imagePrompt = await db.saveSkill({
      displayName: "图片提示词 Skill",
      type: "image_prompt",
      sourceType: "user",
      content: "图片提示词规则"
    });

    expect(firstTitle.id).toBe("title-01");
    expect(secondTitle.id).toBe("title-02");
    expect(imagePrompt.id).toBe("image-prompt-01");
    await expect(stat(path.join(userDataPath, "skills", "user", "title-01", "meta.json"))).resolves.toBeTruthy();
    db.close();
  });

  it("keeps workspace activation isolated and filters enabled skills by type", async () => {
    const userDataPath = await makeTempRoot("roster-user-data-");
    const workspacesRoot = await makeTempRoot("roster-workspaces-");
    const db = await ConfigDatabase.open(userDataPath);
    const firstWorkspaceId = await createWorkspace(db, workspacesRoot, "品牌A");
    const secondWorkspaceId = await createWorkspace(db, workspacesRoot, "品牌B");

    await db.saveSkill({
      skillId: "title-skill",
      displayName: "标题 Skill",
      type: "title",
      sourceType: "user",
      content: "标题规则"
    });
    await db.saveSkill({
      skillId: "script-skill",
      displayName: "文案 Skill",
      type: "script",
      sourceType: "user",
      content: "文案规则"
    });

    const firstActivation = await db.updateSkillActivation({
      workspaceId: firstWorkspaceId,
      enabledSkillIds: ["title-skill", "script-skill", "missing-skill", "title-skill"]
    });
    const secondActivation = await db.updateSkillActivation({
      workspaceId: secondWorkspaceId,
      enabledSkillIds: ["script-skill"]
    });

    expect(firstActivation.enabledSkillIds).toEqual(["title-skill", "script-skill"]);
    expect(secondActivation.enabledSkillIds).toEqual(["script-skill"]);
    expect((await db.listEnabledSkills(firstWorkspaceId, "title")).map((skill) => skill.id)).toEqual(["title-skill"]);
    expect((await db.listEnabledSkills(secondWorkspaceId, "title")).map((skill) => skill.id)).toEqual([]);

    const activationPath = path.join(workspacesRoot, "品牌A", "skills_config", "activation.json");
    const activationFile = JSON.parse(await readFile(activationPath, "utf8")) as { enabledSkillIds: string[] };
    expect(activationFile.enabledSkillIds).toEqual(["title-skill", "script-skill"]);
    db.close();
  });

  it("lists and restores skill save snapshots without dropping current edits", async () => {
    const userDataPath = await makeTempRoot("roster-user-data-");
    const db = await ConfigDatabase.open(userDataPath);

    await db.saveSkill({
      skillId: "snapshot-skill",
      displayName: "快照 Skill",
      type: "title",
      sourceType: "user",
      content: "版本 1"
    });
    await db.saveSkill({
      skillId: "snapshot-skill",
      displayName: "快照 Skill",
      type: "title",
      sourceType: "user",
      content: "版本 2"
    });

    const snapshots = await db.listSkillSnapshots({ skillId: "snapshot-skill" });
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]?.contentPreview).toContain("版本 1");

    const restored = await db.restoreSkillSnapshot({
      skillId: "snapshot-skill",
      snapshotId: snapshots[0]?.snapshotId ?? ""
    });
    expect(restored.content).toBe("版本 1");
    const afterRestoreSnapshots = await db.listSkillSnapshots({ skillId: "snapshot-skill" });
    expect(afterRestoreSnapshots.length).toBeGreaterThanOrEqual(2);
    expect(afterRestoreSnapshots.some((snapshot) => snapshot.contentPreview.includes("版本 2"))).toBe(true);
    db.close();
  });

  it("lists, reads, and saves markdown include subfiles inside the skill sandbox", async () => {
    const userDataPath = await makeTempRoot("roster-user-data-");
    const db = await ConfigDatabase.open(userDataPath);

    await db.saveSkill({
      skillId: "file-tree-skill",
      displayName: "文件树 Skill",
      type: "title",
      sourceType: "user",
      content: "# 主文件\n{{include: examples/good.md}}\n"
    });
    const saved = await db.saveSkillFile({
      skillId: "file-tree-skill",
      relativePath: "examples/good.md",
      content: "好案例"
    });

    expect(saved).toMatchObject({
      relativePath: "examples/good.md",
      content: "好案例"
    });
    const files = await db.listSkillFiles({ skillId: "file-tree-skill" });
    expect(files.map((file) => file.relativePath)).toEqual(["SKILL.md", "examples/good.md"]);
    await expect(db.readSkillContent({ skillId: "file-tree-skill", relativePath: "examples/good.md" })).resolves.toMatchObject({
      content: "好案例"
    });
    await expect(db.saveSkillFile({ skillId: "file-tree-skill", relativePath: "../secret.md", content: "" })).rejects.toThrow(
      /Skill 文件路径非法/
    );
    await expect(db.saveSkillFile({ skillId: "file-tree-skill", relativePath: ".hidden/good.md", content: "" })).rejects.toThrow(
      /Skill 文件路径非法/
    );
    await expect(db.saveSkillFile({ skillId: "file-tree-skill", relativePath: "examples/good.txt", content: "" })).rejects.toThrow(
      /Skill 文件路径非法/
    );
    const snapshots = await db.listSkillSnapshots({ skillId: "file-tree-skill" });
    expect(snapshots.length).toBeGreaterThanOrEqual(1);
    db.close();
  });

  it("prunes skill snapshots beyond the configured retention", async () => {
    const userDataPath = await makeTempRoot("roster-user-data-");
    const db = await ConfigDatabase.open(userDataPath, { skillSnapshotRetention: 2 });

    await db.saveSkill({
      skillId: "retention-skill",
      displayName: "保留 Skill",
      type: "title",
      sourceType: "user",
      content: "版本 1"
    });
    for (let index = 2; index <= 5; index += 1) {
      await new Promise((resolve) => setTimeout(resolve, 2));
      await db.saveSkill({
        skillId: "retention-skill",
        displayName: "保留 Skill",
        type: "title",
        sourceType: "user",
        content: `版本 ${index}`
      });
    }

    const snapshots = await db.listSkillSnapshots({ skillId: "retention-skill" });
    expect(snapshots).toHaveLength(2);
    expect(snapshots.some((snapshot) => snapshot.contentPreview.includes("版本 1"))).toBe(false);
    expect(snapshots.some((snapshot) => snapshot.contentPreview.includes("版本 3"))).toBe(true);
    expect(snapshots.some((snapshot) => snapshot.contentPreview.includes("版本 4"))).toBe(true);
    db.close();
  });

  it("installs and upgrades official skills from a cached manifest without changing official copies", async () => {
    const userDataPath = await makeTempRoot("roster-user-data-");
    const manifestUrl = "https://example.com/market/manifest.json";
    const skillMdV1 = "# 官方标题 Skill v1\n";
    const skillMdV2 = "# 官方标题 Skill v2\n";
    const metaV1 = JSON.stringify({
      id: "official_title",
      displayName: "旧名称",
      type: "title",
      sourceType: "official",
      version: "0.1.0"
    });
    const metaV2 = JSON.stringify({
      id: "official_title",
      displayName: "旧名称",
      type: "title",
      sourceType: "official",
      version: "0.1.0"
    });
    const manifestV1 = JSON.stringify({
      manifest_version: 1,
      updated_at: "2026-05-09T00:00:00Z",
      skills: [
        {
          name: "official_title",
          display_name: "官方标题",
          type: "title",
          version: "1.0.0",
          description: "标题生成",
          supported_models: ["gpt-5"],
          files: [
            { path: "meta.json", sha256: sha256(metaV1) },
            { path: "SKILL.md", sha256: sha256(skillMdV1) }
          ]
        }
      ]
    });
    const manifestV2 = JSON.stringify({
      manifest_version: 1,
      updated_at: "2026-05-10T00:00:00Z",
      skills: [
        {
          name: "official_title",
          display_name: "官方标题",
          type: "title",
          version: "1.1.0",
          description: "标题生成升级版",
          supported_models: ["gpt-5"],
          files: [
            { path: "meta.json", sha256: sha256(metaV2) },
            { path: "SKILL.md", sha256: sha256(skillMdV2) }
          ]
        }
      ]
    });
    const files: Record<string, string> = {
      "manifest.json": manifestV1,
      "/market/skills/official_title/meta.json": metaV1,
      "/market/skills/official_title/SKILL.md": skillMdV1
    };
    const db = await ConfigDatabase.open(userDataPath, { skillMarketFetcher: makeMarketFetcher(files) });

    const firstMarket = await db.listSkillMarket({ manifestUrl, forceRefresh: true });
    expect(firstMarket.skills[0]).toMatchObject({ name: "official_title", status: "not_installed" });
    const installed = await db.installSkillFromMarket({ name: "official_title", manifestUrl });
    expect(installed.version).toBe("1.0.0");
    await expect(stat(path.join(userDataPath, "skills", "official", "official_title", "SKILL.md"))).resolves.toBeTruthy();

    await db.saveSkill({
      skillId: "official-title-copy",
      displayName: "官方标题副本",
      sourceType: "copy",
      type: "title",
      version: "1.0.0",
      content: "用户修改的副本",
      origin: {
        skillId: "official_title",
        version: "1.0.0"
      }
    });

    files["manifest.json"] = manifestV2;
    files["/market/skills/official_title/meta.json"] = metaV2;
    files["/market/skills/official_title/SKILL.md"] = skillMdV2;
    const upgradeMarket = await db.listSkillMarket({ manifestUrl, forceRefresh: true });
    expect(upgradeMarket.skills[0]).toMatchObject({ installedVersion: "1.0.0", status: "update_available" });
    await db.installSkillFromMarket({ name: "official_title", manifestUrl });

    const skills = await db.listSkills();
    expect(skills.find((skill) => skill.id === "official_title")?.version).toBe("1.1.0");
    expect(await readFile(path.join(userDataPath, "skills", "official", "official_title", "SKILL.md"), "utf8")).toBe(skillMdV2);
    expect(await readFile(path.join(userDataPath, "skills", "user", "official-title-copy", "SKILL.md"), "utf8")).toBe("用户修改的副本");
    db.close();
  });

  it("uses cached Skill market data while offline", async () => {
    const userDataPath = await makeTempRoot("roster-user-data-");
    const manifestUrl = "https://example.com/market/manifest.json";
    const skillMd = "# 离线 Skill\n";
    const meta = JSON.stringify({ id: "offline_title", displayName: "离线标题", type: "title", sourceType: "official" });
    const files: Record<string, string> = {
      "manifest.json": JSON.stringify({
        manifest_version: 1,
        updated_at: "2026-05-09T00:00:00Z",
        skills: [
          {
            name: "offline_title",
            display_name: "离线标题",
            type: "title",
            version: "1.0.0",
            description: "",
            files: [
              { path: "meta.json", sha256: sha256(meta) },
              { path: "SKILL.md", sha256: sha256(skillMd) }
            ]
          }
        ]
      })
    };
    const db = await ConfigDatabase.open(userDataPath, { skillMarketFetcher: makeMarketFetcher(files) });
    await db.listSkillMarket({ manifestUrl, forceRefresh: true });
    db.close();

    const offlineDb = await ConfigDatabase.open(userDataPath, {
      skillMarketFetcher: async () => {
        throw new Error("offline");
      }
    });
    const offlineMarket = await offlineDb.listSkillMarket({ manifestUrl, forceRefresh: true });
    expect(offlineMarket.offline).toBe(true);
    expect(offlineMarket.error).toContain("offline");
    expect(offlineMarket.skills.map((skill) => skill.name)).toEqual(["offline_title"]);
    offlineDb.close();
  });

  it("rolls back official skill install when a downloaded file hash is wrong", async () => {
    const userDataPath = await makeTempRoot("roster-user-data-");
    const manifestUrl = "https://example.com/market/manifest.json";
    const goodSkillMd = "# good\n";
    const badSkillMd = "# bad\n";
    const meta = JSON.stringify({ id: "hash_title", displayName: "Hash 标题", type: "title", sourceType: "official" });
    const files: Record<string, string> = {
      "manifest.json": JSON.stringify({
        manifest_version: 1,
        updated_at: "2026-05-09T00:00:00Z",
        skills: [
          {
            name: "hash_title",
            display_name: "Hash 标题",
            type: "title",
            version: "1.0.0",
            description: "",
            files: [
              { path: "meta.json", sha256: sha256(meta) },
              { path: "SKILL.md", sha256: sha256(goodSkillMd) }
            ]
          }
        ]
      }),
      "/market/skills/hash_title/meta.json": meta,
      "/market/skills/hash_title/SKILL.md": badSkillMd
    };
    const db = await ConfigDatabase.open(userDataPath, { skillMarketFetcher: makeMarketFetcher(files) });
    await db.listSkillMarket({ manifestUrl, forceRefresh: true });
    await expect(db.installSkillFromMarket({ name: "hash_title", manifestUrl })).rejects.toThrow(/hash 校验失败/);
    expect((await db.listSkills()).find((skill) => skill.id === "hash_title")).toBeUndefined();
    await expect(stat(path.join(userDataPath, "skills", "official", "hash_title"))).rejects.toThrow();
    db.close();
  });

  it("creates official copies, restores to copied version, and explicitly upgrades to latest official version", async () => {
    const userDataPath = await makeTempRoot("roster-user-data-");
    const manifestUrl = "https://example.com/market/manifest.json";
    const officialV1 = "# 官方 v1\n";
    const officialV2 = "# 官方 v2\n";
    const metaV1 = JSON.stringify({ id: "copy_source", displayName: "复制来源", type: "title", sourceType: "official" });
    const metaV2 = JSON.stringify({ id: "copy_source", displayName: "复制来源", type: "title", sourceType: "official" });
    const files: Record<string, string> = {
      "manifest.json": JSON.stringify({
        manifest_version: 1,
        updated_at: "2026-05-09T00:00:00Z",
        skills: [
          {
            name: "copy_source",
            display_name: "复制来源",
            type: "title",
            version: "1.0.0",
            description: "",
            files: [
              { path: "meta.json", sha256: sha256(metaV1) },
              { path: "SKILL.md", sha256: sha256(officialV1) }
            ]
          }
        ]
      }),
      "/market/skills/copy_source/meta.json": metaV1,
      "/market/skills/copy_source/SKILL.md": officialV1
    };
    const db = await ConfigDatabase.open(userDataPath, { skillMarketFetcher: makeMarketFetcher(files) });
    await db.listSkillMarket({ manifestUrl, forceRefresh: true });
    await db.installSkillFromMarket({ name: "copy_source", manifestUrl });

    const copy = await db.createOfficialSkillCopy({ skillId: "copy_source", copySkillId: "copy_source_custom" });
    expect(copy.sourceType).toBe("copy");
    expect(copy.origin).toEqual({ skillId: "copy_source", version: "1.0.0" });

    await db.saveSkill({
      skillId: "copy_source_custom",
      displayName: "复制来源 副本",
      type: "title",
      sourceType: "copy",
      version: "1.0.0",
      content: "# 用户修改\n",
      origin: {
        skillId: "copy_source",
        version: "1.0.0"
      }
    });
    const restored = await db.restoreOfficialSkillCopy({ skillId: "copy_source_custom" });
    expect(restored.content).toBe(officialV1);

    files["manifest.json"] = JSON.stringify({
      manifest_version: 1,
      updated_at: "2026-05-10T00:00:00Z",
      skills: [
        {
          name: "copy_source",
          display_name: "复制来源",
          type: "title",
          version: "1.1.0",
          description: "",
          files: [
            { path: "meta.json", sha256: sha256(metaV2) },
            { path: "SKILL.md", sha256: sha256(officialV2) }
          ]
        }
      ]
    });
    files["/market/skills/copy_source/meta.json"] = metaV2;
    files["/market/skills/copy_source/SKILL.md"] = officialV2;
    await db.listSkillMarket({ manifestUrl, forceRefresh: true });
    await db.installSkillFromMarket({ name: "copy_source", manifestUrl });

    expect(await readFile(path.join(userDataPath, "skills", "user", "copy_source_custom", "SKILL.md"), "utf8")).toBe(officialV1);
    const upgraded = await db.upgradeOfficialSkillCopy({ skillId: "copy_source_custom" });
    expect(upgraded.content).toBe(officialV2);
    const upgradedCopy = (await db.listSkills()).find((skill) => skill.id === "copy_source_custom");
    expect(upgradedCopy?.origin).toEqual({ skillId: "copy_source", version: "1.1.0" });
    db.close();
  });
});
