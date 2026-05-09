import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import ExcelJS from "exceljs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { WorkspaceDatabase, assignPublishTimes, generateTaskRows } from "@roster/db";
import type { PlatformAccountRecord, TitleRecord, VideoRecord } from "@roster/shared-types";

const tempRoots: string[] = [];

async function makeWorkspaceRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "roster-task-workspace-"));
  tempRoots.push(root);
  await mkdir(path.join(root, "videos"), { recursive: true });
  return root;
}

async function writeVideo(root: string, relativePath: string): Promise<void> {
  const absolutePath = path.join(root, relativePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, "video-bytes");
}

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

function baseVideo(index: number): VideoRecord {
  return {
    id: `video-${index}`,
    relativePath: `videos/SKU-${index}/video-${index}.mp4`,
    fileName: `video-${index}.mp4`,
    sku: `SKU-${index}`,
    style: null,
    durationSeconds: 10,
    width: 1080,
    height: 1920,
    sizeBytes: 1024,
    status: "active",
    thumbnailRelativePath: null,
    hasCover: false,
    usedCount: index,
    note: null,
    metadataError: null,
    lastScannedAt: null,
    lastUsedAt: null,
    createdAt: `2026-05-09T00:00:0${index}.000Z`,
    updatedAt: `2026-05-09T00:00:0${index}.000Z`
  };
}

function platformAccount(index: number): PlatformAccountRecord {
  return {
    id: `account-${index}`,
    platform: ["抖音", "视频号", "小红书", "快手"][index] ?? `平台${index}`,
    accountName: `账号${index}`,
    enabled: true,
    createdAt: "2026-05-09T00:00:00.000Z",
    updatedAt: "2026-05-09T00:00:00.000Z"
  };
}

function title(index: number, score: number, useCount = 0): TitleRecord {
  return {
    id: `title-${index}`,
    text: `标题 ${index}`,
    sourceSkillId: null,
    score,
    useCount,
    status: "active",
    notes: null,
    lastUsedAt: null,
    createdAt: "2026-05-09T00:00:00.000Z",
    updatedAt: "2026-05-09T00:00:00.000Z"
  };
}

describe("task generation algorithms", () => {
  it("assigns all publish times when task count is not divisible by anchor count", () => {
    const times = assignPublishTimes(["09:00", "12:00", "15:00"], 15, 10, () => 0.5);

    expect(times).toHaveLength(10);
    const byAnchor = new Map<string, number>();
    for (const item of times) {
      byAnchor.set(item.anchor, (byAnchor.get(item.anchor) ?? 0) + 1);
      const [hour, minute] = item.time.split(":").map((part) => Number.parseInt(part, 10));
      const actual = hour * 60 + minute;
      const [anchorHour, anchorMinute] = item.anchor.split(":").map((part) => Number.parseInt(part, 10));
      const anchor = anchorHour * 60 + anchorMinute;
      expect(Math.abs(actual - anchor)).toBeLessThanOrEqual(15);
    }
    expect(byAnchor).toEqual(
      new Map([
        ["09:00", 4],
        ["12:00", 3],
        ["15:00", 3]
      ])
    );
  });

  it("excludes historically successful video-platform pairs", () => {
    const result = generateTaskRows(
      {
        sheetDate: "2026-05-09",
        videoCount: 2,
        platformAccountIds: ["account-0", "account-1"],
        videoStrategy: "low_publish",
        titleStrategy: "best_score",
        defaultTagRatio: 80,
        timeAnchors: ["09:00"],
        jitterMinutes: 0
      },
      {
        videos: [baseVideo(0), baseVideo(1)],
        platformAccounts: [platformAccount(0), platformAccount(1)],
        titles: [title(0, 90)],
        tags: [],
        successfulPairs: new Set(["video-0::account-0"])
      },
      () => 0.5
    );

    expect(result.rows).toHaveLength(3);
    expect(result.rows.map((row) => `${row.videoId}::${row.platformAccountId}`)).not.toContain("video-0::account-0");
  });
});

describe("WorkspaceDatabase task generation", () => {
  it("generates 5 videos x 4 platform accounts into 20 task rows", async () => {
    const root = await makeWorkspaceRoot();
    for (let index = 0; index < 5; index += 1) {
      await writeVideo(root, `videos/SKU-${index}/video-${index}.mp4`);
    }
    const db = await WorkspaceDatabase.open(root);
    await db.scanVideos({
      metadataReader: async () => ({ durationSeconds: 10, width: 1080, height: 1920 })
    });

    const accounts = ["抖音", "视频号", "小红书", "快手"].map((platform) =>
      db.savePlatformAccount({ platform, accountName: `${platform} 主账号`, enabled: true })
    );
    db.saveTitle({ text: "低分标题", score: 10, status: "active" });
    db.saveTitle({ text: "高分标题", score: 95, status: "active" });
    for (let index = 0; index < 5; index += 1) {
      db.saveTag({ skuCode: `SKU-${index}`, tagGroup: "default", tag1: `默认-${index}` });
      db.saveTag({ skuCode: `SKU-${index}`, tagGroup: "test", tag1: `测试-${index}` });
    }

    const sheet = db.generateTaskSheet({
      sheetDate: "2026-05-09",
      videoCount: 5,
      platformAccountIds: accounts.map((account) => account.id),
      videoStrategy: "low_publish",
      titleStrategy: "best_score",
      defaultTagRatio: 80,
      timeAnchors: ["09:00", "12:00", "15:00", "18:00", "21:00"],
      jitterMinutes: 0
    });

    expect(sheet.rows).toHaveLength(20);
    expect(new Set(sheet.rows.map((row) => row.runKey)).size).toBe(20);
    expect(sheet.rows.every((row) => row.titleText === "高分标题" || row.titleText === "低分标题")).toBe(true);
    expect(sheet.rows[0]?.titleText).toBe("高分标题");
    expect(sheet.rows.filter((row) => row.tagGroup === "default")).toHaveLength(16);
    expect(sheet.rows.filter((row) => row.tagGroup === "test")).toHaveLength(4);
    expect(sheet.rows.every((row) => row.publishAt.startsWith("2026-05-09T"))).toBe(true);
    expect(db.getTaskSheetByDate("2026-05-09")?.rows).toHaveLength(20);
    db.close();
  });

  it("exports task sheet Excel, CSV, JSON, preflight and status directory", async () => {
    const root = await makeWorkspaceRoot();
    await writeVideo(root, "videos/SKU-0/video-0.mp4");
    await writeVideo(root, "videos/SKU-1/video-1.mp4");
    const db = await WorkspaceDatabase.open(root);
    await db.scanVideos({
      metadataReader: async () => ({ durationSeconds: 10, width: 1080, height: 1920 })
    });

    const accounts = ["抖音", "视频号"].map((platform) =>
      db.savePlatformAccount({ platform, accountName: `${platform} 主账号`, enabled: true })
    );
    db.saveTitle({ text: "高分标题", score: 95, status: "active" });
    db.saveTag({ skuCode: "SKU-0", tagGroup: "default", tag1: "#默认0" });
    db.saveTag({ skuCode: "SKU-1", tagGroup: "default", tag1: "#默认1" });
    db.generateTaskSheet({
      sheetDate: "2026-05-09",
      videoCount: 2,
      platformAccountIds: accounts.map((account) => account.id),
      videoStrategy: "low_publish",
      titleStrategy: "best_score",
      defaultTagRatio: 100,
      timeAnchors: ["09:00", "12:00"],
      jitterMinutes: 0
    });

    const result = await db.exportTaskSheet({
      sheetDate: "2026-05-09",
      formats: ["xlsx", "csv", "json"],
      targetPlatform: "windows",
      workspaceId: "workspace-1",
      macRootPath: root,
      winRootPath: "D:\\CloudSync\\BrandA"
    });

    expect(result.exportRelativeDir).toBe("tasks/2026-05-09");
    expect(result.writtenFiles).toEqual([
      "tasks/2026-05-09/tasks.xlsx",
      "tasks/2026-05-09/tasks.csv",
      "tasks/2026-05-09/tasks.json",
      "tasks/2026-05-09/preflight.json"
    ]);
    await expect(stat(path.join(root, "tasks/2026-05-09/status"))).resolves.toMatchObject({ isDirectory: expect.any(Function) });

    const csv = await readFile(path.join(root, "tasks/2026-05-09/tasks.csv"), "utf8");
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain("任务ID,任务日期,定时发布时间");
    expect(csv).toContain("D:\\CloudSync\\BrandA\\videos\\SKU-0\\video-0.mp4");

    const json = JSON.parse(await readFile(path.join(root, "tasks/2026-05-09/tasks.json"), "utf8")) as Array<Record<string, unknown>>;
    expect(json).toHaveLength(4);
    expect(json[0]?.video_path).toContain("D:\\CloudSync\\BrandA\\videos\\");

    const preflight = JSON.parse(await readFile(path.join(root, "tasks/2026-05-09/preflight.json"), "utf8")) as {
      schema_version: number;
      target_platform: string;
      items: Array<{ relative_path: string; target_path: string; local_readable: boolean; local_probe: string }>;
    };
    expect(preflight.schema_version).toBe(1);
    expect(preflight.target_platform).toBe("windows");
    expect(preflight.items).toHaveLength(4);
    expect(preflight.items.every((item) => item.local_readable && item.local_probe === "readable")).toBe(true);
    expect(preflight.items[0]?.target_path).toContain("D:\\CloudSync\\BrandA\\videos\\");

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(path.join(root, "tasks/2026-05-09/tasks.xlsx"));
    const worksheet = workbook.getWorksheet("任务单");
    expect(worksheet?.rowCount).toBe(5);
    expect(worksheet?.getCell("A1").value).toBe("任务ID");
    expect(String(worksheet?.getCell("K2").value)).toContain("D:\\CloudSync\\BrandA\\videos\\");
    expect(db.getTaskSheetByDate("2026-05-09")?.status).toBe("exported");
    db.close();
  });

  it("ingests RPA status files idempotently and applies success side effects once", async () => {
    const root = await makeWorkspaceRoot();
    await writeVideo(root, "videos/SKU-0/video-0.mp4");
    const db = await WorkspaceDatabase.open(root);
    await db.scanVideos({
      metadataReader: async () => ({ durationSeconds: 10, width: 1080, height: 1920 })
    });
    const account = db.savePlatformAccount({ platform: "抖音", accountName: "抖音 主账号", enabled: true });
    const savedTitle = db.saveTitle({ text: "高分标题", score: 95, status: "active" });
    db.saveTag({ skuCode: "SKU-0", tagGroup: "default", tag1: "#默认0" });
    const sheet = db.generateTaskSheet({
      sheetDate: "2026-05-09",
      videoCount: 1,
      platformAccountIds: [account.id],
      videoStrategy: "low_publish",
      titleStrategy: "best_score",
      defaultTagRatio: 100,
      timeAnchors: ["09:00"],
      jitterMinutes: 0
    });
    await db.exportTaskSheet({
      sheetDate: "2026-05-09",
      formats: ["json"],
      targetPlatform: "windows",
      workspaceId: "workspace-1",
      macRootPath: root,
      winRootPath: "D:\\CloudSync\\BrandA"
    });

    const row = sheet.rows[0];
    expect(row).toBeDefined();
    await writeFile(
      path.join(root, "tasks/2026-05-09/status/ignored.tmp"),
      "{}"
    );
    await writeFile(
      path.join(root, "tasks/2026-05-09/status/status.json"),
      JSON.stringify({
        schema_version: 1,
        task_id: row?.id,
        attempt_no: row?.attemptNo,
        run_key: row?.runKey,
        status: "success",
        executed_at: "2026-05-09T09:02:00.000Z",
        platform_post_url: "https://example.com/post/1",
        error_code: null,
        error_message: null,
        writer: "yingdao-rpa"
      })
    );

    const firstScan = await db.scanTaskStatusFiles({ sheetDate: "2026-05-09" });
    expect(firstScan).toMatchObject({ scanned: 1, processed: 1, duplicates: 0, ignoredTmp: 1, errors: [] });
    const updatedSheet = db.getTaskSheetByDate("2026-05-09");
    expect(updatedSheet?.rows[0]?.status).toBe("success");
    expect(updatedSheet?.status).toBe("completed");
    expect(db.listVideos()[0]?.status).toBe("used");
    expect(db.listVideos()[0]?.usedCount).toBe(1);
    expect(db.listTitles().find((candidate) => candidate.id === savedTitle.id)?.useCount).toBe(1);

    const duplicateScan = await db.scanTaskStatusFiles({ sheetDate: "2026-05-09" });
    expect(duplicateScan).toMatchObject({ scanned: 1, processed: 0, duplicates: 1, ignoredTmp: 1, errors: [] });
    expect(db.listVideos()[0]?.usedCount).toBe(1);
    expect(db.listTitles().find((candidate) => candidate.id === savedTitle.id)?.useCount).toBe(1);
    db.close();
  });

  it("retries failed task rows with a new attempt and run key while keeping old status files", async () => {
    const root = await makeWorkspaceRoot();
    await writeVideo(root, "videos/SKU-0/video-0.mp4");
    const db = await WorkspaceDatabase.open(root);
    await db.scanVideos({
      metadataReader: async () => ({ durationSeconds: 10, width: 1080, height: 1920 })
    });
    const account = db.savePlatformAccount({ platform: "抖音", accountName: "抖音 主账号", enabled: true });
    db.saveTitle({ text: "高分标题", score: 95, status: "active" });
    const sheet = db.generateTaskSheet({
      sheetDate: "2026-05-09",
      videoCount: 1,
      platformAccountIds: [account.id],
      videoStrategy: "low_publish",
      titleStrategy: "best_score",
      defaultTagRatio: 100,
      timeAnchors: ["09:00"],
      jitterMinutes: 0
    });
    await db.exportTaskSheet({
      sheetDate: "2026-05-09",
      formats: ["json"],
      targetPlatform: "windows",
      workspaceId: "workspace-1",
      macRootPath: root,
      winRootPath: "D:\\CloudSync\\BrandA"
    });
    const row = sheet.rows[0];
    expect(row).toBeDefined();
    const failedStatusPath = path.join(root, `tasks/2026-05-09/status/${row?.runKey}.json`);
    await writeFile(
      failedStatusPath,
      JSON.stringify({
        schema_version: 1,
        task_id: row?.id,
        attempt_no: row?.attemptNo,
        run_key: row?.runKey,
        status: "failed",
        executed_at: "2026-05-09T09:02:00.000Z",
        error_code: "RPA_TIMEOUT",
        error_message: "上传超时",
        writer: "yingdao-rpa"
      })
    );
    await db.scanTaskStatusFiles({ sheetDate: "2026-05-09" });

    const retried = db.retryTaskRow({ taskId: row?.id ?? "" });

    expect(retried.attemptNo).toBe(2);
    expect(retried.runKey).toBe(`${row?.id}__attempt-2`);
    expect(retried.status).toBe("pending");
    expect(retried.errorCode).toBeNull();
    await expect(stat(failedStatusPath)).resolves.toMatchObject({ isFile: expect.any(Function) });
    expect(db.getTaskSheetByDate("2026-05-09")?.status).toBe("exported");
    db.close();
  });

  it("manually marks task rows and applies success side effects once", async () => {
    const root = await makeWorkspaceRoot();
    await writeVideo(root, "videos/SKU-0/video-0.mp4");
    const db = await WorkspaceDatabase.open(root);
    await db.scanVideos({
      metadataReader: async () => ({ durationSeconds: 10, width: 1080, height: 1920 })
    });
    const account = db.savePlatformAccount({ platform: "抖音", accountName: "抖音 主账号", enabled: true });
    const savedTitle = db.saveTitle({ text: "高分标题", score: 95, status: "active" });
    const sheet = db.generateTaskSheet({
      sheetDate: "2026-05-09",
      videoCount: 1,
      platformAccountIds: [account.id],
      videoStrategy: "low_publish",
      titleStrategy: "best_score",
      defaultTagRatio: 100,
      timeAnchors: ["09:00"],
      jitterMinutes: 0
    });
    const row = sheet.rows[0];
    expect(row).toBeDefined();

    const success = db.markTaskRowStatus({ taskId: row?.id ?? "", status: "success" });
    db.markTaskRowStatus({ taskId: row?.id ?? "", status: "success" });

    expect(success.status).toBe("success");
    expect(db.listVideos()[0]?.status).toBe("used");
    expect(db.listVideos()[0]?.usedCount).toBe(1);
    expect(db.listTitles().find((candidate) => candidate.id === savedTitle.id)?.useCount).toBe(1);
    const failed = db.markTaskRowStatus({
      taskId: row?.id ?? "",
      status: "failed",
      errorCode: "MANUAL_FAILED",
      errorMessage: "人工复核失败"
    });
    expect(failed.status).toBe("failed");
    expect(failed.errorCode).toBe("MANUAL_FAILED");
    expect(failed.errorMessage).toBe("人工复核失败");
    expect(db.listVideos()[0]?.usedCount).toBe(1);
    expect(db.listTitles().find((candidate) => candidate.id === savedTitle.id)?.useCount).toBe(1);
    db.close();
  });

  it("edits, adds, deletes, and re-exports task rows with updated values", async () => {
    const root = await makeWorkspaceRoot();
    await writeVideo(root, "videos/SKU-0/video-0.mp4");
    const db = await WorkspaceDatabase.open(root);
    await db.scanVideos({
      metadataReader: async () => ({ durationSeconds: 10, width: 1080, height: 1920 })
    });
    const account = db.savePlatformAccount({ platform: "抖音", accountName: "抖音 主账号", enabled: true });
    db.saveTitle({ text: "高分标题", score: 95, status: "active" });
    const sheet = db.generateTaskSheet({
      sheetDate: "2026-05-09",
      videoCount: 1,
      platformAccountIds: [account.id],
      videoStrategy: "low_publish",
      titleStrategy: "best_score",
      defaultTagRatio: 100,
      timeAnchors: ["09:00"],
      jitterMinutes: 0
    });
    const row = sheet.rows[0];
    expect(row).toBeDefined();

    const updated = db.updateTaskRow({
      taskId: row?.id ?? "",
      publishAt: "2026-05-09T10:30:00",
      titleText: "人工编辑标题",
      tags: ["#A", "#B"]
    });
    expect(updated.publishAt).toBe("2026-05-09T10:30:00");
    expect(updated.titleText).toBe("人工编辑标题");
    expect(updated.tags).toEqual(["#A", "#B"]);

    const added = db.addTaskRow({ sheetDate: "2026-05-09", sourceTaskId: updated.id });
    expect(added.id).not.toBe(updated.id);
    expect(added.titleText).toBe("人工编辑标题");
    expect(db.getTaskSheetByDate("2026-05-09")?.rows).toHaveLength(2);

    const afterDelete = db.deleteTaskRow({ taskId: added.id });
    expect(afterDelete.rows).toHaveLength(1);
    await db.exportTaskSheet({
      sheetDate: "2026-05-09",
      formats: ["json"],
      targetPlatform: "windows",
      workspaceId: "workspace-1",
      macRootPath: root,
      winRootPath: "D:\\CloudSync\\BrandA"
    });
    const exported = JSON.parse(await readFile(path.join(root, "tasks/2026-05-09/tasks.json"), "utf8")) as Array<Record<string, unknown>>;
    expect(exported).toHaveLength(1);
    expect(exported[0]?.title).toBe("人工编辑标题");
    expect(exported[0]?.publish_time).toBe("10:30:00");
    expect(exported[0]?.tag1).toBe("#A");
    expect(exported[0]?.tag2).toBe("#B");
    db.close();
  });

  it("batch replaces selected and full-sheet task titles while clearing manual title overrides", async () => {
    const root = await makeWorkspaceRoot();
    await writeVideo(root, "videos/SKU-0/video-0.mp4");
    const db = await WorkspaceDatabase.open(root);
    await db.scanVideos({
      metadataReader: async () => ({ durationSeconds: 10, width: 1080, height: 1920 })
    });
    const accounts = ["抖音", "视频号"].map((platform) =>
      db.savePlatformAccount({ platform, accountName: `${platform} 主账号`, enabled: true })
    );
    const oldTitle = db.saveTitle({ text: "旧标题", score: 10, status: "active" });
    const sheet = db.generateTaskSheet({
      sheetDate: "2026-05-09",
      videoCount: 1,
      platformAccountIds: accounts.map((account) => account.id),
      videoStrategy: "low_publish",
      titleStrategy: "best_score",
      defaultTagRatio: 100,
      timeAnchors: ["09:00"],
      jitterMinutes: 0
    });
    const [firstRow, secondRow] = sheet.rows;
    expect(firstRow).toBeDefined();
    expect(secondRow).toBeDefined();
    db.updateTaskRow({ taskId: firstRow?.id ?? "", titleText: "人工覆盖标题" });
    const newTitle = db.saveTitle({ text: "新高分标题", score: 95, status: "active" });

    const selectedReplacement = db.batchReplaceTaskTitles({
      sheetDate: "2026-05-09",
      taskIds: [firstRow?.id ?? ""],
      titleStrategy: "best_score"
    });

    const selectedFirst = selectedReplacement.rows.find((row) => row.id === firstRow?.id);
    const selectedSecond = selectedReplacement.rows.find((row) => row.id === secondRow?.id);
    expect(selectedFirst?.titleId).toBe(newTitle.id);
    expect(selectedFirst?.titleText).toBe("新高分标题");
    expect(selectedSecond?.titleId).toBe(oldTitle.id);
    expect(selectedSecond?.titleText).toBe("旧标题");

    db.saveTitle({ titleId: oldTitle.id, text: oldTitle.text, score: oldTitle.score, status: "archived" });
    db.updateTaskRow({ taskId: secondRow?.id ?? "", titleText: "第二行人工覆盖" });
    const fullReplacement = db.batchReplaceTaskTitles({
      sheetDate: "2026-05-09",
      titleStrategy: "best_score"
    });

    expect(fullReplacement.rows).toHaveLength(2);
    expect(fullReplacement.rows.every((row) => row.titleId === newTitle.id)).toBe(true);
    expect(fullReplacement.rows.every((row) => row.titleText === "新高分标题")).toBe(true);
    db.close();
  });
});
