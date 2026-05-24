import { existsSync } from "node:fs";
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import ffmpeg from "fluent-ffmpeg";
import type { VideoMetadata } from "@roster/shared-types";

export interface ThumbnailRequest {
  videoRelativePath: string;
  outputRelativeDir: string;
  frameCount: number;
}

export interface ThumbnailResult {
  frames: string[];
  durationSeconds: number;
}

export function createMockThumbnailResult(request: ThumbnailRequest): ThumbnailResult {
  return {
    frames: Array.from({ length: request.frameCount }, (_, index) => `${request.outputRelativeDir}/frame-${index}.jpg`),
    durationSeconds: request.frameCount
  };
}

export interface FfmpegToolPaths {
  ffmpegPath?: string;
  ffprobePath?: string;
}

export interface FirstFrameThumbnailInput {
  videoId: string;
  videoAbsolutePath: string;
}

export interface FirstFrameThumbnailOptions extends FfmpegToolPaths {
  cacheRootPath: string;
}

export type VideoMetadataReader = (absolutePath: string) => Promise<VideoMetadata>;
export type FirstFrameThumbnailGenerator = (input: FirstFrameThumbnailInput) => Promise<string>;

export interface TimelineFrame {
  index: number;
  second: number;
  cacheRelativePath: string;
}

export interface TimelineThumbnailInput {
  videoId: string;
  videoAbsolutePath: string;
  durationSeconds?: number | null;
  frameCount: number;
}

export interface TimelineThumbnailOptions extends FfmpegToolPaths {
  cacheRootPath: string;
}

export type TimelineThumbnailGenerator = (input: TimelineThumbnailInput) => Promise<{ durationSeconds: number; frames: TimelineFrame[] }>;

export interface CoverJpegInput {
  videoAbsolutePath: string;
  outputAbsolutePath: string;
  second: number;
  aspectRatioWidth: number;
  aspectRatioHeight: number;
  cropPosition?: {
    x: number;
    y: number;
  };
}

export interface CoverJpegOptions extends FfmpegToolPaths {
  fallbackJpegBytes?: Buffer;
}

export type CoverJpegGenerator = (input: CoverJpegInput) => Promise<void>;

const DEFAULT_FALLBACK_JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAH/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAEFAqf/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAEDAQE/ASP/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAECAQE/ASP/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAY/Al//xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAE/IV//2gAMAwEAAgADAAAAEP/EFBQRAQAAAAAAAAAAAAAAAAAAABD/2gAIAQMBAT8QH//EFBQRAQAAAAAAAAAAAAAAAAAAABD/2gAIAQIBAT8QH//EFBABAQAAAAAAAAAAAAAAAAAAABD/2gAIAQEAAT8QH//Z",
  "base64"
);

function configureFfmpeg(paths: FfmpegToolPaths): void {
  if (paths.ffmpegPath) {
    ffmpeg.setFfmpegPath(paths.ffmpegPath);
  }
  if (paths.ffprobePath) {
    ffmpeg.setFfprobePath(paths.ffprobePath);
  }
}

export function createFfmpegVideoMetadataReader(paths: FfmpegToolPaths = {}): VideoMetadataReader {
  configureFfmpeg(paths);
  return (absolutePath) =>
    new Promise((resolve, reject) => {
      ffmpeg.ffprobe(absolutePath, (error, metadata) => {
        if (error) {
          reject(error);
          return;
        }

        const stream = metadata.streams.find((candidate) => candidate.codec_type === "video");
        resolve({
          durationSeconds: typeof metadata.format.duration === "number" ? metadata.format.duration : undefined,
          width: typeof stream?.width === "number" ? stream.width : undefined,
          height: typeof stream?.height === "number" ? stream.height : undefined
        });
      });
    });
}

export function videoThumbnailCacheRelativePath(videoId: string): string {
  return `videos/${videoId}/thumbnail.jpg`;
}

export function coverTimelineCacheRelativeDir(videoId: string): string {
  return `covers/${videoId}/timeline`;
}

function timelineFrameSeconds(durationSeconds: number, frameCount: number): number[] {
  const safeFrameCount = Math.max(1, frameCount);
  const safeDuration = Math.max(0, durationSeconds);
  if (safeFrameCount === 1 || safeDuration === 0) {
    return Array.from({ length: safeFrameCount }, () => 0);
  }
  return Array.from({ length: safeFrameCount }, (_, index) => (safeDuration * index) / (safeFrameCount - 1));
}

function mockFrameSvg(index: number, second: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180">
  <rect width="100%" height="100%" fill="#e4e4e7"/>
  <rect x="10" y="10" width="300" height="160" rx="6" fill="#fafafa" stroke="#d4d4d8"/>
  <text x="24" y="58" font-size="24" fill="#18181b">Frame ${index + 1}</text>
  <text x="24" y="96" font-size="18" fill="#52525b">${second.toFixed(1)}s</text>
</svg>`;
}

export function createFirstFrameThumbnailGenerator(options: FirstFrameThumbnailOptions): FirstFrameThumbnailGenerator {
  configureFfmpeg(options);
  return async ({ videoId, videoAbsolutePath }) => {
    const cacheRelativePath = videoThumbnailCacheRelativePath(videoId);
    const outputPath = path.join(options.cacheRootPath, cacheRelativePath);
    await mkdir(path.dirname(outputPath), { recursive: true });

    await new Promise<void>((resolve, reject) => {
      ffmpeg(videoAbsolutePath)
        .outputOptions(["-frames:v 1", "-q:v 3"])
        .output(outputPath)
        .on("end", () => resolve())
        .on("error", (error) => reject(error))
        .run();
    });

    return cacheRelativePath;
  };
}

export async function createMockTimelineThumbnails(input: {
  cacheRootPath: string;
  videoId: string;
  durationSeconds?: number | null;
  frameCount: number;
}): Promise<{ durationSeconds: number; frames: TimelineFrame[] }> {
  const durationSeconds = input.durationSeconds && input.durationSeconds > 0 ? input.durationSeconds : input.frameCount;
  const seconds = timelineFrameSeconds(durationSeconds, input.frameCount);
  const outputRelativeDir = coverTimelineCacheRelativeDir(input.videoId);
  const frames: TimelineFrame[] = [];
  await mkdir(path.join(input.cacheRootPath, outputRelativeDir), { recursive: true });
  for (let index = 0; index < seconds.length; index += 1) {
    const cacheRelativePath = path.posix.join(outputRelativeDir, `frame-${String(index + 1).padStart(3, "0")}.svg`);
    await writeFile(path.join(input.cacheRootPath, cacheRelativePath), mockFrameSvg(index, seconds[index]), "utf8");
    frames.push({ index, second: seconds[index], cacheRelativePath });
  }
  return { durationSeconds, frames };
}

export interface PreviewFrameInput {
  videoId: string;
  videoAbsolutePath: string;
  second: number;
}

export interface PreviewFrameOptions extends FfmpegToolPaths {
  cacheRootPath: string;
  maxWidth?: number;
}

export type PreviewFrameGenerator = (input: PreviewFrameInput) => Promise<{ cacheRelativePath: string; second: number }>;

export function coverPreviewCacheRelativeDir(videoId: string): string {
  return `covers/${videoId}/preview`;
}

export function createPreviewFrameGenerator(options: PreviewFrameOptions): PreviewFrameGenerator {
  configureFfmpeg(options);
  return async ({ videoId, videoAbsolutePath, second }) => {
    const ms = Math.max(0, Math.round(second * 1000));
    const cacheRelativePath = path.posix.join(
      coverPreviewCacheRelativeDir(videoId),
      `preview-${String(ms).padStart(8, "0")}.jpg`
    );
    const outputPath = path.join(options.cacheRootPath, cacheRelativePath);
    await mkdir(path.dirname(outputPath), { recursive: true });
    if (existsSync(outputPath)) {
      // eslint-disable-next-line no-console
      console.log("[ffmpeg-preview] cache hit:", outputPath);
      return { cacheRelativePath, second };
    }
    await new Promise<void>((resolve, reject) => {
      ffmpeg(videoAbsolutePath)
        .seekInput(Math.max(0, second))
        .outputOptions(["-frames:v 1", "-q:v 3"])
        .output(outputPath)
        .on("start", (cmdLine) => {
          // eslint-disable-next-line no-console
          console.log("[ffmpeg-preview] command:", cmdLine);
        })
        .on("end", () => {
          // eslint-disable-next-line no-console
          console.log("[ffmpeg-preview] done:", outputPath);
          resolve();
        })
        .on("error", (error, _stdout, stderr) => {
          const detail = typeof stderr === "string" && stderr.length > 0 ? `: ${stderr.trim().split("\n").slice(-3).join(" | ")}` : "";
          // eslint-disable-next-line no-console
          console.error("[ffmpeg-preview] failed:", error instanceof Error ? error.message : error, "stderr:", stderr);
          reject(new Error(`${error instanceof Error ? error.message : String(error)}${detail}`));
        })
        .run();
    });
    return { cacheRelativePath, second };
  };
}

export function createTimelineThumbnailGenerator(options: TimelineThumbnailOptions): TimelineThumbnailGenerator {
  configureFfmpeg(options);
  return async ({ videoId, videoAbsolutePath, durationSeconds, frameCount }) => {
    const metadataDuration =
      durationSeconds && durationSeconds > 0
        ? durationSeconds
        : (await createFfmpegVideoMetadataReader(options)(videoAbsolutePath)).durationSeconds;
    const safeDuration = metadataDuration && metadataDuration > 0 ? metadataDuration : frameCount;
    const seconds = timelineFrameSeconds(safeDuration, frameCount);
    const outputRelativeDir = coverTimelineCacheRelativeDir(videoId);
    const outputDir = path.join(options.cacheRootPath, outputRelativeDir);
    await mkdir(outputDir, { recursive: true });

    const frames: TimelineFrame[] = seconds.map((second, index) => ({
      index,
      second,
      cacheRelativePath: path.posix.join(outputRelativeDir, `frame-${String(index + 1).padStart(3, "0")}.jpg`)
    }));

    const allCached = frames.every((frame) =>
      existsSync(path.join(options.cacheRootPath, frame.cacheRelativePath))
    );
    if (allCached) {
      return { durationSeconds: safeDuration, frames };
    }

    // Single-pass extraction: one ffmpeg invocation walks the whole video once
    // and emits all N thumbnails via the fps filter. This is dramatically
    // faster than spawning N (or even N/concurrency) ffmpeg processes that
    // each have to open, seek, decode, and exit.
    const safeFps = Math.max(1 / Math.max(safeDuration, 0.001), frameCount / Math.max(safeDuration, 0.001));
    const outputPattern = path.join(outputDir, "frame-%03d.jpg");
    await new Promise<void>((resolve, reject) => {
      ffmpeg(videoAbsolutePath)
        .outputOptions([
          "-vf",
          `fps=${safeFps.toFixed(6)},scale=320:-2`,
          "-frames:v",
          String(frameCount),
          "-q:v",
          "5",
          "-y"
        ])
        .output(outputPattern)
        .on("end", () => resolve())
        .on("error", (error) => reject(error))
        .run();
    });

    // Keep only the frames that ffmpeg actually wrote (very short videos may
    // emit fewer than frameCount frames). UI is tolerant of partial output.
    const written = frames.filter((frame) =>
      existsSync(path.join(options.cacheRootPath, frame.cacheRelativePath))
    );
    return { durationSeconds: safeDuration, frames: written.length > 0 ? written : frames };
  };
}

export async function writeFallbackCoverJpeg(outputAbsolutePath: string, bytes: Buffer = DEFAULT_FALLBACK_JPEG): Promise<void> {
  await mkdir(path.dirname(outputAbsolutePath), { recursive: true });
  await writeFile(outputAbsolutePath, bytes);
}

function clampCropPosition(value: number | undefined): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return 0.5;
  }
  return Math.max(0, Math.min(1, value));
}

export function coverCropFilter(input: {
  aspectRatioWidth: number;
  aspectRatioHeight: number;
  cropPosition?: {
    x: number;
    y: number;
  };
}): string {
  // Wrap the ratio in parentheses, otherwise expressions like `iw/3/4`
  // are parsed by ffmpeg's expression evaluator as `(iw/3)/4 = iw/12`
  // rather than the intended `iw/(3/4) = iw*4/3`, producing a thin
  // sliver of the original frame instead of a proper aspect crop.
  const ratioExpression = `(${input.aspectRatioWidth}/${input.aspectRatioHeight})`;
  const cropX = clampCropPosition(input.cropPosition?.x);
  const cropY = clampCropPosition(input.cropPosition?.y);
  const cropWidth = `if(gt(a,${ratioExpression}),ih*${ratioExpression},iw)`;
  const cropHeight = `if(gt(a,${ratioExpression}),ih,iw/${ratioExpression})`;
  return [
    `scale='if(gt(a,${ratioExpression}),-1,720)':'if(gt(a,${ratioExpression}),720,-1)'`,
    `crop='${cropWidth}':'${cropHeight}':'(iw-(${cropWidth}))*${cropX}':'(ih-(${cropHeight}))*${cropY}'`
  ].join(",");
}

export function createCoverJpegGenerator(options: CoverJpegOptions = {}): CoverJpegGenerator {
  configureFfmpeg(options);
  return async ({ videoAbsolutePath, outputAbsolutePath, second, aspectRatioWidth, aspectRatioHeight, cropPosition }) => {
    await mkdir(path.dirname(outputAbsolutePath), { recursive: true });
    await new Promise<void>((resolve, reject) => {
      ffmpeg(videoAbsolutePath)
        .seekInput(Math.max(0, second))
        .outputOptions([
          "-frames:v 1",
          "-q:v 2",
          "-vf",
          coverCropFilter({ aspectRatioWidth, aspectRatioHeight, cropPosition })
        ])
        .output(outputAbsolutePath)
        .on("end", () => resolve())
        .on("error", (error) => reject(error))
        .run();
    });
  };
}

export async function copyOrFallbackCoverJpeg(input: {
  sourceAbsolutePath: string | null;
  outputAbsolutePath: string;
  fallbackJpegBytes?: Buffer;
}): Promise<void> {
  await mkdir(path.dirname(input.outputAbsolutePath), { recursive: true });
  if (input.sourceAbsolutePath && input.sourceAbsolutePath.endsWith(".jpg")) {
    await copyFile(input.sourceAbsolutePath, input.outputAbsolutePath);
    return;
  }
  await writeFallbackCoverJpeg(input.outputAbsolutePath, input.fallbackJpegBytes);
}
