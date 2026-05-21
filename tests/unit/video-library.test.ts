import { mkdir, mkdtemp, rm, stat, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WorkspaceDatabase } from "@roster/db";

const tempRoots: string[] = [];

async function makeWorkspaceRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "roster-video-workspace-"));
  tempRoots.push(root);
  await mkdir(path.join(root, "videos"), { recursive: true });
  return root;
}

async function writeVideo(root: string, relativePath: string, contents = "video-bytes"): Promise<string> {
  const absolutePath = path.join(root, relativePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, contents);
  return absolutePath;
}

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("WorkspaceDatabase video library scanning", () => {
  it("indexes videos with relative paths and parses SKU and style from folders", async () => {
    const root = await makeWorkspaceRoot();
    await writeVideo(root, "videos/SKU-WB-001/style_a.mp4");
    await writeVideo(root, "videos/SKU-WB-002/款式 A/含 空格.mov");
    const db = await WorkspaceDatabase.open(root);

    const summary = await db.scanVideos({
      metadataReader: async () => ({
        durationSeconds: 12.5,
        width: 1080,
        height: 1920
      })
    });

    expect(summary).toMatchObject({ scanned: 2, added: 2, archived: 0, failedMetadata: 0 });
    const videos = db.listVideos();
    expect(videos.map((video) => video.relativePath)).toEqual([
      "videos/SKU-WB-001/style_a.mp4",
      "videos/SKU-WB-002/款式 A/含 空格.mov"
    ]);
    expect(videos[0]).toMatchObject({
      fileName: "style_a.mp4",
      sku: "SKU-WB-001",
      style: null,
      durationSeconds: 12.5,
      width: 1080,
      height: 1920,
      status: "active"
    });
    expect(videos[1]).toMatchObject({
      fileName: "含 空格.mov",
      sku: "SKU-WB-002",
      style: "款式 A"
    });
    db.close();
  });

  it("marks videos missing from disk as archived without deleting records", async () => {
    const root = await makeWorkspaceRoot();
    const videoPath = await writeVideo(root, "videos/SKU-WB-001/style_a.mp4");
    const db = await WorkspaceDatabase.open(root);

    await db.scanVideos();
    await unlink(videoPath);
    const summary = await db.scanVideos();

    expect(summary.archived).toBe(1);
    expect(db.listVideos()).toMatchObject([
      {
        relativePath: "videos/SKU-WB-001/style_a.mp4",
        status: "archived"
      }
    ]);
    db.close();
  });

  it("keeps damaged videos in the library with metadata_error status", async () => {
    const root = await makeWorkspaceRoot();
    await writeVideo(root, "videos/SKU-WB-001/broken.mp4");
    const db = await WorkspaceDatabase.open(root);

    const summary = await db.scanVideos({
      metadataReader: async () => {
        throw new Error("ffprobe failed");
      }
    });

    expect(summary).toMatchObject({ scanned: 1, added: 1, failedMetadata: 1 });
    expect(db.listVideos()).toMatchObject([
      {
        relativePath: "videos/SKU-WB-001/broken.mp4",
        status: "metadata_error",
        metadataError: "ffprobe failed"
      }
    ]);
    db.close();
  });

  it("updates editable video fields without changing relative path", async () => {
    const root = await makeWorkspaceRoot();
    await writeVideo(root, "videos/SKU-WB-001/style_a.mp4");
    const db = await WorkspaceDatabase.open(root);

    await db.scanVideos();
    const [video] = db.listVideos();
    if (!video) {
      throw new Error("video missing");
    }

    const updated = db.updateVideo({
      videoId: video.id,
      sku: "SKU-EDITED",
      style: "日常款",
      note: "手动修正"
    });

    expect(updated).toMatchObject({
      relativePath: "videos/SKU-WB-001/style_a.mp4",
      sku: "SKU-EDITED",
      style: "日常款",
      note: "手动修正"
    });
    db.close();
  });

  it("batch updates video metadata and archives records without deleting files", async () => {
    const root = await makeWorkspaceRoot();
    const firstPath = await writeVideo(root, "videos/SKU-WB-001/style_a.mp4");
    const secondPath = await writeVideo(root, "videos/SKU-WB-002/style_b.mp4");
    const db = await WorkspaceDatabase.open(root);

    await db.scanVideos();
    const videos = db.listVideos();
    const updated = db.batchUpdateVideos({
      videoIds: videos.map((video) => video.id),
      sku: "SKU-BATCH",
      style: "批量款"
    });

    expect(updated).toHaveLength(2);
    expect(db.listVideos()).toMatchObject([
      { sku: "SKU-BATCH", style: "批量款", status: "active" },
      { sku: "SKU-BATCH", style: "批量款", status: "active" }
    ]);

    db.batchUpdateVideos({
      videoIds: [videos[0].id],
      status: "archived"
    });

    expect(db.listVideos().find((video) => video.id === videos[0].id)).toMatchObject({ status: "archived" });
    await expect(stat(firstPath)).resolves.toBeTruthy();
    await expect(stat(secondPath)).resolves.toBeTruthy();
    db.close();
  });

  it("stores generated thumbnail cache paths when a generator is available", async () => {
    const root = await makeWorkspaceRoot();
    await writeVideo(root, "videos/SKU-WB-001/style_a.mp4");
    const db = await WorkspaceDatabase.open(root);

    const summary = await db.scanVideos({
      thumbnailGenerator: async ({ videoId }) => `videos/${videoId}/thumbnail.jpg`
    });

    expect(summary.added).toBe(1);
    const [video] = db.listVideos();
    expect(video?.thumbnailRelativePath).toMatch(/^videos\/.+\/thumbnail\.jpg$/);
    db.close();
  });

  it("marks zero-byte cloud placeholders without invoking metadata reads", async () => {
    const root = await makeWorkspaceRoot();
    await writeVideo(root, "videos/SKU-WB-001/pending.mov", "");
    const db = await WorkspaceDatabase.open(root);
    const metadataReader = vi.fn(async () => ({ durationSeconds: 1 }));

    const summary = await db.scanVideos({ metadataReader });

    expect(metadataReader).not.toHaveBeenCalled();
    expect(summary).toMatchObject({ scanned: 1, added: 1, placeholders: 1 });
    expect(db.listVideos()).toMatchObject([
      {
        relativePath: "videos/SKU-WB-001/pending.mov",
        status: "placeholder",
        metadataError: "文件尚未同步或为空"
      }
    ]);
    db.close();
  });

  it("scans a custom external video library root and stores videos/<sku>/... paths", async () => {
    const workspaceRoot = await makeWorkspaceRoot();
    const libraryRoot = await mkdtemp(path.join(os.tmpdir(), "roster-video-library-"));
    tempRoots.push(libraryRoot);
    await mkdir(path.join(libraryRoot, "SKU-X-001"), { recursive: true });
    await writeFile(path.join(libraryRoot, "SKU-X-001", "style_a.mp4"), "video-bytes");
    await mkdir(path.join(libraryRoot, "SKU-X-002", "款式 A"), { recursive: true });
    await writeFile(path.join(libraryRoot, "SKU-X-002", "款式 A", "含 空格.mov"), "video-bytes");

    const db = await WorkspaceDatabase.open(workspaceRoot, { videoLibraryRootPath: libraryRoot });

    const summary = await db.scanVideos();

    expect(summary).toMatchObject({ scanned: 2, added: 2, archived: 0 });
    expect(db.getVideoLibraryRootPath()).toBe(libraryRoot);
    const videos = db.listVideos();
    expect(videos.map((video) => video.relativePath)).toEqual([
      "videos/SKU-X-001/style_a.mp4",
      "videos/SKU-X-002/款式 A/含 空格.mov"
    ]);
    expect(videos[0]).toMatchObject({ sku: "SKU-X-001", style: null });
    expect(videos[1]).toMatchObject({ sku: "SKU-X-002", style: "款式 A" });
    db.close();
  });
});
