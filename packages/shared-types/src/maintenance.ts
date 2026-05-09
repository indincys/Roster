import { z } from "zod";

export const WorkspaceBackupInputSchema = z.object({
  scope: z.enum(["database", "database_skills", "all"]).default("all"),
  retentionCount: z.number().int().min(1).max(100).default(7)
});

export const WorkspaceBackupResultSchema = z.object({
  backupRelativePath: z.string().min(1),
  backupAbsolutePath: z.string().min(1),
  sizeBytes: z.number().int().nonnegative()
});

export const WorkspaceRestoreInputSchema = z.object({
  backupAbsolutePath: z.string().trim().min(1)
});

export const WorkspaceRestoreResultSchema = z.object({
  restoredFrom: z.string().min(1),
  preRestoreBackupRelativePath: z.string().min(1),
  preRestoreBackupAbsolutePath: z.string().min(1),
  restoredFiles: z.number().int().nonnegative()
});

export const FeedbackPackageInputSchema = z.object({
  description: z.string().trim().optional().default(""),
  includeLogs: z.boolean().default(true),
  includeSystemInfo: z.boolean().default(true)
});

export const FeedbackPackageResultSchema = z.object({
  packageAbsolutePath: z.string().min(1),
  packageRelativePath: z.string().min(1),
  sizeBytes: z.number().int().nonnegative(),
  includedFiles: z.array(z.string())
});

export const CacheCleanupInputSchema = z.object({
  targets: z.array(z.enum(["video_thumbnails", "cover_timeline", "skill_market"])).min(1)
});

export const CacheCleanupResultSchema = z.object({
  removedFiles: z.number().int().nonnegative(),
  removedBytes: z.number().int().nonnegative(),
  cleanedTargets: z.array(z.string())
});

export const SoftwareUpdateCheckInputSchema = z.object({
  forceRefresh: z.boolean().default(false)
});

export const SoftwareUpdateStateSchema = z.enum([
  "idle",
  "checking",
  "available",
  "not_available",
  "downloading",
  "downloaded",
  "error"
]);

export const SoftwareUpdateCheckResultSchema = z.object({
  state: SoftwareUpdateStateSchema.default("idle"),
  currentVersion: z.string().min(1),
  latestVersion: z.string().min(1).nullable(),
  updateAvailable: z.boolean(),
  checkedAt: z.string().nullable(),
  releaseNotes: z.string().nullable(),
  downloadUrl: z.string().nullable(),
  sourceUrl: z.string().nullable(),
  error: z.string().nullable(),
  progressPercent: z.number().min(0).max(100).nullable().default(null),
  downloadedFile: z.string().nullable().default(null)
});

export const SoftwareUpdateInstallResultSchema = z.object({
  initiated: z.boolean()
});

export type WorkspaceBackupInput = z.input<typeof WorkspaceBackupInputSchema>;
export type WorkspaceBackupResult = z.infer<typeof WorkspaceBackupResultSchema>;
export type WorkspaceRestoreInput = z.infer<typeof WorkspaceRestoreInputSchema>;
export type WorkspaceRestoreResult = z.infer<typeof WorkspaceRestoreResultSchema>;
export type FeedbackPackageInput = z.infer<typeof FeedbackPackageInputSchema>;
export type FeedbackPackageResult = z.infer<typeof FeedbackPackageResultSchema>;
export type CacheCleanupInput = z.infer<typeof CacheCleanupInputSchema>;
export type CacheCleanupResult = z.infer<typeof CacheCleanupResultSchema>;
export type SoftwareUpdateCheckInput = z.input<typeof SoftwareUpdateCheckInputSchema>;
export type SoftwareUpdateState = z.infer<typeof SoftwareUpdateStateSchema>;
export type SoftwareUpdateCheckResult = z.infer<typeof SoftwareUpdateCheckResultSchema>;
export type SoftwareUpdateInstallResult = z.infer<typeof SoftwareUpdateInstallResultSchema>;
