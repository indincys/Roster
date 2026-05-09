import { z } from "zod";
import { RelativeWorkspacePathSchema } from "./path";
import { PromptRecordSchema } from "./prompt";

export const ImageStatusSchema = z.enum(["active", "soft_deleted", "archived"]);

export const ImageRecordSchema = z.object({
  id: z.string().min(1),
  promptId: z.string().nullable(),
  relativePath: RelativeWorkspacePathSchema,
  fileName: z.string().min(1),
  scene: z.string().min(1),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  aspectRatio: z.string().nullable(),
  sourceModel: z.string().nullable(),
  status: ImageStatusSchema,
  tags: z.string().nullable(),
  notes: z.string().nullable(),
  generatedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const ImageLibraryItemSchema = ImageRecordSchema.extend({
  currentAbsolutePath: z.string().min(1)
});

export const ImageSaveInputSchema = z.object({
  imageId: z.string().min(1).optional(),
  promptId: z.string().trim().nullable().optional(),
  relativePath: RelativeWorkspacePathSchema,
  scene: z.string().trim().min(1, "场景不能为空"),
  width: z.number().int().positive().nullable().optional(),
  height: z.number().int().positive().nullable().optional(),
  aspectRatio: z.string().trim().nullable().optional(),
  sourceModel: z.string().trim().nullable().optional(),
  status: ImageStatusSchema.default("active"),
  tags: z.string().trim().nullable().optional(),
  notes: z.string().trim().nullable().optional(),
  generatedAt: z.string().trim().nullable().optional()
});

export const ImageSoftDeleteInputSchema = z.object({
  imageId: z.string().min(1)
});

export const ImageSoftDeleteResultSchema = z.object({
  image: ImageLibraryItemSchema,
  trashRelativePath: RelativeWorkspacePathSchema,
  trashAbsolutePath: z.string().min(1),
  prompt: PromptRecordSchema.nullable(),
  suggestedNegativePrompt: z.boolean()
});

export type ImageStatus = z.infer<typeof ImageStatusSchema>;
export type ImageRecord = z.infer<typeof ImageRecordSchema>;
export type ImageLibraryItem = z.infer<typeof ImageLibraryItemSchema>;
export type ImageSaveInput = z.infer<typeof ImageSaveInputSchema>;
export type ImageSoftDeleteInput = z.infer<typeof ImageSoftDeleteInputSchema>;
export type ImageSoftDeleteResult = z.infer<typeof ImageSoftDeleteResultSchema>;
