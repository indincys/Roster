import { mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { WorkspaceDatabase } from "@roster/db";

const tempRoots: string[] = [];

async function makeWorkspaceRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "roster-prompt-workspace-"));
  tempRoots.push(root);
  await mkdir(path.join(root, "videos"), { recursive: true });
  return root;
}

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("WorkspaceDatabase prompt library", () => {
  it("creates and edits prompt records", async () => {
    const root = await makeWorkspaceRoot();
    const db = await WorkspaceDatabase.open(root);

    const created = db.savePrompt({
      text: "电商主图，暖色室内光，突出面料纹理",
      scene: "主图",
      status: "active",
      notes: "手动新增"
    });
    const updated = db.savePrompt({
      promptId: created.id,
      text: "电商主图，暖色室内光，突出高腰剪裁和面料纹理",
      scene: "主图",
      status: "negative",
      notes: "标记反面"
    });

    expect(updated).toMatchObject({
      text: "电商主图，暖色室内光，突出高腰剪裁和面料纹理",
      scene: "主图",
      generatedCount: 0,
      keptCount: 0,
      status: "negative",
      notes: "标记反面"
    });
    expect(db.listPrompts()).toHaveLength(1);
    db.close();
  });
});
