import { mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { WorkspaceDatabase } from "@roster/db";

const tempRoots: string[] = [];

async function makeWorkspaceRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "roster-tag-workspace-"));
  tempRoots.push(root);
  await mkdir(path.join(root, "videos"), { recursive: true });
  return root;
}

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("WorkspaceDatabase tag library CSV import", () => {
  it("imports Chinese-header CSV rows into SKU tag groups", async () => {
    const root = await makeWorkspaceRoot();
    const db = await WorkspaceDatabase.open(root);

    const summary = db.importTagsCsv(
      "\uFEFFSKU编码,款式,标签一,标签二,标签三,标签四,标签五,标签组类型,备注\n" +
        "SKU-WB-001,日常款,保暖,显瘦,通勤,冬季,高腰,默认,主推\n" +
        "SKU-WB-001,日常款,轻薄,测试词,,,,测试,AB 测试\n"
    );

    expect(summary).toMatchObject({ imported: 2, inserted: 2, updated: 0, skipped: 0, errors: [] });
    expect(db.listTags()).toMatchObject([
      {
        skuCode: "SKU-WB-001",
        skuStyle: "日常款",
        tag1: "保暖",
        tag5: "高腰",
        tagGroup: "default",
        notes: "主推"
      },
      {
        skuCode: "SKU-WB-001",
        skuStyle: "日常款",
        tag1: "轻薄",
        tag2: "测试词",
        tagGroup: "test",
        notes: "AB 测试"
      }
    ]);
    db.close();
  });

  it("updates existing SKU/style/group rows instead of duplicating them", async () => {
    const root = await makeWorkspaceRoot();
    const db = await WorkspaceDatabase.open(root);

    db.importTagsCsv("sku,style,tag1,tag_group\nSKU-WB-001,日常款,保暖,default\n");
    const summary = db.importTagsCsv("sku,style,tag1,tag2,tag_group\nSKU-WB-001,日常款,显瘦,通勤,default\n");

    expect(summary).toMatchObject({ imported: 1, inserted: 0, updated: 1, skipped: 0 });
    expect(db.listTags()).toHaveLength(1);
    expect(db.listTags()[0]).toMatchObject({ tag1: "显瘦", tag2: "通勤" });
    db.close();
  });

  it("reports missing SKU rows and keeps valid rows in the same import", async () => {
    const root = await makeWorkspaceRoot();
    const db = await WorkspaceDatabase.open(root);

    const summary = db.importTagsCsv("sku,tag1\n,缺失\nSKU-WB-002,\"含,逗号\"\n");

    expect(summary.imported).toBe(1);
    expect(summary.inserted).toBe(1);
    expect(summary.skipped).toBe(1);
    expect(summary.errors).toEqual(["第 2 行缺少 SKU"]);
    expect(db.listTags()).toMatchObject([{ skuCode: "SKU-WB-002", tag1: "含,逗号" }]);
    db.close();
  });

  it("saves manually edited tag groups", async () => {
    const root = await makeWorkspaceRoot();
    const db = await WorkspaceDatabase.open(root);

    const created = db.saveTag({
      skuCode: "SKU-WB-003",
      skuStyle: "户外款",
      tag1: "防风",
      tagGroup: "default",
      notes: "手动新增"
    });
    const updated = db.saveTag({
      tagId: created.id,
      skuCode: "SKU-WB-003",
      skuStyle: "户外款",
      tag1: "防风",
      tag2: "防水",
      tagGroup: "test",
      notes: "改为测试"
    });

    expect(updated).toMatchObject({
      skuCode: "SKU-WB-003",
      skuStyle: "户外款",
      tag1: "防风",
      tag2: "防水",
      tagGroup: "test",
      notes: "改为测试"
    });
    expect(db.listTags()).toHaveLength(1);
    db.close();
  });
});
