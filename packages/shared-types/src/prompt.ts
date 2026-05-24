import { z } from "zod";

export const IMAGE_GENERATION_PROMPT_MAX_LENGTH = 1000;

export const PromptStatusSchema = z.enum(["active", "archived", "negative"]);

export const PromptRecordSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  scene: z.string().min(1),
  generatedCount: z.number().int().nonnegative(),
  keptCount: z.number().int().nonnegative(),
  status: PromptStatusSchema,
  notes: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const PromptSaveInputSchema = z.object({
  promptId: z.string().min(1).optional(),
  text: z.string().trim().min(1, "提示词不能为空").max(IMAGE_GENERATION_PROMPT_MAX_LENGTH, "提示词最多 1000 个字符"),
  scene: z.string().trim().min(1, "场景不能为空"),
  status: PromptStatusSchema.default("active"),
  notes: z.string().trim().nullable().optional()
});

export type PromptStatus = z.infer<typeof PromptStatusSchema>;
export type PromptRecord = z.infer<typeof PromptRecordSchema>;
export type PromptSaveInput = z.infer<typeof PromptSaveInputSchema>;
