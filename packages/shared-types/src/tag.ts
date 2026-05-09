import { z } from "zod";

export const TagGroupSchema = z.enum(["default", "test"]);

export const TagRecordSchema = z.object({
  id: z.string().min(1),
  skuCode: z.string().min(1),
  skuStyle: z.string().nullable(),
  tag1: z.string().nullable(),
  tag2: z.string().nullable(),
  tag3: z.string().nullable(),
  tag4: z.string().nullable(),
  tag5: z.string().nullable(),
  tagGroup: TagGroupSchema,
  useCount: z.number().int().nonnegative(),
  notes: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const TagImportSummarySchema = z.object({
  imported: z.number().int().nonnegative(),
  inserted: z.number().int().nonnegative(),
  updated: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
  errors: z.array(z.string())
});

export const TagSaveInputSchema = z.object({
  tagId: z.string().min(1).optional(),
  skuCode: z.string().trim().min(1, "SKU 不能为空"),
  skuStyle: z.string().trim().nullable().optional(),
  tag1: z.string().trim().nullable().optional(),
  tag2: z.string().trim().nullable().optional(),
  tag3: z.string().trim().nullable().optional(),
  tag4: z.string().trim().nullable().optional(),
  tag5: z.string().trim().nullable().optional(),
  tagGroup: TagGroupSchema,
  notes: z.string().trim().nullable().optional()
});

export type TagGroup = z.infer<typeof TagGroupSchema>;
export type TagRecord = z.infer<typeof TagRecordSchema>;
export type TagImportSummary = z.infer<typeof TagImportSummarySchema>;
export type TagSaveInput = z.infer<typeof TagSaveInputSchema>;
