import path from "node:path";
import { RelativeWorkspacePathSchema, type TargetPlatform } from "@roster/shared-types";

export function normalizeWinRootPath(input: string): string {
  const trimmed = input.trim().replaceAll("/", "\\");
  return trimmed.endsWith("\\") ? trimmed.slice(0, -1) : trimmed;
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
}): string {
  const relativePath = assertRelativeWorkspacePath(options.relativePath);
  if (options.targetPlatform === "windows") {
    return `${normalizeWinRootPath(options.winRootPath)}\\${relativePath.replaceAll("/", "\\")}`;
  }

  return path.join(options.macRootPath, relativePath);
}

export function isLikelyCloudSyncPath(input: string): boolean {
  const normalized = input.toLowerCase();
  return ["onedrive", "dropbox", "google drive", "坚果云", "jianguoyun"].some((token) =>
    normalized.includes(token)
  );
}
