import { z } from "zod";

export const WorkspaceIdSchema = z.string().min(1);

export const WorkspacePathMappingSchema = z.object({
  macRootPath: z.string().min(1, "Mac 根路径不能为空"),
  winRootPath: z.string().trim().default("")
});

export const WorkspaceCreateInputSchema = z.object({
  name: z.string().trim().min(1, "工作空间名称不能为空"),
  rootPath: z.string().min(1, "工作空间根目录不能为空"),
  macRootPath: z.string().min(1, "Mac 根路径不能为空"),
  winRootPath: z.string().trim().default(""),
  videoLibraryRootPath: z.string().trim().default(""),
  videoLibraryMacRootPath: z.string().trim().default(""),
  videoLibraryWinRootPath: z.string().trim().default(""),
  copySkillConfigFromWorkspaceId: z.string().optional()
});

export const WorkspaceUpdateInputSchema = z.object({
  workspaceId: WorkspaceIdSchema,
  name: z.string().trim().min(1, "工作空间名称不能为空"),
  rootPath: z.string().min(1, "工作空间根目录不能为空"),
  macRootPath: z.string().min(1, "Mac 根路径不能为空"),
  winRootPath: z.string().trim().default(""),
  videoLibraryRootPath: z.string().trim().default(""),
  videoLibraryMacRootPath: z.string().trim().default(""),
  videoLibraryWinRootPath: z.string().trim().default("")
});

export const WorkspaceDeleteInputSchema = z.object({
  workspaceId: WorkspaceIdSchema
});

export const WorkspacePathValidationInputSchema = z.object({
  rootPath: z.string().trim().optional().default(""),
  macRootPath: z.string().trim().optional().default(""),
  winRootPath: z.string().trim().optional().default(""),
  videoLibraryRootPath: z.string().trim().optional().default(""),
  videoLibraryMacRootPath: z.string().trim().optional().default(""),
  videoLibraryWinRootPath: z.string().trim().optional().default(""),
  requireRpaPath: z.boolean().optional().default(false)
});

export const WorkspacePathValidationResultSchema = z.object({
  ok: z.boolean(),
  errors: z.array(z.string()),
  normalized: z.object({
    rootPath: z.string(),
    macRootPath: z.string(),
    winRootPath: z.string(),
    videoLibraryRootPath: z.string(),
    videoLibraryMacRootPath: z.string(),
    videoLibraryWinRootPath: z.string()
  })
});

export const WorkspaceRecordSchema = z.object({
  id: WorkspaceIdSchema,
  name: z.string(),
  rootPath: z.string(),
  macRootPath: z.string(),
  winRootPath: z.string(),
  videoLibraryRootPath: z.string(),
  videoLibraryMacRootPath: z.string(),
  videoLibraryWinRootPath: z.string(),
  color: z.string(),
  isDefault: z.boolean(),
  isReadOnly: z.boolean(),
  lastOpenedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const WorkspaceRuntimeStateSchema = z.object({
  activeWorkspaceId: WorkspaceIdSchema.nullable(),
  workspaces: z.array(WorkspaceRecordSchema)
});

export const WorkspaceCloudSyncCheckResultSchema = z.object({
  workspaceId: WorkspaceIdSchema,
  rootPath: z.string().min(1),
  provider: z.enum(["onedrive", "dropbox", "jianguoyun", "icloud", "unknown"]).nullable(),
  likelySynced: z.boolean(),
  rootExists: z.boolean(),
  rootWritable: z.boolean(),
  warnings: z.array(z.string())
});

export type WorkspacePathMapping = z.infer<typeof WorkspacePathMappingSchema>;
export type WorkspaceCreateInput = z.infer<typeof WorkspaceCreateInputSchema>;
export type WorkspaceUpdateInput = z.infer<typeof WorkspaceUpdateInputSchema>;
export type WorkspaceDeleteInput = z.infer<typeof WorkspaceDeleteInputSchema>;
export type WorkspacePathValidationInput = z.input<typeof WorkspacePathValidationInputSchema>;
export type WorkspacePathValidationResult = z.infer<typeof WorkspacePathValidationResultSchema>;
export type WorkspaceRecord = z.infer<typeof WorkspaceRecordSchema>;
export type WorkspaceRuntimeState = z.infer<typeof WorkspaceRuntimeStateSchema>;
export type WorkspaceCloudSyncCheckResult = z.infer<typeof WorkspaceCloudSyncCheckResultSchema>;

export const WORKSPACE_DIRECTORIES = [
  "videos",
  "covers",
  "images",
  "tasks",
  "skills_config",
  "_backup"
] as const;

export type WorkspaceDirectory = (typeof WORKSPACE_DIRECTORIES)[number];

export const ImageSubdirectories = ["main", "detail", "live_cover", "_trash"] as const;

export type ImageSubdirectory = (typeof ImageSubdirectories)[number];
