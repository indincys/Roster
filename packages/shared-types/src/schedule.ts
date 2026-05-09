import { z } from "zod";

export const ScheduledJobTypeSchema = z.enum(["task_sheet", "title_generation", "image_generation", "script_generation"]);
export const ScheduledJobStatusSchema = z.enum(["enabled", "paused"]);
export const ScheduledJobRunStatusSchema = z.enum(["success", "failed", "skipped"]);
export const ScheduledJobMissedRunPolicySchema = z.enum(["catch_up_last", "catch_up_all", "skip"]);

export const ScheduledJobRecordSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: ScheduledJobTypeSchema,
  status: ScheduledJobStatusSchema,
  scheduleLabel: z.string().min(1),
  nextRunAt: z.string().nullable(),
  missedRunPolicy: ScheduledJobMissedRunPolicySchema,
  targetPage: z.string().min(1),
  lastRunStatus: ScheduledJobRunStatusSchema.nullable(),
  lastError: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const ScheduledJobRunRecordSchema = z.object({
  id: z.string().min(1),
  jobId: z.string().min(1),
  status: ScheduledJobRunStatusSchema,
  startedAt: z.string(),
  finishedAt: z.string().nullable(),
  durationMs: z.number().int().nonnegative().nullable(),
  artifactSummary: z.string().nullable(),
  errorMessage: z.string().nullable()
});

export const ScheduledJobSaveInputSchema = z.object({
  jobId: z.string().min(1).optional(),
  name: z.string().trim().min(1),
  type: ScheduledJobTypeSchema,
  status: ScheduledJobStatusSchema.default("enabled"),
  scheduleLabel: z.string().trim().min(1),
  nextRunAt: z.string().nullable().optional(),
  missedRunPolicy: ScheduledJobMissedRunPolicySchema.default("catch_up_last"),
  targetPage: z.string().trim().min(1)
});

export const ScheduledJobToggleInputSchema = z.object({
  jobId: z.string().min(1),
  enabled: z.boolean()
});

export const ScheduledJobRunsListInputSchema = z.object({
  jobId: z.string().min(1),
  limit: z.number().int().min(1).max(100).default(20)
});

export type ScheduledJobType = z.infer<typeof ScheduledJobTypeSchema>;
export type ScheduledJobStatus = z.infer<typeof ScheduledJobStatusSchema>;
export type ScheduledJobRunStatus = z.infer<typeof ScheduledJobRunStatusSchema>;
export type ScheduledJobMissedRunPolicy = z.infer<typeof ScheduledJobMissedRunPolicySchema>;
export type ScheduledJobRecord = z.infer<typeof ScheduledJobRecordSchema>;
export type ScheduledJobRunRecord = z.infer<typeof ScheduledJobRunRecordSchema>;
export type ScheduledJobSaveInput = z.infer<typeof ScheduledJobSaveInputSchema>;
export type ScheduledJobToggleInput = z.infer<typeof ScheduledJobToggleInputSchema>;
export type ScheduledJobRunsListInput = z.infer<typeof ScheduledJobRunsListInputSchema>;
