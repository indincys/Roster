import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertRelativeWorkspacePath,
  isValidWindowsAbsolutePath,
  normalizeWinRootPath,
  resolveWorkspacePath,
  toWorkspaceRelativePath,
  validateWorkspacePaths
} from "@roster/db";

describe("workspace path utilities", () => {
  it("normalizes Windows roots and joins RPA paths with backslashes", () => {
    expect(normalizeWinRootPath("D:/CloudSync/品牌A/")).toBe("D:\\CloudSync\\品牌A");
    expect(normalizeWinRootPath("D:/")).toBe("D:\\");
    expect(isValidWindowsAbsolutePath("D:\\CloudSync\\品牌A")).toBe(true);
    expect(isValidWindowsAbsolutePath("D:\\")).toBe(true);
    expect(isValidWindowsAbsolutePath("\\\\server\\share\\品牌A")).toBe(true);
    expect(isValidWindowsAbsolutePath("CloudSync\\品牌A")).toBe(false);
    expect(
      resolveWorkspacePath({
        targetPlatform: "windows",
        macRootPath: "/Users/name/CloudSync/品牌A",
        winRootPath: "D:/CloudSync/品牌A/",
        relativePath: "videos/SKU001/style_a.mp4"
      })
    ).toBe("D:\\CloudSync\\品牌A\\videos\\SKU001\\style_a.mp4");
  });

  it("converts absolute local paths to slash-normalized relative paths", () => {
    const root = path.join("/tmp", "品牌 A");
    const absolute = path.join(root, "videos", "SKU001", "style_a.mp4");
    expect(toWorkspaceRelativePath(root, absolute)).toBe("videos/SKU001/style_a.mp4");
  });

  it("rejects absolute or escaping business paths", () => {
    expect(() => assertRelativeWorkspacePath("/Users/name/video.mp4")).toThrow();
    expect(() => assertRelativeWorkspacePath("D:\\video.mp4")).toThrow();
    expect(() => assertRelativeWorkspacePath("videos/../secret.mp4")).toThrow();
  });

  it("allows empty RPA paths for workspace setup but rejects them when exporting task sheets", () => {
    expect(
      validateWorkspacePaths({
        rootPath: "/Users/name/CloudSync/品牌A",
        macRootPath: "/Users/name/CloudSync/品牌A",
        winRootPath: ""
      })
    ).toMatchObject({ ok: true, normalized: { winRootPath: "" } });

    expect(
      validateWorkspacePaths({
        rootPath: "/Users/name/CloudSync/品牌A",
        macRootPath: "/Users/name/CloudSync/品牌A",
        winRootPath: "",
        requireRpaPath: true
      })
    ).toMatchObject({ ok: false, errors: expect.arrayContaining(["任务单导出需要先填写 RPA 执行路径"]) });

    expect(
      validateWorkspacePaths({
        rootPath: "/Users/name/CloudSync/品牌A",
        macRootPath: "CloudSync/品牌A",
        winRootPath: ""
      })
    ).toMatchObject({ ok: false, errors: expect.arrayContaining(["Mac 根路径必须是 macOS 绝对路径"]) });
  });
});
