import { z } from "zod";

export const TitleStatusSchema = z.enum(["active", "archived"]);

export const TitleRecordSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  sourceSkillId: z.string().nullable(),
  score: z.number().int().nullable(),
  useCount: z.number().int().nonnegative(),
  status: TitleStatusSchema,
  notes: z.string().nullable(),
  lastUsedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const TitleSaveInputSchema = z.object({
  titleId: z.string().min(1).optional(),
  text: z.string().trim().min(1, "标题不能为空"),
  sourceSkillId: z.string().trim().nullable().optional(),
  score: z.number().int().min(0).max(100).nullable().optional(),
  status: TitleStatusSchema.default("active"),
  notes: z.string().trim().nullable().optional()
});

export type TitleStatus = z.infer<typeof TitleStatusSchema>;
export type TitleRecord = z.infer<typeof TitleRecordSchema>;
export type TitleSaveInput = z.infer<typeof TitleSaveInputSchema>;
