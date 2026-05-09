import { mkdir, readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import {
  ApiCallLogSaveInputSchema,
  ImageScenePresetSaveInputSchema,
  ImageSaveInputSchema,
  ImageSoftDeleteInputSchema,
  PlatformAccountSaveInputSchema,
  PromptSaveInputSchema,
  RpaStatusFileSchema,
  ScheduledJobSaveInputSchema,
  ScheduledJobToggleInputSchema,
  ScriptSaveInputSchema,
  TagGroupSchema,
  TagSaveInputSchema,
  TaskStatusScanInputSchema,
  TaskRetryInputSchema,
  TaskManualStatusInputSchema,
  TaskRowUpdateInputSchema,
  TaskRowDeleteInputSchema,
  TaskRowAddInputSchema,
  TaskBatchReplaceTitlesInputSchema,
  TaskGenerateInputSchema,
  TaskExportInputSchema,
  TitleSaveInputSchema,
  VideoBatchUpdateInputSchema,
  VideoUpdateInputSchema,
  type ApiCallLogSaveInput,
  type ImageRecord,
  type ImageSceneAspectRatio,
  type ImageSceneOutputSubdir,
  type ImageScenePreset,
  type ImageScenePresetSaveInput,
  type ImageSaveInput,
  type ImageSoftDeleteInput,
  type ImageStatus,
  type PlatformAccountRecord,
  type PlatformAccountSaveInput,
  type PromptRecord,
  type PromptSaveInput,
  type PromptStatus,
  type ScriptRecord,
  type ScriptSaveInput,
  type ScriptStatus,
  type ScheduledJobRecord,
  type ScheduledJobMissedRunPolicy,
  type ScheduledJobRunRecord,
  type ScheduledJobRunStatus,
  type ScheduledJobSaveInput,
  type ScheduledJobStatus,
  type ScheduledJobToggleInput,
  type ScheduledJobType,
  type TagGroup,
  type TagImportSummary,
  type TagRecord,
  type TagSaveInput,
  type TaskGenerateInput,
  type TaskExportInput,
  type TaskExportResult,
  type TaskStatusScanInput,
  type TaskStatusScanResult,
  type TaskRetryInput,
  type TaskManualStatusInput,
  type TaskRowUpdateInput,
  type TaskRowDeleteInput,
  type TaskRowAddInput,
  type TaskBatchReplaceTitlesInput,
  type TaskTitleStrategy,
  type TaskRowRecord,
  type TaskRowStatus,
  type TaskSheetRecord,
  type TaskSheetStatus,
  type TitleRecord,
  type TitleSaveInput,
  type TitleStatus,
  type VideoMetadata,
  type VideoRecord,
  type VideoBatchUpdateInput,
  type VideoScanSummary,
  type VideoStatus,
  type VideoUpdateInput
} from "@roster/shared-types";
import { applySqlMigrations, openSqliteDatabase, type SqliteDatabase } from "./sqlite";
import { WORKSPACE_MIGRATIONS } from "./schema";
import { toWorkspaceRelativePath } from "./path-utils";
import { exportTaskSheetFiles } from "./task-exporter";
import { generateTaskRows } from "./task-generator";

const SUPPORTED_VIDEO_EXTENSIONS = new Set([".mp4", ".mov", ".avi", ".mkv", ".flv"]);

type VideoMetadataReader = (absolutePath: string) => Promise<VideoMetadata>;
type ThumbnailGenerator = (input: { videoId: string; videoAbsolutePath: string; relativePath: string }) => Promise<string>;

export interface ScheduledJobDueRun {
  job: ScheduledJobRecord;
  scheduledAt: string;
}

export interface ScheduledJobDuePlan {
  job: ScheduledJobRecord;
  runTimes: string[];
  skippedTimes: string[];
  nextRunAt: string | null;
}

export interface ScheduledJobRunSaveInput {
  jobId: string;
  status: ScheduledJobRunStatus;
  startedAt: string;
  finishedAt?: string | null;
  durationMs?: number | null;
  artifactSummary?: string | null;
  errorMessage?: string | null;
}

export interface ScheduledJobExecutionResult {
  status: ScheduledJobRunStatus;
  artifactSummary?: string | null;
  errorMessage?: string | null;
}

export type ScheduledJobExecutor = (run: ScheduledJobDueRun) => ScheduledJobExecutionResult;

interface TagRow {
  id: string;
  sku_code: string;
  sku_style: string;
  tag1: string | null;
  tag2: string | null;
  tag3: string | null;
  tag4: string | null;
  tag5: string | null;
  tag_group: string;
  use_count: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface TitleRow {
  id: string;
  text: string;
  source_skill_id: string | null;
  score: number | null;
  use_count: number;
  status: string;
  notes: string | null;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
}

interface PromptRow {
  id: string;
  text: string;
  scene: string;
  generated_count: number;
  kept_count: number;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface ImageRow {
  id: string;
  prompt_id: string | null;
  relative_path: string;
  file_name: string | null;
  scene: string;
  width: number | null;
  height: number | null;
  aspect_ratio: string | null;
  source_model: string | null;
  status: string;
  tags: string | null;
  notes: string | null;
  generated_at: string | null;
  created_at: string;
  updated_at: string;
}

interface ImageScenePresetRow {
  id: string;
  name: string;
  skill_id: string | null;
  default_aspect_ratio: string;
  default_per_prompt_count: number;
  default_output_subdir: string;
  default_image_model: string;
  created_at: string;
  updated_at: string;
}

interface PlatformAccountRow {
  id: string;
  platform: string;
  account_name: string;
  enabled: number;
  created_at: string;
  updated_at: string;
}

interface TaskSheetRow {
  id: string;
  sheet_date: string;
  name: string;
  status: string;
  export_relative_dir: string | null;
  created_at: string;
  updated_at: string;
}

interface TaskRowRow {
  id: string;
  sheet_id: string;
  run_key: string;
  attempt_no: number;
  video_id: string;
  title_id: string | null;
  platform_account_id: string;
  publish_at: string;
  status: string;
  video_relative_path: string;
  cover_relative_path: string | null;
  created_at: string;
  updated_at: string;
  sheet_date: string;
  video_file_name: string | null;
  sku: string | null;
  style: string | null;
  platform: string;
  account_name: string;
  title_text: string | null;
  title_text_override: string | null;
  tag_group: string | null;
  tag1: string | null;
  tag2: string | null;
  tag3: string | null;
  tag4: string | null;
  tag5: string | null;
  error_code: string | null;
  error_message: string | null;
}

interface ScriptRow {
  id: string;
  text: string;
  source_skill_id: string | null;
  sku_code: string | null;
  use_count: number;
  status: string;
  notes: string | null;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
}

interface VideoRow {
  id: string;
  relative_path: string;
  file_name: string | null;
  sku: string | null;
  style: string | null;
  duration_seconds: number | null;
  width: number | null;
  height: number | null;
  size_bytes: number | null;
  status: string;
  thumbnail_relative_path: string | null;
  cover_relative_path: string | null;
  has_cover: number;
  used_count: number;
  note: string | null;
  metadata_error: string | null;
  last_scanned_at: string | null;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
}

interface ScheduledJobRow {
  id: string;
  name: string;
  type: string;
  status: string;
  schedule_label: string;
  next_run_at: string | null;
  missed_run_policy: string;
  target_page: string;
  last_run_status: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

interface ScheduledJobRunRow {
  id: string;
  job_id: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  artifact_summary: string | null;
  error_message: string | null;
}

interface ScannedVideo {
  absolutePath: string;
  relativePath: string;
  fileName: string;
  sku: string | null;
  style: string | null;
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
  sizeBytes: number;
  status: VideoStatus;
  metadataError: string | null;
}

function nowIso(): string {
  return new Date().toISOString();
}

function rowString(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  if (typeof value !== "string") {
    throw new Error(`Invalid SQLite row: ${key} is not a string`);
  }
  return value;
}

function rowOptionalString(row: Record<string, unknown>, key: string): string | null {
  const value = row[key];
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== "string") {
    throw new Error(`Invalid SQLite row: ${key} is not a nullable string`);
  }
  return value;
}

function rowNumber(row: Record<string, unknown>, key: string): number {
  const value = row[key];
  if (typeof value !== "number") {
    throw new Error(`Invalid SQLite row: ${key} is not a number`);
  }
  return value;
}

function rowOptionalNumber(row: Record<string, unknown>, key: string): number | null {
  const value = row[key];
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== "number") {
    throw new Error(`Invalid SQLite row: ${key} is not a nullable number`);
  }
  return value;
}

function coerceVideoRow(row: Record<string, unknown>): VideoRow {
  return {
    id: rowString(row, "id"),
    relative_path: rowString(row, "relative_path"),
    file_name: rowOptionalString(row, "file_name"),
    sku: rowOptionalString(row, "sku"),
    style: rowOptionalString(row, "style"),
    duration_seconds: rowOptionalNumber(row, "duration_seconds"),
    width: rowOptionalNumber(row, "width"),
    height: rowOptionalNumber(row, "height"),
    size_bytes: rowOptionalNumber(row, "size_bytes"),
    status: rowString(row, "status"),
    thumbnail_relative_path: rowOptionalString(row, "thumbnail_relative_path"),
    cover_relative_path: rowOptionalString(row, "cover_relative_path"),
    has_cover: rowNumber(row, "has_cover"),
    used_count: rowNumber(row, "used_count"),
    note: rowOptionalString(row, "note"),
    metadata_error: rowOptionalString(row, "metadata_error"),
    last_scanned_at: rowOptionalString(row, "last_scanned_at"),
    last_used_at: rowOptionalString(row, "last_used_at"),
    created_at: rowString(row, "created_at"),
    updated_at: rowString(row, "updated_at")
  };
}

function mapVideoRow(row: VideoRow): VideoRecord {
  return {
    id: row.id,
    relativePath: row.relative_path,
    fileName: row.file_name ?? path.basename(row.relative_path),
    sku: row.sku,
    style: row.style,
    durationSeconds: row.duration_seconds,
    width: row.width,
    height: row.height,
    sizeBytes: row.size_bytes,
    status: row.status as VideoStatus,
    thumbnailRelativePath: row.thumbnail_relative_path,
    coverRelativePath: row.cover_relative_path,
    hasCover: row.has_cover === 1,
    usedCount: row.used_count,
    note: row.note,
    metadataError: row.metadata_error,
    lastScannedAt: row.last_scanned_at,
    lastUsedAt: row.last_used_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function coerceScheduledJobRow(row: Record<string, unknown>): ScheduledJobRow {
  return {
    id: rowString(row, "id"),
    name: rowString(row, "name"),
    type: rowString(row, "type"),
    status: rowString(row, "status"),
    schedule_label: rowString(row, "schedule_label"),
    next_run_at: rowOptionalString(row, "next_run_at"),
    missed_run_policy: rowOptionalString(row, "missed_run_policy") ?? "catch_up_last",
    target_page: rowString(row, "target_page"),
    last_run_status: rowOptionalString(row, "last_run_status"),
    last_error: rowOptionalString(row, "last_error"),
    created_at: rowString(row, "created_at"),
    updated_at: rowString(row, "updated_at")
  };
}

function mapScheduledJobRow(row: ScheduledJobRow): ScheduledJobRecord {
  return {
    id: row.id,
    name: row.name,
    type: row.type as ScheduledJobType,
    status: row.status as ScheduledJobStatus,
    scheduleLabel: row.schedule_label,
    nextRunAt: row.next_run_at,
    missedRunPolicy: row.missed_run_policy as ScheduledJobMissedRunPolicy,
    targetPage: row.target_page,
    lastRunStatus: row.last_run_status as ScheduledJobRunStatus | null,
    lastError: row.last_error,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function coerceScheduledJobRunRow(row: Record<string, unknown>): ScheduledJobRunRow {
  return {
    id: rowString(row, "id"),
    job_id: rowString(row, "job_id"),
    status: rowString(row, "status"),
    started_at: rowString(row, "started_at"),
    finished_at: rowOptionalString(row, "finished_at"),
    duration_ms: rowOptionalNumber(row, "duration_ms"),
    artifact_summary: rowOptionalString(row, "artifact_summary"),
    error_message: rowOptionalString(row, "error_message")
  };
}

function mapScheduledJobRunRow(row: ScheduledJobRunRow): ScheduledJobRunRecord {
  return {
    id: row.id,
    jobId: row.job_id,
    status: row.status as ScheduledJobRunStatus,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    durationMs: row.duration_ms,
    artifactSummary: row.artifact_summary,
    errorMessage: row.error_message
  };
}

function calculateNextRunAt(scheduleLabel: string, fromIso: string): string | null {
  const from = new Date(fromIso);
  const secondsMatch = scheduleLabel.match(/每\s*(\d+)\s*秒/);
  if (secondsMatch) {
    from.setSeconds(from.getSeconds() + Number(secondsMatch[1]));
    return from.toISOString();
  }
  const dailyMatch = scheduleLabel.match(/每天\s*(\d{1,2}):(\d{2})/);
  if (dailyMatch) {
    const next = new Date(from);
    next.setHours(Number(dailyMatch[1]), Number(dailyMatch[2]), 0, 0);
    if (next <= from) {
      next.setDate(next.getDate() + 1);
    }
    return next.toISOString();
  }
  return null;
}

function collectDueScheduleTimes(
  scheduleLabel: string,
  nextRunAt: string,
  nowIsoValue: string,
  missedRunPolicy: ScheduledJobMissedRunPolicy
): { runTimes: string[]; skippedTimes: string[]; nextRunAt: string | null } {
  const dueTimes: string[] = [];
  let cursor: string | null = nextRunAt;
  for (let guard = 0; cursor && cursor <= nowIsoValue && guard < 100; guard += 1) {
    dueTimes.push(cursor);
    cursor = calculateNextRunAt(scheduleLabel, cursor);
  }

  if (dueTimes.length === 0) {
    return { runTimes: [], skippedTimes: [], nextRunAt: cursor };
  }

  if (missedRunPolicy === "skip") {
    return { runTimes: [], skippedTimes: dueTimes, nextRunAt: cursor };
  }

  if (missedRunPolicy === "catch_up_all") {
    return { runTimes: dueTimes, skippedTimes: [], nextRunAt: cursor };
  }

  return {
    runTimes: [dueTimes[dueTimes.length - 1]],
    skippedTimes: dueTimes.slice(0, -1),
    nextRunAt: cursor
  };
}

const scheduledJobExpectedTargetPages: Record<ScheduledJobType, string> = {
  task_sheet: "tasks",
  title_generation: "titles",
  image_generation: "images",
  script_generation: "scripts"
};

function resolveScheduledJobRunResult(job: ScheduledJobRow): {
  status: ScheduledJobRunStatus;
  artifactSummary: string | null;
  errorMessage: string | null;
} {
  const jobType = job.type as ScheduledJobType;
  const expectedTargetPage = scheduledJobExpectedTargetPages[jobType];
  if (!expectedTargetPage || job.target_page !== expectedTargetPage) {
    return {
      status: "failed",
      artifactSummary: null,
      errorMessage: `定时任务配置无效：${job.name} 应进入 ${expectedTargetPage ?? "有效工作区"}，当前为 ${job.target_page}`
    };
  }
  if (jobType !== "task_sheet") {
    return {
      status: "skipped",
      artifactSummary: `已跳过 ${job.name}；该类型执行器尚未接入`,
      errorMessage: null
    };
  }
  return {
    status: "success",
    artifactSummary: `已触发 ${job.name}；v1 调度器记录运行，具体工作流配置在 ${job.target_page}`,
    errorMessage: null
  };
}

function defaultScheduledJobExecutor(run: ScheduledJobDueRun): ScheduledJobExecutionResult {
  const job = {
    id: run.job.id,
    name: run.job.name,
    type: run.job.type,
    status: run.job.status,
    schedule_label: run.job.scheduleLabel,
    next_run_at: run.job.nextRunAt,
    missed_run_policy: run.job.missedRunPolicy,
    target_page: run.job.targetPage,
    last_run_status: run.job.lastRunStatus,
    last_error: run.job.lastError,
    created_at: run.job.createdAt,
    updated_at: run.job.updatedAt
  };
  return resolveScheduledJobRunResult(job);
}

function coerceTagRow(row: Record<string, unknown>): TagRow {
  return {
    id: rowString(row, "id"),
    sku_code: rowString(row, "sku_code"),
    sku_style: rowString(row, "sku_style"),
    tag1: rowOptionalString(row, "tag1"),
    tag2: rowOptionalString(row, "tag2"),
    tag3: rowOptionalString(row, "tag3"),
    tag4: rowOptionalString(row, "tag4"),
    tag5: rowOptionalString(row, "tag5"),
    tag_group: rowString(row, "tag_group"),
    use_count: rowNumber(row, "use_count"),
    notes: rowOptionalString(row, "notes"),
    created_at: rowString(row, "created_at"),
    updated_at: rowString(row, "updated_at")
  };
}

function mapTagRow(row: TagRow): TagRecord {
  return {
    id: row.id,
    skuCode: row.sku_code,
    skuStyle: row.sku_style || null,
    tag1: row.tag1,
    tag2: row.tag2,
    tag3: row.tag3,
    tag4: row.tag4,
    tag5: row.tag5,
    tagGroup: TagGroupSchema.parse(row.tag_group),
    useCount: row.use_count,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function coerceTitleRow(row: Record<string, unknown>): TitleRow {
  return {
    id: rowString(row, "id"),
    text: rowString(row, "text"),
    source_skill_id: rowOptionalString(row, "source_skill_id"),
    score: rowOptionalNumber(row, "score"),
    use_count: rowNumber(row, "use_count"),
    status: rowString(row, "status"),
    notes: rowOptionalString(row, "notes"),
    last_used_at: rowOptionalString(row, "last_used_at"),
    created_at: rowString(row, "created_at"),
    updated_at: rowString(row, "updated_at")
  };
}

function mapTitleRow(row: TitleRow): TitleRecord {
  return {
    id: row.id,
    text: row.text,
    sourceSkillId: row.source_skill_id,
    score: row.score,
    useCount: row.use_count,
    status: row.status as TitleStatus,
    notes: row.notes,
    lastUsedAt: row.last_used_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function coercePromptRow(row: Record<string, unknown>): PromptRow {
  return {
    id: rowString(row, "id"),
    text: rowString(row, "text"),
    scene: rowString(row, "scene"),
    generated_count: rowNumber(row, "generated_count"),
    kept_count: rowNumber(row, "kept_count"),
    status: rowString(row, "status"),
    notes: rowOptionalString(row, "notes"),
    created_at: rowString(row, "created_at"),
    updated_at: rowString(row, "updated_at")
  };
}

function mapPromptRow(row: PromptRow): PromptRecord {
  return {
    id: row.id,
    text: row.text,
    scene: row.scene,
    generatedCount: row.generated_count,
    keptCount: row.kept_count,
    status: row.status as PromptStatus,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function coerceImageRow(row: Record<string, unknown>): ImageRow {
  return {
    id: rowString(row, "id"),
    prompt_id: rowOptionalString(row, "prompt_id"),
    relative_path: rowString(row, "relative_path"),
    file_name: rowOptionalString(row, "file_name"),
    scene: rowString(row, "scene"),
    width: rowOptionalNumber(row, "width"),
    height: rowOptionalNumber(row, "height"),
    aspect_ratio: rowOptionalString(row, "aspect_ratio"),
    source_model: rowOptionalString(row, "source_model"),
    status: rowString(row, "status"),
    tags: rowOptionalString(row, "tags"),
    notes: rowOptionalString(row, "notes"),
    generated_at: rowOptionalString(row, "generated_at"),
    created_at: rowString(row, "created_at"),
    updated_at: rowString(row, "updated_at")
  };
}

function mapImageRow(row: ImageRow): ImageRecord {
  return {
    id: row.id,
    promptId: row.prompt_id,
    relativePath: row.relative_path,
    fileName: row.file_name ?? path.posix.basename(row.relative_path),
    scene: row.scene,
    width: row.width,
    height: row.height,
    aspectRatio: row.aspect_ratio,
    sourceModel: row.source_model,
    status: row.status as ImageStatus,
    tags: row.tags,
    notes: row.notes,
    generatedAt: row.generated_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function coerceImageScenePresetRow(row: Record<string, unknown>): ImageScenePresetRow {
  return {
    id: rowString(row, "id"),
    name: rowString(row, "name"),
    skill_id: rowOptionalString(row, "skill_id"),
    default_aspect_ratio: rowString(row, "default_aspect_ratio"),
    default_per_prompt_count: rowNumber(row, "default_per_prompt_count"),
    default_output_subdir: rowString(row, "default_output_subdir"),
    default_image_model: rowString(row, "default_image_model"),
    created_at: rowString(row, "created_at"),
    updated_at: rowString(row, "updated_at")
  };
}

const BUILTIN_IMAGE_SCENE_PRESETS: ImageScenePreset[] = [
  {
    id: "builtin-video-cover",
    name: "视频封面",
    skillId: null,
    defaultAspectRatio: "3:4",
    defaultPerPromptCount: 2,
    defaultOutputSubdir: "live_cover",
    defaultImageModel: "mock-image",
    isBuiltin: true,
    createdAt: "1970-01-01T00:00:00.000Z",
    updatedAt: "1970-01-01T00:00:00.000Z"
  },
  {
    id: "builtin-live-cover",
    name: "直播封面",
    skillId: null,
    defaultAspectRatio: "9:16",
    defaultPerPromptCount: 2,
    defaultOutputSubdir: "live_cover",
    defaultImageModel: "mock-image",
    isBuiltin: true,
    createdAt: "1970-01-01T00:00:00.000Z",
    updatedAt: "1970-01-01T00:00:00.000Z"
  },
  {
    id: "builtin-main",
    name: "主图",
    skillId: null,
    defaultAspectRatio: "1:1",
    defaultPerPromptCount: 2,
    defaultOutputSubdir: "main",
    defaultImageModel: "mock-image",
    isBuiltin: true,
    createdAt: "1970-01-01T00:00:00.000Z",
    updatedAt: "1970-01-01T00:00:00.000Z"
  },
  {
    id: "builtin-sku",
    name: "SKU素材",
    skillId: null,
    defaultAspectRatio: "1:1",
    defaultPerPromptCount: 2,
    defaultOutputSubdir: "main",
    defaultImageModel: "mock-image",
    isBuiltin: true,
    createdAt: "1970-01-01T00:00:00.000Z",
    updatedAt: "1970-01-01T00:00:00.000Z"
  },
  {
    id: "builtin-detail",
    name: "详情页",
    skillId: null,
    defaultAspectRatio: "16:9",
    defaultPerPromptCount: 2,
    defaultOutputSubdir: "detail",
    defaultImageModel: "mock-image",
    isBuiltin: true,
    createdAt: "1970-01-01T00:00:00.000Z",
    updatedAt: "1970-01-01T00:00:00.000Z"
  },
  {
    id: "builtin-composite",
    name: "拼接",
    skillId: null,
    defaultAspectRatio: "16:9",
    defaultPerPromptCount: 2,
    defaultOutputSubdir: "detail",
    defaultImageModel: "mock-image",
    isBuiltin: true,
    createdAt: "1970-01-01T00:00:00.000Z",
    updatedAt: "1970-01-01T00:00:00.000Z"
  }
];

function mapImageScenePresetRow(row: ImageScenePresetRow): ImageScenePreset {
  return {
    id: row.id,
    name: row.name,
    skillId: row.skill_id,
    defaultAspectRatio: row.default_aspect_ratio as ImageSceneAspectRatio,
    defaultPerPromptCount: row.default_per_prompt_count,
    defaultOutputSubdir: row.default_output_subdir as ImageSceneOutputSubdir,
    defaultImageModel: row.default_image_model,
    isBuiltin: false,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function coercePlatformAccountRow(row: Record<string, unknown>): PlatformAccountRow {
  return {
    id: rowString(row, "id"),
    platform: rowString(row, "platform"),
    account_name: rowString(row, "account_name"),
    enabled: rowNumber(row, "enabled"),
    created_at: rowString(row, "created_at"),
    updated_at: rowString(row, "updated_at")
  };
}

function mapPlatformAccountRow(row: PlatformAccountRow): PlatformAccountRecord {
  return {
    id: row.id,
    platform: row.platform,
    accountName: row.account_name,
    enabled: row.enabled === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function coerceTaskSheetRow(row: Record<string, unknown>): TaskSheetRow {
  return {
    id: rowString(row, "id"),
    sheet_date: rowString(row, "sheet_date"),
    name: rowString(row, "name"),
    status: rowString(row, "status"),
    export_relative_dir: rowOptionalString(row, "export_relative_dir"),
    created_at: rowString(row, "created_at"),
    updated_at: rowString(row, "updated_at")
  };
}

function coerceTaskRowRow(row: Record<string, unknown>): TaskRowRow {
  return {
    id: rowString(row, "id"),
    sheet_id: rowString(row, "sheet_id"),
    run_key: rowString(row, "run_key"),
    attempt_no: rowNumber(row, "attempt_no"),
    video_id: rowString(row, "video_id"),
    title_id: rowOptionalString(row, "title_id"),
    platform_account_id: rowString(row, "platform_account_id"),
    publish_at: rowString(row, "publish_at"),
    status: rowString(row, "status"),
    video_relative_path: rowString(row, "video_relative_path"),
    cover_relative_path: rowOptionalString(row, "cover_relative_path"),
    created_at: rowString(row, "created_at"),
    updated_at: rowString(row, "updated_at"),
    sheet_date: rowString(row, "sheet_date"),
    video_file_name: rowOptionalString(row, "video_file_name"),
    sku: rowOptionalString(row, "sku"),
    style: rowOptionalString(row, "style"),
    platform: rowString(row, "platform"),
    account_name: rowString(row, "account_name"),
    title_text: rowOptionalString(row, "title_text"),
    title_text_override: rowOptionalString(row, "title_text_override"),
    tag_group: rowOptionalString(row, "tag_group"),
    tag1: rowOptionalString(row, "tag1"),
    tag2: rowOptionalString(row, "tag2"),
    tag3: rowOptionalString(row, "tag3"),
    tag4: rowOptionalString(row, "tag4"),
    tag5: rowOptionalString(row, "tag5"),
    error_code: rowOptionalString(row, "error_code"),
    error_message: rowOptionalString(row, "error_message")
  };
}

function mapTaskRowRow(row: TaskRowRow): TaskRowRecord {
  return {
    id: row.id,
    sheetId: row.sheet_id,
    runKey: row.run_key,
    attemptNo: row.attempt_no,
    sheetDate: row.sheet_date,
    publishAt: row.publish_at,
    status: row.status as TaskRowStatus,
    videoId: row.video_id,
    videoRelativePath: row.video_relative_path,
    videoFileName: row.video_file_name ?? path.posix.basename(row.video_relative_path),
    sku: row.sku,
    style: row.style,
    platformAccountId: row.platform_account_id,
    platform: row.platform,
    accountName: row.account_name,
    titleId: row.title_id,
    titleText: row.title_text_override ?? row.title_text,
    tagGroup: row.tag_group === "test" ? "test" : "default",
    tags: [row.tag1, row.tag2, row.tag3, row.tag4, row.tag5].filter((tag): tag is string => Boolean(tag)),
    coverRelativePath: row.cover_relative_path,
    errorCode: row.error_code,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapTaskSheetRow(row: TaskSheetRow, rows: TaskRowRecord[]): TaskSheetRecord {
  return {
    id: row.id,
    sheetDate: row.sheet_date,
    name: row.name,
    status: row.status as TaskSheetStatus,
    exportRelativeDir: row.export_relative_dir,
    rows,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function coerceScriptRow(row: Record<string, unknown>): ScriptRow {
  return {
    id: rowString(row, "id"),
    text: rowString(row, "text"),
    source_skill_id: rowOptionalString(row, "source_skill_id"),
    sku_code: rowOptionalString(row, "sku_code"),
    use_count: rowNumber(row, "use_count"),
    status: rowString(row, "status"),
    notes: rowOptionalString(row, "notes"),
    last_used_at: rowOptionalString(row, "last_used_at"),
    created_at: rowString(row, "created_at"),
    updated_at: rowString(row, "updated_at")
  };
}

function mapScriptRow(row: ScriptRow): ScriptRecord {
  return {
    id: row.id,
    text: row.text,
    sourceSkillId: row.source_skill_id,
    skuCode: row.sku_code,
    useCount: row.use_count,
    status: row.status as ScriptStatus,
    notes: row.notes,
    lastUsedAt: row.last_used_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function normalizeOptionalCsvCell(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : null;
}

function normalizeTagGroup(value: string | undefined): TagGroup {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "test" || normalized === "测试" || normalized === "测试标签" || normalized === "1") {
    return "test";
  }
  return "default";
}

function parseCsvRows(csvText: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < csvText.length; index += 1) {
    const char = csvText[index];
    const next = csvText[index + 1];
    if (quoted) {
      if (char === "\"" && next === "\"") {
        cell += "\"";
        index += 1;
      } else if (char === "\"") {
        quoted = false;
      } else {
        cell += char;
      }
      continue;
    }

    if (char === "\"") {
      quoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }

  if (cell || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows.filter((candidate) => candidate.some((value) => value.trim()));
}

function normalizeHeader(value: string): string {
  return value.trim().replace(/^\uFEFF/, "").toLowerCase().replaceAll(" ", "").replaceAll("_", "");
}

const headerAliases: Record<string, string> = {
  sku: "skuCode",
  skucode: "skuCode",
  sku编码: "skuCode",
  商品编码: "skuCode",
  款式: "skuStyle",
  sku款式: "skuStyle",
  款式名: "skuStyle",
  tag1: "tag1",
  标签一: "tag1",
  标签1: "tag1",
  tag2: "tag2",
  标签二: "tag2",
  标签2: "tag2",
  tag3: "tag3",
  标签三: "tag3",
  标签3: "tag3",
  tag4: "tag4",
  标签四: "tag4",
  标签4: "tag4",
  tag5: "tag5",
  标签五: "tag5",
  标签5: "tag5",
  taggroup: "tagGroup",
  ratiogroup: "tagGroup",
  标签组: "tagGroup",
  标签组类型: "tagGroup",
  是否测试标签: "tagGroup",
  istesttag: "tagGroup",
  notes: "notes",
  note: "notes",
  备注: "notes"
};

function csvRecord(headers: string[], row: string[]): Record<string, string | undefined> {
  const record: Record<string, string | undefined> = {};
  for (let index = 0; index < headers.length; index += 1) {
    const key = headerAliases[normalizeHeader(headers[index] ?? "")];
    if (key) {
      record[key] = row[index];
    }
  }
  return record;
}

function isVideoFile(filePath: string): boolean {
  return SUPPORTED_VIDEO_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function metadataErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function sha256(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function isNotFoundError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === "ENOENT";
}

function parseSkuAndStyle(relativePath: string): { sku: string | null; style: string | null } {
  const segments = relativePath.split("/");
  const videoRootIndex = segments[0] === "videos" ? 0 : -1;
  if (videoRootIndex !== 0 || segments.length < 3) {
    return { sku: null, style: null };
  }

  return {
    sku: segments[1] ?? null,
    style: segments.length > 3 ? segments.slice(2, -1).join("/") : null
  };
}

async function listVideoFiles(rootPath: string): Promise<string[]> {
  const entries = await readdir(rootPath, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(rootPath, entry.name);
      if (entry.isDirectory()) {
        return listVideoFiles(fullPath);
      }
      return entry.isFile() && isVideoFile(fullPath) ? [fullPath] : [];
    })
  );
  return nested.flat();
}

export class WorkspaceDatabase {
  private constructor(
    private readonly workspaceRootPath: string,
    private readonly db: SqliteDatabase
  ) {
    applySqlMigrations(this.db, WORKSPACE_MIGRATIONS);
  }

  static async open(workspaceRootPath: string): Promise<WorkspaceDatabase> {
    await mkdir(path.join(workspaceRootPath, "videos"), { recursive: true });
    const db = await openSqliteDatabase(path.join(workspaceRootPath, "workspace.db"));
    return new WorkspaceDatabase(workspaceRootPath, db);
  }

  close(): void {
    this.db.close();
  }

  listVideos(): VideoRecord[] {
    const rows = this.db.prepare("SELECT * FROM videos ORDER BY relative_path ASC").all();
    return rows.map((row) => mapVideoRow(coerceVideoRow(row)));
  }

  saveApiCallLog(input: ApiCallLogSaveInput): void {
    const parsed = ApiCallLogSaveInputSchema.parse(input);
    const timestamp = nowIso();
    this.db
      .prepare(
        `INSERT INTO api_call_log (
          id, provider, model, workflow, status, started_at, finished_at, duration_ms,
          input_tokens, output_tokens, total_tokens, error_code, error_message, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        crypto.randomUUID(),
        parsed.provider,
        parsed.model,
        parsed.workflow,
        parsed.status,
        parsed.startedAt,
        parsed.finishedAt,
        parsed.durationMs,
        parsed.inputTokens ?? null,
        parsed.outputTokens ?? null,
        parsed.totalTokens ?? null,
        parsed.errorCode ?? null,
        parsed.errorMessage ?? null,
        timestamp
      );
  }

  listTags(): TagRecord[] {
    const rows = this.db.prepare("SELECT * FROM tags ORDER BY sku_code ASC, sku_style ASC, tag_group ASC").all();
    return rows.map((row) => mapTagRow(coerceTagRow(row)));
  }

  importTagsCsv(csvText: string): TagImportSummary {
    const rows = parseCsvRows(csvText);
    if (rows.length === 0) {
      return { imported: 0, inserted: 0, updated: 0, skipped: 0, errors: ["CSV 文件为空"] };
    }

    const [headers, ...bodyRows] = rows;
    if (!headers?.some((header) => headerAliases[normalizeHeader(header)] === "skuCode")) {
      return { imported: 0, inserted: 0, updated: 0, skipped: bodyRows.length, errors: ["CSV 缺少 SKU 列"] };
    }

    const summary: TagImportSummary = { imported: 0, inserted: 0, updated: 0, skipped: 0, errors: [] };
    const timestamp = nowIso();

    this.runInTransaction(() => {
      for (let index = 0; index < bodyRows.length; index += 1) {
        const record = csvRecord(headers, bodyRows[index] ?? []);
        const skuCode = record.skuCode?.trim();
        if (!skuCode) {
          summary.skipped += 1;
          summary.errors.push(`第 ${index + 2} 行缺少 SKU`);
          continue;
        }

        const skuStyle = record.skuStyle?.trim() ?? "";
        const tagGroup = normalizeTagGroup(record.tagGroup);
        const existing = this.db
          .prepare("SELECT id FROM tags WHERE sku_code = ? AND sku_style = ? AND tag_group = ?")
          .get(skuCode, skuStyle, tagGroup);
        if (existing) {
          this.db
            .prepare(
              `UPDATE tags SET
                tag1 = ?, tag2 = ?, tag3 = ?, tag4 = ?, tag5 = ?, notes = ?, updated_at = ?
               WHERE id = ?`
            )
            .run(
              normalizeOptionalCsvCell(record.tag1),
              normalizeOptionalCsvCell(record.tag2),
              normalizeOptionalCsvCell(record.tag3),
              normalizeOptionalCsvCell(record.tag4),
              normalizeOptionalCsvCell(record.tag5),
              normalizeOptionalCsvCell(record.notes),
              timestamp,
              rowString(existing, "id")
            );
          summary.updated += 1;
        } else {
          this.db
            .prepare(
              `INSERT INTO tags (
                id, sku_code, sku_style, tag1, tag2, tag3, tag4, tag5, tag_group,
                use_count, notes, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`
            )
            .run(
              crypto.randomUUID(),
              skuCode,
              skuStyle,
              normalizeOptionalCsvCell(record.tag1),
              normalizeOptionalCsvCell(record.tag2),
              normalizeOptionalCsvCell(record.tag3),
              normalizeOptionalCsvCell(record.tag4),
              normalizeOptionalCsvCell(record.tag5),
              tagGroup,
              normalizeOptionalCsvCell(record.notes),
              timestamp,
              timestamp
            );
          summary.inserted += 1;
        }
        summary.imported += 1;
      }
    });

    return summary;
  }

  saveTag(input: TagSaveInput): TagRecord {
    const parsed = TagSaveInputSchema.parse(input);
    const timestamp = nowIso();
    const skuStyle = parsed.skuStyle?.trim() ?? "";
    const existing = parsed.tagId
      ? this.db.prepare("SELECT id FROM tags WHERE id = ?").get(parsed.tagId)
      : this.db
          .prepare("SELECT id FROM tags WHERE sku_code = ? AND sku_style = ? AND tag_group = ?")
          .get(parsed.skuCode, skuStyle, parsed.tagGroup);
    const tagId = existing ? rowString(existing, "id") : crypto.randomUUID();

    this.db
      .prepare(
        `INSERT INTO tags (
          id, sku_code, sku_style, tag1, tag2, tag3, tag4, tag5, tag_group,
          use_count, notes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          sku_code = excluded.sku_code,
          sku_style = excluded.sku_style,
          tag1 = excluded.tag1,
          tag2 = excluded.tag2,
          tag3 = excluded.tag3,
          tag4 = excluded.tag4,
          tag5 = excluded.tag5,
          tag_group = excluded.tag_group,
          notes = excluded.notes,
          updated_at = excluded.updated_at`
      )
      .run(
        tagId,
        parsed.skuCode,
        skuStyle,
        parsed.tag1 || null,
        parsed.tag2 || null,
        parsed.tag3 || null,
        parsed.tag4 || null,
        parsed.tag5 || null,
        parsed.tagGroup,
        parsed.notes || null,
        timestamp,
        timestamp
      );

    const saved = this.db.prepare("SELECT * FROM tags WHERE id = ?").get(tagId);
    if (!saved) {
      throw new Error("标签保存后无法读取");
    }
    return mapTagRow(coerceTagRow(saved));
  }

  listTitles(): TitleRecord[] {
    const rows = this.db.prepare("SELECT * FROM titles ORDER BY updated_at DESC, created_at DESC").all();
    return rows.map((row) => mapTitleRow(coerceTitleRow(row)));
  }

  saveTitle(input: TitleSaveInput): TitleRecord {
    const parsed = TitleSaveInputSchema.parse(input);
    const timestamp = nowIso();
    const titleId = parsed.titleId ?? crypto.randomUUID();

    this.db
      .prepare(
        `INSERT INTO titles (
          id, text, source_skill_id, score, use_count, status, notes,
          last_used_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 0, ?, ?, NULL, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          text = excluded.text,
          source_skill_id = excluded.source_skill_id,
          score = excluded.score,
          status = excluded.status,
          notes = excluded.notes,
          updated_at = excluded.updated_at`
      )
      .run(
        titleId,
        parsed.text,
        parsed.sourceSkillId || null,
        parsed.score ?? null,
        parsed.status,
        parsed.notes || null,
        timestamp,
        timestamp
      );

    const saved = this.db.prepare("SELECT * FROM titles WHERE id = ?").get(titleId);
    if (!saved) {
      throw new Error("标题保存后无法读取");
    }
    return mapTitleRow(coerceTitleRow(saved));
  }

  listPrompts(): PromptRecord[] {
    const rows = this.db.prepare("SELECT * FROM prompts ORDER BY updated_at DESC, created_at DESC").all();
    return rows.map((row) => mapPromptRow(coercePromptRow(row)));
  }

  savePrompt(input: PromptSaveInput): PromptRecord {
    const parsed = PromptSaveInputSchema.parse(input);
    const timestamp = nowIso();
    const promptId = parsed.promptId ?? crypto.randomUUID();

    this.db
      .prepare(
        `INSERT INTO prompts (
          id, text, scene, generated_count, kept_count, status, notes, created_at, updated_at
        ) VALUES (?, ?, ?, 0, 0, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          text = excluded.text,
          scene = excluded.scene,
          status = excluded.status,
          notes = excluded.notes,
          updated_at = excluded.updated_at`
      )
      .run(promptId, parsed.text, parsed.scene, parsed.status, parsed.notes || null, timestamp, timestamp);

    const saved = this.db.prepare("SELECT * FROM prompts WHERE id = ?").get(promptId);
    if (!saved) {
      throw new Error("提示词保存后无法读取");
    }
    return mapPromptRow(coercePromptRow(saved));
  }

  incrementPromptGeneratedCount(promptId: string, generatedCount: number, keptCount = generatedCount): PromptRecord {
    if (generatedCount < 0 || keptCount < 0) {
      throw new Error("提示词计数不能为负数");
    }
    const timestamp = nowIso();
    this.db
      .prepare(
        `UPDATE prompts
        SET generated_count = generated_count + ?,
          kept_count = kept_count + ?,
          updated_at = ?
        WHERE id = ?`
      )
      .run(generatedCount, keptCount, timestamp, promptId);
    const saved = this.db.prepare("SELECT * FROM prompts WHERE id = ?").get(promptId);
    if (!saved) {
      throw new Error("提示词不存在");
    }
    return mapPromptRow(coercePromptRow(saved));
  }

  listPlatformAccounts(): PlatformAccountRecord[] {
    const rows = this.db.prepare("SELECT * FROM platform_accounts ORDER BY platform ASC, account_name ASC").all();
    return rows.map((row) => mapPlatformAccountRow(coercePlatformAccountRow(row)));
  }

  savePlatformAccount(input: PlatformAccountSaveInput): PlatformAccountRecord {
    const parsed = PlatformAccountSaveInputSchema.parse(input);
    const timestamp = nowIso();
    const accountId = parsed.accountId ?? crypto.randomUUID();

    this.db
      .prepare(
        `INSERT INTO platform_accounts (
          id, platform, account_name, enabled, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          platform = excluded.platform,
          account_name = excluded.account_name,
          enabled = excluded.enabled,
          updated_at = excluded.updated_at`
      )
      .run(accountId, parsed.platform, parsed.accountName, parsed.enabled ? 1 : 0, timestamp, timestamp);

    const saved = this.db.prepare("SELECT * FROM platform_accounts WHERE id = ?").get(accountId);
    if (!saved) {
      throw new Error("平台账号保存后无法读取");
    }
    return mapPlatformAccountRow(coercePlatformAccountRow(saved));
  }

  getTaskSheetByDate(sheetDate: string): TaskSheetRecord | null {
    const sheet = this.db.prepare("SELECT * FROM task_sheets WHERE sheet_date = ? ORDER BY created_at DESC LIMIT 1").get(sheetDate);
    if (!sheet) {
      return null;
    }
    const sheetRow = coerceTaskSheetRow(sheet);
    return mapTaskSheetRow(sheetRow, this.listTaskRows(sheetRow.id));
  }

  async exportTaskSheet(input: TaskExportInput & { workspaceId: string; macRootPath: string; winRootPath: string }): Promise<TaskExportResult> {
    const parsed = TaskExportInputSchema.parse(input);
    const sheet = this.getTaskSheetByDate(parsed.sheetDate);
    if (!sheet) {
      throw new Error("任务单不存在，无法导出");
    }
    if (sheet.rows.length === 0) {
      throw new Error("任务单没有任务行，无法导出");
    }

    const result = await exportTaskSheetFiles({
      workspaceId: input.workspaceId,
      workspaceRootPath: this.workspaceRootPath,
      macRootPath: input.macRootPath,
      winRootPath: input.winRootPath,
      sheet,
      formats: parsed.formats
    });
    const timestamp = nowIso();
    this.db
      .prepare("UPDATE task_sheets SET status = 'exported', export_relative_dir = ?, updated_at = ? WHERE id = ?")
      .run(result.exportRelativeDir, timestamp, sheet.id);

    return {
      sheetDate: parsed.sheetDate,
      exportRelativeDir: result.exportRelativeDir,
      exportAbsoluteDir: result.exportAbsoluteDir,
      statusRelativeDir: result.statusRelativeDir,
      statusAbsoluteDir: result.statusAbsoluteDir,
      writtenFiles: result.writtenFiles,
      preflight: result.preflight,
      warnings: result.warnings
    };
  }

  async scanTaskStatusFiles(input: TaskStatusScanInput): Promise<TaskStatusScanResult> {
    const parsed = TaskStatusScanInputSchema.parse(input);
    const statusRelativeDir = `tasks/${parsed.sheetDate}/status`;
    const statusAbsoluteDir = path.join(this.workspaceRootPath, statusRelativeDir);
    const result: TaskStatusScanResult = {
      sheetDate: parsed.sheetDate,
      scanned: 0,
      processed: 0,
      duplicates: 0,
      ignoredTmp: 0,
      errors: []
    };

    let entries: string[];
    try {
      entries = await readdir(statusAbsoluteDir);
    } catch (error) {
      if (isNotFoundError(error)) {
        return result;
      }
      throw error;
    }

    for (const entry of entries) {
      if (entry.endsWith(".tmp")) {
        result.ignoredTmp += 1;
        continue;
      }
      if (!entry.endsWith(".json")) {
        continue;
      }

      result.scanned += 1;
      const absolutePath = path.join(statusAbsoluteDir, entry);
      const relativePath = `${statusRelativeDir}/${entry}`;
      try {
        const fileBuffer = await readFile(absolutePath);
        const fileHash = sha256(fileBuffer);
        const fileStat = await stat(absolutePath);
        const payload = RpaStatusFileSchema.parse(JSON.parse(fileBuffer.toString("utf8")));
        const existing = this.db
          .prepare("SELECT id FROM processed_status_files WHERE run_key = ? AND file_hash = ?")
          .get(payload.run_key, fileHash);
        if (existing) {
          result.duplicates += 1;
          continue;
        }
        this.applyStatusPayload({
          payload,
          relativePath,
          fileHash,
          fileMtime: Math.floor(fileStat.mtimeMs / 1000)
        });
        result.processed += 1;
      } catch (error) {
        result.errors.push(`${entry}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return result;
  }

  retryTaskRow(input: TaskRetryInput): TaskRowRecord {
    const parsed = TaskRetryInputSchema.parse(input);
    const existing = this.db.prepare("SELECT id, sheet_id, attempt_no, status FROM task_rows WHERE id = ?").get(parsed.taskId);
    if (!existing) {
      throw new Error("任务行不存在，无法重试");
    }
    const currentStatus = rowString(existing, "status") as TaskRowStatus;
    if (currentStatus !== "failed") {
      throw new Error("只有失败任务可以重试");
    }
    const taskId = rowString(existing, "id");
    const sheetId = rowString(existing, "sheet_id");
    const nextAttemptNo = rowNumber(existing, "attempt_no") + 1;
    const nextRunKey = `${taskId}__attempt-${nextAttemptNo}`;
    const timestamp = nowIso();
    this.runInTransaction(() => {
      this.db
        .prepare(
          `UPDATE task_rows SET
            attempt_no = ?,
            run_key = ?,
            status = 'pending',
            error_code = NULL,
            error_message = NULL,
            updated_at = ?
          WHERE id = ?`
        )
        .run(nextAttemptNo, nextRunKey, timestamp, taskId);
      this.db.prepare("UPDATE task_sheets SET status = 'exported', updated_at = ? WHERE id = ?").run(timestamp, sheetId);
    });
    const updated = this.listTaskRows(sheetId).find((row) => row.id === taskId);
    if (!updated) {
      throw new Error("任务行重试后无法读取");
    }
    return updated;
  }

  markTaskRowStatus(input: TaskManualStatusInput): TaskRowRecord {
    const parsed = TaskManualStatusInputSchema.parse(input);
    const existing = this.db.prepare("SELECT id, sheet_id, attempt_no, run_key FROM task_rows WHERE id = ?").get(parsed.taskId);
    if (!existing) {
      throw new Error("任务行不存在，无法标记状态");
    }
    const taskId = rowString(existing, "id");
    const sheetId = rowString(existing, "sheet_id");
    this.applyStatusPayload({
      payload: {
        task_id: taskId,
        attempt_no: rowNumber(existing, "attempt_no"),
        run_key: rowString(existing, "run_key"),
        status: parsed.status,
        executed_at: nowIso(),
        platform_post_url: null,
        error_code: parsed.status === "failed" ? parsed.errorCode ?? "MANUAL_FAILED" : null,
        error_message: parsed.status === "failed" ? parsed.errorMessage ?? "手动标记失败" : null,
        rpa_log: "manual"
      },
      relativePath: `manual://${taskId}`,
      fileHash: sha256(Buffer.from(`${taskId}:${parsed.status}:${Date.now()}:${crypto.randomUUID()}`)),
      fileMtime: null
    });
    const updated = this.listTaskRows(sheetId).find((row) => row.id === taskId);
    if (!updated) {
      throw new Error("任务行标记后无法读取");
    }
    return updated;
  }

  updateTaskRow(input: TaskRowUpdateInput): TaskRowRecord {
    const parsed = TaskRowUpdateInputSchema.parse(input);
    const existing = this.db.prepare("SELECT id, sheet_id FROM task_rows WHERE id = ?").get(parsed.taskId);
    if (!existing) {
      throw new Error("任务行不存在，无法编辑");
    }
    const taskId = rowString(existing, "id");
    const sheetId = rowString(existing, "sheet_id");
    const tags = parsed.tags;
    const timestamp = nowIso();
    this.db
      .prepare(
        `UPDATE task_rows SET
          publish_at = COALESCE(?, publish_at),
          title_text_override = CASE WHEN ? = 1 THEN ? ELSE title_text_override END,
          title_id = CASE WHEN ? = 1 THEN NULL ELSE title_id END,
          tag1 = CASE WHEN ? = 1 THEN ? ELSE tag1 END,
          tag2 = CASE WHEN ? = 1 THEN ? ELSE tag2 END,
          tag3 = CASE WHEN ? = 1 THEN ? ELSE tag3 END,
          tag4 = CASE WHEN ? = 1 THEN ? ELSE tag4 END,
          tag5 = CASE WHEN ? = 1 THEN ? ELSE tag5 END,
          updated_at = ?
        WHERE id = ?`
      )
      .run(
        parsed.publishAt ?? null,
        parsed.titleText === undefined ? 0 : 1,
        parsed.titleText ?? null,
        parsed.titleText === undefined ? 0 : 1,
        tags ? 1 : 0,
        tags?.[0] ?? null,
        tags ? 1 : 0,
        tags?.[1] ?? null,
        tags ? 1 : 0,
        tags?.[2] ?? null,
        tags ? 1 : 0,
        tags?.[3] ?? null,
        tags ? 1 : 0,
        tags?.[4] ?? null,
        timestamp,
        taskId
      );
    const updated = this.listTaskRows(sheetId).find((row) => row.id === taskId);
    if (!updated) {
      throw new Error("任务行编辑后无法读取");
    }
    return updated;
  }

  deleteTaskRow(input: TaskRowDeleteInput): TaskSheetRecord {
    const parsed = TaskRowDeleteInputSchema.parse(input);
    const existing = this.db.prepare("SELECT sheet_id FROM task_rows WHERE id = ?").get(parsed.taskId);
    if (!existing) {
      throw new Error("任务行不存在，无法删除");
    }
    const sheetId = rowString(existing, "sheet_id");
    this.db.prepare("DELETE FROM task_rows WHERE id = ?").run(parsed.taskId);
    const sheet = this.db.prepare("SELECT * FROM task_sheets WHERE id = ?").get(sheetId);
    if (!sheet) {
      throw new Error("任务单不存在");
    }
    return mapTaskSheetRow(coerceTaskSheetRow(sheet), this.listTaskRows(sheetId));
  }

  addTaskRow(input: TaskRowAddInput): TaskRowRecord {
    const parsed = TaskRowAddInputSchema.parse(input);
    const sheet = this.getTaskSheetByDate(parsed.sheetDate);
    if (!sheet) {
      throw new Error("任务单不存在，无法添加任务行");
    }
    const source = parsed.sourceTaskId
      ? sheet.rows.find((row) => row.id === parsed.sourceTaskId)
      : sheet.rows[0];
    if (!source) {
      throw new Error("任务单没有可复制的任务行");
    }
    const timestamp = nowIso();
    const taskId = crypto.randomUUID();
    const attemptNo = 1;
    const runKey = `${taskId}__attempt-${attemptNo}`;
    this.db
      .prepare(
        `INSERT INTO task_rows (
          id, sheet_id, run_key, attempt_no, video_id, title_id, platform_account_id,
          publish_at, status, video_relative_path, cover_relative_path, tag_group,
          tag1, tag2, tag3, tag4, tag5, title_text_override, error_code, error_message, created_at, updated_at
        )
        SELECT
          ?, sheet_id, ?, ?, video_id, title_id, platform_account_id,
          publish_at, 'pending', video_relative_path, cover_relative_path, tag_group,
          tag1, tag2, tag3, tag4, tag5, title_text_override, NULL, NULL, ?, ?
        FROM task_rows
        WHERE id = ?`
      )
      .run(taskId, runKey, attemptNo, timestamp, timestamp, source.id);
    const added = this.listTaskRows(sheet.id).find((row) => row.id === taskId);
    if (!added) {
      throw new Error("任务行添加后无法读取");
    }
    return added;
  }

  batchReplaceTaskTitles(input: TaskBatchReplaceTitlesInput): TaskSheetRecord {
    const parsed = TaskBatchReplaceTitlesInputSchema.parse(input);
    const sheet = this.getTaskSheetByDate(parsed.sheetDate);
    if (!sheet) {
      throw new Error("任务单不存在，无法批量换标题");
    }
    const targetIds = new Set(parsed.taskIds && parsed.taskIds.length > 0 ? parsed.taskIds : sheet.rows.map((row) => row.id));
    const targets = sheet.rows.filter((row) => targetIds.has(row.id));
    if (targets.length === 0) {
      throw new Error("没有可替换标题的任务行");
    }
    const titles = this.selectTitlesForReplacement(parsed.titleStrategy, targets.length);
    if (titles.length === 0) {
      throw new Error("标题库没有可用标题");
    }
    const timestamp = nowIso();
    this.runInTransaction(() => {
      targets.forEach((row, index) => {
        const title = titles[index % titles.length];
        this.db
          .prepare("UPDATE task_rows SET title_id = ?, title_text_override = NULL, updated_at = ? WHERE id = ?")
          .run(title.id, timestamp, row.id);
      });
      this.db.prepare("UPDATE task_sheets SET updated_at = ? WHERE id = ?").run(timestamp, sheet.id);
    });
    const updatedSheet = this.db.prepare("SELECT * FROM task_sheets WHERE id = ?").get(sheet.id);
    if (!updatedSheet) {
      throw new Error("任务单不存在");
    }
    return mapTaskSheetRow(coerceTaskSheetRow(updatedSheet), this.listTaskRows(sheet.id));
  }

  generateTaskSheet(input: TaskGenerateInput): TaskSheetRecord {
    const parsed = TaskGenerateInputSchema.parse(input);
    const timestamp = nowIso();
    const sheetId = crypto.randomUUID();
    const candidateRows = generateTaskRows(parsed, {
      videos: this.listVideos(),
      platformAccounts: this.listPlatformAccounts(),
      titles: this.listTitles(),
      tags: this.listTags(),
      successfulPairs: this.listSuccessfulVideoPlatformPairs()
    });

    this.runInTransaction(() => {
      this.db
        .prepare(
          `INSERT INTO task_sheets (
            id, sheet_date, name, status, export_relative_dir, created_at, updated_at
          ) VALUES (?, ?, ?, 'draft', NULL, ?, ?)`
        )
        .run(sheetId, parsed.sheetDate, `${parsed.sheetDate} 任务单`, timestamp, timestamp);

      const insert = this.db.prepare(
        `INSERT INTO task_rows (
          id, sheet_id, run_key, attempt_no, video_id, title_id, platform_account_id,
          publish_at, status, video_relative_path, cover_relative_path, tag_group,
          tag1, tag2, tag3, tag4, tag5, error_code, error_message, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?)`
      );

      for (const row of candidateRows.rows) {
        insert.run(
          row.id,
          sheetId,
          row.runKey,
          row.attemptNo,
          row.videoId,
          row.titleId,
          row.platformAccountId,
          row.publishAt,
          row.status,
          row.videoRelativePath,
          row.coverRelativePath,
          row.tagGroup,
          row.tags[0] ?? null,
          row.tags[1] ?? null,
          row.tags[2] ?? null,
          row.tags[3] ?? null,
          row.tags[4] ?? null,
          timestamp,
          timestamp
        );
      }
    });

    const saved = this.db.prepare("SELECT * FROM task_sheets WHERE id = ?").get(sheetId);
    if (!saved) {
      throw new Error("任务单保存后无法读取");
    }
    return mapTaskSheetRow(coerceTaskSheetRow(saved), this.listTaskRows(sheetId));
  }

  listImages(): ImageRecord[] {
    const rows = this.db.prepare("SELECT * FROM images ORDER BY updated_at DESC, created_at DESC").all();
    return rows.map((row) => mapImageRow(coerceImageRow(row)));
  }

  listImageScenePresets(): ImageScenePreset[] {
    const customRows = this.db.prepare("SELECT * FROM image_scene_presets ORDER BY updated_at DESC, name ASC").all();
    const custom = customRows.map((row) => mapImageScenePresetRow(coerceImageScenePresetRow(row)));
    const customNames = new Set(custom.map((preset) => preset.name));
    return [...BUILTIN_IMAGE_SCENE_PRESETS.filter((preset) => !customNames.has(preset.name)), ...custom];
  }

  saveImageScenePreset(input: ImageScenePresetSaveInput): ImageScenePreset {
    const parsed = ImageScenePresetSaveInputSchema.parse(input);
    const timestamp = nowIso();
    const presetId = parsed.presetId ?? crypto.randomUUID();
    this.db
      .prepare(
        `INSERT INTO image_scene_presets (
          id, name, skill_id, default_aspect_ratio, default_per_prompt_count,
          default_output_subdir, default_image_model, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          skill_id = excluded.skill_id,
          default_aspect_ratio = excluded.default_aspect_ratio,
          default_per_prompt_count = excluded.default_per_prompt_count,
          default_output_subdir = excluded.default_output_subdir,
          default_image_model = excluded.default_image_model,
          updated_at = excluded.updated_at`
      )
      .run(
        presetId,
        parsed.name,
        parsed.skillId || null,
        parsed.defaultAspectRatio,
        parsed.defaultPerPromptCount,
        parsed.defaultOutputSubdir,
        parsed.defaultImageModel,
        timestamp,
        timestamp
      );
    const saved = this.db.prepare("SELECT * FROM image_scene_presets WHERE id = ?").get(presetId);
    if (!saved) {
      throw new Error("图片场景预设保存后无法读取");
    }
    return mapImageScenePresetRow(coerceImageScenePresetRow(saved));
  }

  saveImage(input: ImageSaveInput): ImageRecord {
    const parsed = ImageSaveInputSchema.parse(input);
    const timestamp = nowIso();
    const existingById = parsed.imageId ? this.db.prepare("SELECT id FROM images WHERE id = ?").get(parsed.imageId) : undefined;
    const existingByPath = this.db.prepare("SELECT id FROM images WHERE relative_path = ?").get(parsed.relativePath);
    if (existingById && existingByPath && rowString(existingById, "id") !== rowString(existingByPath, "id")) {
      throw new Error("图片相对路径已被其他记录使用");
    }
    const existing = existingById ?? existingByPath;
    const imageId = existing ? rowString(existing, "id") : crypto.randomUUID();
    const fileName = path.posix.basename(parsed.relativePath);

    this.db
      .prepare(
        `INSERT INTO images (
          id, prompt_id, relative_path, file_name, scene, width, height, aspect_ratio,
          source_model, status, tags, notes, generated_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          prompt_id = excluded.prompt_id,
          relative_path = excluded.relative_path,
          file_name = excluded.file_name,
          scene = excluded.scene,
          width = excluded.width,
          height = excluded.height,
          aspect_ratio = excluded.aspect_ratio,
          source_model = excluded.source_model,
          status = excluded.status,
          tags = excluded.tags,
          notes = excluded.notes,
          generated_at = excluded.generated_at,
          updated_at = excluded.updated_at`
      )
      .run(
        imageId,
        parsed.promptId || null,
        parsed.relativePath,
        fileName,
        parsed.scene,
        parsed.width ?? null,
        parsed.height ?? null,
        parsed.aspectRatio || null,
        parsed.sourceModel || null,
        parsed.status,
        parsed.tags || null,
        parsed.notes || null,
        parsed.generatedAt || null,
        timestamp,
        timestamp
      );

    const saved = this.db.prepare("SELECT * FROM images WHERE id = ?").get(imageId);
    if (!saved) {
      throw new Error("图片记录保存后无法读取");
    }
    return mapImageRow(coerceImageRow(saved));
  }

  getImage(imageId: string): ImageRecord | null {
    const saved = this.db.prepare("SELECT * FROM images WHERE id = ?").get(imageId);
    return saved ? mapImageRow(coerceImageRow(saved)) : null;
  }

  softDeleteImageRecord(input: ImageSoftDeleteInput & { trashRelativePath: string }): {
    image: ImageRecord;
    prompt: PromptRecord | null;
    suggestedNegativePrompt: boolean;
  } {
    const parsed = ImageSoftDeleteInputSchema.parse(input);
    const trashRelativePath = ImageSaveInputSchema.shape.relativePath.parse(input.trashRelativePath);
    const timestamp = nowIso();
    let prompt: PromptRecord | null = null;
    let image: ImageRecord | null = null;
    this.runInTransaction(() => {
      const existing = this.db.prepare("SELECT * FROM images WHERE id = ?").get(parsed.imageId);
      if (!existing) {
        throw new Error("图片不存在");
      }
      const current = mapImageRow(coerceImageRow(existing));
      const alreadyDeleted = current.status === "soft_deleted";
      this.db
        .prepare(
          `UPDATE images
          SET relative_path = ?,
            file_name = ?,
            status = 'soft_deleted',
            updated_at = ?
          WHERE id = ?`
        )
        .run(trashRelativePath, path.posix.basename(trashRelativePath), timestamp, parsed.imageId);
      if (current.promptId && !alreadyDeleted) {
        this.db
          .prepare(
            `UPDATE prompts
            SET kept_count = CASE WHEN kept_count > 0 THEN kept_count - 1 ELSE 0 END,
              updated_at = ?
            WHERE id = ?`
          )
          .run(timestamp, current.promptId);
      }
      const nextImage = this.db.prepare("SELECT * FROM images WHERE id = ?").get(parsed.imageId);
      if (!nextImage) {
        throw new Error("图片软删后无法读取");
      }
      image = mapImageRow(coerceImageRow(nextImage));
      if (image.promptId) {
        const nextPrompt = this.db.prepare("SELECT * FROM prompts WHERE id = ?").get(image.promptId);
        prompt = nextPrompt ? mapPromptRow(coercePromptRow(nextPrompt)) : null;
      }
    });
    if (!image) {
      throw new Error("图片软删后无法读取");
    }
    const resultPrompt = prompt as PromptRecord | null;
    return {
      image,
      prompt: resultPrompt,
      suggestedNegativePrompt: resultPrompt !== null && resultPrompt.generatedCount > 0 && resultPrompt.keptCount === 0
    };
  }

  listScripts(): ScriptRecord[] {
    const rows = this.db.prepare("SELECT * FROM scripts ORDER BY updated_at DESC, created_at DESC").all();
    return rows.map((row) => mapScriptRow(coerceScriptRow(row)));
  }

  saveScript(input: ScriptSaveInput): ScriptRecord {
    const parsed = ScriptSaveInputSchema.parse(input);
    const timestamp = nowIso();
    const scriptId = parsed.scriptId ?? crypto.randomUUID();

    this.db
      .prepare(
        `INSERT INTO scripts (
          id, text, source_skill_id, sku_code, use_count, status, notes, last_used_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 0, ?, ?, NULL, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          text = excluded.text,
          source_skill_id = excluded.source_skill_id,
          sku_code = excluded.sku_code,
          status = excluded.status,
          notes = excluded.notes,
          updated_at = excluded.updated_at`
      )
      .run(
        scriptId,
        parsed.text,
        parsed.sourceSkillId || null,
        parsed.skuCode || null,
        parsed.status,
        parsed.notes || null,
        timestamp,
        timestamp
      );

    const saved = this.db.prepare("SELECT * FROM scripts WHERE id = ?").get(scriptId);
    if (!saved) {
      throw new Error("文案保存后无法读取");
    }
    return mapScriptRow(coerceScriptRow(saved));
  }

  updateVideo(input: VideoUpdateInput): VideoRecord {
    const parsed = VideoUpdateInputSchema.parse(input);
    const existing = this.db.prepare("SELECT * FROM videos WHERE id = ?").get(parsed.videoId);
    if (!existing) {
      throw new Error("视频不存在");
    }

    const current = mapVideoRow(coerceVideoRow(existing));
    const nextSku = parsed.sku === undefined ? current.sku : parsed.sku;
    const nextStyle = parsed.style === undefined ? current.style : parsed.style;
    const nextNote = parsed.note === undefined ? current.note : parsed.note || null;

    this.db
      .prepare("UPDATE videos SET sku = ?, style = ?, note = ?, updated_at = ? WHERE id = ?")
      .run(nextSku, nextStyle, nextNote, nowIso(), parsed.videoId);

    const updated = this.db.prepare("SELECT * FROM videos WHERE id = ?").get(parsed.videoId);
    if (!updated) {
      throw new Error("视频保存后无法读取");
    }
    return mapVideoRow(coerceVideoRow(updated));
  }

  batchUpdateVideos(input: VideoBatchUpdateInput): VideoRecord[] {
    const parsed = VideoBatchUpdateInputSchema.parse(input);
    const uniqueIds = [...new Set(parsed.videoIds)];
    const timestamp = nowIso();
    const updatedRows: VideoRecord[] = [];
    this.runInTransaction(() => {
      const statement = this.db.prepare(
        `UPDATE videos
        SET sku = COALESCE(?, sku),
          style = COALESCE(?, style),
          status = COALESCE(?, status),
          updated_at = ?
        WHERE id = ?`
      );
      for (const videoId of uniqueIds) {
        statement.run(parsed.sku ?? null, parsed.style ?? null, parsed.status ?? null, timestamp, videoId);
        const updated = this.db.prepare("SELECT * FROM videos WHERE id = ?").get(videoId);
        if (updated) {
          updatedRows.push(mapVideoRow(coerceVideoRow(updated)));
        }
      }
    });
    return updatedRows;
  }

  setVideoCover(videoId: string, coverRelativePath: string): VideoRecord {
    const existing = this.db.prepare("SELECT * FROM videos WHERE id = ?").get(videoId);
    if (!existing) {
      throw new Error("视频不存在");
    }
    this.db
      .prepare("UPDATE videos SET has_cover = 1, cover_relative_path = ?, updated_at = ? WHERE id = ?")
      .run(coverRelativePath, nowIso(), videoId);
    const updated = this.db.prepare("SELECT * FROM videos WHERE id = ?").get(videoId);
    if (!updated) {
      throw new Error("视频封面保存后无法读取");
    }
    return mapVideoRow(coerceVideoRow(updated));
  }

  listScheduledJobs(): ScheduledJobRecord[] {
    const rows = this.db
      .prepare(
        `SELECT sj.*,
          (
            SELECT status FROM scheduled_job_runs
            WHERE job_id = sj.id
            ORDER BY started_at DESC
            LIMIT 1
          ) AS last_run_status,
          (
            SELECT error_message FROM scheduled_job_runs
            WHERE job_id = sj.id
            ORDER BY started_at DESC
            LIMIT 1
          ) AS last_error
         FROM scheduled_jobs sj
         ORDER BY COALESCE(next_run_at, updated_at) ASC`
      )
      .all();
    return rows.map((row) => mapScheduledJobRow(coerceScheduledJobRow(row)));
  }

  saveScheduledJob(input: ScheduledJobSaveInput): ScheduledJobRecord {
    const parsed = ScheduledJobSaveInputSchema.parse(input);
    const timestamp = nowIso();
    const jobId = parsed.jobId ?? crypto.randomUUID();
    this.db
      .prepare(
        `INSERT INTO scheduled_jobs (
          id, name, type, status, schedule_label, next_run_at, missed_run_policy, target_page, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          type = excluded.type,
          status = excluded.status,
          schedule_label = excluded.schedule_label,
          next_run_at = excluded.next_run_at,
          missed_run_policy = excluded.missed_run_policy,
          target_page = excluded.target_page,
          updated_at = excluded.updated_at`
      )
      .run(
        jobId,
        parsed.name,
        parsed.type,
        parsed.status,
        parsed.scheduleLabel,
        parsed.nextRunAt ?? null,
        parsed.missedRunPolicy,
        parsed.targetPage,
        timestamp,
        timestamp
      );
    const saved = this.listScheduledJobs().find((job) => job.id === jobId);
    if (!saved) {
      throw new Error("定时任务保存后无法读取");
    }
    return saved;
  }

  toggleScheduledJob(input: ScheduledJobToggleInput): ScheduledJobRecord {
    const parsed = ScheduledJobToggleInputSchema.parse(input);
    this.db
      .prepare("UPDATE scheduled_jobs SET status = ?, updated_at = ? WHERE id = ?")
      .run(parsed.enabled ? "enabled" : "paused", nowIso(), parsed.jobId);
    const saved = this.listScheduledJobs().find((job) => job.id === parsed.jobId);
    if (!saved) {
      throw new Error("定时任务不存在");
    }
    return saved;
  }

  collectDueScheduledJobPlans(nowIsoValue = nowIso()): ScheduledJobDuePlan[] {
    const dueRows = this.db
      .prepare(
        `SELECT * FROM scheduled_jobs
        WHERE status = 'enabled'
          AND next_run_at IS NOT NULL
          AND next_run_at <= ?
        ORDER BY next_run_at ASC`
      )
      .all(nowIsoValue);
    const jobsById = new Map(this.listScheduledJobs().map((job) => [job.id, job]));
    const plans: ScheduledJobDuePlan[] = [];
    for (const rawRow of dueRows) {
      const row = coerceScheduledJobRow({
        ...rawRow,
        last_run_status: null,
        last_error: null
      });
      if (!row.next_run_at) {
        continue;
      }
      const schedulePlan = collectDueScheduleTimes(
        row.schedule_label,
        row.next_run_at,
        nowIsoValue,
        row.missed_run_policy as ScheduledJobMissedRunPolicy
      );
      const job = jobsById.get(row.id) ?? mapScheduledJobRow(row);
      plans.push({
        job,
        runTimes: schedulePlan.runTimes,
        skippedTimes: schedulePlan.skippedTimes,
        nextRunAt: schedulePlan.nextRunAt
      });
    }
    return plans;
  }

  saveScheduledJobRun(input: ScheduledJobRunSaveInput): ScheduledJobRunRecord {
    const finishedAt = input.finishedAt ?? nowIso();
    const durationMs =
      input.durationMs ?? Math.max(0, new Date(finishedAt).getTime() - new Date(input.startedAt).getTime());
    const runId = crypto.randomUUID();
    this.db
      .prepare(
        `INSERT INTO scheduled_job_runs (
          id, job_id, status, started_at, finished_at, duration_ms, artifact_summary, error_message
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        runId,
        input.jobId,
        input.status,
        input.startedAt,
        finishedAt,
        durationMs,
        input.artifactSummary ?? null,
        input.errorMessage ?? null
      );
    const savedRun = this.db.prepare("SELECT * FROM scheduled_job_runs WHERE id = ?").get(runId);
    if (!savedRun) {
      throw new Error("定时任务运行记录保存后无法读取");
    }
    return mapScheduledJobRunRow(coerceScheduledJobRunRow(savedRun));
  }

  updateScheduledJobNextRun(jobId: string, nextRunAt: string | null, updatedAt = nowIso()): ScheduledJobRecord {
    this.db.prepare("UPDATE scheduled_jobs SET next_run_at = ?, updated_at = ? WHERE id = ?").run(nextRunAt, updatedAt, jobId);
    const saved = this.listScheduledJobs().find((job) => job.id === jobId);
    if (!saved) {
      throw new Error("定时任务不存在");
    }
    return saved;
  }

  runDueScheduledJobs(nowIsoValue = nowIso(), executor: ScheduledJobExecutor = defaultScheduledJobExecutor): ScheduledJobRunRecord[] {
    const plans = this.collectDueScheduledJobPlans(nowIsoValue);
    const runs: ScheduledJobRunRecord[] = [];
    this.runInTransaction(() => {
      for (const plan of plans) {
        const finishedAt = nowIso();
        for (const skippedAt of plan.skippedTimes) {
          runs.push(
            this.saveScheduledJobRun({
              jobId: plan.job.id,
              status: "skipped",
              startedAt: skippedAt,
              finishedAt,
              durationMs: 0,
              artifactSummary: `按错过补跑策略跳过 ${plan.job.name}`,
              errorMessage: null
            })
          );
        }
        for (const scheduledAt of plan.runTimes) {
          const runResult = executor({ job: plan.job, scheduledAt });
          runs.push(
            this.saveScheduledJobRun({
              jobId: plan.job.id,
              status: runResult.status,
              startedAt: scheduledAt,
              finishedAt,
              artifactSummary: runResult.artifactSummary ?? null,
              errorMessage: runResult.errorMessage ?? null
            })
          );
        }
        this.updateScheduledJobNextRun(plan.job.id, plan.nextRunAt, finishedAt);
      }
    });
    return runs;
  }

  listScheduledJobRuns(jobId: string, limit = 20): ScheduledJobRunRecord[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM scheduled_job_runs
        WHERE job_id = ?
        ORDER BY started_at DESC
        LIMIT ?`
      )
      .all(jobId, limit);
    return rows.map((row) => mapScheduledJobRunRow(coerceScheduledJobRunRow(row)));
  }

  async scanVideos(options: { metadataReader?: VideoMetadataReader; thumbnailGenerator?: ThumbnailGenerator } = {}): Promise<VideoScanSummary> {
    const timestamp = nowIso();
    const absoluteFiles = await listVideoFiles(path.join(this.workspaceRootPath, "videos"));
    const scannedVideos = await Promise.all(
      absoluteFiles.map((absolutePath) => this.scanVideoFile(absolutePath, options.metadataReader))
    );
    const currentRelativePaths = new Set(scannedVideos.map((video) => video.relativePath));

    let added = 0;
    let updated = 0;
    let archived = 0;

    const thumbnailQueue: Array<{ videoId: string; videoAbsolutePath: string; relativePath: string }> = [];

    this.runInTransaction(() => {
      for (const scanned of scannedVideos) {
        const existing = this.db.prepare("SELECT id, thumbnail_relative_path FROM videos WHERE relative_path = ?").get(scanned.relativePath);
        let videoId: string;
        let thumbnailRelativePath: string | null;
        if (existing) {
          videoId = rowString(existing, "id");
          thumbnailRelativePath = rowOptionalString(existing, "thumbnail_relative_path");
          this.updateScannedVideo(scanned, timestamp);
          updated += 1;
        } else {
          videoId = crypto.randomUUID();
          thumbnailRelativePath = null;
          this.insertScannedVideo(videoId, scanned, timestamp);
          added += 1;
        }

        if (scanned.status === "active" && !thumbnailRelativePath && options.thumbnailGenerator) {
          thumbnailQueue.push({
            videoId,
            videoAbsolutePath: scanned.absolutePath,
            relativePath: scanned.relativePath
          });
        }
      }

      const rows = this.db.prepare("SELECT relative_path FROM videos WHERE relative_path LIKE 'videos/%' AND status != 'archived'").all();
      for (const row of rows) {
        const relativePath = rowString(row, "relative_path");
        if (!currentRelativePaths.has(relativePath)) {
          this.db
            .prepare("UPDATE videos SET status = 'archived', updated_at = ? WHERE relative_path = ?")
            .run(timestamp, relativePath);
          archived += 1;
        }
      }
    });

    await this.generateQueuedThumbnails(thumbnailQueue, options.thumbnailGenerator);

    return {
      scanned: scannedVideos.length,
      added,
      updated,
      archived,
      failedMetadata: scannedVideos.filter((video) => video.status === "metadata_error").length,
      placeholders: scannedVideos.filter((video) => video.status === "placeholder").length
    };
  }

  private async scanVideoFile(absolutePath: string, metadataReader?: VideoMetadataReader): Promise<ScannedVideo> {
    const fileStat = await stat(absolutePath);
    const relativePath = toWorkspaceRelativePath(this.workspaceRootPath, absolutePath);
    const parsed = parseSkuAndStyle(relativePath);
    const fileName = path.basename(absolutePath);

    if (fileStat.size === 0) {
      return {
        absolutePath,
        relativePath,
        fileName,
        sku: parsed.sku,
        style: parsed.style,
        durationSeconds: null,
        width: null,
        height: null,
        sizeBytes: fileStat.size,
        status: "placeholder",
        metadataError: "文件尚未同步或为空"
      };
    }

    if (!metadataReader) {
      return {
        absolutePath,
        relativePath,
        fileName,
        sku: parsed.sku,
        style: parsed.style,
        durationSeconds: null,
        width: null,
        height: null,
        sizeBytes: fileStat.size,
        status: "active",
        metadataError: null
      };
    }

    try {
      const metadata = await metadataReader(absolutePath);
      return {
        absolutePath,
        relativePath,
        fileName,
        sku: parsed.sku,
        style: parsed.style,
        durationSeconds: metadata.durationSeconds ?? null,
        width: metadata.width ?? null,
        height: metadata.height ?? null,
        sizeBytes: fileStat.size,
        status: "active",
        metadataError: null
      };
    } catch (error) {
      return {
        absolutePath,
        relativePath,
        fileName,
        sku: parsed.sku,
        style: parsed.style,
        durationSeconds: null,
        width: null,
        height: null,
        sizeBytes: fileStat.size,
        status: "metadata_error",
        metadataError: metadataErrorMessage(error)
      };
    }
  }

  private async generateQueuedThumbnails(
    queue: Array<{ videoId: string; videoAbsolutePath: string; relativePath: string }>,
    thumbnailGenerator: ThumbnailGenerator | undefined
  ): Promise<void> {
    if (!thumbnailGenerator || queue.length === 0) {
      return;
    }

    for (const item of queue) {
      try {
        const thumbnailRelativePath = await thumbnailGenerator(item);
        this.db
          .prepare("UPDATE videos SET thumbnail_relative_path = ?, updated_at = ? WHERE id = ?")
          .run(thumbnailRelativePath, nowIso(), item.videoId);
      } catch {
        // Thumbnail generation is a cache optimization. Keep the indexed video usable.
      }
    }
  }

  private listSuccessfulVideoPlatformPairs(): Set<string> {
    const rows = this.db.prepare("SELECT video_id, platform_account_id FROM task_rows WHERE status = 'success'").all();
    return new Set(rows.map((row) => `${rowString(row, "video_id")}::${rowString(row, "platform_account_id")}`));
  }

  private listTaskRows(sheetId: string): TaskRowRecord[] {
    const rows = this.db
      .prepare(
        `SELECT
          tr.*,
          ts.sheet_date,
          v.file_name AS video_file_name,
          v.sku,
          v.style,
          pa.platform,
          pa.account_name,
          t.text AS title_text,
          tr.title_text_override
        FROM task_rows tr
        JOIN task_sheets ts ON ts.id = tr.sheet_id
        JOIN videos v ON v.id = tr.video_id
        JOIN platform_accounts pa ON pa.id = tr.platform_account_id
        LEFT JOIN titles t ON t.id = tr.title_id
        WHERE tr.sheet_id = ?
        ORDER BY tr.publish_at ASC, pa.platform ASC, pa.account_name ASC`
      )
      .all(sheetId);
    return rows.map((row) => mapTaskRowRow(coerceTaskRowRow(row)));
  }

  private selectTitlesForReplacement(strategy: TaskTitleStrategy, count: number): TitleRecord[] {
    const titles = this.listTitles().filter((title) => title.status === "active");
    if (titles.length === 0 || count <= 0) {
      return [];
    }
    const sorted =
      strategy === "best_score"
        ? [...titles].sort((left, right) => (right.score ?? 0) - (left.score ?? 0) || left.useCount - right.useCount)
        : strategy === "new_test"
          ? [...titles].sort((left, right) => left.useCount - right.useCount || (right.score ?? 0) - (left.score ?? 0))
          : [...titles].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
    return Array.from({ length: count }, (_, index) => sorted[index % sorted.length]);
  }

  private insertScannedVideo(id: string, video: ScannedVideo, timestamp: string): void {
    this.db
      .prepare(
        `INSERT INTO videos (
          id, relative_path, file_name, sku, style, duration_seconds, width, height,
          size_bytes, status, has_cover, used_count, metadata_error, last_scanned_at,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?)`
      )
      .run(
        id,
        video.relativePath,
        video.fileName,
        video.sku,
        video.style,
        video.durationSeconds,
        video.width,
        video.height,
        video.sizeBytes,
        video.status,
        video.metadataError,
        timestamp,
        timestamp,
        timestamp
      );
  }

  private updateScannedVideo(video: ScannedVideo, timestamp: string): void {
    this.db
      .prepare(
        `UPDATE videos SET
          file_name = ?,
          duration_seconds = ?,
          width = ?,
          height = ?,
          size_bytes = ?,
          status = ?,
          metadata_error = ?,
          last_scanned_at = ?,
          updated_at = ?
        WHERE relative_path = ?`
      )
      .run(
        video.fileName,
        video.durationSeconds,
        video.width,
        video.height,
        video.sizeBytes,
        video.status,
        video.metadataError,
        timestamp,
        timestamp,
        video.relativePath
      );
  }

  private applyStatusPayload(input: {
    payload: {
      task_id: string;
      attempt_no: number;
      run_key: string;
      status: "running" | "success" | "failed" | "skipped";
      executed_at?: string | null;
      platform_post_url?: string | null;
      error_code?: string | null;
      error_message?: string | null;
      rpa_log?: string | null;
    };
    relativePath: string;
    fileHash: string;
    fileMtime: number | null;
  }): void {
    const timestamp = nowIso();
    this.runInTransaction(() => {
      const existingProcessed = this.db
        .prepare("SELECT id FROM processed_status_files WHERE run_key = ? AND file_hash = ?")
        .get(input.payload.run_key, input.fileHash);
      if (existingProcessed) {
        return;
      }

      const row = this.db.prepare("SELECT id, video_id, title_id, status FROM task_rows WHERE run_key = ?").get(input.payload.run_key);
      if (!row) {
        throw new Error(`状态文件引用的 run_key 不存在：${input.payload.run_key}`);
      }

      const taskId = rowString(row, "id");
      if (taskId !== input.payload.task_id) {
        throw new Error(`状态文件 task_id 与 run_key 对应任务不一致：${input.payload.task_id}`);
      }

      const previousStatus = rowString(row, "status") as TaskRowStatus;
      this.db
        .prepare(
          `INSERT INTO processed_status_files (id, run_key, file_hash, processed_at)
           VALUES (?, ?, ?, ?)`
        )
        .run(crypto.randomUUID(), input.payload.run_key, input.fileHash, timestamp);
      this.db
        .prepare(
          `INSERT INTO task_status_events (
            id, task_id, attempt_no, run_key, status, status_file_relative_path,
            status_file_mtime, status_file_hash, executed_at, platform_post_url,
            error_code, error_message, rpa_log, ingested_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          crypto.randomUUID(),
          taskId,
          input.payload.attempt_no,
          input.payload.run_key,
          input.payload.status,
          input.relativePath,
          input.fileMtime,
          input.fileHash,
          input.payload.executed_at ?? null,
          input.payload.platform_post_url ?? null,
          input.payload.error_code ?? null,
          input.payload.error_message ?? null,
          input.payload.rpa_log ?? null,
          timestamp
        );

      this.db
        .prepare(
          `UPDATE task_rows SET
            status = ?,
            attempt_no = ?,
            error_code = ?,
            error_message = ?,
            updated_at = ?
          WHERE id = ?`
        )
        .run(
          input.payload.status,
          input.payload.attempt_no,
          input.payload.error_code ?? null,
          input.payload.error_message ?? null,
          timestamp,
          taskId
        );

      if (input.payload.status === "success" && previousStatus !== "success") {
        const videoId = rowString(row, "video_id");
        const titleId = rowOptionalString(row, "title_id");
        this.db
          .prepare("UPDATE videos SET status = 'used', used_count = used_count + 1, last_used_at = ?, updated_at = ? WHERE id = ?")
          .run(input.payload.executed_at ?? timestamp, timestamp, videoId);
        if (titleId) {
          this.db
            .prepare("UPDATE titles SET use_count = use_count + 1, last_used_at = ?, updated_at = ? WHERE id = ?")
            .run(input.payload.executed_at ?? timestamp, timestamp, titleId);
        }
      }

      this.refreshTaskSheetStatus(taskId, timestamp);
    });
  }

  private refreshTaskSheetStatus(taskRowId: string, timestamp: string): void {
    const row = this.db.prepare("SELECT sheet_id FROM task_rows WHERE id = ?").get(taskRowId);
    if (!row) {
      return;
    }
    const sheetId = rowString(row, "sheet_id");
    const counts = this.db
      .prepare(
        `SELECT
          COUNT(*) AS total_count,
          SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) AS success_count,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed_count,
          SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) AS running_count
         FROM task_rows
         WHERE sheet_id = ?`
      )
      .get(sheetId);
    if (!counts) {
      return;
    }
    const totalCount = rowNumber(counts, "total_count");
    const successCount = rowNumber(counts, "success_count");
    const failedCount = rowNumber(counts, "failed_count");
    const runningCount = rowNumber(counts, "running_count");
    const nextStatus: TaskSheetStatus =
      totalCount > 0 && successCount + failedCount === totalCount
        ? "completed"
        : runningCount > 0
          ? "running"
          : "exported";
    this.db.prepare("UPDATE task_sheets SET status = ?, updated_at = ? WHERE id = ?").run(nextStatus, timestamp, sheetId);
  }

  private runInTransaction(callback: () => void): void {
    this.db.exec("BEGIN IMMEDIATE;");
    try {
      callback();
      this.db.exec("COMMIT;");
    } catch (error) {
      this.db.exec("ROLLBACK;");
      throw error;
    }
  }
}
