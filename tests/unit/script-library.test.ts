import { mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { WorkspaceDatabase } from "@roster/db";

const tempRoots: string[] = [];

async function makeWorkspaceRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "roster-script-workspace-"));
  tempRoots.push(root);
  await mkdir(path.join(root, "videos"), { recursive: true });
  return root;
}

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("WorkspaceDatabase script library", () => {
  it("creates and edits script records", async () => {
    const root = await makeWorkspaceRoot();
    const db = await WorkspaceDatabase.open(root);

    const created = db.saveScript({
      text: "今天这条裤子适合通勤和周末出门，显瘦不紧绷。",
      sourceSkillId: "skill-script-v1",
      skuCode: "SKU-001",
      status: "active",
      notes: "手动新增"
    });
    const updated = db.saveScript({
      scriptId: created.id,
      text: "今天这条高腰裤适合通勤和周末出门，显瘦不紧绷。",
      sourceSkillId: "skill-script-v1",
      skuCode: "SKU-002",
      status: "archived",
      notes: "旧版本归档"
    });

    expect(updated).toMatchObject({
      text: "今天这条高腰裤适合通勤和周末出门，显瘦不紧绷。",
      sourceSkillId: "skill-script-v1",
      skuCode: "SKU-002",
      useCount: 0,
      status: "archived",
      notes: "旧版本归档"
    });
    expect(db.listScripts()).toHaveLength(1);
    db.close();
  });
});
