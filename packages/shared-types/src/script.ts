import { z } from "zod";

export const ScriptStatusSchema = z.enum(["active", "archived"]);

export const ScriptRecordSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  sourceSkillId: z.string().nullable(),
  skuCode: z.string().nullable(),
  useCount: z.number().int().nonnegative(),
  status: ScriptStatusSchema,
  notes: z.string().nullable(),
  lastUsedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const ScriptSaveInputSchema = z.object({
  scriptId: z.string().min(1).optional(),
  text: z.string().trim().min(1, "文案不能为空"),
  sourceSkillId: z.string().trim().nullable().optional(),
  skuCode: z.string().trim().nullable().optional(),
  status: ScriptStatusSchema.default("active"),
  notes: z.string().trim().nullable().optional()
});

export const ScriptExportFormatSchema = z.enum(["txt", "csv"]);

export const ScriptExportInputSchema = z.object({
  scriptIds: z.array(z.string().trim().min(1)).optional().default([]),
  formats: z.array(ScriptExportFormatSchema).min(1).default(["txt", "csv"])
});

export const ScriptExportResultSchema = z.object({
  exportRelativeDir: z.string().min(1),
  exportAbsoluteDir: z.string().min(1),
  writtenFiles: z.array(z.string().min(1)),
  exportedCount: z.number().int().nonnegative()
});

export type ScriptStatus = z.infer<typeof ScriptStatusSchema>;
export type ScriptRecord = z.infer<typeof ScriptRecordSchema>;
export type ScriptSaveInput = z.infer<typeof ScriptSaveInputSchema>;
export type ScriptExportFormat = z.infer<typeof ScriptExportFormatSchema>;
export type ScriptExportInput = z.infer<typeof ScriptExportInputSchema>;
export type ScriptExportResult = z.infer<typeof ScriptExportResultSchema>;
