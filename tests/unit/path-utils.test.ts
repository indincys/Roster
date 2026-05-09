import path from "node:path";
import { describe, expect, it } from "vitest";
import { assertRelativeWorkspacePath, normalizeWinRootPath, resolveWorkspacePath, toWorkspaceRelativePath } from "@roster/db";

describe("workspace path utilities", () => {
  it("normalizes Windows roots and joins RPA paths with backslashes", () => {
    expect(normalizeWinRootPath("D:/CloudSync/品牌A/")).toBe("D:\\CloudSync\\品牌A");
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
});
