import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  coverCropFilter,
  createFfmpegVideoMetadataReader,
  createFirstFrameThumbnailGenerator,
  createMockTimelineThumbnails,
  writeFallbackCoverJpeg
} from "@roster/ffmpeg-utils";

const tempRoots: string[] = [];
const hasFfmpeg = spawnSync("ffmpeg", ["-version"], { stdio: "ignore" }).status === 0;
const hasFfprobe = spawnSync("ffprobe", ["-version"], { stdio: "ignore" }).status === 0;

async function makeTempRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "roster-ffmpeg-"));
  tempRoots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe.skipIf(!hasFfmpeg || !hasFfprobe)("ffmpeg utilities", () => {
  it("reads metadata and extracts a first-frame thumbnail", async () => {
    const root = await makeTempRoot();
    const videoPath = path.join(root, "sample.mp4");
    const createVideo = spawnSync(
      "ffmpeg",
      ["-y", "-f", "lavfi", "-i", "color=c=black:s=64x64:d=1", "-pix_fmt", "yuv420p", videoPath],
      { stdio: "ignore" }
    );
    expect(createVideo.status).toBe(0);

    const metadata = await createFfmpegVideoMetadataReader()(videoPath);
    expect(metadata.width).toBe(64);
    expect(metadata.height).toBe(64);
    expect(metadata.durationSeconds).toBeGreaterThan(0);

    const cacheRootPath = path.join(root, "cache");
    const thumbnailRelativePath = await createFirstFrameThumbnailGenerator({ cacheRootPath })({
      videoId: "video-1",
      videoAbsolutePath: videoPath
    });

    expect(thumbnailRelativePath).toBe("videos/video-1/thumbnail.jpg");
    await expect(stat(path.join(cacheRootPath, thumbnailRelativePath))).resolves.toBeTruthy();
  });
});

describe("cover timeline utilities", () => {
  it("creates deterministic mock timeline frames", async () => {
    const root = await makeTempRoot();
    const result = await createMockTimelineThumbnails({
      cacheRootPath: root,
      videoId: "video-1",
      durationSeconds: 10,
      frameCount: 3
    });

    expect(result.durationSeconds).toBe(10);
    expect(result.frames).toEqual([
      { index: 0, second: 0, cacheRelativePath: "covers/video-1/timeline/frame-001.svg" },
      { index: 1, second: 5, cacheRelativePath: "covers/video-1/timeline/frame-002.svg" },
      { index: 2, second: 10, cacheRelativePath: "covers/video-1/timeline/frame-003.svg" }
    ]);
    const frame = await readFile(path.join(root, result.frames[1].cacheRelativePath), "utf8");
    expect(frame).toContain("Frame 2");
    expect(frame).toContain("5.0s");
  });

  it("writes a JPEG fallback cover file", async () => {
    const root = await makeTempRoot();
    const outputPath = path.join(root, "covers", "fallback.jpg");
    await writeFallbackCoverJpeg(outputPath);
    const bytes = await readFile(outputPath);
    expect(bytes[0]).toBe(0xff);
    expect(bytes[1]).toBe(0xd8);
    expect(bytes.at(-2)).toBe(0xff);
    expect(bytes.at(-1)).toBe(0xd9);
  });

  it("builds a crop filter using the requested mask position", () => {
    const filter = coverCropFilter({
      aspectRatioWidth: 3,
      aspectRatioHeight: 4,
      cropPosition: { x: 0.25, y: 0.75 }
    });

    expect(filter).toContain("3/4");
    expect(filter).toContain(")*0.25");
    expect(filter).toContain(")*0.75");
  });

  it("clamps invalid crop positions in the crop filter", () => {
    const filter = coverCropFilter({
      aspectRatioWidth: 1,
      aspectRatioHeight: 1,
      cropPosition: { x: -1, y: 2 }
    });

    expect(filter).toContain(")*0");
    expect(filter).toContain(")*1");
  });

  it("wraps the aspect ratio in parentheses so ffmpeg parses iw/(w/h) correctly", () => {
    // Regression: without parens, `iw/3/4` is evaluated by ffmpeg as
    // (iw/3)/4 = iw/12 instead of iw/(3/4) = iw*4/3, producing a thin
    // horizontal sliver instead of a 3:4 portrait crop.
    const filter = coverCropFilter({ aspectRatioWidth: 3, aspectRatioHeight: 4 });
    expect(filter).toContain("iw/(3/4)");
    expect(filter).toContain("ih*(3/4)");
    expect(filter).toContain("gt(a,(3/4))");
    expect(filter).not.toMatch(/[^(]iw\/3\/4/);
  });
});
