import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ConfigDatabase, WorkspaceDatabase } from "@roster/db";
import { WORKSPACE_DIRECTORIES } from "@roster/shared-types";

const tempRoots: string[] = [];

async function makeTempRoot(prefix: string): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), prefix));
  tempRoots.push(root);
  return root;
}

async function writeVideo(workspaceRoot: string, relativePath: string): Promise<void> {
  const absolutePath = path.join(workspaceRoot, relativePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, `video bytes for ${relativePath}`);
}

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("workspace task flow integration", () => {
  it("creates a workspace, scans videos, exports a task sheet, and ingests RPA status idempotently", async () => {
    const userDataRoot = await makeTempRoot("roster-integration-user-data-");
    const workspaceParent = await makeTempRoot("roster-integration-workspaces-");
    const workspaceRoot = path.join(workspaceParent, "品牌集成测试");
    const configDb = await ConfigDatabase.open(userDataRoot);

    const runtimeState = await configDb.createWorkspace({
      name: "品牌集成测试",
      rootPath: workspaceRoot,
      macRootPath: workspaceRoot,
      winRootPath: "D:\\RosterIntegration\\品牌集成测试"
    });

    expect(runtimeState.activeWorkspaceId).toBeTruthy();
    for (const directory of WORKSPACE_DIRECTORIES) {
      await expect(stat(path.join(workspaceRoot, directory))).resolves.toMatchObject({ isDirectory: expect.any(Function) });
    }
    await expect(stat(path.join(workspaceRoot, "workspace.db"))).resolves.toBeTruthy();
    await expect(stat(path.join(workspaceRoot, "workspace.json"))).resolves.toBeTruthy();
    await expect(stat(path.join(workspaceRoot, "workspace.lock"))).resolves.toBeTruthy();
    await expect(stat(path.join(workspaceRoot, "skills_config", "activation.json"))).resolves.toBeTruthy();

    await writeVideo(workspaceRoot, "videos/SKU-001/style-a/video-1.mp4");
    await writeVideo(workspaceRoot, "videos/SKU-002/video-2.mp4");
    const workspaceDb = await WorkspaceDatabase.open(workspaceRoot);
    const scanSummary = await workspaceDb.scanVideos({
      metadataReader: async () => ({ durationSeconds: 12, width: 1080, height: 1920 })
    });

    expect(scanSummary).toMatchObject({ scanned: 2, added: 2, failedMetadata: 0, placeholders: 0 });
    const videos = workspaceDb.listVideos();
    expect(videos).toHaveLength(2);
    expect(videos.every((video) => video.relativePath.startsWith("videos/"))).toBe(true);
    expect(videos.some((video) => video.sku === "SKU-001" && video.style === "style-a")).toBe(true);

    const accounts = ["抖音", "视频号"].map((platform) =>
      workspaceDb.savePlatformAccount({ platform, accountName: `${platform} 主账号`, enabled: true })
    );
    const title = workspaceDb.saveTitle({ text: "集成测试高分标题", score: 99, status: "active" });
    workspaceDb.saveTag({ skuCode: "SKU-001", skuStyle: "style-a", tagGroup: "default", tag1: "#默认A" });
    workspaceDb.saveTag({ skuCode: "SKU-002", tagGroup: "default", tag1: "#默认B" });

    const sheet = workspaceDb.generateTaskSheet({
      sheetDate: "2026-05-09",
      videoCount: 2,
      platformAccountIds: accounts.map((account) => account.id),
      videoStrategy: "low_publish",
      titleStrategy: "best_score",
      defaultTagRatio: 100,
      timeAnchors: ["09:00", "12:00", "15:00"],
      jitterMinutes: 0
    });

    expect(sheet.rows).toHaveLength(4);
    expect(sheet.rows.every((row) => row.videoRelativePath.startsWith("videos/"))).toBe(true);
    expect(sheet.rows.every((row) => row.titleText === title.text)).toBe(true);

    const exportResult = await workspaceDb.exportTaskSheet({
      sheetDate: "2026-05-09",
      formats: ["xlsx", "csv", "json"],
      targetPlatform: "windows",
      workspaceId: runtimeState.activeWorkspaceId ?? "integration-workspace",
      macRootPath: workspaceRoot,
      winRootPath: "D:\\RosterIntegration\\品牌集成测试"
    });

    expect(exportResult.writtenFiles).toEqual([
      "tasks/2026-05-09/tasks.xlsx",
      "tasks/2026-05-09/tasks.csv",
      "tasks/2026-05-09/tasks.json",
      "tasks/2026-05-09/preflight.json"
    ]);
    await expect(stat(path.join(workspaceRoot, "tasks/2026-05-09/status"))).resolves.toMatchObject({
      isDirectory: expect.any(Function)
    });
    const csv = await readFile(path.join(workspaceRoot, "tasks/2026-05-09/tasks.csv"), "utf8");
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain("D:\\RosterIntegration\\品牌集成测试\\videos\\");
    const exportedJson = JSON.parse(await readFile(path.join(workspaceRoot, "tasks/2026-05-09/tasks.json"), "utf8")) as Array<{
      video_relative_path: string;
      video_path: string;
    }>;
    expect(exportedJson).toHaveLength(4);
    expect(exportedJson.every((row) => row.video_relative_path.startsWith("videos/"))).toBe(true);
    expect(exportedJson.every((row) => row.video_path.startsWith("D:\\RosterIntegration\\品牌集成测试\\videos\\"))).toBe(true);
    const preflight = JSON.parse(await readFile(path.join(workspaceRoot, "tasks/2026-05-09/preflight.json"), "utf8")) as {
      target_platform: string;
      items: Array<{ relative_path: string; target_path: string; local_readable: boolean }>;
    };
    expect(preflight.target_platform).toBe("windows");
    expect(preflight.items).toHaveLength(4);
    expect(preflight.items.every((item) => item.relative_path.startsWith("videos/") && item.local_readable)).toBe(true);

    await expect(
      workspaceDb.exportTaskSheet({
        sheetDate: "2026-05-09",
        formats: ["json"],
        targetPlatform: "windows",
        workspaceId: runtimeState.activeWorkspaceId ?? "integration-workspace",
        macRootPath: workspaceRoot,
        winRootPath: ""
      })
    ).rejects.toThrow("RPA 执行路径");

    const taskRow = sheet.rows[0];
    await writeFile(path.join(workspaceRoot, "tasks/2026-05-09/status/ignored.tmp"), "{}");
    await writeFile(
      path.join(workspaceRoot, "tasks/2026-05-09/status", `${taskRow.runKey}.json`),
      `${JSON.stringify({
        schema_version: 1,
        task_id: taskRow.id,
        attempt_no: taskRow.attemptNo,
        run_key: taskRow.runKey,
        status: "success",
        executed_at: "2026-05-09T09:05:00.000Z",
        error_code: null,
        error_message: null,
        writer: "integration-test"
      })}\n`
    );

    const firstScan = await workspaceDb.scanTaskStatusFiles({ sheetDate: "2026-05-09" });
    expect(firstScan).toMatchObject({ scanned: 1, processed: 1, duplicates: 0, ignoredTmp: 1, errors: [] });
    const afterStatus = workspaceDb.getTaskSheetByDate("2026-05-09");
    expect(afterStatus?.rows.find((row) => row.id === taskRow.id)?.status).toBe("success");
    expect(workspaceDb.listVideos().find((video) => video.id === taskRow.videoId)?.usedCount).toBe(1);
    expect(workspaceDb.listTitles().find((candidate) => candidate.id === title.id)?.useCount).toBe(1);

    const duplicateScan = await workspaceDb.scanTaskStatusFiles({ sheetDate: "2026-05-09" });
    expect(duplicateScan).toMatchObject({ scanned: 1, processed: 0, duplicates: 1, ignoredTmp: 1, errors: [] });
    expect(workspaceDb.listVideos().find((video) => video.id === taskRow.videoId)?.usedCount).toBe(1);
    expect(workspaceDb.listTitles().find((candidate) => candidate.id === title.id)?.useCount).toBe(1);

    workspaceDb.close();
    configDb.close();
  });
});
