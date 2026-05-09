import { z } from "zod";

export const WorkspaceIdSchema = z.string().min(1);

export const WorkspacePathMappingSchema = z.object({
  macRootPath: z.string().min(1, "Mac 根路径不能为空"),
  winRootPath: z.string().min(1, "Windows 根路径不能为空")
});

export const WorkspaceCreateInputSchema = z.object({
  name: z.string().trim().min(1, "工作空间名称不能为空"),
  rootPath: z.string().min(1, "工作空间根目录不能为空"),
  macRootPath: z.string().min(1, "Mac 根路径不能为空"),
  winRootPath: z.string().min(1, "Windows 根路径不能为空"),
  copySkillConfigFromWorkspaceId: z.string().optional()
});

export const WorkspaceRecordSchema = z.object({
  id: WorkspaceIdSchema,
  name: z.string(),
  rootPath: z.string(),
  macRootPath: z.string(),
  winRootPath: z.string(),
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
