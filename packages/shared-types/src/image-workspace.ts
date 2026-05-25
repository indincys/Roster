import { z } from "zod";
import { ImageLibraryItemSchema } from "./image";
import { ProviderIdSchema } from "./provider";
import { IMAGE_GENERATION_PROMPT_MAX_LENGTH } from "./prompt";

export const ImagePromptWorkspaceModelSchema = z.object({
  provider: ProviderIdSchema,
  model: z.string().trim().min(1)
});

export const ImageWorkspaceProviderTargetSchema = z.object({
  provider: ProviderIdSchema,
  model: z.string().trim().min(1),
  apiKeyId: z.string().trim().min(1).nullable().optional()
});

export const ImageWorkspaceGenerationStrategySchema = z.enum(["all_providers", "load_balance"]);
export const ImageStudioResultHandlingSchema = z.enum(["auto_library", "manual_review"]);

export const ImageSceneOutputSubdirSchema = z.enum(["main", "detail", "live_cover"]);
export const ImageSceneAspectRatioSchema = z.enum(["1:1", "3:4", "9:16", "16:9"]);
export const ImageGenerationResolutionSchema = z.enum(["1k", "2k", "4k"]);
export const ImageGenerationQualitySchema = z.enum(["auto", "low", "medium", "high"]);
export const ImageGenerationOutputFormatSchema = z.enum(["png", "jpeg", "webp"]);

export const IMAGE_GENERATION_RESOLUTIONS_BY_ASPECT_RATIO: Record<
  z.infer<typeof ImageSceneAspectRatioSchema>,
  readonly z.infer<typeof ImageGenerationResolutionSchema>[]
> = {
  "1:1": ["1k", "2k"],
  "3:4": ["1k", "2k", "4k"],
  "9:16": ["1k", "2k", "4k"],
  "16:9": ["1k", "2k", "4k"]
} as const;

export const IMAGE_GENERATION_DIMENSIONS_BY_ASPECT_RATIO: Record<
  z.infer<typeof ImageSceneAspectRatioSchema>,
  Partial<Record<z.infer<typeof ImageGenerationResolutionSchema>, { width: number; height: number }>>
> = {
  "1:1": {
    "1k": { width: 1024, height: 1024 },
    "2k": { width: 2048, height: 2048 }
  },
  "3:4": {
    "1k": { width: 1024, height: 1536 },
    "2k": { width: 1024, height: 1536 },
    "4k": { width: 2160, height: 3840 }
  },
  "9:16": {
    "1k": { width: 1024, height: 1536 },
    "2k": { width: 1024, height: 1536 },
    "4k": { width: 2160, height: 3840 }
  },
  "16:9": {
    "1k": { width: 1536, height: 864 },
    "2k": { width: 2048, height: 1152 },
    "4k": { width: 3840, height: 2160 }
  }
} as const;

export function imageGenerationDimensions(
  aspectRatio: z.infer<typeof ImageSceneAspectRatioSchema>,
  resolution: z.infer<typeof ImageGenerationResolutionSchema>
): { width: number; height: number } {
  const dimensions = IMAGE_GENERATION_DIMENSIONS_BY_ASPECT_RATIO[aspectRatio][resolution];
  if (!dimensions) {
    throw new Error(`${aspectRatio} 不支持 ${resolution} 分辨率`);
  }
  return dimensions;
}

export function imageGenerationSize(
  aspectRatio: z.infer<typeof ImageSceneAspectRatioSchema>,
  resolution: z.infer<typeof ImageGenerationResolutionSchema>
): string {
  const { width, height } = imageGenerationDimensions(aspectRatio, resolution);
  return `${width}x${height}`;
}

function validateImageResolutionForAspectRatio(
  input: {
    aspectRatio: z.infer<typeof ImageSceneAspectRatioSchema>;
    resolution: z.infer<typeof ImageGenerationResolutionSchema>;
  },
  ctx: z.RefinementCtx
): void {
  if (!IMAGE_GENERATION_RESOLUTIONS_BY_ASPECT_RATIO[input.aspectRatio].includes(input.resolution)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["resolution"],
      message: `${input.aspectRatio} 不支持 ${input.resolution} 分辨率`
    });
  }
}

export const ImageScenePresetSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1),
  skillId: z.string().trim().min(1).nullable(),
  defaultAspectRatio: ImageSceneAspectRatioSchema,
  defaultPerPromptCount: z.number().int().min(1).max(10),
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
  defaultPerPromptCount: z.number().int().min(1).max(10).default(2),
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

export const ImageWorkspaceGenerateInputSchema = z
  .object({
    promptIds: z.array(z.string().min(1)).min(1),
    provider: ProviderIdSchema.optional(),
    model: z.string().trim().min(1).default("mock-image"),
    targets: z.array(ImageWorkspaceProviderTargetSchema).optional().default([]),
    generationStrategy: ImageWorkspaceGenerationStrategySchema.default("load_balance"),
    aspectRatio: ImageSceneAspectRatioSchema.default("1:1"),
    resolution: ImageGenerationResolutionSchema.default("1k"),
    quality: ImageGenerationQualitySchema.default("auto"),
    outputFormat: ImageGenerationOutputFormatSchema.default("png"),
    perPromptCount: z.number().int().min(1).max(10).default(1),
    outputSubdir: ImageSceneOutputSubdirSchema.default("main"),
    resultHandling: ImageStudioResultHandlingSchema.default("auto_library")
  })
  .superRefine(validateImageResolutionForAspectRatio);

export const ImageWorkspaceGenerateResultSchema = z.object({
  requested: z.number().int().nonnegative(),
  savedImages: z.array(ImageLibraryItemSchema),
  failed: z.number().int().nonnegative().default(0),
  errors: z.array(z.string()).default([])
});

export const ImageWorkspaceModeSchema = z.enum(["batch", "quick", "i2i", "template"]);

export const ImageWorkspaceAdHocPromptSchema = z.object({
  text: z.string().trim().min(1).max(IMAGE_GENERATION_PROMPT_MAX_LENGTH, "提示词最多 1000 个字符"),
  label: z.string().trim().max(80).optional()
});

export const ImageWorkspaceAdHocGenerateInputSchema = z
  .object({
    mode: ImageWorkspaceModeSchema.default("quick"),
    scene: z.string().trim().min(1),
    prompts: z.array(ImageWorkspaceAdHocPromptSchema).min(1).max(40),
    provider: ProviderIdSchema.optional(),
    model: z.string().trim().min(1).default("mock-image"),
    targets: z.array(ImageWorkspaceProviderTargetSchema).optional().default([]),
    generationStrategy: ImageWorkspaceGenerationStrategySchema.default("load_balance"),
    aspectRatio: ImageSceneAspectRatioSchema.default("1:1"),
    resolution: ImageGenerationResolutionSchema.default("1k"),
    quality: ImageGenerationQualitySchema.default("auto"),
    outputFormat: ImageGenerationOutputFormatSchema.default("png"),
    perPromptCount: z.number().int().min(1).max(10).default(2),
    outputSubdir: ImageSceneOutputSubdirSchema.default("main"),
    resultHandling: ImageStudioResultHandlingSchema.default("auto_library")
  })
  .superRefine(validateImageResolutionForAspectRatio);

export const ImageWorkspaceAdHocGenerateResultSchema = ImageWorkspaceGenerateResultSchema.extend({
  promptIds: z.array(z.string())
});

export const ImageReferenceInputSchema = z.object({
  absolutePath: z.string().trim().min(1),
  fileName: z.string().trim().min(1),
  mimeType: z.string().trim().min(1),
  sizeBytes: z.number().int().positive()
});

export const ImageWorkspaceEditJobSchema = z
  .object({
    promptId: z.string().trim().min(1).optional(),
    promptText: z.string().trim().min(1).max(IMAGE_GENERATION_PROMPT_MAX_LENGTH).optional(),
    label: z.string().trim().max(80).optional(),
    references: z.array(ImageReferenceInputSchema).min(1).max(15)
  })
  .refine((job) => Boolean(job.promptId || job.promptText), {
    message: "图生图任务必须提供 promptId 或 promptText"
  });

export const ImageWorkspaceEditGenerateInputSchema = z
  .object({
    scene: z.string().trim().min(1),
    jobs: z.array(ImageWorkspaceEditJobSchema).min(1).max(200),
    provider: ProviderIdSchema.optional(),
    model: z.string().trim().min(1).default("mock-image"),
    targets: z.array(ImageWorkspaceProviderTargetSchema).optional().default([]),
    generationStrategy: ImageWorkspaceGenerationStrategySchema.default("load_balance"),
    aspectRatio: ImageSceneAspectRatioSchema.default("1:1"),
    resolution: ImageGenerationResolutionSchema.default("1k"),
    quality: ImageGenerationQualitySchema.default("auto"),
    outputFormat: ImageGenerationOutputFormatSchema.default("png"),
    perPromptCount: z.number().int().min(1).max(10).default(1),
    outputSubdir: ImageSceneOutputSubdirSchema.default("main"),
    resultHandling: ImageStudioResultHandlingSchema.default("auto_library")
  })
  .superRefine(validateImageResolutionForAspectRatio);

export const ImageReferenceFolderMixedModeSchema = z.enum(["root", "subfolders", "all"]);
export const ImageReferenceFolderInspectInputSchema = z.object({
  folderPath: z.string().trim().min(1),
  mixedMode: ImageReferenceFolderMixedModeSchema.optional()
});

export const ImageReferenceFolderTaskSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  folderPath: z.string().min(1).nullable(),
  references: z.array(ImageReferenceInputSchema).min(1).max(15),
  skipped: z.number().int().nonnegative().default(0)
});

export const ImageReferenceFolderInspectResultSchema = z.object({
  canceled: z.boolean().default(false),
  folderPath: z.string().nullable(),
  structure: z.enum(["empty", "flat", "nested", "mixed"]),
  requiresMixedMode: z.boolean().default(false),
  rootImages: z.array(ImageReferenceInputSchema).default([]),
  subfolderTasks: z.array(ImageReferenceFolderTaskSchema).default([]),
  tasks: z.array(ImageReferenceFolderTaskSchema).default([]),
  skipped: z.number().int().nonnegative().default(0),
  warnings: z.array(z.string()).default([])
});

export const ImageReferenceFileChooseResultSchema = z.object({
  canceled: z.boolean(),
  references: z.array(ImageReferenceInputSchema).default([])
});

export const ImageReferenceFolderChooseResultSchema = z.object({
  canceled: z.boolean(),
  folderPath: z.string().nullable()
});

export const ImageReviewUpdateInputSchema = z.object({
  imageId: z.string().min(1),
  reviewStatus: z.literal("approved")
});

export type ImagePromptWorkspaceModel = z.infer<typeof ImagePromptWorkspaceModelSchema>;
export type ImageWorkspaceProviderTarget = z.infer<typeof ImageWorkspaceProviderTargetSchema>;
export type ImageWorkspaceGenerationStrategy = z.infer<typeof ImageWorkspaceGenerationStrategySchema>;
export type ImageStudioResultHandling = z.infer<typeof ImageStudioResultHandlingSchema>;
export type ImageSceneOutputSubdir = z.infer<typeof ImageSceneOutputSubdirSchema>;
export type ImageSceneAspectRatio = z.infer<typeof ImageSceneAspectRatioSchema>;
export type ImageGenerationResolution = z.infer<typeof ImageGenerationResolutionSchema>;
export type ImageGenerationQuality = z.infer<typeof ImageGenerationQualitySchema>;
export type ImageGenerationOutputFormat = z.infer<typeof ImageGenerationOutputFormatSchema>;
export type ImageScenePreset = z.infer<typeof ImageScenePresetSchema>;
export type ImageScenePresetSaveInput = z.infer<typeof ImageScenePresetSaveInputSchema>;
export type ImagePromptWorkspaceGenerateInput = z.infer<typeof ImagePromptWorkspaceGenerateInputSchema>;
export type ImagePromptWorkspaceGenerateResult = z.infer<typeof ImagePromptWorkspaceGenerateResultSchema>;
export type ImageWorkspaceGenerateInput = z.infer<typeof ImageWorkspaceGenerateInputSchema>;
export type ImageWorkspaceGenerateResult = z.infer<typeof ImageWorkspaceGenerateResultSchema>;
export type ImageWorkspaceMode = z.infer<typeof ImageWorkspaceModeSchema>;
export type ImageWorkspaceAdHocPrompt = z.infer<typeof ImageWorkspaceAdHocPromptSchema>;
export type ImageWorkspaceAdHocGenerateInput = z.infer<typeof ImageWorkspaceAdHocGenerateInputSchema>;
export type ImageWorkspaceAdHocGenerateResult = z.infer<typeof ImageWorkspaceAdHocGenerateResultSchema>;
export type ImageReferenceInput = z.infer<typeof ImageReferenceInputSchema>;
export type ImageWorkspaceEditJob = z.infer<typeof ImageWorkspaceEditJobSchema>;
export type ImageWorkspaceEditGenerateInput = z.infer<typeof ImageWorkspaceEditGenerateInputSchema>;
export type ImageReferenceFolderMixedMode = z.infer<typeof ImageReferenceFolderMixedModeSchema>;
export type ImageReferenceFolderInspectInput = z.infer<typeof ImageReferenceFolderInspectInputSchema>;
export type ImageReferenceFolderTask = z.infer<typeof ImageReferenceFolderTaskSchema>;
export type ImageReferenceFolderInspectResult = z.infer<typeof ImageReferenceFolderInspectResultSchema>;
export type ImageReferenceFileChooseResult = z.infer<typeof ImageReferenceFileChooseResultSchema>;
export type ImageReferenceFolderChooseResult = z.infer<typeof ImageReferenceFolderChooseResultSchema>;
export type ImageReviewUpdateInput = z.infer<typeof ImageReviewUpdateInputSchema>;
