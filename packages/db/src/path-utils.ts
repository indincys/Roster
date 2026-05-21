import path from "node:path";
import { RelativeWorkspacePathSchema, type TargetPlatform } from "@roster/shared-types";

const WINDOWS_DRIVE_ROOT_PATTERN = /^[A-Za-z]:\\(?:[^<>:"|?*\r\n]+\\?)*$/;
const WINDOWS_UNC_ROOT_PATTERN = /^\\\\[^<>:"|?*\r\n\\]+\\[^<>:"|?*\r\n\\]+(?:\\[^<>:"|?*\r\n]+)*\\?$/;

export function normalizeWinRootPath(input: string): string {
  const trimmed = input.trim().replaceAll("/", "\\");
  if (/^[A-Za-z]:\\$/.test(trimmed)) {
    return trimmed;
  }
  return trimmed.endsWith("\\") ? trimmed.slice(0, -1) : trimmed;
}

export function isValidMacAbsolutePath(input: string): boolean {
  const trimmed = input.trim();
  return Boolean(trimmed) && trimmed.startsWith("/") && !trimmed.includes("\0") && !trimmed.split("/").includes("..");
}

function isValidCurrentPlatformAbsolutePath(input: string): boolean {
  const trimmed = input.trim();
  if (!trimmed || trimmed.includes("\0")) {
    return false;
  }
  if (process.platform === "win32") {
    return isValidWindowsAbsolutePath(trimmed);
  }
  return isValidMacAbsolutePath(trimmed);
}

export function isValidWindowsAbsolutePath(input: string): boolean {
  const normalized = input.trim().replaceAll("/", "\\");
  if (!normalized) {
    return false;
  }
  return WINDOWS_DRIVE_ROOT_PATTERN.test(normalized) || WINDOWS_UNC_ROOT_PATTERN.test(normalized);
}

export function validateWorkspacePaths(input: {
  rootPath?: string;
  macRootPath?: string;
  winRootPath?: string;
  videoLibraryRootPath?: string;
  videoLibraryMacRootPath?: string;
  videoLibraryWinRootPath?: string;
  requireRpaPath?: boolean;
}): {
  ok: boolean;
  errors: string[];
  normalized: {
    rootPath: string;
    macRootPath: string;
    winRootPath: string;
    videoLibraryRootPath: string;
    videoLibraryMacRootPath: string;
    videoLibraryWinRootPath: string;
  };
} {
  const rawRootPath = input.rootPath?.trim() ?? "";
  const rawMacRootPath = input.macRootPath?.trim() ?? "";
  const rawWinRootPath = input.winRootPath?.trim() ?? "";
  const rawVideoLibraryRootPath = input.videoLibraryRootPath?.trim() ?? "";
  const rawVideoLibraryMacRootPath = input.videoLibraryMacRootPath?.trim() ?? "";
  const rawVideoLibraryWinRootPath = input.videoLibraryWinRootPath?.trim() ?? "";
  const rootPath = path.resolve(rawRootPath || ".");
  const macRootPath = path.resolve(rawMacRootPath || "");
  const winRootPath = rawWinRootPath ? normalizeWinRootPath(rawWinRootPath) : "";
  const videoLibraryRootPath = rawVideoLibraryRootPath ? path.resolve(rawVideoLibraryRootPath) : "";
  const videoLibraryMacRootPath = rawVideoLibraryMacRootPath ? path.resolve(rawVideoLibraryMacRootPath) : "";
  const videoLibraryWinRootPath = rawVideoLibraryWinRootPath ? normalizeWinRootPath(rawVideoLibraryWinRootPath) : "";
  const errors: string[] = [];

  if (!rawRootPath) {
    errors.push("工作空间根目录不能为空");
  } else if (!isValidCurrentPlatformAbsolutePath(rawRootPath)) {
    errors.push(process.platform === "win32" ? "工作空间根目录必须是 Windows 绝对路径" : "工作空间根目录必须是 macOS 绝对路径");
  }

  if (!rawMacRootPath) {
    errors.push("Mac 根路径不能为空");
  } else if (!isValidMacAbsolutePath(rawMacRootPath)) {
    errors.push("Mac 根路径必须是 macOS 绝对路径");
  }

  if (input.requireRpaPath && !winRootPath) {
    errors.push("任务单导出需要先填写 RPA 执行路径");
  } else if (winRootPath && !isValidWindowsAbsolutePath(winRootPath)) {
    errors.push("RPA 执行路径必须是 Windows 绝对路径，例如 D:\\CloudSync\\品牌A 或 \\\\server\\share\\品牌A");
  }

  if (rawVideoLibraryRootPath && !isValidCurrentPlatformAbsolutePath(rawVideoLibraryRootPath)) {
    errors.push(
      process.platform === "win32"
        ? "视频库根目录必须是 Windows 绝对路径"
        : "视频库根目录必须是 macOS 绝对路径"
    );
  }
  if (rawVideoLibraryMacRootPath && !isValidMacAbsolutePath(rawVideoLibraryMacRootPath)) {
    errors.push("视频库 Mac 路径必须是 macOS 绝对路径");
  }
  if (videoLibraryWinRootPath && !isValidWindowsAbsolutePath(videoLibraryWinRootPath)) {
    errors.push("视频库 Windows 路径必须是 Windows 绝对路径，例如 D:\\VideoLibrary\\品牌A");
  }

  return {
    ok: errors.length === 0,
    errors,
    normalized: {
      rootPath,
      macRootPath,
      winRootPath,
      videoLibraryRootPath,
      videoLibraryMacRootPath,
      videoLibraryWinRootPath
    }
  };
}

export function toWorkspaceRelativePath(rootPath: string, absolutePath: string): string {
  const relative = path.relative(rootPath, absolutePath).replaceAll(path.sep, "/");
  return RelativeWorkspacePathSchema.parse(relative);
}

export function assertRelativeWorkspacePath(relativePath: string): string {
  return RelativeWorkspacePathSchema.parse(relativePath.replaceAll("\\", "/"));
}

export function resolveWorkspacePath(options: {
  targetPlatform: TargetPlatform;
  macRootPath: string;
  winRootPath: string;
  relativePath: string;
  videoLibraryMacRootPath?: string;
  videoLibraryWinRootPath?: string;
}): string {
  const relativePath = assertRelativeWorkspacePath(options.relativePath);
  const isVideoPath = relativePath === "videos" || relativePath.startsWith("videos/");
  const videoLibrarySubPath = isVideoPath ? relativePath.slice("videos/".length) : "";

  if (options.targetPlatform === "windows") {
    if (isVideoPath && options.videoLibraryWinRootPath && options.videoLibraryWinRootPath.trim()) {
      const winLibraryRoot = normalizeWinRootPath(options.videoLibraryWinRootPath);
      if (!isValidWindowsAbsolutePath(winLibraryRoot)) {
        throw new Error("视频库 Windows 路径必须是合法的 Windows 绝对路径");
      }
      const separator = winLibraryRoot.endsWith("\\") ? "" : "\\";
      return `${winLibraryRoot}${separator}${videoLibrarySubPath.replaceAll("/", "\\")}`;
    }
    const winRootPath = normalizeWinRootPath(options.winRootPath);
    if (!isValidWindowsAbsolutePath(winRootPath)) {
      throw new Error("任务单导出需要先填写合法的 RPA 执行路径");
    }
    const separator = winRootPath.endsWith("\\") ? "" : "\\";
    return `${winRootPath}${separator}${relativePath.replaceAll("/", "\\")}`;
  }

  if (isVideoPath && options.videoLibraryMacRootPath && options.videoLibraryMacRootPath.trim()) {
    return path.join(options.videoLibraryMacRootPath, videoLibrarySubPath);
  }
  return path.join(options.macRootPath, relativePath);
}

export function resolveVideoLibraryRootPath(options: {
  workspaceRootPath: string;
  videoLibraryRootPath: string | null | undefined;
}): string {
  const customRoot = options.videoLibraryRootPath?.trim();
  if (customRoot) {
    return customRoot;
  }
  return path.join(options.workspaceRootPath, "videos");
}

export function toVideoLibraryRelativePath(rootPath: string, absolutePath: string): string {
  const sub = path.relative(rootPath, absolutePath).replaceAll(path.sep, "/");
  if (!sub) {
    return "videos";
  }
  return assertRelativeWorkspacePath(`videos/${sub}`);
}

export function isLikelyCloudSyncPath(input: string): boolean {
  const normalized = input.toLowerCase();
  return ["onedrive", "dropbox", "google drive", "坚果云", "jianguoyun"].some((token) =>
    normalized.includes(token)
  );
}
