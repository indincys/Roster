import { z } from "zod";
import { RelativeWorkspacePathSchema } from "./path";

export const PlatformAccountSaveInputSchema = z.object({
  accountId: z.string().min(1).optional(),
  platform: z.string().trim().min(1, "平台不能为空"),
  accountName: z.string().trim().min(1, "账号名称不能为空"),
  enabled: z.boolean().default(true)
});

export const PlatformAccountRecordSchema = z.object({
  id: z.string().min(1),
  platform: z.string().min(1),
  accountName: z.string().min(1),
  enabled: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const TaskVideoStrategySchema = z.enum(["popular_sku", "low_publish", "recent_hot", "custom"]);
export const TaskTitleStrategySchema = z.enum(["best_score", "new_test", "random"]);
export const TaskRowStatusSchema = z.enum(["pending", "running", "success", "failed", "skipped"]);
export const TaskSheetStatusSchema = z.enum(["draft", "exported", "running", "completed"]);

export const TaskGenerateInputSchema = z.object({
  sheetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  videoCount: z.number().int().positive(),
  platformAccountIds: z.array(z.string().min(1)).min(1, "至少选择一个平台账号"),
  videoStrategy: TaskVideoStrategySchema.default("low_publish"),
  titleStrategy: TaskTitleStrategySchema.default("best_score"),
  defaultTagRatio: z.number().int().min(0).max(100).default(80),
  timeAnchors: z.array(z.string().regex(/^\d{2}:\d{2}$/)).min(1, "至少配置一个发布时间锚点"),
  jitterMinutes: z.number().int().min(0).max(180).default(15)
});

export const TaskRowRecordSchema = z.object({
  id: z.string().min(1),
  sheetId: z.string().min(1),
  runKey: z.string().min(1),
  attemptNo: z.number().int().positive(),
  sheetDate: z.string(),
  publishAt: z.string(),
  status: TaskRowStatusSchema,
  videoId: z.string().min(1),
  videoRelativePath: RelativeWorkspacePathSchema,
  videoFileName: z.string().min(1),
  sku: z.string().nullable(),
  style: z.string().nullable(),
  platformAccountId: z.string().min(1),
  platform: z.string().min(1),
  accountName: z.string().min(1),
  titleId: z.string().nullable(),
  titleText: z.string().nullable(),
  tagGroup: z.enum(["default", "test"]),
  tags: z.array(z.string()),
  coverRelativePath: RelativeWorkspacePathSchema.nullable(),
  errorCode: z.string().nullable(),
  errorMessage: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const TaskSheetRecordSchema = z.object({
  id: z.string().min(1),
  sheetDate: z.string(),
  name: z.string(),
  status: TaskSheetStatusSchema,
  exportRelativeDir: RelativeWorkspacePathSchema.nullable(),
  rows: z.array(TaskRowRecordSchema),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const TaskExportFormatSchema = z.enum(["xlsx", "csv", "json"]);

export const TaskExportInputSchema = z.object({
  sheetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  formats: z.array(TaskExportFormatSchema).min(1).default(["xlsx", "csv", "json"]),
  targetPlatform: z.literal("windows").default("windows")
});

export const TaskExportPreflightItemSchema = z.object({
  taskId: z.string().min(1),
  relativePath: RelativeWorkspacePathSchema,
  targetPath: z.string().min(1),
  currentDevicePath: z.string().min(1),
  kind: z.enum(["video", "cover"]),
  expectedSize: z.number().nullable(),
  mtime: z.number().nullable(),
  localReadable: z.boolean(),
  localProbe: z.string(),
  warning: z.string().nullable()
});

export const TaskExportResultSchema = z.object({
  sheetDate: z.string(),
  exportRelativeDir: RelativeWorkspacePathSchema,
  exportAbsoluteDir: z.string(),
  statusRelativeDir: RelativeWorkspacePathSchema,
  statusAbsoluteDir: z.string(),
  writtenFiles: z.array(z.string()),
  preflight: z.object({
    schemaVersion: z.literal(1),
    generatedOn: z.enum(["macos", "windows", "linux"]),
    targetPlatform: z.literal("windows"),
    workspaceId: z.string().min(1),
    taskDate: z.string(),
    items: z.array(TaskExportPreflightItemSchema)
  }),
  warnings: z.array(z.string())
});

export const RpaStatusFileSchema = z.object({
  schema_version: z.number().int().positive().default(1),
  task_id: z.string().min(1),
  attempt_no: z.number().int().positive(),
  run_key: z.string().min(1),
  status: z.enum(["running", "success", "failed", "skipped"]),
  executed_at: z.string().nullable().optional(),
  platform_post_url: z.string().nullable().optional(),
  error_code: z.string().nullable().optional(),
  error_message: z.string().nullable().optional(),
  rpa_log: z.string().nullable().optional(),
  writer: z.string().nullable().optional()
});

export const TaskStatusScanInputSchema = z.object({
  sheetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
});

export const TaskStatusScanResultSchema = z.object({
  sheetDate: z.string(),
  scanned: z.number().int().nonnegative(),
  processed: z.number().int().nonnegative(),
  duplicates: z.number().int().nonnegative(),
  ignoredTmp: z.number().int().nonnegative(),
  errors: z.array(z.string())
});

export const TaskRetryInputSchema = z.object({
  taskId: z.string().min(1)
});

export const TaskManualStatusInputSchema = z.object({
  taskId: z.string().min(1),
  status: z.enum(["success", "failed"]),
  errorCode: z.string().nullable().optional(),
  errorMessage: z.string().nullable().optional()
});

export const TaskRowUpdateInputSchema = z.object({
  taskId: z.string().min(1),
  publishAt: z.string().optional(),
  titleText: z.string().nullable().optional(),
  tags: z.array(z.string()).max(5).optional()
});

export const TaskRowDeleteInputSchema = z.object({
  taskId: z.string().min(1)
});

export const TaskRowAddInputSchema = z.object({
  sheetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sourceTaskId: z.string().min(1).optional()
});

export const TaskBatchReplaceTitlesInputSchema = z.object({
  sheetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  taskIds: z.array(z.string().min(1)).optional(),
  titleStrategy: TaskTitleStrategySchema.default("random")
});

export interface AssignedPublishTime {
  anchor: string;
  time: string;
}

export type PlatformAccountSaveInput = z.infer<typeof PlatformAccountSaveInputSchema>;
export type PlatformAccountRecord = z.infer<typeof PlatformAccountRecordSchema>;
export type TaskVideoStrategy = z.infer<typeof TaskVideoStrategySchema>;
export type TaskTitleStrategy = z.infer<typeof TaskTitleStrategySchema>;
export type TaskRowStatus = z.infer<typeof TaskRowStatusSchema>;
export type TaskSheetStatus = z.infer<typeof TaskSheetStatusSchema>;
export type TaskGenerateInput = z.infer<typeof TaskGenerateInputSchema>;
export type TaskRowRecord = z.infer<typeof TaskRowRecordSchema>;
export type TaskSheetRecord = z.infer<typeof TaskSheetRecordSchema>;
export type TaskExportFormat = z.infer<typeof TaskExportFormatSchema>;
export type TaskExportInput = z.infer<typeof TaskExportInputSchema>;
export type TaskExportPreflightItem = z.infer<typeof TaskExportPreflightItemSchema>;
export type TaskExportResult = z.infer<typeof TaskExportResultSchema>;
export type RpaStatusFile = z.infer<typeof RpaStatusFileSchema>;
export type TaskStatusScanInput = z.infer<typeof TaskStatusScanInputSchema>;
export type TaskStatusScanResult = z.infer<typeof TaskStatusScanResultSchema>;
export type TaskRetryInput = z.infer<typeof TaskRetryInputSchema>;
export type TaskManualStatusInput = z.infer<typeof TaskManualStatusInputSchema>;
export type TaskRowUpdateInput = z.infer<typeof TaskRowUpdateInputSchema>;
export type TaskRowDeleteInput = z.infer<typeof TaskRowDeleteInputSchema>;
export type TaskRowAddInput = z.infer<typeof TaskRowAddInputSchema>;
export type TaskBatchReplaceTitlesInput = z.infer<typeof TaskBatchReplaceTitlesInputSchema>;
