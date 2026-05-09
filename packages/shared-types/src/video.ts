import { z } from "zod";
import { RelativeWorkspacePathSchema } from "./path";

export const VideoStatusSchema = z.enum(["active", "used", "archived", "metadata_error", "placeholder"]);

export const VideoRecordSchema = z.object({
  id: z.string().min(1),
  relativePath: RelativeWorkspacePathSchema,
  fileName: z.string().min(1),
  sku: z.string().nullable(),
  style: z.string().nullable(),
  durationSeconds: z.number().nullable(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
  sizeBytes: z.number().int().nonnegative().nullable(),
  status: VideoStatusSchema,
  thumbnailRelativePath: RelativeWorkspacePathSchema.nullable(),
  coverRelativePath: RelativeWorkspacePathSchema.nullable(),
  hasCover: z.boolean(),
  usedCount: z.number().int().nonnegative(),
  note: z.string().nullable(),
  metadataError: z.string().nullable(),
  lastScannedAt: z.string().nullable(),
  lastUsedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const VideoLibraryItemSchema = VideoRecordSchema.extend({
  currentAbsolutePath: z.string().min(1),
  thumbnailAbsolutePath: z.string().min(1).nullable(),
  thumbnailUrl: z.string().min(1).nullable(),
  previewUrl: z.string().min(1).nullable()
});

export const VideoMetadataSchema = z.object({
  durationSeconds: z.number().nonnegative().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional()
});

export const VideoScanSummarySchema = z.object({
  scanned: z.number().int().nonnegative(),
  added: z.number().int().nonnegative(),
  updated: z.number().int().nonnegative(),
  archived: z.number().int().nonnegative(),
  failedMetadata: z.number().int().nonnegative(),
  placeholders: z.number().int().nonnegative()
});

export const VideoUpdateInputSchema = z.object({
  videoId: z.string().min(1),
  sku: z.string().trim().min(1).nullable().optional(),
  style: z.string().trim().min(1).nullable().optional(),
  note: z.string().trim().nullable().optional()
});

export const VideoBatchUpdateInputSchema = z.object({
  videoIds: z.array(z.string().min(1)).min(1),
  sku: z.string().trim().min(1).nullable().optional(),
  style: z.string().trim().min(1).nullable().optional(),
  status: VideoStatusSchema.optional()
});

export const CoverAspectRatioSchema = z.enum(["3:4", "9:16", "1:1", "custom"]);

export const CoverCropPositionSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1)
});

export const CoverApplyInputSchema = z.object({
  videoId: z.string().min(1),
  aspectRatio: CoverAspectRatioSchema.default("3:4"),
  customRatio: z
    .object({
      width: z.number().int().min(1).max(100),
      height: z.number().int().min(1).max(100)
    })
    .optional(),
  cropPosition: CoverCropPositionSchema.optional(),
  frameIndex: z.number().int().nonnegative().optional()
});

export const CoverApplyResultSchema = z.object({
  video: VideoLibraryItemSchema,
  coverRelativePath: RelativeWorkspacePathSchema,
  coverAbsolutePath: z.string().min(1)
});

export const CoverBatchApplyFirstFrameInputSchema = z.object({
  aspectRatio: CoverAspectRatioSchema.default("3:4"),
  customRatio: z
    .object({
      width: z.number().int().min(1).max(100),
      height: z.number().int().min(1).max(100)
    })
    .optional()
});

export const CoverBatchApplyFirstFrameResultSchema = z.object({
  applied: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
  videos: z.array(VideoLibraryItemSchema),
  coverRelativePaths: z.array(RelativeWorkspacePathSchema)
});

export const CoverTimelineFrameSchema = z.object({
  index: z.number().int().nonnegative(),
  second: z.number().nonnegative(),
  cacheRelativePath: RelativeWorkspacePathSchema,
  url: z.string().min(1)
});

export const CoverTimelineInputSchema = z.object({
  videoId: z.string().min(1),
  frameCount: z.number().int().min(1).max(60).default(30)
});

export const CoverTimelineResultSchema = z.object({
  videoId: z.string().min(1),
  durationSeconds: z.number().nonnegative(),
  frames: z.array(CoverTimelineFrameSchema),
  generated: z.boolean(),
  error: z.string().nullable()
});

export type VideoStatus = z.infer<typeof VideoStatusSchema>;
export type VideoRecord = z.infer<typeof VideoRecordSchema>;
export type VideoLibraryItem = z.infer<typeof VideoLibraryItemSchema>;
export type VideoMetadata = z.infer<typeof VideoMetadataSchema>;
export type VideoScanSummary = z.infer<typeof VideoScanSummarySchema>;
export type VideoUpdateInput = z.infer<typeof VideoUpdateInputSchema>;
export type VideoBatchUpdateInput = z.infer<typeof VideoBatchUpdateInputSchema>;
export type CoverAspectRatio = z.infer<typeof CoverAspectRatioSchema>;
export type CoverCropPosition = z.infer<typeof CoverCropPositionSchema>;
export type CoverApplyInput = z.infer<typeof CoverApplyInputSchema>;
export type CoverApplyResult = z.infer<typeof CoverApplyResultSchema>;
export type CoverBatchApplyFirstFrameInput = z.infer<typeof CoverBatchApplyFirstFrameInputSchema>;
export type CoverBatchApplyFirstFrameResult = z.infer<typeof CoverBatchApplyFirstFrameResultSchema>;
export type CoverTimelineFrame = z.infer<typeof CoverTimelineFrameSchema>;
export type CoverTimelineInput = z.infer<typeof CoverTimelineInputSchema>;
export type CoverTimelineResult = z.infer<typeof CoverTimelineResultSchema>;
