import { mkdir, rename, stat, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { access } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import ExcelJS from "exceljs";
import type { TaskExportFormat, TaskExportPreflightItem, TaskRowRecord, TaskSheetRecord } from "@roster/shared-types";
import { resolveWorkspacePath } from "./path-utils";

export interface TaskExportOptions {
  workspaceId: string;
  workspaceRootPath: string;
  macRootPath: string;
  winRootPath: string;
  videoLibraryRootPath?: string;
  videoLibraryMacRootPath?: string;
  videoLibraryWinRootPath?: string;
  sheet: TaskSheetRecord;
  formats: TaskExportFormat[];
}

export interface TaskExportWriteResult {
  exportRelativeDir: string;
  exportAbsoluteDir: string;
  statusRelativeDir: string;
  statusAbsoluteDir: string;
  writtenFiles: string[];
  preflight: {
    schemaVersion: 1;
    generatedOn: "macos" | "windows" | "linux";
    targetPlatform: "windows";
    workspaceId: string;
    taskDate: string;
    items: TaskExportPreflightItem[];
  };
  warnings: string[];
}

interface ExportTaskRow {
  task_id: string;
  task_date: string;
  publish_time: string;
  platform: string;
  account_name: string;
  sku_code: string | null;
  sku_style: string | null;
  product_name: string | null;
  video_file_name: string;
  video_relative_path: string;
  video_path: string;
  cover_relative_path: string | null;
  cover_path: string | null;
  title: string | null;
  tag1: string | null;
  tag2: string | null;
  tag3: string | null;
  tag4: string | null;
  tag5: string | null;
  status: string;
  run_key: string;
  attempt_no: number;
  error_message: string | null;
}

const exportColumns: Array<{ key: keyof ExportTaskRow; zh: string; width: number }> = [
  { key: "task_id", zh: "任务ID", width: 16 },
  { key: "task_date", zh: "任务日期", width: 14 },
  { key: "publish_time", zh: "定时发布时间", width: 14 },
  { key: "platform", zh: "平台", width: 12 },
  { key: "account_name", zh: "平台账号", width: 18 },
  { key: "sku_code", zh: "SKU编码", width: 16 },
  { key: "sku_style", zh: "SKU款式", width: 18 },
  { key: "product_name", zh: "商品名称", width: 20 },
  { key: "video_file_name", zh: "视频文件名", width: 22 },
  { key: "video_relative_path", zh: "视频相对路径", width: 34 },
  { key: "video_path", zh: "视频路径", width: 46 },
  { key: "cover_relative_path", zh: "封面相对路径", width: 34 },
  { key: "cover_path", zh: "封面路径", width: 46 },
  { key: "title", zh: "标题", width: 36 },
  { key: "tag1", zh: "标签1", width: 16 },
  { key: "tag2", zh: "标签2", width: 16 },
  { key: "tag3", zh: "标签3", width: 16 },
  { key: "tag4", zh: "标签4", width: 16 },
  { key: "tag5", zh: "标签5", width: 16 },
  { key: "status", zh: "状态", width: 12 },
  { key: "run_key", zh: "RunKey", width: 34 },
  { key: "attempt_no", zh: "尝试次数", width: 12 },
  { key: "error_message", zh: "错误信息", width: 24 }
];

function currentPlatform(): "macos" | "windows" | "linux" {
  if (process.platform === "darwin") {
    return "macos";
  }
  if (process.platform === "win32") {
    return "windows";
  }
  return "linux";
}

function statusLabel(status: TaskRowRecord["status"]): string {
  const labels: Record<TaskRowRecord["status"], string> = {
    pending: "待执行",
    running: "执行中",
    success: "成功",
    failed: "失败",
    skipped: "跳过"
  };
  return labels[status];
}

function publishTime(value: string): string {
  return value.slice(11, 19) || value;
}

function taskId(row: TaskRowRecord): string {
  return row.id;
}

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  const text = String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replaceAll("\"", "\"\"")}"`;
  }
  return text;
}

function toJsonKey(record: ExportTaskRow): Record<string, unknown> {
  return Object.fromEntries(exportColumns.map((column) => [column.key, record[column.key]]));
}

async function atomicWriteText(filePath: string, content: string): Promise<void> {
  const tempPath = `${filePath}.tmp`;
  await writeFile(tempPath, content, "utf8");
  await rename(tempPath, filePath);
}

async function atomicWriteJson(filePath: string, value: unknown): Promise<void> {
  await atomicWriteText(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function atomicWriteWorkbook(filePath: string, workbook: ExcelJS.Workbook): Promise<void> {
  const tempPath = `${filePath}.tmp`;
  await workbook.xlsx.writeFile(tempPath);
  await rename(tempPath, filePath);
}

async function probePath(absolutePath: string): Promise<{
  expectedSize: number | null;
  mtime: number | null;
  localReadable: boolean;
  localProbe: string;
  warning: string | null;
}> {
  try {
    await access(absolutePath, constants.R_OK);
    const fileStat = await stat(absolutePath);
    if (!fileStat.isFile()) {
      return {
        expectedSize: null,
        mtime: null,
        localReadable: false,
        localProbe: "not_file",
        warning: "本机路径不是文件"
      };
    }
    if (fileStat.size === 0) {
      return {
        expectedSize: fileStat.size,
        mtime: Math.floor(fileStat.mtimeMs / 1000),
        localReadable: false,
        localProbe: "empty_file",
        warning: "文件为空或仍是云盘占位符"
      };
    }
    return {
      expectedSize: fileStat.size,
      mtime: Math.floor(fileStat.mtimeMs / 1000),
      localReadable: true,
      localProbe: "readable",
      warning: null
    };
  } catch (error) {
    return {
      expectedSize: null,
      mtime: null,
      localReadable: false,
      localProbe: "missing_or_unreadable",
      warning: error instanceof Error ? error.message : String(error)
    };
  }
}

function currentDeviceAbsolutePathFor(options: TaskExportOptions, relativePath: string): string {
  const isVideoPath = relativePath === "videos" || relativePath.startsWith("videos/");
  if (isVideoPath && options.videoLibraryRootPath && options.videoLibraryRootPath.trim()) {
    const sub = relativePath.slice("videos/".length);
    return path.join(options.videoLibraryRootPath, sub);
  }
  return path.join(options.workspaceRootPath, relativePath);
}

async function buildPreflightItems(options: TaskExportOptions): Promise<TaskExportPreflightItem[]> {
  const items: TaskExportPreflightItem[] = [];
  for (const row of options.sheet.rows) {
    const paths = [
      { kind: "video" as const, relativePath: row.videoRelativePath },
      ...(row.coverRelativePath ? [{ kind: "cover" as const, relativePath: row.coverRelativePath }] : [])
    ];
    for (const item of paths) {
      const currentDevicePath = currentDeviceAbsolutePathFor(options, item.relativePath);
      const targetPath = resolveWorkspacePath({
        targetPlatform: "windows",
        macRootPath: options.macRootPath,
        winRootPath: options.winRootPath,
        videoLibraryMacRootPath: options.videoLibraryMacRootPath,
        videoLibraryWinRootPath: options.videoLibraryWinRootPath,
        relativePath: item.relativePath
      });
      const probe = await probePath(currentDevicePath);
      items.push({
        taskId: taskId(row),
        relativePath: item.relativePath,
        targetPath,
        currentDevicePath,
        kind: item.kind,
        expectedSize: probe.expectedSize,
        mtime: probe.mtime,
        localReadable: probe.localReadable,
        localProbe: probe.localProbe,
        warning: probe.warning
      });
    }
  }
  return items;
}

function toExportRows(options: TaskExportOptions): ExportTaskRow[] {
  return options.sheet.rows.map((row) => {
    const videoPath = resolveWorkspacePath({
      targetPlatform: "windows",
      macRootPath: options.macRootPath,
      winRootPath: options.winRootPath,
      videoLibraryMacRootPath: options.videoLibraryMacRootPath,
      videoLibraryWinRootPath: options.videoLibraryWinRootPath,
      relativePath: row.videoRelativePath
    });
    const coverPath = row.coverRelativePath
      ? resolveWorkspacePath({
          targetPlatform: "windows",
          macRootPath: options.macRootPath,
          winRootPath: options.winRootPath,
          relativePath: row.coverRelativePath
        })
      : null;

    return {
      task_id: taskId(row),
      task_date: row.sheetDate,
      publish_time: publishTime(row.publishAt),
      platform: row.platform,
      account_name: row.accountName,
      sku_code: row.sku,
      sku_style: row.style,
      product_name: null,
      video_file_name: row.videoFileName,
      video_relative_path: row.videoRelativePath,
      video_path: videoPath,
      cover_relative_path: row.coverRelativePath,
      cover_path: coverPath,
      title: row.titleText,
      tag1: row.tags[0] ?? null,
      tag2: row.tags[1] ?? null,
      tag3: row.tags[2] ?? null,
      tag4: row.tags[3] ?? null,
      tag5: row.tags[4] ?? null,
      status: statusLabel(row.status),
      run_key: row.runKey,
      attempt_no: row.attemptNo,
      error_message: row.errorMessage
    };
  });
}

async function writeCsv(filePath: string, rows: ExportTaskRow[]): Promise<void> {
  const header = exportColumns.map((column) => column.zh).join(",");
  const body = rows.map((row) => exportColumns.map((column) => csvEscape(row[column.key])).join(","));
  await atomicWriteText(filePath, `\uFEFF${[header, ...body].join("\n")}\n`);
}

async function writeJson(filePath: string, rows: ExportTaskRow[]): Promise<void> {
  await atomicWriteJson(filePath, rows.map((row) => toJsonKey(row)));
}

async function writeXlsx(filePath: string, rows: ExportTaskRow[]): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "短视频运营工作台";
  workbook.created = new Date();
  const worksheet = workbook.addWorksheet("任务单");
  worksheet.columns = exportColumns.map((column) => ({
    header: column.zh,
    key: column.key,
    width: column.width
  }));
  worksheet.addRows(rows.map((row) => toJsonKey(row)));
  worksheet.getRow(1).font = { bold: true };
  worksheet.views = [{ state: "frozen", ySplit: 1 }];
  await atomicWriteWorkbook(filePath, workbook);
}

export async function exportTaskSheetFiles(options: TaskExportOptions): Promise<TaskExportWriteResult> {
  const exportRelativeDir = `tasks/${options.sheet.sheetDate}`;
  const statusRelativeDir = `${exportRelativeDir}/status`;
  const exportAbsoluteDir = path.join(options.workspaceRootPath, exportRelativeDir);
  const statusAbsoluteDir = path.join(options.workspaceRootPath, statusRelativeDir);
  await mkdir(statusAbsoluteDir, { recursive: true });

  const rows = toExportRows(options);
  const preflightItems = await buildPreflightItems(options);
  const preflight = {
    schemaVersion: 1 as const,
    generatedOn: currentPlatform(),
    targetPlatform: "windows" as const,
    workspaceId: options.workspaceId,
    taskDate: options.sheet.sheetDate,
    items: preflightItems
  };
  const writtenFiles: string[] = [];
  const normalizedFormats = new Set(options.formats);

  if (normalizedFormats.has("xlsx")) {
    await writeXlsx(path.join(exportAbsoluteDir, "tasks.xlsx"), rows);
    writtenFiles.push(`${exportRelativeDir}/tasks.xlsx`);
  }
  if (normalizedFormats.has("csv")) {
    await writeCsv(path.join(exportAbsoluteDir, "tasks.csv"), rows);
    writtenFiles.push(`${exportRelativeDir}/tasks.csv`);
  }
  if (normalizedFormats.has("json")) {
    await writeJson(path.join(exportAbsoluteDir, "tasks.json"), rows);
    writtenFiles.push(`${exportRelativeDir}/tasks.json`);
  }

  await atomicWriteJson(path.join(exportAbsoluteDir, "preflight.json"), {
    schema_version: preflight.schemaVersion,
    generated_on: preflight.generatedOn,
    target_platform: preflight.targetPlatform,
    workspace_id: preflight.workspaceId,
    task_date: preflight.taskDate,
    items: preflight.items.map((item) => ({
      task_id: item.taskId,
      relative_path: item.relativePath,
      target_path: item.targetPath,
      current_device_path: item.currentDevicePath,
      kind: item.kind,
      expected_size: item.expectedSize,
      mtime: item.mtime,
      local_readable: item.localReadable,
      local_probe: item.localProbe,
      warning: item.warning
    })),
    generated_by: os.hostname()
  });
  writtenFiles.push(`${exportRelativeDir}/preflight.json`);

  return {
    exportRelativeDir,
    exportAbsoluteDir,
    statusRelativeDir,
    statusAbsoluteDir,
    writtenFiles,
    preflight,
    warnings: preflightItems.filter((item) => item.warning).map((item) => `${item.relativePath}: ${item.warning}`)
  };
}
