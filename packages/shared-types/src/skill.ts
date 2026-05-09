import { z } from "zod";
import { ProviderIdSchema } from "./provider";

export const SkillWorkflowTypeSchema = z.enum(["title", "image_prompt", "image", "script", "cover"]);
export const SkillSourceTypeSchema = z.enum(["official", "copy", "user"]);

export const SkillMetaSchema = z.object({
  id: z.string().trim().min(1),
  displayName: z.string().trim().min(1),
  type: SkillWorkflowTypeSchema,
  sourceType: SkillSourceTypeSchema,
  version: z.string().trim().min(1).default("0.1.0"),
  description: z.string().trim().optional().default(""),
  defaultModel: z.string().trim().optional().nullable().default(null),
  supportedModels: z.array(z.string().trim().min(1)).optional().default([]),
  origin: z
    .object({
      skillId: z.string().trim().min(1),
      version: z.string().trim().min(1)
    })
    .optional()
    .nullable()
    .default(null)
});

export const SkillRecordSchema = SkillMetaSchema.extend({
  rootPath: z.string().min(1),
  isEditable: z.boolean(),
  isRestorable: z.boolean(),
  isMissing: z.boolean().default(false),
  updatedAt: z.string().nullable()
});

export const SkillSaveInputSchema = z.object({
  skillId: z.string().trim().min(1).optional(),
  displayName: z.string().trim().min(1, "Skill 名称不能为空"),
  type: SkillWorkflowTypeSchema,
  sourceType: z.enum(["copy", "user"]).default("user"),
  version: z.string().trim().min(1).default("0.1.0"),
  description: z.string().trim().optional().default(""),
  defaultModel: z.string().trim().nullable().optional(),
  supportedModels: z.array(z.string().trim().min(1)).optional().default([]),
  content: z.string().default(""),
  origin: SkillMetaSchema.shape.origin.optional()
});

export const SkillContentSchema = z.object({
  skillId: z.string().min(1),
  relativePath: z.string().min(1).default("SKILL.md"),
  content: z.string(),
  rootPath: z.string().min(1)
});

export const SkillContentRequestSchema = z.object({
  skillId: z.string().min(1),
  relativePath: z.string().min(1).default("SKILL.md")
});

export const SkillFileSchema = z.object({
  relativePath: z.string().min(1),
  name: z.string().min(1),
  isEntry: z.boolean(),
  sizeBytes: z.number().int().nonnegative(),
  updatedAt: z.string()
});

export const SkillFileSaveInputSchema = z.object({
  skillId: z.string().min(1),
  relativePath: z.string().min(1),
  content: z.string()
});

export const SkillSnapshotSchema = z.object({
  skillId: z.string().min(1),
  snapshotId: z.string().min(1),
  createdAt: z.string(),
  contentPreview: z.string()
});

export const SkillSnapshotRestoreInputSchema = z.object({
  skillId: z.string().min(1),
  snapshotId: z.string().min(1)
});

export const SkillCreateOfficialCopyInputSchema = z.object({
  skillId: z.string().trim().min(1),
  copySkillId: z.string().trim().min(1).optional(),
  displayName: z.string().trim().min(1).optional()
});

export const SkillOfficialCopyInputSchema = z.object({
  skillId: z.string().trim().min(1)
});

export const SkillActivationConfigSchema = z.object({
  workspaceId: z.string().min(1),
  enabledSkillIds: z.array(z.string().trim().min(1)),
  updatedAt: z.string()
});

export const SkillActivationUpdateInputSchema = z.object({
  workspaceId: z.string().min(1),
  enabledSkillIds: z.array(z.string().trim().min(1))
});

export const SkillTestModelSchema = z.object({
  provider: ProviderIdSchema,
  model: z.string().trim().min(1)
});

export const SkillTestInputSchema = z.object({
  skillId: z.string().trim().min(1),
  taskPrompt: z.string().trim().min(1, "请输入测试提示词"),
  model: SkillTestModelSchema
});

export const SkillTestResultSchema = z.object({
  skillId: z.string().min(1),
  provider: ProviderIdSchema,
  model: z.string().min(1),
  status: z.enum(["success", "failed"]),
  text: z.string(),
  error: z.string().nullable(),
  includedFiles: z.array(z.string()),
  usage: z
    .object({
      inputTokens: z.number().int().nonnegative(),
      outputTokens: z.number().int().nonnegative(),
      totalTokens: z.number().int().nonnegative()
    })
    .nullable()
});

export type SkillWorkflowType = z.infer<typeof SkillWorkflowTypeSchema>;
export type SkillSourceType = z.infer<typeof SkillSourceTypeSchema>;
export type SkillMeta = z.infer<typeof SkillMetaSchema>;
export type SkillRecord = z.infer<typeof SkillRecordSchema>;
export type SkillSaveInput = z.infer<typeof SkillSaveInputSchema>;
export type SkillContent = z.infer<typeof SkillContentSchema>;
export type SkillContentRequest = z.infer<typeof SkillContentRequestSchema>;
export type SkillFile = z.infer<typeof SkillFileSchema>;
export type SkillFileSaveInput = z.infer<typeof SkillFileSaveInputSchema>;
export type SkillSnapshot = z.infer<typeof SkillSnapshotSchema>;
export type SkillSnapshotRestoreInput = z.infer<typeof SkillSnapshotRestoreInputSchema>;
export type SkillCreateOfficialCopyInput = z.infer<typeof SkillCreateOfficialCopyInputSchema>;
export type SkillOfficialCopyInput = z.infer<typeof SkillOfficialCopyInputSchema>;
export type SkillActivationConfig = z.infer<typeof SkillActivationConfigSchema>;
export type SkillActivationUpdateInput = z.infer<typeof SkillActivationUpdateInputSchema>;
export type SkillTestModel = z.infer<typeof SkillTestModelSchema>;
export type SkillTestInput = z.infer<typeof SkillTestInputSchema>;
export type SkillTestResult = z.infer<typeof SkillTestResultSchema>;
