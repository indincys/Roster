import { mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { WorkspaceDatabase } from "@roster/db";

const tempRoots: string[] = [];

async function makeWorkspaceRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "roster-image-workspace-"));
  tempRoots.push(root);
  await mkdir(path.join(root, "videos"), { recursive: true });
  await mkdir(path.join(root, "images", "main"), { recursive: true });
  return root;
}

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("WorkspaceDatabase image library", () => {
  it("creates and edits image records with relative paths only", async () => {
    const root = await makeWorkspaceRoot();
    const db = await WorkspaceDatabase.open(root);
    const prompt = db.savePrompt({
      text: "电商主图，展示高腰剪裁",
      scene: "主图",
      status: "active"
    });

    const created = db.saveImage({
      relativePath: "images/main/SKU-WB-001.jpg",
      promptId: prompt.id,
      scene: "主图",
      width: 1024,
      height: 1365,
      aspectRatio: "3:4",
      sourceModel: "mock-image",
      status: "active",
      tags: "通勤,高腰",
      notes: "首批入库",
      generatedAt: "2026-05-09T00:00:00.000Z"
    });
    const updated = db.saveImage({
      imageId: created.id,
      relativePath: "images/main/SKU-WB-001.jpg",
      promptId: prompt.id,
      scene: "主图",
      width: 1024,
      height: 1365,
      aspectRatio: "3:4",
      sourceModel: "mock-image",
      status: "soft_deleted",
      tags: "通勤",
      notes: "软删候选",
      generatedAt: "2026-05-09T00:00:00.000Z"
    });

    expect(updated).toMatchObject({
      promptId: prompt.id,
      relativePath: "images/main/SKU-WB-001.jpg",
      fileName: "SKU-WB-001.jpg",
      scene: "主图",
      width: 1024,
      height: 1365,
      aspectRatio: "3:4",
      sourceModel: "mock-image",
      status: "soft_deleted",
      reviewStatus: "approved",
      tags: "通勤",
      notes: "软删候选"
    });
    expect(updated.relativePath).not.toContain(root);
    expect(db.listImages()).toHaveLength(1);
    db.close();
  });

  it("rejects absolute image paths", async () => {
    const root = await makeWorkspaceRoot();
    const db = await WorkspaceDatabase.open(root);

    expect(() =>
      db.saveImage({
        relativePath: path.join(root, "images/main/bad.jpg"),
        scene: "主图",
        status: "active"
      })
    ).toThrow(/业务路径必须是相对路径/);

    db.close();
  });

  it("updates prompt kept rate when generated images are soft deleted", async () => {
    const root = await makeWorkspaceRoot();
    const db = await WorkspaceDatabase.open(root);
    const prompt = db.savePrompt({
      text: "电商主图，白底构图",
      scene: "主图",
      status: "active"
    });
    db.incrementPromptGeneratedCount(prompt.id, 2);
    const image = db.saveImage({
      relativePath: "images/main/keep-rate-001.svg",
      promptId: prompt.id,
      scene: "主图",
      status: "active"
    });

    const result = db.softDeleteImageRecord({
      imageId: image.id,
      trashRelativePath: `_trash/images/${image.id}/keep-rate-001.svg`
    });

    expect(result.image).toMatchObject({
      id: image.id,
      relativePath: `_trash/images/${image.id}/keep-rate-001.svg`,
      status: "soft_deleted"
    });
    expect(result.prompt).toMatchObject({
      id: prompt.id,
      generatedCount: 2,
      keptCount: 1
    });
    expect(result.suggestedNegativePrompt).toBe(false);

    const secondImage = db.saveImage({
      relativePath: "images/main/keep-rate-002.svg",
      promptId: prompt.id,
      scene: "主图",
      status: "active"
    });
    const secondResult = db.softDeleteImageRecord({
      imageId: secondImage.id,
      trashRelativePath: `_trash/images/${secondImage.id}/keep-rate-002.svg`
    });

    expect(secondResult.prompt).toMatchObject({
      generatedCount: 2,
      keptCount: 0
    });
    expect(secondResult.suggestedNegativePrompt).toBe(true);
    db.close();
  });

  it("keeps manually reviewed images pending until they are approved", async () => {
    const root = await makeWorkspaceRoot();
    const db = await WorkspaceDatabase.open(root);
    const prompt = db.savePrompt({
      text: "电商主图，人工验收",
      scene: "主图",
      status: "active"
    });
    db.incrementPromptGeneratedCount(prompt.id, 1, 0);
    const pending = db.saveImage({
      relativePath: "images/main/pending-review.svg",
      promptId: prompt.id,
      scene: "主图",
      status: "active",
      reviewStatus: "pending"
    });

    expect(pending.reviewStatus).toBe("pending");
    expect(db.listPrompts().find((item) => item.id === prompt.id)).toMatchObject({
      generatedCount: 1,
      keptCount: 0
    });

    const approved = db.reviewImage({ imageId: pending.id, reviewStatus: "approved" });

    expect(approved.reviewStatus).toBe("approved");
    expect(db.listPrompts().find((item) => item.id === prompt.id)).toMatchObject({
      generatedCount: 1,
      keptCount: 1
    });
    db.close();
  });

  it("lists builtin image scene presets and saves custom presets", async () => {
    const root = await makeWorkspaceRoot();
    const db = await WorkspaceDatabase.open(root);

    const initial = db.listImageScenePresets();
    expect(initial.map((preset) => preset.name)).toContain("主图");
    expect(initial.find((preset) => preset.name === "主图")).toMatchObject({
      isBuiltin: true,
      defaultOutputSubdir: "main",
      defaultAspectRatio: "1:1"
    });

    const saved = db.saveImageScenePreset({
      name: "海报素材",
      skillId: "image-prompt-skill",
      defaultAspectRatio: "16:9",
      defaultPerPromptCount: 3,
      defaultOutputSubdir: "detail",
      defaultImageModel: "mock-image"
    });

    expect(saved).toMatchObject({
      name: "海报素材",
      skillId: "image-prompt-skill",
      defaultAspectRatio: "16:9",
      defaultPerPromptCount: 3,
      defaultOutputSubdir: "detail",
      defaultImageModel: "mock-image",
      isBuiltin: false
    });
    expect(db.listImageScenePresets().find((preset) => preset.id === saved.id)).toMatchObject(saved);
    db.close();
  });
});
