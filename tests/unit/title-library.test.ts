import { mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { WorkspaceDatabase } from "@roster/db";

const tempRoots: string[] = [];

async function makeWorkspaceRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "roster-title-workspace-"));
  tempRoots.push(root);
  await mkdir(path.join(root, "videos"), { recursive: true });
  return root;
}

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("WorkspaceDatabase title library", () => {
  it("creates and edits title records", async () => {
    const root = await makeWorkspaceRoot();
    const db = await WorkspaceDatabase.open(root);

    const created = db.saveTitle({
      text: "冬季高腰显瘦裤，通勤也能穿",
      sourceSkillId: "skill-title-v1",
      score: 88,
      status: "active",
      notes: "手动新增"
    });
    const updated = db.saveTitle({
      titleId: created.id,
      text: "冬季高腰显瘦裤，上班通勤也能穿",
      sourceSkillId: "skill-title-v1",
      score: 92,
      status: "active",
      notes: "已优化"
    });

    expect(updated).toMatchObject({
      text: "冬季高腰显瘦裤，上班通勤也能穿",
      sourceSkillId: "skill-title-v1",
      score: 92,
      useCount: 0,
      status: "active",
      notes: "已优化"
    });
    expect(db.listTitles()).toHaveLength(1);
    db.close();
  });
});
