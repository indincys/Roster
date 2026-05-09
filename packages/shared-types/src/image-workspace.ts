import { z } from "zod";
import { ImageLibraryItemSchema } from "./image";
import { ProviderIdSchema } from "./provider";

export const ImagePromptWorkspaceModelSchema = z.object({
  provider: ProviderIdSchema,
  model: z.string().trim().min(1)
});

export const ImageSceneOutputSubdirSchema = z.enum(["main", "detail", "live_cover"]);
export const ImageSceneAspectRatioSchema = z.enum(["1:1", "3:4", "9:16", "16:9"]);

export const ImageScenePresetSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1),
  skillId: z.string().trim().min(1).nullable(),
  defaultAspectRatio: ImageSceneAspectRatioSchema,
  defaultPerPromptCount: z.number().int().min(1).max(8),
  defaultOutputSubdir: ImageSceneOutputSubdirSchema,
  defaultImageModel: z.string().trim().min(1),
  isBuiltin: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const ImageScenePresetSaveInputSchema = z.object({
  presetId: z.string().trim().min(1).optional(),
  name: z.string().trim().min(1).max(40),
  skillId: z.string().trim().min(1).nullable().optional(),
  defaultAspectRatio: ImageSceneAspectRatioSchema.default("1:1"),
  defaultPerPromptCount: z.number().int().min(1).max(8).default(2),
  defaultOutputSubdir: ImageSceneOutputSubdirSchema.default("main"),
  defaultImageModel: z.string().trim().min(1).default("mock-image")
});

export const ImagePromptWorkspaceGenerateInputSchema = z.object({
  skillId: z.string().trim().min(1),
  scene: z.string().trim().min(1),
  seed: z.string().trim().optional().default(""),
  count: z.number().int().min(1).max(100).default(5),
  model: ImagePromptWorkspaceModelSchema
});

export const ImagePromptWorkspaceGenerateResultSchema = z.object({
  skillId: z.string().min(1),
  scene: z.string().min(1),
  prompts: z.array(z.string().trim().min(1)),
  text: z.string(),
  provider: ProviderIdSchema,
  model: z.string().min(1),
  usage: z
    .object({
      inputTokens: z.number().int().nonnegative(),
      outputTokens: z.number().int().nonnegative(),
      totalTokens: z.number().int().nonnegative()
    })
    .nullable()
});

export const ImageWorkspaceGenerateInputSchema = z.object({
  promptIds: z.array(z.string().min(1)).min(1),
  model: z.string().trim().min(1).default("mock-image"),
  aspectRatio: ImageSceneAspectRatioSchema.default("1:1"),
  perPromptCount: z.number().int().min(1).max(8).default(1),
  outputSubdir: ImageSceneOutputSubdirSchema.default("main")
});

export const ImageWorkspaceGenerateResultSchema = z.object({
  requested: z.number().int().nonnegative(),
  savedImages: z.array(ImageLibraryItemSchema)
});

export type ImagePromptWorkspaceModel = z.infer<typeof ImagePromptWorkspaceModelSchema>;
export type ImageSceneOutputSubdir = z.infer<typeof ImageSceneOutputSubdirSchema>;
export type ImageSceneAspectRatio = z.infer<typeof ImageSceneAspectRatioSchema>;
export type ImageScenePreset = z.infer<typeof ImageScenePresetSchema>;
export type ImageScenePresetSaveInput = z.infer<typeof ImageScenePresetSaveInputSchema>;
export type ImagePromptWorkspaceGenerateInput = z.infer<typeof ImagePromptWorkspaceGenerateInputSchema>;
export type ImagePromptWorkspaceGenerateResult = z.infer<typeof ImagePromptWorkspaceGenerateResultSchema>;
export type ImageWorkspaceGenerateInput = z.infer<typeof ImageWorkspaceGenerateInputSchema>;
export type ImageWorkspaceGenerateResult = z.infer<typeof ImageWorkspaceGenerateResultSchema>;
