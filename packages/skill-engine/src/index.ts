import { existsSync, realpathSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_SKILL_ENTRY_FILE = "SKILL.md";
export const DEFAULT_SKILL_INCLUDE_MAX_DEPTH = 5;
export const DEFAULT_SKILL_INCLUDE_MAX_BYTES = 256 * 1024;

const INCLUDE_PATTERN = /\{\{include:\s*([^}]+?)\s*\}\}/g;

export type SkillIncludeErrorCode =
  | "ABSOLUTE_PATH"
  | "CIRCULAR_INCLUDE"
  | "DEPTH_EXCEEDED"
  | "FILE_MISSING"
  | "HIDDEN_PATH"
  | "INVALID_INCLUDE"
  | "NON_MARKDOWN"
  | "NOT_FILE"
  | "OUTSIDE_SKILL_ROOT"
  | "OVERSIZED_FILE"
  | "SNAPSHOT_PATH"
  | "TRAVERSAL";

export interface SkillIncludeErrorDetail {
  code: SkillIncludeErrorCode;
  message: string;
  includePath?: string;
  filePath?: string;
}

export interface SkillIncludeResult {
  ok: boolean;
  text: string;
  errors: SkillIncludeErrorDetail[];
  includedFiles: string[];
}

export interface SkillIncludeOptions {
  entryFile?: string;
  maxDepth?: number;
  maxBytes?: number;
}

export class SkillIncludeError extends Error {
  readonly code: SkillIncludeErrorCode;

  constructor(code: SkillIncludeErrorCode, message: string) {
    super(message);
    this.name = "SkillIncludeError";
    this.code = code;
  }
}

function toSlashPath(value: string): string {
  return value.replaceAll("\\", "/");
}

function hasWindowsDrivePrefix(value: string): boolean {
  return /^[A-Za-z]:[\\/]/.test(value);
}

function isHiddenOrSnapshotPath(includePath: string): SkillIncludeErrorDetail | null {
  const parts = toSlashPath(includePath).split("/");
  for (const part of parts) {
    if (part === ".snapshots") {
      return {
        code: "SNAPSHOT_PATH",
        message: "include 不能引用 .snapshots 快照目录",
        includePath
      };
    }
    if (part.startsWith(".")) {
      return {
        code: "HIDDEN_PATH",
        message: "include 不能引用隐藏目录或隐藏文件",
        includePath
      };
    }
  }
  return null;
}

function createError(
  code: SkillIncludeErrorCode,
  message: string,
  values: Pick<SkillIncludeErrorDetail, "includePath" | "filePath"> = {}
): SkillIncludeErrorDetail {
  return {
    code,
    message,
    ...values
  };
}

function isInsideRoot(rootRealPath: string, candidateRealPath: string): boolean {
  const relativePath = path.relative(rootRealPath, candidateRealPath);
  return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));
}

function validateIncludePath(includePath: string): SkillIncludeErrorDetail | null {
  const normalized = includePath.trim();
  if (!normalized) {
    return createError("INVALID_INCLUDE", "include 路径不能为空", { includePath });
  }
  if (path.isAbsolute(normalized) || hasWindowsDrivePrefix(normalized)) {
    return createError("ABSOLUTE_PATH", "include 不能使用绝对路径", { includePath: normalized });
  }
  const parts = toSlashPath(normalized).split("/");
  if (parts.some((part) => part === "..")) {
    return createError("TRAVERSAL", "include 不能使用 ../ 越界", { includePath: normalized });
  }
  const hiddenError = isHiddenOrSnapshotPath(normalized);
  if (hiddenError) {
    return hiddenError;
  }
  if (path.extname(normalized) !== ".md") {
    return createError("NON_MARKDOWN", "include 只能引用 Markdown 文件", { includePath: normalized });
  }
  return null;
}

export function assertSafeSkillIncludePath(includePath: string): void {
  const error = validateIncludePath(includePath);
  if (error) {
    throw new SkillIncludeError(error.code, error.message);
  }
}

async function readMarkdownFile(
  filePath: string,
  maxBytes: number,
  errors: SkillIncludeErrorDetail[]
): Promise<string> {
  if (!existsSync(filePath)) {
    errors.push(createError("FILE_MISSING", "Skill 文件不存在", { filePath }));
    return "";
  }

  const stat = statSync(filePath);
  if (!stat.isFile()) {
    errors.push(createError("NOT_FILE", "Skill include 目标不是文件", { filePath }));
    return "";
  }
  if (stat.size > maxBytes) {
    errors.push(createError("OVERSIZED_FILE", "Skill include 文件超过大小限制", { filePath }));
    return "";
  }

  return readFile(filePath, "utf8");
}

function resolveIncludeFile(
  skillRootRealPath: string,
  fromFilePath: string,
  includePath: string
): { filePath?: string; error?: SkillIncludeErrorDetail } {
  const trimmedIncludePath = includePath.trim();
  const pathError = validateIncludePath(trimmedIncludePath);
  if (pathError) {
    return { error: pathError };
  }

  const candidatePath = path.resolve(path.dirname(fromFilePath), trimmedIncludePath);
  if (!existsSync(candidatePath)) {
    return {
      filePath: candidatePath,
      error: createError("FILE_MISSING", "include 引用文件不存在", {
        includePath: trimmedIncludePath,
        filePath: candidatePath
      })
    };
  }

  const candidateRealPath = realpathSync(candidatePath);
  if (!isInsideRoot(skillRootRealPath, candidateRealPath)) {
    return {
      error: createError("OUTSIDE_SKILL_ROOT", "include 不能通过符号链接或路径解析跳出 Skill 根目录", {
        includePath: trimmedIncludePath,
        filePath: candidateRealPath
      })
    };
  }

  return { filePath: candidateRealPath };
}

export async function expandSkillIncludes(
  skillRootPath: string,
  options: SkillIncludeOptions = {}
): Promise<SkillIncludeResult> {
  const entryFile = options.entryFile ?? DEFAULT_SKILL_ENTRY_FILE;
  const maxDepth = options.maxDepth ?? DEFAULT_SKILL_INCLUDE_MAX_DEPTH;
  const maxBytes = options.maxBytes ?? DEFAULT_SKILL_INCLUDE_MAX_BYTES;
  const errors: SkillIncludeErrorDetail[] = [];
  const includedFiles = new Set<string>();
  const rootRealPath = realpathSync(skillRootPath);
  const entryPath = path.join(rootRealPath, entryFile);

  async function expandFile(filePath: string, depth: number, stack: string[]): Promise<string> {
    if (depth > maxDepth) {
      errors.push(createError("DEPTH_EXCEEDED", "Skill include 超过最大递归深度", { filePath }));
      return "";
    }

    const realFilePath = existsSync(filePath) ? realpathSync(filePath) : filePath;
    if (stack.includes(realFilePath)) {
      errors.push(createError("CIRCULAR_INCLUDE", "Skill include 存在循环引用", { filePath: realFilePath }));
      return "";
    }

    if (existsSync(realFilePath) && !isInsideRoot(rootRealPath, realFilePath)) {
      errors.push(createError("OUTSIDE_SKILL_ROOT", "Skill 文件不在 Skill 根目录内", { filePath: realFilePath }));
      return "";
    }

    const content = await readMarkdownFile(realFilePath, maxBytes, errors);
    if (errors.length > 0 && content === "") {
      return "";
    }

    const currentStack = [...stack, realFilePath];
    const replacements: Array<{ marker: string; replacement: string }> = [];

    for (const match of content.matchAll(INCLUDE_PATTERN)) {
      const marker = match[0];
      const includePath = match[1] ?? "";
      const resolved = resolveIncludeFile(rootRealPath, realFilePath, includePath);
      if (resolved.error) {
        errors.push(resolved.error);
        replacements.push({ marker, replacement: "" });
        continue;
      }
      if (!resolved.filePath) {
        replacements.push({ marker, replacement: "" });
        continue;
      }

      includedFiles.add(resolved.filePath);
      replacements.push({
        marker,
        replacement: await expandFile(resolved.filePath, depth + 1, currentStack)
      });
    }

    let expanded = content;
    for (const replacement of replacements) {
      expanded = expanded.replace(replacement.marker, replacement.replacement);
    }
    return expanded;
  }

  const text = await expandFile(entryPath, 0, []);
  return {
    ok: errors.length === 0,
    text: errors.length === 0 ? text : "",
    errors,
    includedFiles: [...includedFiles].sort()
  };
}

export async function expandSkillPrompt(
  skillRootPath: string,
  taskPrompt = "",
  options: SkillIncludeOptions = {}
): Promise<SkillIncludeResult> {
  const result = await expandSkillIncludes(skillRootPath, options);
  if (!result.ok) {
    return result;
  }

  const trimmedTaskPrompt = taskPrompt.trim();
  return {
    ...result,
    text: trimmedTaskPrompt ? `${result.text.trimEnd()}\n\n${trimmedTaskPrompt}` : result.text
  };
}
