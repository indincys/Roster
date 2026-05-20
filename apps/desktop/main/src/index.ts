import { app, BrowserWindow, dialog, ipcMain, net, protocol } from "electron";
import archiver from "archiver";
import extractZip from "extract-zip";
import log from "electron-log/main.js";
import { constants, existsSync } from "node:fs";
import { createWriteStream } from "node:fs";
import { access, cp, mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { z } from "zod";
import type { ProgressInfo, UpdateInfo } from "electron-updater";
import {
  ApiKeySaveInputSchema,
  ApiKeyConnectionTestInputSchema,
  AppSettingsSaveInputSchema,
  CacheCleanupInputSchema,
  CoverApplyInputSchema,
  CoverBatchApplyFirstFrameInputSchema,
  CoverTimelineInputSchema,
  FeedbackPackageInputSchema,
  IPC_CHANNELS,
  ImagePromptWorkspaceGenerateInputSchema,
  ImageScenePresetSaveInputSchema,
  ImageWorkspaceGenerateInputSchema,
  ImageSaveInputSchema,
  ImageSoftDeleteInputSchema,
  PlatformAccountSaveInputSchema,
  PromptSaveInputSchema,
  ScheduledJobRunsListInputSchema,
  ScheduledJobSaveInputSchema,
  ScheduledJobToggleInputSchema,
  ScriptExportInputSchema,
  ScriptSaveInputSchema,
  ScriptWorkspaceGenerateInputSchema,
  ScriptWorkspaceStreamCancelInputSchema,
  ScriptWorkspaceSaveInputSchema,
  SoftwareUpdateCheckInputSchema,
  SkillActivationUpdateInputSchema,
  SkillContentRequestSchema,
  SkillCreateOfficialCopyInputSchema,
  SkillFileSaveInputSchema,
  SkillMarketInstallInputSchema,
  SkillMarketListInputSchema,
  SkillOfficialCopyInputSchema,
  SkillSaveInputSchema,
  SkillSnapshotRestoreInputSchema,
  SkillTestInputSchema,
  SkillWorkflowTypeSchema,
  TagSaveInputSchema,
  TaskExportInputSchema,
  TaskGenerateInputSchema,
  TaskRetryInputSchema,
  TaskStatusScanInputSchema,
  TaskManualStatusInputSchema,
  TaskRowAddInputSchema,
  TaskRowDeleteInputSchema,
  TaskRowUpdateInputSchema,
  TaskBatchReplaceTitlesInputSchema,
  TitleWorkspaceGenerateInputSchema,
  TitleWorkspaceStreamCancelInputSchema,
  TitleWorkspaceSaveInputSchema,
  TitleSaveInputSchema,
  VideoBatchUpdateInputSchema,
  VideoUpdateInputSchema,
  WorkspaceBackupInputSchema,
  WorkspaceRestoreInputSchema,
  WorkspaceCreateInputSchema,
  WorkspaceDeleteInputSchema,
  WorkspacePathValidationInputSchema,
  WorkspaceUpdateInputSchema,
  type ApiCallProvider,
  type ApiCallWorkflow,
  type ApiKeyKind,
  type BootstrapState,
  type ApiKeyConnectionTestResult,
  type ImageProviderConfig,
  type LlmProviderConfig,
  type TitleWorkspaceColumnResult,
  type SoftwareUpdateCheckResult,
  type SoftwareUpdateInstallResult,
  type WorkspaceCloudSyncCheckResult,
  type ImageLibraryItem,
  type ImageRecord,
  type ImageSoftDeleteResult,
  type CoverCropPosition,
  type CoverTimelineResult,
  type ScriptWorkspaceColumnResult,
  type ScheduledJobRecord,
  type ScheduledJobRunRecord,
  type VideoLibraryItem,
  type VideoRecord
} from "@roster/shared-types";
import { ConfigDatabase, WorkspaceDatabase, type ScheduledJobExecutionResult } from "@roster/db";
import {
  createFfmpegVideoMetadataReader,
  createCoverJpegGenerator,
  createFirstFrameThumbnailGenerator,
  copyOrFallbackCoverJpeg,
  createMockTimelineThumbnails,
  createTimelineThumbnailGenerator,
  type FfmpegToolPaths
} from "@roster/ffmpeg-utils";
import {
  MockImageProvider,
  OpenAIImageProvider,
  createDefaultImageProviders,
  imageDimensions as getImageDimensions,
  type ImageProvider
} from "@roster/image-providers";
import {
  LLMProviderError,
  AnthropicLLMProvider,
  GoogleLLMProvider,
  MockLLMProvider,
  OpenAILLMProvider,
  runModelsAllSettled,
  type ChatCompletionResult,
  type ChatRequest,
  type LLMProvider
} from "@roster/llm-providers";
import { expandSkillPrompt } from "@roster/skill-engine";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);
const { autoUpdater } = require("electron-updater") as typeof import("electron-updater");

let mainWindow: BrowserWindow | null = null;
let configDb: ConfigDatabase | null = null;
let schedulerTimer: NodeJS.Timeout | null = null;
let updateCheckTimer: NodeJS.Timeout | null = null;
const titleWorkspaceStreams = new Map<string, AbortController>();
const scriptWorkspaceStreams = new Map<string, AbortController>();

const CACHE_PROTOCOL = "roster-cache";
const SECRET_PATTERN = /(sk-[A-Za-z0-9_-]{8,}|AIza[A-Za-z0-9_-]{8,}|anthropic[A-Za-z0-9_-]{8,}|Bearer\s+[A-Za-z0-9._~+/-]+=*)/g;
const UPDATE_CHECK_INITIAL_DELAY_MS = 5_000;
const UPDATE_CHECK_INTERVAL_MS = 4 * 60 * 60 * 1_000;

let softwareUpdateState: SoftwareUpdateCheckResult = {
  state: "idle",
  currentVersion: app.getVersion(),
  latestVersion: null,
  updateAvailable: false,
  checkedAt: null,
  releaseNotes: null,
  downloadUrl: null,
  sourceUrl: null,
  error: null,
  progressPercent: null,
  downloadedFile: null
};

protocol.registerSchemesAsPrivileged([
  {
    scheme: CACHE_PROTOCOL,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true
    }
  }
]);

if (process.env.ROSTER_USER_DATA_DIR) {
  app.setPath("userData", process.env.ROSTER_USER_DATA_DIR);
}

if (process.env.ROSTER_E2E === "1") {
  process.env.NODE_ENV = "test";
}

function getConfigDb(): ConfigDatabase {
  if (!configDb) {
    throw new Error("config.db 尚未初始化");
  }
  return configDb;
}

function getActiveWorkspaceRootPath(): string {
  const state = getConfigDb().getRuntimeState();
  if (!state.activeWorkspaceId) {
    throw new Error("请先创建或选择工作空间");
  }
  const workspace = getConfigDb().getWorkspace(state.activeWorkspaceId);
  if (!workspace) {
    throw new Error("当前工作空间不存在");
  }
  return workspace.rootPath;
}

function getActiveWorkspaceRecord(): { id: string; rootPath: string; macRootPath: string; winRootPath: string } {
  const state = getConfigDb().getRuntimeState();
  if (!state.activeWorkspaceId) {
    throw new Error("请先创建或选择工作空间");
  }
  const workspace = getConfigDb().getWorkspace(state.activeWorkspaceId);
  if (!workspace) {
    throw new Error("当前工作空间不存在");
  }
  return {
    id: workspace.id,
    rootPath: workspace.rootPath,
    macRootPath: workspace.macRootPath,
    winRootPath: workspace.winRootPath
  };
}

async function withActiveWorkspaceDb<T>(callback: (db: WorkspaceDatabase) => Promise<T> | T): Promise<T> {
  const db = await WorkspaceDatabase.open(getActiveWorkspaceRootPath());
  try {
    return await callback(db);
  } finally {
    db.close();
  }
}

function resolveBundledToolPath(toolName: "ffmpeg" | "ffprobe"): string | undefined {
  const executableName = process.platform === "win32" ? `${toolName}.exe` : toolName;
  const candidateRoots = app.isPackaged
    ? [path.join(process.resourcesPath, "ffmpeg")]
    : [path.resolve(__dirname, "../../../tools/ffmpeg"), path.resolve(process.cwd(), "tools/ffmpeg")];

  for (const root of candidateRoots) {
    const candidate = path.join(root, process.platform, executableName);
    if (existsSync(candidate)) {
      return candidate;
    }
    const flatCandidate = path.join(root, executableName);
    if (existsSync(flatCandidate)) {
      return flatCandidate;
    }
  }

  return undefined;
}

function isCommandAvailable(command: string): boolean {
  const result = spawnSync(command, ["-version"], {
    stdio: "ignore",
    timeout: 2_000
  });
  return result.status === 0;
}

function resolveFfmpegToolPaths(): FfmpegToolPaths | null {
  const ffmpegPath = resolveBundledToolPath("ffmpeg");
  const ffprobePath = resolveBundledToolPath("ffprobe");
  if (ffmpegPath && ffprobePath) {
    return { ffmpegPath, ffprobePath };
  }

  if (isCommandAvailable("ffmpeg") && isCommandAvailable("ffprobe")) {
    return {};
  }

  return null;
}

function toVideoLibraryItem(video: VideoRecord): VideoLibraryItem {
  const workspaceRootPath = getActiveWorkspaceRootPath();
  const previewRelativePath = encodeURIComponent(video.relativePath);
  return {
    ...video,
    currentAbsolutePath: path.join(workspaceRootPath, video.relativePath),
    thumbnailAbsolutePath: video.thumbnailRelativePath
      ? path.join(app.getPath("userData"), "cache", "video-thumbnails", video.thumbnailRelativePath)
      : null,
    thumbnailUrl: video.thumbnailRelativePath
      ? `${CACHE_PROTOCOL}://video-thumbnails/${encodeURIComponent(video.thumbnailRelativePath)}`
      : null,
    previewUrl: video.status === "active" || video.status === "used" ? `${CACHE_PROTOCOL}://workspace-video/${previewRelativePath}` : null
  };
}

function toImageLibraryItem(image: ImageRecord): ImageLibraryItem {
  const workspaceRootPath = getActiveWorkspaceRootPath();
  return {
    ...image,
    currentAbsolutePath: path.join(workspaceRootPath, image.relativePath)
  };
}

function parseTitleLines(text: string, count: number): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:\d+[.)、-]\s*|[-*]\s*)/, "").trim())
    .filter(Boolean)
    .slice(0, count);
}

function parseScriptBlocks(text: string): string[] {
  const normalized = text.trim();
  if (!normalized) {
    return [];
  }
  const blocks = normalized
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
  return blocks.length > 0 ? blocks : [normalized];
}

function parseImagePromptLines(text: string, count: number): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:\d+[.)、-]\s*|[-*]\s*)/, "").trim())
    .filter(Boolean)
    .slice(0, count);
}

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  const text = String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replaceAll("\"", "\"\"")}"`;
  }
  return text;
}

function toTrashImageRelativePath(image: ImageRecord): string {
  return path.posix.join("_trash", "images", image.id, image.fileName);
}

function coverRatioToken(aspectRatio: string): string {
  return aspectRatio.replace(":", "x");
}

function resolveCoverRatio(input: {
  aspectRatio: "3:4" | "9:16" | "1:1" | "custom";
  customRatio?: { width: number; height: number };
}): { width: number; height: number; token: string } {
  if (input.aspectRatio === "custom" && input.customRatio) {
    return {
      width: input.customRatio.width,
      height: input.customRatio.height,
      token: `custom-${input.customRatio.width}x${input.customRatio.height}`
    };
  }
  const [width, height] = input.aspectRatio.split(":").map((value) => Number.parseInt(value, 10));
  return { width, height, token: coverRatioToken(input.aspectRatio) };
}

async function getCoverTimelineFrameForVideo(input: {
  video: VideoRecord;
  frameIndex: number;
}): Promise<{ second: number; absolutePath: string | null }> {
  const cacheRootPath = path.join(app.getPath("userData"), "cache", "cover-timeline");
  const frameCount = 30;
  const safeIndex = Math.max(0, Math.min(frameCount - 1, input.frameIndex));
  const videoAbsolutePath = path.join(getActiveWorkspaceRootPath(), input.video.relativePath);
  const toolPaths = resolveFfmpegToolPaths();
  try {
    const timeline = toolPaths
      ? await createTimelineThumbnailGenerator({ ...toolPaths, cacheRootPath })({
          videoId: input.video.id,
          videoAbsolutePath,
          durationSeconds: input.video.durationSeconds,
          frameCount
        })
      : await createMockTimelineThumbnails({
          cacheRootPath,
          videoId: input.video.id,
          durationSeconds: input.video.durationSeconds,
          frameCount
        });
    const frame = timeline.frames[safeIndex] ?? timeline.frames[0];
    return {
      second: frame?.second ?? 0,
      absolutePath: frame ? path.join(cacheRootPath, frame.cacheRelativePath) : null
    };
  } catch {
    const timeline = await createMockTimelineThumbnails({
      cacheRootPath,
      videoId: input.video.id,
      durationSeconds: input.video.durationSeconds,
      frameCount
    });
    const frame = timeline.frames[safeIndex] ?? timeline.frames[0];
    return {
      second: frame?.second ?? 0,
      absolutePath: frame ? path.join(cacheRootPath, frame.cacheRelativePath) : null
    };
  }
}

async function writeCoverFile(input: {
  workspaceRootPath: string;
  video: VideoRecord;
  aspectRatio: "3:4" | "9:16" | "1:1" | "custom";
  customRatio?: { width: number; height: number };
  frameIndex: number;
  frameSecond?: number;
  cropPosition?: CoverCropPosition;
  timelineFrameCachePath?: string | null;
}): Promise<{ coverRelativePath: string; coverAbsolutePath: string }> {
  const sku = input.video.sku || path.posix.basename(path.posix.dirname(input.video.relativePath)) || "unclassified";
  const videoBaseName = path.posix.basename(input.video.relativePath, path.posix.extname(input.video.relativePath));
  const ratio = resolveCoverRatio(input);
  const coverRelativePath = path.posix.join("covers", sku, `${videoBaseName}__${ratio.token}.jpg`);
  const coverAbsolutePath = path.join(input.workspaceRootPath, coverRelativePath);
  await mkdir(path.dirname(coverAbsolutePath), { recursive: true });
  const toolPaths = resolveFfmpegToolPaths();
  if (toolPaths) {
    try {
      await createCoverJpegGenerator(toolPaths)({
        videoAbsolutePath: path.join(input.workspaceRootPath, input.video.relativePath),
        outputAbsolutePath: coverAbsolutePath,
        second: input.frameSecond ?? 0,
        aspectRatioWidth: ratio.width,
        aspectRatioHeight: ratio.height,
        cropPosition: input.cropPosition
      });
      return { coverRelativePath, coverAbsolutePath };
    } catch {
      // Fall through to timeline frame copy or placeholder JPEG for corrupt/placeholder videos.
    }
  }
  await copyOrFallbackCoverJpeg({
    sourceAbsolutePath: input.timelineFrameCachePath ?? null,
    outputAbsolutePath: coverAbsolutePath
  });
  return { coverRelativePath, coverAbsolutePath };
}

function safeBackupName(value: string): string {
  return value.replace(/[^\p{L}\p{N}_-]+/gu, "-").replace(/^-+|-+$/g, "") || "workspace";
}

function dateStamp(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

function redactSensitiveText(value: string): string {
  return value.replace(SECRET_PATTERN, "***");
}

function redactModels(models: string[]): string[] {
  return models.map((model) => redactSensitiveText(model)).filter((model) => model !== "***" && !model.includes("***"));
}

function detectCloudProvider(rootPath: string): WorkspaceCloudSyncCheckResult["provider"] {
  const normalized = rootPath.toLowerCase().replaceAll("\\", "/");
  if (normalized.includes("onedrive")) {
    return "onedrive";
  }
  if (normalized.includes("dropbox")) {
    return "dropbox";
  }
  if (normalized.includes("jianguoyun") || normalized.includes("坚果云")) {
    return "jianguoyun";
  }
  if (normalized.includes("icloud") || normalized.includes("mobile documents")) {
    return "icloud";
  }
  return null;
}

async function checkWorkspaceCloudSync(): Promise<WorkspaceCloudSyncCheckResult> {
  const workspace = getActiveWorkspaceRecord();
  const provider = detectCloudProvider(workspace.rootPath);
  const warnings: string[] = [];
  let rootExists = false;
  let rootWritable = false;

  try {
    const rootStat = await stat(workspace.rootPath);
    rootExists = rootStat.isDirectory();
    if (!rootExists) {
      warnings.push("工作空间根路径不是目录");
    }
  } catch {
    warnings.push("工作空间根路径不存在或当前设备不可访问");
  }

  if (rootExists) {
    try {
      await access(workspace.rootPath, constants.R_OK | constants.W_OK);
      rootWritable = true;
    } catch {
      warnings.push("工作空间根路径不可读写，请检查云盘同步或权限");
    }
  }

  if (!provider) {
    warnings.push("未识别到 OneDrive、Dropbox、坚果云或 iCloud 云盘路径特征；如需跨设备同步，请确认该目录位于云盘同步目录内");
  }

  return {
    workspaceId: workspace.id,
    rootPath: workspace.rootPath,
    provider,
    likelySynced: Boolean(provider && rootExists && rootWritable),
    rootExists,
    rootWritable,
    warnings
  };
}

function classifyProviderCheckFailure(status: number, message: string): NonNullable<ApiKeyConnectionTestResult["errorCode"]> {
  if (status === 401 || status === 403 || /invalid[_\s-]?api[_\s-]?key|unauthorized|permission/i.test(message)) {
    return "InvalidAPIKey";
  }
  if (status === 429 || /rate[_\s-]?limit|too many requests/i.test(message)) {
    return "RateLimited";
  }
  if (/network|fetch|timeout|econnreset|enotfound/i.test(message)) {
    return "NetworkError";
  }
  return "ProviderError";
}

function compareSemver(left: string, right: string): number {
  const leftParts = left
    .replace(/^v/i, "")
    .split(/[.-]/)
    .map((part) => Number.parseInt(part, 10));
  const rightParts = right
    .replace(/^v/i, "")
    .split(/[.-]/)
    .map((part) => Number.parseInt(part, 10));
  const length = Math.max(leftParts.length, rightParts.length, 3);
  for (let index = 0; index < length; index += 1) {
    const leftValue = Number.isFinite(leftParts[index]) ? leftParts[index] : 0;
    const rightValue = Number.isFinite(rightParts[index]) ? rightParts[index] : 0;
    if (leftValue !== rightValue) {
      return leftValue > rightValue ? 1 : -1;
    }
  }
  return left.localeCompare(right);
}

async function fetchJsonWithTimeout(url: string, init: RequestInit = {}): Promise<{ status: number; body: unknown }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await net.fetch(url, {
      ...init,
      signal: controller.signal
    });
    const text = await response.text();
    let body: unknown = null;
    if (text.trim()) {
      try {
        body = JSON.parse(text);
      } catch {
        body = { message: text.slice(0, 500) };
      }
    }
    return { status: response.status, body };
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeUpdateManifest(raw: unknown): {
  version: string | null;
  releaseNotes: string | null;
  downloadUrl: string | null;
} {
  const manifest = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const version = typeof manifest.version === "string" ? manifest.version : typeof manifest.latestVersion === "string" ? manifest.latestVersion : null;
  const releaseNotes =
    typeof manifest.releaseNotes === "string"
      ? manifest.releaseNotes
      : typeof manifest.notes === "string"
        ? manifest.notes
        : null;
  const downloadUrl =
    typeof manifest.downloadUrl === "string"
      ? manifest.downloadUrl
      : typeof manifest.download_url === "string"
        ? manifest.download_url
        : null;
  return { version, releaseNotes, downloadUrl };
}

function releaseNotesToText(releaseNotes: UpdateInfo["releaseNotes"]): string | null {
  if (!releaseNotes) {
    return null;
  }
  if (typeof releaseNotes === "string") {
    return releaseNotes;
  }
  if (Array.isArray(releaseNotes)) {
    return releaseNotes
      .map((entry) => {
        if (typeof entry === "string") {
          return entry;
        }
        if (entry && typeof entry === "object" && "note" in entry && typeof entry.note === "string") {
          return entry.note;
        }
        return null;
      })
      .filter((entry): entry is string => Boolean(entry))
      .join("\n");
  }
  return null;
}

function updateStateFromInfo(
  info: UpdateInfo,
  next: Partial<SoftwareUpdateCheckResult>
): SoftwareUpdateCheckResult {
  return updateSoftwareUpdateState({
    latestVersion: info.version,
    releaseNotes: releaseNotesToText(info.releaseNotes),
    sourceUrl: process.env.ROSTER_UPDATE_MANIFEST_URL ?? autoUpdater.getFeedURL() ?? null,
    ...next
  });
}

function updateSoftwareUpdateState(next: Partial<SoftwareUpdateCheckResult>): SoftwareUpdateCheckResult {
  softwareUpdateState = {
    ...softwareUpdateState,
    currentVersion: app.getVersion(),
    ...next
  };
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send(IPC_CHANNELS.MAINTENANCE_UPDATE_EVENT, softwareUpdateState);
  }
  return softwareUpdateState;
}

async function checkCustomSoftwareUpdateManifest(sourceUrl: string): Promise<SoftwareUpdateCheckResult> {
  const checkedAt = new Date().toISOString();
  const currentVersion = app.getVersion();
  updateSoftwareUpdateState({
    state: "checking",
    checkedAt,
    sourceUrl,
    error: null,
    progressPercent: null
  });

  try {
    const { status, body } = await fetchJsonWithTimeout(sourceUrl);
    if (status < 200 || status >= 300) {
      return updateSoftwareUpdateState({
        state: "error",
        latestVersion: null,
        updateAvailable: false,
        checkedAt,
        releaseNotes: null,
        downloadUrl: null,
        sourceUrl,
        error: `更新 manifest 读取失败：${status}`
      });
    }
    const manifest = normalizeUpdateManifest(body);
    if (!manifest.version) {
      return updateSoftwareUpdateState({
        state: "error",
        latestVersion: null,
        updateAvailable: false,
        checkedAt,
        releaseNotes: null,
        downloadUrl: null,
        sourceUrl,
        error: "更新 manifest 缺少 version"
      });
    }
    const updateAvailable = compareSemver(manifest.version, currentVersion) > 0;
    return updateSoftwareUpdateState({
      state: updateAvailable ? "available" : "not_available",
      latestVersion: manifest.version,
      updateAvailable,
      checkedAt,
      releaseNotes: manifest.releaseNotes,
      downloadUrl: manifest.downloadUrl,
      sourceUrl,
      error: null,
      downloadedFile: null
    });
  } catch (error) {
    return updateSoftwareUpdateState({
      state: "error",
      latestVersion: null,
      updateAvailable: false,
      checkedAt,
      releaseNotes: null,
      downloadUrl: null,
      sourceUrl,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

async function checkForSoftwareUpdates(): Promise<SoftwareUpdateCheckResult> {
  const customManifestUrl = process.env.ROSTER_UPDATE_MANIFEST_URL;
  if (customManifestUrl) {
    return checkCustomSoftwareUpdateManifest(customManifestUrl);
  }

  const checkedAt = new Date().toISOString();
  updateSoftwareUpdateState({
    state: "checking",
    checkedAt,
    error: null,
    progressPercent: null,
    sourceUrl: autoUpdater.getFeedURL() ?? null
  });

  try {
    const result = await autoUpdater.checkForUpdates();
    if (!result) {
      return updateSoftwareUpdateState({
        state: "error",
        updateAvailable: false,
        checkedAt,
        error: "更新器未启用或缺少 app-update.yml"
      });
    }
    return updateStateFromInfo(result.updateInfo, {
      state: result.isUpdateAvailable ? "available" : "not_available",
      updateAvailable: result.isUpdateAvailable,
      checkedAt,
      error: null,
      progressPercent: null,
      downloadedFile: null
    });
  } catch (error) {
    return updateSoftwareUpdateState({
      state: "error",
      updateAvailable: false,
      checkedAt,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

async function downloadSoftwareUpdate(): Promise<SoftwareUpdateCheckResult> {
  if (process.env.ROSTER_UPDATE_MANIFEST_URL) {
    return updateSoftwareUpdateState({
      state: "downloaded",
      updateAvailable: true,
      progressPercent: 100,
      downloadedFile: softwareUpdateState.downloadUrl,
      error: null
    });
  }
  if (softwareUpdateState.state === "downloaded") {
    return softwareUpdateState;
  }
  updateSoftwareUpdateState({ state: "downloading", error: null, progressPercent: 0 });
  try {
    const downloadedFiles = await autoUpdater.downloadUpdate();
    return updateSoftwareUpdateState({
      state: "downloaded",
      downloadedFile: downloadedFiles[0] ?? null,
      progressPercent: 100,
      error: null
    });
  } catch (error) {
    return updateSoftwareUpdateState({
      state: "error",
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

function installSoftwareUpdate(): SoftwareUpdateInstallResult {
  if (softwareUpdateState.state !== "downloaded") {
    return { initiated: false };
  }
  autoUpdater.quitAndInstall(true, true);
  return { initiated: true };
}

async function listProviderModels(
  kind: ApiKeyKind,
  provider: string,
  apiKey: string,
  providerConfig?: LlmProviderConfig | ImageProviderConfig
): Promise<string[]> {
  const config = findProviderConfigForTest({ kind, provider, providerConfig });
  if (kind === "image") {
    const imageProvider = config ? createImageProviderFromConfig(config as ImageProviderConfig, apiKey) : null;
    if (!imageProvider) {
      throw new Error("UnsupportedProvider");
    }
    return imageProvider.listModels();
  }
  const llmProvider = config ? createLlmProviderFromConfig(config as LlmProviderConfig, apiKey) : null;
  if (!llmProvider) {
    throw new Error("UnsupportedProvider");
  }
  return llmProvider.listModels();
}

async function testApiKeyConnection(input: z.infer<typeof ApiKeyConnectionTestInputSchema>): Promise<ApiKeyConnectionTestResult> {
  const checkedAt = new Date().toISOString();
  let apiKeyId: string | null = input.apiKeyId ?? null;
  let provider = input.provider ?? "mock";
  let kind: ApiKeyKind = input.kind ?? "text";
  try {
    let apiKey = input.apiKey ?? "";
    if (input.apiKeyId) {
      const secret = await getConfigDb().getApiKeySecret(input.apiKeyId);
      apiKeyId = secret.record.id;
      provider = secret.record.provider;
      kind = secret.record.kind;
      apiKey = secret.apiKey;
    } else {
      provider = input.provider ?? "mock";
      kind = input.kind ?? "text";
      apiKey = input.apiKey ?? "";
    }
    const models = redactModels(await listProviderModels(kind, provider, apiKey, input.providerConfig));
    return {
      apiKeyId,
      provider,
      kind,
      ok: true,
      checkedAt,
      models,
      modelCount: models.length,
      errorCode: null,
      errorMessage: null
    };
  } catch (error) {
    const maybeStatus = typeof error === "object" && error && "status" in error ? Number((error as { status?: unknown }).status) : 0;
    const message = error instanceof Error ? error.message : String(error);
    const savedKey = apiKeyId ? getConfigDb().listApiKeys().find((candidate) => candidate.id === apiKeyId) : null;
    return {
      apiKeyId,
      provider: savedKey?.provider ?? provider,
      kind: savedKey?.kind ?? kind,
      ok: false,
      checkedAt,
      models: [],
      modelCount: 0,
      errorCode: message === "UnsupportedProvider" ? "UnsupportedProvider" : message.includes("不存在") ? "NotFound" : classifyProviderCheckFailure(maybeStatus, message),
      errorMessage: redactSensitiveText(message)
    };
  }
}

function configureLogging(): void {
  log.initialize();
  log.transports.file.level = "debug";
  log.transports.file.fileName = `${dateStamp()}.log`;
  log.transports.file.resolvePathFn = () => path.join(app.getPath("userData"), "logs", `${dateStamp()}.log`);
  log.transports.file.transforms.unshift(({ data }: { data: unknown[] }) =>
    data.map((item) => (typeof item === "string" ? redactSensitiveText(item) : item instanceof Error ? item.message : item))
  );
  log.transports.console.level = process.env.ROSTER_E2E === "1" ? false : "info";
}

function configureAutoUpdater(): void {
  autoUpdater.logger = log;
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  if (process.env.ROSTER_UPDATE_MANIFEST_URL) {
    return;
  }

  autoUpdater.on("checking-for-update", () => {
    updateSoftwareUpdateState({
      state: "checking",
      checkedAt: new Date().toISOString(),
      sourceUrl: autoUpdater.getFeedURL() ?? null,
      error: null,
      progressPercent: null
    });
  });
  autoUpdater.on("update-available", (info: UpdateInfo) => {
    updateStateFromInfo(info, {
      state: "available",
      updateAvailable: true,
      checkedAt: new Date().toISOString(),
      error: null,
      progressPercent: null,
      downloadedFile: null
    });
  });
  autoUpdater.on("update-not-available", (info: UpdateInfo) => {
    updateStateFromInfo(info, {
      state: "not_available",
      updateAvailable: false,
      checkedAt: new Date().toISOString(),
      error: null,
      progressPercent: null,
      downloadedFile: null
    });
  });
  autoUpdater.on("download-progress", (progress: ProgressInfo) => {
    updateSoftwareUpdateState({
      state: "downloading",
      progressPercent: Math.max(0, Math.min(100, progress.percent)),
      error: null
    });
  });
  autoUpdater.on("update-downloaded", (info) => {
    updateStateFromInfo(info, {
      state: "downloaded",
      updateAvailable: true,
      checkedAt: new Date().toISOString(),
      error: null,
      progressPercent: 100,
      downloadedFile: info.downloadedFile
    });
  });
  autoUpdater.on("error", (error) => {
    updateSoftwareUpdateState({
      state: "error",
      checkedAt: new Date().toISOString(),
      error: redactSensitiveText(error.message)
    });
  });
}

function startUpdateCheckLoop(): void {
  if (updateCheckTimer) {
    return;
  }
  setTimeout(() => {
    void checkForSoftwareUpdates();
  }, UPDATE_CHECK_INITIAL_DELAY_MS);
  updateCheckTimer = setInterval(() => {
    void checkForSoftwareUpdates();
  }, UPDATE_CHECK_INTERVAL_MS);
}

async function zipDirectory(input: { sourcePath: string; targetPath: string; workspaceName: string; scope: string }): Promise<void> {
  await mkdir(path.dirname(input.targetPath), { recursive: true });
  const tmpPath = `${input.targetPath}.tmp`;
  await new Promise<void>((resolve, reject) => {
    const output = createWriteStream(tmpPath);
    const archive = archiver("zip", { zlib: { level: 9 } });
    output.on("close", () => resolve());
    output.on("error", reject);
    archive.on("error", reject);
    archive.pipe(output);
    if (input.scope === "database") {
      archive.file(path.join(input.sourcePath, "workspace.db"), { name: "workspace.db" });
      archive.file(path.join(input.sourcePath, "workspace.json"), { name: "workspace.json" });
    } else if (input.scope === "database_skills") {
      archive.file(path.join(input.sourcePath, "workspace.db"), { name: "workspace.db" });
      archive.file(path.join(input.sourcePath, "workspace.json"), { name: "workspace.json" });
      archive.directory(path.join(input.sourcePath, "skills_config"), "skills_config");
    } else {
      archive.glob("**/*", {
        cwd: input.sourcePath,
        dot: true,
        ignore: ["_backup/**", "workspace.lock"]
      });
    }
    void archive.finalize();
  });
  await rename(tmpPath, input.targetPath);
}

async function pruneWorkspaceBackups(backupDirectoryPath: string, retentionCount: number): Promise<void> {
  const entries = await readdir(backupDirectoryPath, { withFileTypes: true });
  const backups = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.startsWith("backup_") || !entry.name.endsWith(".zip")) {
      continue;
    }
    const absolutePath = path.join(backupDirectoryPath, entry.name);
    const backupStat = await stat(absolutePath);
    backups.push({ absolutePath, mtimeMs: backupStat.mtimeMs, name: entry.name });
  }
  backups.sort((left, right) => right.mtimeMs - left.mtimeMs || right.name.localeCompare(left.name));
  for (const backup of backups.slice(Math.max(1, retentionCount))) {
    await rm(backup.absolutePath, { force: true });
  }
}

async function countFiles(directoryPath: string): Promise<number> {
  const entries = await readdir(directoryPath, { withFileTypes: true });
  let count = 0;
  for (const entry of entries) {
    const absolutePath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      count += await countFiles(absolutePath);
    } else if (entry.isFile()) {
      count += 1;
    }
  }
  return count;
}

async function inspectDirectory(directoryPath: string): Promise<{ files: number; bytes: number }> {
  const entries = await readdir(directoryPath, { withFileTypes: true }).catch(() => []);
  let files = 0;
  let bytes = 0;
  for (const entry of entries) {
    const absolutePath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      const nested = await inspectDirectory(absolutePath);
      files += nested.files;
      bytes += nested.bytes;
    } else if (entry.isFile()) {
      const fileStat = await stat(absolutePath);
      files += 1;
      bytes += fileStat.size;
    }
  }
  return { files, bytes };
}

function cacheTargetPath(target: "video_thumbnails" | "cover_timeline" | "skill_market"): string {
  const cacheRootPath = path.join(app.getPath("userData"), "cache");
  if (target === "video_thumbnails") {
    return path.join(cacheRootPath, "video-thumbnails");
  }
  if (target === "cover_timeline") {
    return path.join(cacheRootPath, "cover-timeline");
  }
  return path.join(cacheRootPath, "skill-market");
}

async function atomicWriteTextFile(filePath: string, content: string): Promise<void> {
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tempPath, content, "utf8");
  await rename(tempPath, filePath);
}

async function fetchSkillMarketBytes(url: string): Promise<Buffer> {
  const parsed = new URL(url);
  if (!["https:", "http:", "file:"].includes(parsed.protocol)) {
    throw new Error("Skill 市场仅支持公开 HTTP(S) 或本地 file URL");
  }
  const response = await net.fetch(url);
  if (!response.ok) {
    throw new Error(`Skill 市场文件读取失败：${response.status}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

const scheduledJobExpectedTargetPages: Record<ScheduledJobRecord["type"], string> = {
  task_sheet: "tasks",
  title_generation: "titles",
  image_generation: "images",
  script_generation: "scripts"
};

function validateScheduledWorkflowTarget(job: ScheduledJobRecord): string | null {
  const expectedTargetPage = scheduledJobExpectedTargetPages[job.type];
  if (!expectedTargetPage || job.targetPage !== expectedTargetPage) {
    return `定时任务配置无效：${job.name} 应进入 ${expectedTargetPage ?? "有效工作区"}，当前为 ${job.targetPage}`;
  }
  return null;
}

function runTaskSheetScheduledJob(job: ScheduledJobRecord): ScheduledJobExecutionResult {
  return {
    status: "success",
    artifactSummary: `已触发 ${job.name}；v1 调度器记录运行，具体工作流配置在 ${job.targetPage}`,
    errorMessage: null
  };
}

async function getLatestApiKeyForProvider(provider: ApiCallProvider, model?: string, kind: ApiKeyKind = "text"): Promise<string | null> {
  if (provider === "mock") {
    return null;
  }
  const candidates = getConfigDb().listApiKeys().filter((candidate) => candidate.kind === kind && candidate.provider === provider);
  const key =
    (model
      ? candidates.find((candidate) => candidate.model === model && candidate.isDefault) ??
        candidates.find((candidate) => candidate.model === model)
      : null) ??
    candidates.find((candidate) => candidate.isDefault) ??
    candidates[0];
  if (!key) {
    return null;
  }
  return (await getConfigDb().getApiKeySecret(key.id)).apiKey;
}

function getLlmProviderConfig(provider: string): LlmProviderConfig | null {
  return getConfigDb().getSettings().llmProviderConfigs.find((config) => config.id === provider && config.enabled) ?? null;
}

function getImageProviderConfig(provider: string): ImageProviderConfig | null {
  return getConfigDb().getSettings().imageProviderConfigs.find((config) => config.id === provider && config.enabled) ?? null;
}

function findProviderConfigForTest(input: {
  kind: ApiKeyKind;
  provider: string;
  providerConfig?: LlmProviderConfig | ImageProviderConfig;
}): LlmProviderConfig | ImageProviderConfig | null {
  if (input.providerConfig?.id === input.provider && input.providerConfig.enabled) {
    return input.providerConfig;
  }
  return input.kind === "image" ? getImageProviderConfig(input.provider) : getLlmProviderConfig(input.provider);
}

function createLlmProviderFromConfig(config: LlmProviderConfig, apiKey?: string): LLMProvider | null {
  if (config.adapter === "mock") {
    return new MockLLMProvider();
  }
  if (config.adapter === "openai") {
    return new OpenAILLMProvider({ id: config.id, baseUrl: config.baseUrl ?? undefined, apiKey, endpoint: "responses" });
  }
  if (config.adapter === "openai-compatible") {
    return new OpenAILLMProvider({ id: config.id, baseUrl: config.baseUrl ?? undefined, apiKey, endpoint: "chat-completions" });
  }
  if (config.adapter === "anthropic") {
    return new AnthropicLLMProvider({ id: config.id, baseUrl: config.baseUrl ?? undefined, apiKey });
  }
  if (config.adapter === "google") {
    return new GoogleLLMProvider({ id: config.id, baseUrl: config.baseUrl ?? undefined, apiKey });
  }
  return null;
}

function createImageProviderFromConfig(config: ImageProviderConfig, apiKey?: string): ImageProvider | null {
  if (config.adapter === "mock") {
    return new MockImageProvider(config.id);
  }
  if (config.adapter === "openai-image") {
    return new OpenAIImageProvider({ id: config.id, baseUrl: config.baseUrl ?? undefined, apiKey });
  }
  return null;
}

async function getImageApiKeyForTarget(target: { provider: ApiCallProvider; model: string; apiKeyId?: string | null }): Promise<string | undefined> {
  if (target.provider === "mock") {
    return undefined;
  }
  if (target.apiKeyId) {
    const { record, apiKey } = await getConfigDb().getApiKeySecret(target.apiKeyId);
    if (record.kind !== "image" || record.provider !== target.provider) {
      throw new Error(`图片 API key 与 Provider 不匹配：${target.provider}`);
    }
    if (record.model && record.model !== target.model) {
      throw new Error(`图片 API key 模型不匹配：${target.model}`);
    }
    return apiKey;
  }
  return (await getLatestApiKeyForProvider(target.provider, target.model, "image")) ?? undefined;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let cursor = 0;
  const workerCount = Math.min(Math.max(1, limit), items.length);
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (cursor < items.length) {
        const index = cursor;
        cursor += 1;
        try {
          results[index] = { status: "fulfilled", value: await worker(items[index] as T, index) };
        } catch (error) {
          results[index] = { status: "rejected", reason: error };
        }
      }
    })
  );
  return results;
}

function providerErrorCode(error: unknown): string {
  if (error instanceof LLMProviderError) {
    return error.code;
  }
  if (error && typeof error === "object" && "code" in error && typeof (error as { code?: unknown }).code === "string") {
    return (error as { code: string }).code;
  }
  return "ProviderError";
}

function logApiCall(input: {
  db: WorkspaceDatabase;
  provider: ApiCallProvider;
  model: string;
  workflow: ApiCallWorkflow;
  startedAt: string;
  result?: ChatCompletionResult;
  error?: unknown;
}): void {
  const finishedAt = new Date().toISOString();
  input.db.saveApiCallLog({
    provider: input.provider,
    model: input.model,
    workflow: input.workflow,
    status: input.error ? (providerErrorCode(input.error) === "Canceled" ? "canceled" : "failed") : "success",
    startedAt: input.startedAt,
    finishedAt,
    durationMs: Math.max(0, Date.parse(finishedAt) - Date.parse(input.startedAt)),
    inputTokens: input.result?.usage.inputTokens ?? null,
    outputTokens: input.result?.usage.outputTokens ?? null,
    totalTokens: input.result?.usage.totalTokens ?? null,
    errorCode: input.error ? providerErrorCode(input.error) : null,
    errorMessage: input.error ? redactSensitiveText(input.error instanceof Error ? input.error.message : String(input.error)) : null
  });
}

async function runSingleLlmProvider(input: {
  provider: ApiCallProvider;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  maxTokens: number;
  workflow: Extract<ApiCallWorkflow, "skill_test" | "image_prompt_workspace">;
  db: WorkspaceDatabase;
}): Promise<ChatCompletionResult> {
  const apiKey = input.provider === "mock" ? undefined : await getLatestApiKeyForProvider(input.provider, input.model);
  const config = getLlmProviderConfig(input.provider);
  const provider = config ? createLlmProviderFromConfig(config, apiKey ?? undefined) : null;
  if (!provider) {
    throw new Error(`Provider 未注册：${input.provider}`);
  }
  if (input.provider !== "mock" && !apiKey) {
    throw new LLMProviderError("InvalidAPIKey", `未配置 ${input.provider} API key`, false);
  }
  const startedAt = new Date().toISOString();
  try {
    const [settled] = await runModelsAllSettled(provider, [
      {
        columnId: `${input.provider}:${input.model}:skill-test`,
        model: input.model,
        systemPrompt: input.systemPrompt,
        userPrompt: input.userPrompt,
        maxTokens: input.maxTokens,
        apiKey: apiKey ?? undefined
      } satisfies ChatRequest & { columnId: string }
    ]);
    if (settled?.status === "fulfilled") {
      logApiCall({
        db: input.db,
        provider: input.provider,
        model: input.model,
        workflow: input.workflow,
        startedAt,
        result: settled.value
      });
      return settled.value;
    }
    throw new Error(settled?.status === "rejected" ? settled.reason : "Provider request failed");
  } catch (error) {
    logApiCall({
      db: input.db,
      provider: input.provider,
      model: input.model,
      workflow: input.workflow,
      startedAt,
      error
    });
    throw error;
  }
}

async function runLlmModelsWithProviders(input: {
  models: Array<{ provider: ApiCallProvider; model: string }>;
  systemPrompt: string;
  userPrompt: string;
  maxTokens: number;
  workflow: Extract<ApiCallWorkflow, "title_workspace" | "script_workspace">;
  db: WorkspaceDatabase;
}): Promise<
  Array<
    | { status: "fulfilled"; columnId: string; provider: ApiCallProvider; model: string; value: ChatCompletionResult }
    | { status: "rejected"; columnId: string; provider: ApiCallProvider; model: string; reason: string }
  >
> {
	const rows = await Promise.all(
		input.models.map(async (model, index) => {
      const apiKey = model.provider === "mock" ? undefined : await getLatestApiKeyForProvider(model.provider, model.model);
      const config = getLlmProviderConfig(model.provider);
			const provider = config ? createLlmProviderFromConfig(config, apiKey ?? undefined) : null;
			const columnId = `${model.provider}:${model.model}:${index}`;
      if (!provider) {
        return {
          status: "rejected" as const,
          columnId,
          provider: model.provider,
          model: model.model,
          reason: `Provider 未注册：${model.provider}`
        };
      }
      const startedAt = new Date().toISOString();
      try {
        if (model.provider !== "mock" && !apiKey) {
          throw new LLMProviderError("InvalidAPIKey", `未配置 ${model.provider} API key`, false);
        }
        const requestApiKey = apiKey ?? undefined;
        const request: ChatRequest & { columnId: string } = {
          columnId,
          model: model.model,
          systemPrompt: input.systemPrompt,
          userPrompt: input.userPrompt,
          maxTokens: input.maxTokens,
          apiKey: requestApiKey
        };
        const [settled] = await runModelsAllSettled(provider, [request]);
        if (settled?.status === "fulfilled") {
          logApiCall({
            db: input.db,
            provider: model.provider,
            model: model.model,
            workflow: input.workflow,
            startedAt,
            result: settled.value
          });
          return {
            status: "fulfilled" as const,
            columnId,
            provider: model.provider,
            model: model.model,
            value: settled.value
          };
        }
        const reason = settled?.status === "rejected" ? settled.reason : "Provider request failed";
        logApiCall({
          db: input.db,
          provider: model.provider,
          model: model.model,
          workflow: input.workflow,
          startedAt,
          error: new Error(reason)
        });
        return {
          status: "rejected" as const,
          columnId,
          provider: model.provider,
          model: model.model,
          reason
        };
      } catch (error) {
        logApiCall({
          db: input.db,
          provider: model.provider,
          model: model.model,
          workflow: input.workflow,
          startedAt,
          error
        });
        return {
          status: "rejected" as const,
          columnId,
          provider: model.provider,
          model: model.model,
          reason: error instanceof Error ? redactSensitiveText(error.message) : redactSensitiveText(String(error))
        };
      }
    })
  );
  return rows;
}

async function runLlmModelsWithProvidersStreaming(input: {
  models: Array<{ provider: ApiCallProvider; model: string }>;
  systemPrompt: string;
  userPrompt: string;
  maxTokens: number;
  workflow: Extract<ApiCallWorkflow, "title_workspace" | "script_workspace">;
  db: WorkspaceDatabase;
  abortSignal: AbortSignal;
  onText: (columnId: string, chunk: string) => void;
}): Promise<
  Array<
    | { status: "fulfilled"; columnId: string; provider: ApiCallProvider; model: string; value: ChatCompletionResult }
    | { status: "rejected"; columnId: string; provider: ApiCallProvider; model: string; reason: string }
  >
> {
  const rows = await Promise.all(
    input.models.map(async (model, index) => {
      const apiKey = model.provider === "mock" ? undefined : await getLatestApiKeyForProvider(model.provider, model.model);
      const config = getLlmProviderConfig(model.provider);
      const provider = config ? createLlmProviderFromConfig(config, apiKey ?? undefined) : null;
      const columnId = `${model.provider}:${model.model}:${index}`;
			if (!provider) {
				return {
					status: "rejected" as const,
					columnId,
					provider: model.provider,
					model: model.model,
          reason: `Provider 未注册：${model.provider}`
        };
      }
      const startedAt = new Date().toISOString();
      if (model.provider !== "mock" && !apiKey) {
        const error = new LLMProviderError("InvalidAPIKey", `未配置 ${model.provider} API key`, false);
        logApiCall({
          db: input.db,
          provider: model.provider,
          model: model.model,
          workflow: input.workflow,
          startedAt,
          error
        });
        return {
          status: "rejected" as const,
          columnId,
          provider: model.provider,
          model: model.model,
          reason: redactSensitiveText(error.message)
        };
      }
      try {
        const [settled] = await runModelsAllSettled(
          provider,
          [
            {
              columnId,
              model: model.model,
              systemPrompt: input.systemPrompt,
              userPrompt: input.userPrompt,
              maxTokens: input.maxTokens,
              apiKey: apiKey ?? undefined,
              abortSignal: input.abortSignal
            } satisfies ChatRequest & { columnId: string }
          ],
          input.onText
        );
        if (settled?.status === "fulfilled") {
          logApiCall({
            db: input.db,
            provider: model.provider,
            model: model.model,
            workflow: input.workflow,
            startedAt,
            result: settled.value
          });
          return {
            status: "fulfilled" as const,
            columnId,
            provider: model.provider,
            model: model.model,
            value: settled.value
          };
        }
        throw new Error(settled?.status === "rejected" ? settled.reason : "Provider request failed");
      } catch (error) {
        logApiCall({
          db: input.db,
          provider: model.provider,
          model: model.model,
          workflow: input.workflow,
          startedAt,
          error
        });
        return {
          status: "rejected" as const,
          columnId,
          provider: model.provider,
          model: model.model,
          reason: error instanceof Error ? redactSensitiveText(error.message) : redactSensitiveText(String(error))
        };
      }
    })
  );
  return rows;
}

async function runTitleScheduledJob(job: ScheduledJobRecord, db: WorkspaceDatabase): Promise<ScheduledJobExecutionResult> {
  const title = db.saveTitle({
    text: `${job.name} 自动标题 ${new Date().toISOString().slice(0, 16).replace("T", " ")}`,
    sourceSkillId: "scheduled:title_generation",
    score: 80,
    status: "active",
    notes: "由主进程定时任务自动生成"
  });
  return {
    status: "success",
    artifactSummary: `已生成标题 1 条：${title.text}`,
    errorMessage: null
  };
}

async function runScriptScheduledJob(job: ScheduledJobRecord, db: WorkspaceDatabase): Promise<ScheduledJobExecutionResult> {
  const script = db.saveScript({
    text: [
      `开场：这是 ${job.name} 的定时生成文案。`,
      "卖点：主进程已按计划触发，结果写入本地文案库。",
      "转化：检查文案库后可继续编辑或导出。"
    ].join("\n"),
    sourceSkillId: "scheduled:script_generation",
    skuCode: null,
    status: "active",
    notes: "由主进程定时任务自动生成"
  });
  return {
    status: "success",
    artifactSummary: `已生成文案 1 条：${script.id}`,
    errorMessage: null
  };
}

async function runImageScheduledJob(job: ScheduledJobRecord, db: WorkspaceDatabase): Promise<ScheduledJobExecutionResult> {
  const workspaceRootPath = getActiveWorkspaceRootPath();
  const prompt = db.savePrompt({
    text: `${job.name} 自动图片提示词，干净背景，突出商品主体`,
    scene: "main",
    status: "active",
    notes: "由主进程定时任务自动生成"
  });
  const providers = createDefaultImageProviders();
  const provider = providers.mock;
  if (!provider) {
    throw new Error("Mock 图片 Provider 未注册");
  }
  const generated = await provider.generate({
    provider: provider.id,
    model: "mock-image",
    prompt: prompt.text,
    count: 1,
    ratio: "1:1"
  });
  const image = generated.images[0];
  if (!image) {
    throw new Error("图片 Provider 未返回结果");
  }
  const relativePath = path.posix.join("images", "main", `${prompt.id}-${image.id}.${image.extension}`);
  const absolutePath = path.join(workspaceRootPath, relativePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, image.bytes);
  const savedImage = db.saveImage({
    promptId: prompt.id,
    relativePath,
    scene: prompt.scene,
    width: image.width,
    height: image.height,
    aspectRatio: "1:1",
    sourceModel: generated.model,
    status: "active",
    generatedAt: new Date().toISOString()
  });
  db.incrementPromptGeneratedCount(prompt.id, 1);
  return {
    status: "success",
    artifactSummary: `已生成图片 1 张：${savedImage.relativePath}`,
    errorMessage: null
  };
}

async function runScheduledWorkflow(job: ScheduledJobRecord, db: WorkspaceDatabase): Promise<ScheduledJobExecutionResult> {
  const targetError = validateScheduledWorkflowTarget(job);
  if (targetError) {
    return {
      status: "failed",
      artifactSummary: null,
      errorMessage: targetError
    };
  }
  if (job.type === "task_sheet") {
    return runTaskSheetScheduledJob(job);
  }
  if (job.type === "title_generation") {
    return runTitleScheduledJob(job, db);
  }
  if (job.type === "image_generation") {
    return runImageScheduledJob(job, db);
  }
  if (job.type === "script_generation") {
    return runScriptScheduledJob(job, db);
  }
  return {
    status: "failed",
    artifactSummary: null,
    errorMessage: `不支持的定时任务类型：${job.type}`
  };
}

async function runDueScheduledJobsWithAdapters(nowIsoValue = new Date().toISOString()): Promise<ScheduledJobRunRecord[]> {
  return withActiveWorkspaceDb(async (db) => {
    const plans = db.collectDueScheduledJobPlans(nowIsoValue);
    const runs: ScheduledJobRunRecord[] = [];
    for (const plan of plans) {
      const finishedAt = new Date().toISOString();
      for (const skippedAt of plan.skippedTimes) {
        runs.push(
          db.saveScheduledJobRun({
            jobId: plan.job.id,
            status: "skipped",
            startedAt: skippedAt,
            finishedAt,
            durationMs: 0,
            artifactSummary: `按错过补跑策略跳过 ${plan.job.name}`,
            errorMessage: null
          })
        );
      }
      for (const scheduledAt of plan.runTimes) {
        const startedAtMs = Date.now();
        let result: ScheduledJobExecutionResult;
        try {
          result = await runScheduledWorkflow(plan.job, db);
        } catch (error) {
          result = {
            status: "failed",
            artifactSummary: null,
            errorMessage: error instanceof Error ? error.message : String(error)
          };
        }
        runs.push(
          db.saveScheduledJobRun({
            jobId: plan.job.id,
            status: result.status,
            startedAt: scheduledAt,
            finishedAt: new Date().toISOString(),
            durationMs: Math.max(0, Date.now() - startedAtMs),
            artifactSummary: result.artifactSummary ?? null,
            errorMessage: result.errorMessage ?? null
          })
        );
      }
      db.updateScheduledJobNextRun(plan.job.id, plan.nextRunAt);
    }
    return runs;
  });
}

async function createZipFromFiles(input: { targetPath: string; files: Array<{ absolutePath: string; archiveName: string }> }): Promise<void> {
  await mkdir(path.dirname(input.targetPath), { recursive: true });
  const tmpPath = `${input.targetPath}.tmp`;
  await new Promise<void>((resolve, reject) => {
    const output = createWriteStream(tmpPath);
    const archive = archiver("zip", { zlib: { level: 9 } });
    output.on("close", () => resolve());
    output.on("error", reject);
    archive.on("error", reject);
    archive.pipe(output);
    for (const file of input.files) {
      archive.file(file.absolutePath, { name: file.archiveName });
    }
    void archive.finalize();
  });
  await rename(tmpPath, input.targetPath);
}

function registerIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.APP_GET_BOOTSTRAP, async (): Promise<BootstrapState> => ({
    appVersion: app.getVersion(),
    platform: process.platform,
    userDataPath: app.getPath("userData"),
    workspace: getConfigDb().getRuntimeState(),
    apiKeys: getConfigDb().listApiKeys()
  }));

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_CREATE, async (_event, payload: unknown) => {
    const input = WorkspaceCreateInputSchema.parse(payload);
    return getConfigDb().createWorkspace(input);
  });

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_UPDATE, async (_event, payload: unknown) => {
    const input = WorkspaceUpdateInputSchema.parse(payload);
    return getConfigDb().updateWorkspace(input);
  });

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_DELETE, async (_event, payload: unknown) => {
    const input = WorkspaceDeleteInputSchema.parse(payload);
    return getConfigDb().deleteWorkspace(input);
  });

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_SWITCH, async (_event, payload: unknown) => {
    const input = z.object({ workspaceId: z.string().min(1) }).parse(payload);
    return getConfigDb().switchWorkspace(input.workspaceId);
  });

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_CHOOSE_DIRECTORY, async () => {
    const result = await dialog.showOpenDialog({
      title: "选择工作空间根目录",
      properties: ["openDirectory", "createDirectory"]
    });
    return {
      canceled: result.canceled,
      path: result.filePaths[0] ?? null
    };
  });
  ipcMain.handle(IPC_CHANNELS.WORKSPACE_VALIDATE_PATHS, async (_event, payload: unknown) => {
    const input = WorkspacePathValidationInputSchema.parse(payload);
    return getConfigDb().validateWorkspacePaths(input);
  });
  ipcMain.handle(IPC_CHANNELS.WORKSPACE_CHECK_CLOUD_SYNC, async () => checkWorkspaceCloudSync());

  ipcMain.handle(IPC_CHANNELS.VIDEOS_LIST, async () =>
    withActiveWorkspaceDb((db) => db.listVideos().map((video) => toVideoLibraryItem(video)))
  );
  ipcMain.handle(IPC_CHANNELS.VIDEOS_SCAN, async () =>
    withActiveWorkspaceDb((db) => {
      const toolPaths = resolveFfmpegToolPaths();
      if (!toolPaths) {
        return db.scanVideos();
      }
      return db.scanVideos({
        metadataReader: createFfmpegVideoMetadataReader(toolPaths),
        thumbnailGenerator: createFirstFrameThumbnailGenerator({
          ...toolPaths,
          cacheRootPath: path.join(app.getPath("userData"), "cache", "video-thumbnails")
        })
      });
    })
  );
  ipcMain.handle(IPC_CHANNELS.VIDEOS_UPDATE, async (_event, payload: unknown) => {
    const input = VideoUpdateInputSchema.parse(payload);
    return withActiveWorkspaceDb((db) => toVideoLibraryItem(db.updateVideo(input)));
  });
  ipcMain.handle(IPC_CHANNELS.VIDEOS_BATCH_UPDATE, async (_event, payload: unknown) => {
    const input = VideoBatchUpdateInputSchema.parse(payload);
    return withActiveWorkspaceDb((db) => db.batchUpdateVideos(input).map((video) => toVideoLibraryItem(video)));
  });
  ipcMain.handle(IPC_CHANNELS.COVERS_GET_TIMELINE, async (_event, payload: unknown): Promise<CoverTimelineResult> => {
    const input = CoverTimelineInputSchema.parse(payload);
    const cacheRootPath = path.join(app.getPath("userData"), "cache", "cover-timeline");
    return withActiveWorkspaceDb(async (db) => {
      const video = db.listVideos().find((candidate) => candidate.id === input.videoId);
      if (!video) {
        throw new Error("视频不存在");
      }
      const videoAbsolutePath = path.join(getActiveWorkspaceRootPath(), video.relativePath);
      const toolPaths = resolveFfmpegToolPaths();
      try {
        const result = toolPaths
          ? await createTimelineThumbnailGenerator({ ...toolPaths, cacheRootPath })({
              videoId: video.id,
              videoAbsolutePath,
              durationSeconds: video.durationSeconds,
              frameCount: input.frameCount
            })
          : await createMockTimelineThumbnails({
              cacheRootPath,
              videoId: video.id,
              durationSeconds: video.durationSeconds,
              frameCount: input.frameCount
            });
        return {
          videoId: video.id,
          durationSeconds: result.durationSeconds,
          generated: true,
          error: null,
          frames: result.frames.map((frame) => ({
            index: frame.index,
            second: frame.second,
            cacheRelativePath: frame.cacheRelativePath,
            url: `${CACHE_PROTOCOL}://cover-timeline/${encodeURIComponent(frame.cacheRelativePath)}`
          }))
        };
      } catch (error) {
        const result = await createMockTimelineThumbnails({
          cacheRootPath,
          videoId: video.id,
          durationSeconds: video.durationSeconds,
          frameCount: input.frameCount
        });
        return {
          videoId: video.id,
          durationSeconds: result.durationSeconds,
          generated: false,
          error: error instanceof Error ? error.message : String(error),
          frames: result.frames.map((frame) => ({
            index: frame.index,
            second: frame.second,
            cacheRelativePath: frame.cacheRelativePath,
            url: `${CACHE_PROTOCOL}://cover-timeline/${encodeURIComponent(frame.cacheRelativePath)}`
          }))
        };
      }
    });
  });
  ipcMain.handle(IPC_CHANNELS.COVERS_APPLY, async (_event, payload: unknown) => {
    const input = CoverApplyInputSchema.parse(payload);
    const workspaceRootPath = getActiveWorkspaceRootPath();
    return withActiveWorkspaceDb(async (db) => {
      const video = db.listVideos().find((candidate) => candidate.id === input.videoId);
      if (!video) {
        throw new Error("视频不存在");
      }
      const frame = await getCoverTimelineFrameForVideo({
        video,
        frameIndex: input.frameIndex ?? 0
      });
      const written = await writeCoverFile({
        workspaceRootPath,
        video,
        aspectRatio: input.aspectRatio,
        customRatio: input.customRatio,
        frameIndex: input.frameIndex ?? 0,
        frameSecond: frame.second,
        cropPosition: input.cropPosition,
        timelineFrameCachePath: frame.absolutePath
      });
      return {
        video: toVideoLibraryItem(db.setVideoCover(video.id, written.coverRelativePath)),
        coverRelativePath: written.coverRelativePath,
        coverAbsolutePath: written.coverAbsolutePath
      };
    });
  });
  ipcMain.handle(IPC_CHANNELS.COVERS_BATCH_APPLY_FIRST_FRAME, async (_event, payload: unknown) => {
    const input = CoverBatchApplyFirstFrameInputSchema.parse(payload);
    const workspaceRootPath = getActiveWorkspaceRootPath();
    return withActiveWorkspaceDb(async (db) => {
      const videos = db.listVideos();
      const pendingVideos = videos.filter((video) => !video.hasCover && video.status !== "archived");
      const updatedVideos: VideoLibraryItem[] = [];
      const coverRelativePaths: string[] = [];
      for (const video of pendingVideos) {
        const written = await writeCoverFile({
          workspaceRootPath,
          video,
          aspectRatio: input.aspectRatio,
          customRatio: input.customRatio,
          frameIndex: 0,
          frameSecond: 0,
          timelineFrameCachePath: (
            await getCoverTimelineFrameForVideo({
              video,
              frameIndex: 0
            })
          ).absolutePath
        });
        coverRelativePaths.push(written.coverRelativePath);
        updatedVideos.push(toVideoLibraryItem(db.setVideoCover(video.id, written.coverRelativePath)));
      }
      return {
        applied: updatedVideos.length,
        skipped: videos.length - pendingVideos.length,
        videos: updatedVideos,
        coverRelativePaths
      };
    });
  });
  ipcMain.handle(IPC_CHANNELS.TAGS_LIST, async () => withActiveWorkspaceDb((db) => db.listTags()));
  ipcMain.handle(IPC_CHANNELS.TAGS_IMPORT_CSV, async () => {
    const result = await dialog.showOpenDialog({
      title: "导入标签 CSV",
      properties: ["openFile"],
      filters: [{ name: "CSV", extensions: ["csv"] }]
    });
    if (result.canceled || !result.filePaths[0]) {
      return { imported: 0, inserted: 0, updated: 0, skipped: 0, errors: [] };
    }
    const csvText = await readFile(result.filePaths[0], "utf8");
    return withActiveWorkspaceDb((db) => db.importTagsCsv(csvText));
  });
  ipcMain.handle(IPC_CHANNELS.TAGS_SAVE, async (_event, payload: unknown) => {
    const input = TagSaveInputSchema.parse(payload);
    return withActiveWorkspaceDb((db) => db.saveTag(input));
  });
  ipcMain.handle(IPC_CHANNELS.TITLES_LIST, async () => withActiveWorkspaceDb((db) => db.listTitles()));
  ipcMain.handle(IPC_CHANNELS.TITLES_SAVE, async (_event, payload: unknown) => {
    const input = TitleSaveInputSchema.parse(payload);
    return withActiveWorkspaceDb((db) => db.saveTitle(input));
  });
  ipcMain.handle(IPC_CHANNELS.TITLE_WORKSPACE_GENERATE, async (_event, payload: unknown) => {
    const input = TitleWorkspaceGenerateInputSchema.parse(payload);
    const workspace = getActiveWorkspaceRecord();
    const enabledTitleSkills = await getConfigDb().listEnabledSkills(workspace.id, "title");
    const skill = enabledTitleSkills.find((candidate) => candidate.id === input.skillId);
    if (!skill) {
      throw new Error("当前工作空间未启用该标题 Skill");
    }
    const expanded = await expandSkillPrompt(skill.rootPath, input.taskPrompt);
    if (!expanded.ok) {
      throw new Error(`Skill 展开失败：${expanded.errors.map((error) => error.message).join("；")}`);
    }
    return withActiveWorkspaceDb(async (db) => {
      const settled = await runLlmModelsWithProviders({
        models: input.models,
        systemPrompt: expanded.text,
        userPrompt: input.taskPrompt || `请生成 ${input.count} 条短视频标题`,
        maxTokens: 1_000,
        workflow: "title_workspace",
        db
      });
      return {
        skillId: input.skillId,
        columns: settled.map((result) => {
          if (result.status === "fulfilled") {
            return {
              columnId: result.columnId,
              provider: result.provider,
              model: result.model,
              status: "success",
              text: result.value.fullText,
              titles: parseTitleLines(result.value.fullText, input.count),
              error: null,
              usage: result.value.usage
            };
          }
          return {
            columnId: result.columnId,
            provider: result.provider,
            model: result.model,
            status: "failed",
            text: "",
            titles: [],
            error: result.reason,
            usage: null
          };
        })
      };
    });
  });
  ipcMain.handle(IPC_CHANNELS.TITLE_WORKSPACE_STREAM_START, async (event, payload: unknown) => {
    const input = TitleWorkspaceGenerateInputSchema.parse(payload);
    const streamId = crypto.randomUUID();
    const controller = new AbortController();
    titleWorkspaceStreams.set(streamId, controller);
    const sender = event.sender;

    setTimeout(() => {
      void (async () => {
      const emit = (payloadToSend: unknown): void => {
        if (!sender.isDestroyed()) {
          sender.send(IPC_CHANNELS.TITLE_WORKSPACE_STREAM_EVENT, payloadToSend);
        }
      };
      try {
        const workspace = getActiveWorkspaceRecord();
        const enabledTitleSkills = await getConfigDb().listEnabledSkills(workspace.id, "title");
        const skill = enabledTitleSkills.find((candidate) => candidate.id === input.skillId);
        if (!skill) {
          throw new Error("当前工作空间未启用该标题 Skill");
        }
        const expanded = await expandSkillPrompt(skill.rootPath, input.taskPrompt);
        if (!expanded.ok) {
          throw new Error(`Skill 展开失败：${expanded.errors.map((error) => error.message).join("；")}`);
        }
        const initialColumns = input.models.map((model, index) => ({
          columnId: `${model.provider}:${model.model}:${index}`,
          provider: model.provider,
          model: model.model
        }));
        emit({ type: "started", streamId, columns: initialColumns });
        await withActiveWorkspaceDb(async (db) => {
          const settled = await runLlmModelsWithProvidersStreaming({
            models: input.models,
            systemPrompt: expanded.text,
            userPrompt: input.taskPrompt || `请生成 ${input.count} 条短视频标题`,
            maxTokens: 1_000,
            workflow: "title_workspace",
            db,
            abortSignal: controller.signal,
            onText: (columnId, chunk) => emit({ type: "chunk", streamId, columnId, text: chunk })
          });
          for (const result of settled) {
            const column: TitleWorkspaceColumnResult =
              result.status === "fulfilled"
                ? {
                    columnId: result.columnId,
                    provider: result.provider,
                    model: result.model,
                    status: "success",
                    text: result.value.fullText,
                    titles: parseTitleLines(result.value.fullText, input.count),
                    error: null,
                    usage: result.value.usage
                  }
                : {
                    columnId: result.columnId,
                    provider: result.provider,
                    model: result.model,
                    status: "failed",
                    text: "",
                    titles: [],
                    error: result.reason,
                    usage: null
                  };
            emit({ type: "columnComplete", streamId, column });
          }
        });
        emit({ type: "done", streamId, canceled: controller.signal.aborted });
      } catch (error) {
        emit({
          type: "done",
          streamId,
          canceled: controller.signal.aborted,
          error: error instanceof Error ? redactSensitiveText(error.message) : redactSensitiveText(String(error))
        });
      } finally {
        titleWorkspaceStreams.delete(streamId);
      }
      })();
    }, 25);

    return { streamId };
  });
  ipcMain.handle(IPC_CHANNELS.TITLE_WORKSPACE_STREAM_CANCEL, async (_event, payload: unknown) => {
    const input = TitleWorkspaceStreamCancelInputSchema.parse(payload);
    const controller = titleWorkspaceStreams.get(input.streamId);
    if (!controller) {
      return { canceled: false };
    }
    controller.abort();
    return { canceled: true };
  });
  ipcMain.handle(IPC_CHANNELS.TITLE_WORKSPACE_SAVE_SELECTED, async (_event, payload: unknown) => {
    const input = TitleWorkspaceSaveInputSchema.parse(payload);
    return withActiveWorkspaceDb((db) => {
      const titleIds = input.titles.map(
        (title) =>
          db.saveTitle({
            text: title,
            sourceSkillId: input.skillId,
            score: input.score ?? null,
            status: "active"
          }).id
      );
      return {
        savedCount: titleIds.length,
        titleIds
      };
    });
  });
  ipcMain.handle(IPC_CHANNELS.PROMPTS_LIST, async () => withActiveWorkspaceDb((db) => db.listPrompts()));
  ipcMain.handle(IPC_CHANNELS.PROMPTS_SAVE, async (_event, payload: unknown) => {
    const input = PromptSaveInputSchema.parse(payload);
    return withActiveWorkspaceDb((db) => db.savePrompt(input));
  });
  ipcMain.handle(IPC_CHANNELS.IMAGES_LIST, async () =>
    withActiveWorkspaceDb((db) => db.listImages().map((image) => toImageLibraryItem(image)))
  );
  ipcMain.handle(IPC_CHANNELS.IMAGES_SAVE, async (_event, payload: unknown) => {
    const input = ImageSaveInputSchema.parse(payload);
    return withActiveWorkspaceDb((db) => toImageLibraryItem(db.saveImage(input)));
  });
  ipcMain.handle(IPC_CHANNELS.IMAGES_SOFT_DELETE, async (_event, payload: unknown): Promise<ImageSoftDeleteResult> => {
    const input = ImageSoftDeleteInputSchema.parse(payload);
    const workspaceRootPath = getActiveWorkspaceRootPath();
    return withActiveWorkspaceDb(async (db) => {
      const existing = db.getImage(input.imageId);
      if (!existing) {
        throw new Error("图片不存在");
      }
      if (existing.status === "soft_deleted") {
        const trashAbsolutePath = path.join(workspaceRootPath, existing.relativePath);
        const prompt = existing.promptId ? db.listPrompts().find((candidate) => candidate.id === existing.promptId) ?? null : null;
        return {
          image: toImageLibraryItem(existing),
          trashRelativePath: existing.relativePath,
          trashAbsolutePath,
          prompt,
          suggestedNegativePrompt: Boolean(prompt && prompt.generatedCount > 0 && prompt.keptCount === 0)
        };
      }
      const trashRelativePath = toTrashImageRelativePath(existing);
      const sourcePath = path.join(workspaceRootPath, existing.relativePath);
      const trashAbsolutePath = path.join(workspaceRootPath, trashRelativePath);
      await mkdir(path.dirname(trashAbsolutePath), { recursive: true });
      await rename(sourcePath, trashAbsolutePath);
      try {
        const result = db.softDeleteImageRecord({
          imageId: input.imageId,
          trashRelativePath
        });
        return {
          image: toImageLibraryItem(result.image),
          trashRelativePath,
          trashAbsolutePath,
          prompt: result.prompt,
          suggestedNegativePrompt: result.suggestedNegativePrompt
        };
      } catch (error) {
        await mkdir(path.dirname(sourcePath), { recursive: true });
        await rename(trashAbsolutePath, sourcePath);
        throw error;
      }
    });
  });
  ipcMain.handle(IPC_CHANNELS.IMAGE_PROMPT_WORKSPACE_GENERATE, async (_event, payload: unknown) => {
    const input = ImagePromptWorkspaceGenerateInputSchema.parse(payload);
    const workspace = getActiveWorkspaceRecord();
    const enabledImagePromptSkills = await getConfigDb().listEnabledSkills(workspace.id, "image_prompt");
    const skill = enabledImagePromptSkills.find((candidate) => candidate.id === input.skillId);
    if (!skill) {
      throw new Error("当前工作空间未启用该图片提示词 Skill");
    }
    const userPrompt = [
      `场景：${input.scene}`,
      input.seed ? `种子描述：${input.seed}` : "种子描述：按当前场景生成可直接用于图片模型的商品图片提示词",
      `请生成 ${input.count} 条图片提示词。每条单独一行，不要输出解释。`
    ].join("\n");
    const expanded = await expandSkillPrompt(skill.rootPath, userPrompt);
    if (!expanded.ok) {
      throw new Error(`Skill 展开失败：${expanded.errors.map((error) => error.message).join("；")}`);
    }
    return withActiveWorkspaceDb(async (db) => {
      const result = await runSingleLlmProvider({
        provider: input.model.provider,
        model: input.model.model,
        systemPrompt: expanded.text,
        userPrompt,
        maxTokens: 1_200,
        workflow: "image_prompt_workspace",
        db
      });
      const prompts = parseImagePromptLines(result.fullText, input.count);
      return {
        skillId: input.skillId,
        scene: input.scene,
        prompts,
        text: result.fullText,
        provider: input.model.provider,
        model: input.model.model,
        usage: result.usage
      };
    });
  });
  ipcMain.handle(IPC_CHANNELS.IMAGE_SCENE_PRESETS_LIST, async () => withActiveWorkspaceDb((db) => db.listImageScenePresets()));
  ipcMain.handle(IPC_CHANNELS.IMAGE_SCENE_PRESETS_SAVE, async (_event, payload: unknown) => {
    const input = ImageScenePresetSaveInputSchema.parse(payload);
    return withActiveWorkspaceDb((db) => db.saveImageScenePreset(input));
  });
  ipcMain.handle(IPC_CHANNELS.IMAGE_WORKSPACE_GENERATE, async (_event, payload: unknown) => {
    const input = ImageWorkspaceGenerateInputSchema.parse(payload);
    const workspaceRootPath = getActiveWorkspaceRootPath();
    const expectedDimensions = getImageDimensions(input.aspectRatio);
    return withActiveWorkspaceDb(async (db) => {
      const promptById = new Map(db.listPrompts().map((prompt) => [prompt.id, prompt]));
      const prompts = input.promptIds.map((promptId) => promptById.get(promptId)).filter((prompt): prompt is NonNullable<typeof prompt> => Boolean(prompt));
      if (prompts.length === 0) {
        throw new Error("未找到可生成图片的提示词");
      }
      const targets =
        input.targets.length > 0
          ? input.targets
          : [
              {
                provider: input.provider ?? (input.model.startsWith("mock") ? "mock" : "openai"),
                model: input.model,
                apiKeyId: null
              }
            ];
      const jobs =
        input.generationStrategy === "all_providers"
          ? prompts.flatMap((prompt) => targets.map((target) => ({ prompt, target })))
          : prompts.map((prompt, index) => ({ prompt, target: targets[index % targets.length] as (typeof targets)[number] }));
      const settled = await mapWithConcurrency(
        jobs,
        getConfigDb().getSettings().providerConcurrencyLimit,
        async ({ prompt, target }) => {
          const config = getImageProviderConfig(target.provider);
          const providerApiKey = await getImageApiKeyForTarget(target);
          const provider = config ? createImageProviderFromConfig(config, providerApiKey) : null;
          if (!provider) {
            throw new Error(`图片 Provider 未配置：${target.provider}`);
          }
          if (provider.id !== "mock" && !providerApiKey) {
            throw new Error(`未配置 ${provider.id} 图片 API key`);
          }
          const startedAt = new Date().toISOString();
          try {
            const generated = await provider.generate({
              provider: provider.id,
              model: target.model,
              prompt: prompt.text,
              count: input.perPromptCount,
              ratio: input.aspectRatio,
              apiKey: providerApiKey
            });
            db.saveApiCallLog({
              provider: provider.id,
              model: target.model,
              workflow: "image_workspace",
              status: "success",
              startedAt,
              finishedAt: new Date().toISOString(),
              durationMs: Math.max(0, Date.now() - Date.parse(startedAt)),
              inputTokens: null,
              outputTokens: null,
              totalTokens: null
            });
            const savedImages: ImageLibraryItem[] = [];
            for (const generatedImage of generated.images) {
              const providerSlug = provider.id.replace(/[^A-Za-z0-9._-]+/g, "-");
              const fileName = `${prompt.id}-${providerSlug}-${generatedImage.id}.${generatedImage.extension}`;
              const relativePath = path.posix.join("images", input.outputSubdir, fileName);
              const absolutePath = path.join(workspaceRootPath, relativePath);
              await mkdir(path.dirname(absolutePath), { recursive: true });
              await writeFile(absolutePath, generatedImage.bytes);
              savedImages.push(
                toImageLibraryItem(
                  db.saveImage({
                    promptId: prompt.id,
                    relativePath,
                    scene: prompt.scene,
                    width: generatedImage.width || expectedDimensions.width,
                    height: generatedImage.height || expectedDimensions.height,
                    aspectRatio: input.aspectRatio,
                    sourceModel: `${generated.provider}/${generated.model}`,
                    status: "active",
                    generatedAt: new Date().toISOString()
                  })
                )
              );
            }
            db.incrementPromptGeneratedCount(prompt.id, savedImages.length);
            return savedImages;
          } catch (error) {
            db.saveApiCallLog({
              provider: provider.id,
              model: target.model,
              workflow: "image_workspace",
              status: "failed",
              startedAt,
              finishedAt: new Date().toISOString(),
              durationMs: Math.max(0, Date.now() - Date.parse(startedAt)),
              errorCode: providerErrorCode(error),
              errorMessage: redactSensitiveText(error instanceof Error ? error.message : String(error))
            });
            throw error;
          }
        }
      );
      const savedImages = settled.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
      const errors = [
        ...new Set(
          settled
            .filter((result): result is PromiseRejectedResult => result.status === "rejected")
            .map((result) => redactSensitiveText(result.reason instanceof Error ? result.reason.message : String(result.reason)))
        )
      ];
      if (savedImages.length === 0 && errors.length > 0) {
        throw new Error(errors[0]);
      }
      return {
        requested: jobs.length * input.perPromptCount,
        savedImages,
        failed: errors.length,
        errors
      };
    });
  });
  ipcMain.handle(IPC_CHANNELS.SCRIPTS_LIST, async () => withActiveWorkspaceDb((db) => db.listScripts()));
  ipcMain.handle(IPC_CHANNELS.SCRIPTS_SAVE, async (_event, payload: unknown) => {
    const input = ScriptSaveInputSchema.parse(payload);
    return withActiveWorkspaceDb((db) => db.saveScript(input));
  });
  ipcMain.handle(IPC_CHANNELS.SCRIPTS_EXPORT, async (_event, payload: unknown) => {
    const input = ScriptExportInputSchema.parse(payload);
    const workspace = getActiveWorkspaceRecord();
    return withActiveWorkspaceDb(async (db) => {
      const allScripts = db.listScripts();
      const selectedIds = new Set(input.scriptIds);
      const scripts = selectedIds.size > 0 ? allScripts.filter((script) => selectedIds.has(script.id)) : allScripts;
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const exportRelativeDir = path.posix.join("scripts_export", timestamp);
      const exportAbsoluteDir = path.join(workspace.rootPath, exportRelativeDir);
      await mkdir(exportAbsoluteDir, { recursive: true });

      const writtenFiles: string[] = [];
      if (input.formats.includes("txt")) {
        const txtRelativePath = path.posix.join(exportRelativeDir, "scripts.txt");
        const txt = scripts
          .map((script, index) =>
            [
              `# ${index + 1}`,
              script.skuCode ? `SKU: ${script.skuCode}` : null,
              script.sourceSkillId ? `Skill: ${script.sourceSkillId}` : null,
              script.text
            ]
              .filter(Boolean)
              .join("\n")
          )
          .join("\n\n---\n\n");
        await atomicWriteTextFile(path.join(workspace.rootPath, txtRelativePath), `${txt}\n`);
        writtenFiles.push(txtRelativePath);
      }
      if (input.formats.includes("csv")) {
        const csvRelativePath = path.posix.join(exportRelativeDir, "scripts.csv");
        const rows = [
          ["script_id", "sku_code", "source_skill_id", "status", "use_count", "created_at", "text"],
          ...scripts.map((script) => [
            script.id,
            script.skuCode ?? "",
            script.sourceSkillId ?? "",
            script.status,
            String(script.useCount),
            script.createdAt,
            script.text
          ])
        ];
        const csv = `\uFEFF${rows.map((row) => row.map(csvEscape).join(",")).join("\n")}\n`;
        await atomicWriteTextFile(path.join(workspace.rootPath, csvRelativePath), csv);
        writtenFiles.push(csvRelativePath);
      }

      return {
        exportRelativeDir,
        exportAbsoluteDir,
        writtenFiles,
        exportedCount: scripts.length
      };
    });
  });
  ipcMain.handle(IPC_CHANNELS.SCRIPT_WORKSPACE_GENERATE, async (_event, payload: unknown) => {
    const input = ScriptWorkspaceGenerateInputSchema.parse(payload);
    const workspace = getActiveWorkspaceRecord();
    const enabledScriptSkills = await getConfigDb().listEnabledSkills(workspace.id, "script");
    const skill = enabledScriptSkills.find((candidate) => candidate.id === input.skillId);
    if (!skill) {
      throw new Error("当前工作空间未启用该文案 Skill");
    }
    const promptParts = [
      input.taskPrompt || "请生成一条短视频口播脚本或剪映文字转语音文案。",
      input.skuCode ? `关联 SKU：${input.skuCode}` : ""
    ].filter(Boolean);
    const userPrompt = promptParts.join("\n");
    const expanded = await expandSkillPrompt(skill.rootPath, userPrompt);
    if (!expanded.ok) {
      throw new Error(`Skill 展开失败：${expanded.errors.map((error) => error.message).join("；")}`);
    }
    return withActiveWorkspaceDb(async (db) => {
      const settled = await runLlmModelsWithProviders({
        models: input.models,
        systemPrompt: expanded.text,
        userPrompt,
        maxTokens: 1_500,
        workflow: "script_workspace",
        db
      });
      return {
        skillId: input.skillId,
        skuCode: input.skuCode || null,
        columns: settled.map((result) => {
          if (result.status === "fulfilled") {
            return {
              columnId: result.columnId,
              provider: result.provider,
              model: result.model,
              status: "success",
              text: result.value.fullText,
              scripts: parseScriptBlocks(result.value.fullText),
              error: null,
              usage: result.value.usage
            };
          }
          return {
            columnId: result.columnId,
            provider: result.provider,
            model: result.model,
            status: "failed",
            text: "",
            scripts: [],
            error: result.reason,
            usage: null
          };
        })
      };
    });
  });
  ipcMain.handle(IPC_CHANNELS.SCRIPT_WORKSPACE_STREAM_START, async (event, payload: unknown) => {
    const input = ScriptWorkspaceGenerateInputSchema.parse(payload);
    const streamId = crypto.randomUUID();
    const controller = new AbortController();
    scriptWorkspaceStreams.set(streamId, controller);
    const sender = event.sender;

    setTimeout(() => {
      void (async () => {
      const emit = (payloadToSend: unknown): void => {
        if (!sender.isDestroyed()) {
          sender.send(IPC_CHANNELS.SCRIPT_WORKSPACE_STREAM_EVENT, payloadToSend);
        }
      };
      try {
        const workspace = getActiveWorkspaceRecord();
        const enabledScriptSkills = await getConfigDb().listEnabledSkills(workspace.id, "script");
        const skill = enabledScriptSkills.find((candidate) => candidate.id === input.skillId);
        if (!skill) {
          throw new Error("当前工作空间未启用该文案 Skill");
        }
        const promptParts = [
          input.taskPrompt || "请生成一条短视频口播脚本或剪映文字转语音文案。",
          input.skuCode ? `关联 SKU：${input.skuCode}` : ""
        ].filter(Boolean);
        const userPrompt = promptParts.join("\n");
        const expanded = await expandSkillPrompt(skill.rootPath, userPrompt);
        if (!expanded.ok) {
          throw new Error(`Skill 展开失败：${expanded.errors.map((error) => error.message).join("；")}`);
        }
        const initialColumns = input.models.map((model, index) => ({
          columnId: `${model.provider}:${model.model}:${index}`,
          provider: model.provider,
          model: model.model
        }));
        emit({ type: "started", streamId, columns: initialColumns });
        await withActiveWorkspaceDb(async (db) => {
          const settled = await runLlmModelsWithProvidersStreaming({
            models: input.models,
            systemPrompt: expanded.text,
            userPrompt,
            maxTokens: 1_500,
            workflow: "script_workspace",
            db,
            abortSignal: controller.signal,
            onText: (columnId, chunk) => emit({ type: "chunk", streamId, columnId, text: chunk })
          });
          for (const result of settled) {
            const column: ScriptWorkspaceColumnResult =
              result.status === "fulfilled"
                ? {
                    columnId: result.columnId,
                    provider: result.provider,
                    model: result.model,
                    status: "success",
                    text: result.value.fullText,
                    scripts: parseScriptBlocks(result.value.fullText),
                    error: null,
                    usage: result.value.usage
                  }
                : {
                    columnId: result.columnId,
                    provider: result.provider,
                    model: result.model,
                    status: "failed",
                    text: "",
                    scripts: [],
                    error: result.reason,
                    usage: null
                  };
            emit({ type: "columnComplete", streamId, column });
          }
        });
        emit({ type: "done", streamId, canceled: controller.signal.aborted });
      } catch (error) {
        emit({
          type: "done",
          streamId,
          canceled: controller.signal.aborted,
          error: error instanceof Error ? redactSensitiveText(error.message) : redactSensitiveText(String(error))
        });
      } finally {
        scriptWorkspaceStreams.delete(streamId);
      }
      })();
    }, 25);

    return { streamId };
  });
  ipcMain.handle(IPC_CHANNELS.SCRIPT_WORKSPACE_STREAM_CANCEL, async (_event, payload: unknown) => {
    const input = ScriptWorkspaceStreamCancelInputSchema.parse(payload);
    const controller = scriptWorkspaceStreams.get(input.streamId);
    if (!controller) {
      return { canceled: false };
    }
    controller.abort();
    return { canceled: true };
  });
  ipcMain.handle(IPC_CHANNELS.SCRIPT_WORKSPACE_SAVE_SELECTED, async (_event, payload: unknown) => {
    const input = ScriptWorkspaceSaveInputSchema.parse(payload);
    return withActiveWorkspaceDb((db) => {
      const scriptIds = input.scripts.map(
        (script) =>
          db.saveScript({
            text: script,
            sourceSkillId: input.skillId,
            skuCode: input.skuCode || null,
            status: "active"
          }).id
      );
      return {
        savedCount: scriptIds.length,
        scriptIds
      };
    });
  });
  ipcMain.handle(IPC_CHANNELS.SCHEDULED_JOBS_LIST, async () => withActiveWorkspaceDb((db) => db.listScheduledJobs()));
  ipcMain.handle(IPC_CHANNELS.SCHEDULED_JOBS_SAVE, async (_event, payload: unknown) => {
    const input = ScheduledJobSaveInputSchema.parse(payload);
    return withActiveWorkspaceDb((db) => db.saveScheduledJob(input));
  });
  ipcMain.handle(IPC_CHANNELS.SCHEDULED_JOBS_TOGGLE, async (_event, payload: unknown) => {
    const input = ScheduledJobToggleInputSchema.parse(payload);
    return withActiveWorkspaceDb((db) => db.toggleScheduledJob(input));
  });
  ipcMain.handle(IPC_CHANNELS.SCHEDULED_JOBS_RUN_DUE, async () => runDueScheduledJobsWithAdapters());
  ipcMain.handle(IPC_CHANNELS.SCHEDULED_JOB_RUNS_LIST, async (_event, payload: unknown) => {
    const input = ScheduledJobRunsListInputSchema.parse(payload);
    return withActiveWorkspaceDb((db) => db.listScheduledJobRuns(input.jobId, input.limit));
  });
  ipcMain.handle(IPC_CHANNELS.SKILLS_LIST, async () => getConfigDb().listSkills());
  ipcMain.handle(IPC_CHANNELS.SKILLS_SAVE, async (_event, payload: unknown) => {
    const input = SkillSaveInputSchema.parse(payload);
    return getConfigDb().saveSkill(input);
  });
  ipcMain.handle(IPC_CHANNELS.SKILLS_READ_CONTENT, async (_event, payload: unknown) => {
    const input = SkillContentRequestSchema.parse(payload);
    return getConfigDb().readSkillContent(input);
  });
  ipcMain.handle(IPC_CHANNELS.SKILLS_LIST_FILES, async (_event, payload: unknown) => {
    const input = SkillContentRequestSchema.parse(payload);
    return getConfigDb().listSkillFiles(input);
  });
  ipcMain.handle(IPC_CHANNELS.SKILLS_SAVE_FILE, async (_event, payload: unknown) => {
    const input = SkillFileSaveInputSchema.parse(payload);
    return getConfigDb().saveSkillFile(input);
  });
  ipcMain.handle(IPC_CHANNELS.SKILLS_LIST_SNAPSHOTS, async (_event, payload: unknown) => {
    const input = SkillContentRequestSchema.parse(payload);
    return getConfigDb().listSkillSnapshots(input);
  });
  ipcMain.handle(IPC_CHANNELS.SKILLS_RESTORE_SNAPSHOT, async (_event, payload: unknown) => {
    const input = SkillSnapshotRestoreInputSchema.parse(payload);
    return getConfigDb().restoreSkillSnapshot(input);
  });
  ipcMain.handle(IPC_CHANNELS.SKILLS_CREATE_OFFICIAL_COPY, async (_event, payload: unknown) => {
    const input = SkillCreateOfficialCopyInputSchema.parse(payload);
    return getConfigDb().createOfficialSkillCopy(input);
  });
  ipcMain.handle(IPC_CHANNELS.SKILLS_RESTORE_OFFICIAL_COPY, async (_event, payload: unknown) => {
    const input = SkillOfficialCopyInputSchema.parse(payload);
    return getConfigDb().restoreOfficialSkillCopy(input);
  });
  ipcMain.handle(IPC_CHANNELS.SKILLS_UPGRADE_OFFICIAL_COPY, async (_event, payload: unknown) => {
    const input = SkillOfficialCopyInputSchema.parse(payload);
    return getConfigDb().upgradeOfficialSkillCopy(input);
  });
  ipcMain.handle(IPC_CHANNELS.SKILLS_TEST, async (_event, payload: unknown) => {
    const input = SkillTestInputSchema.parse(payload);
    const skill = (await getConfigDb().listSkills()).find((candidate) => candidate.id === input.skillId);
    if (!skill) {
      throw new Error("Skill 不存在，无法测试");
    }
    const expanded = await expandSkillPrompt(skill.rootPath, input.taskPrompt);
    if (!expanded.ok) {
      throw new Error(`Skill 展开失败：${expanded.errors.map((error) => error.message).join("；")}`);
    }
    return withActiveWorkspaceDb(async (db) => {
      try {
        const result = await runSingleLlmProvider({
          provider: input.model.provider,
          model: input.model.model,
          systemPrompt: expanded.text,
          userPrompt: input.taskPrompt,
          maxTokens: 1_200,
          workflow: "skill_test",
          db
        });
        return {
          skillId: input.skillId,
          provider: input.model.provider,
          model: input.model.model,
          status: "success",
          text: result.fullText,
          error: null,
          includedFiles: expanded.includedFiles,
          usage: result.usage
        };
      } catch (error) {
        return {
          skillId: input.skillId,
          provider: input.model.provider,
          model: input.model.model,
          status: "failed",
          text: "",
          error: error instanceof Error ? redactSensitiveText(error.message) : redactSensitiveText(String(error)),
          includedFiles: expanded.includedFiles,
          usage: null
        };
      }
    });
  });
  ipcMain.handle(IPC_CHANNELS.SKILLS_LIST_ENABLED, async (_event, payload: unknown) => {
    const input = z.object({ type: SkillWorkflowTypeSchema.optional() }).parse(payload ?? {});
    const workspace = getActiveWorkspaceRecord();
    return getConfigDb().listEnabledSkills(workspace.id, input.type);
  });
  ipcMain.handle(IPC_CHANNELS.SKILLS_GET_ACTIVATION, async () => {
    const workspace = getActiveWorkspaceRecord();
    return getConfigDb().getSkillActivation(workspace.id);
  });
  ipcMain.handle(IPC_CHANNELS.SKILLS_UPDATE_ACTIVATION, async (_event, payload: unknown) => {
    const input = SkillActivationUpdateInputSchema.parse(payload);
    return getConfigDb().updateSkillActivation(input);
  });
  ipcMain.handle(IPC_CHANNELS.SKILL_MARKET_LIST, async (_event, payload: unknown) => {
    const input = SkillMarketListInputSchema.parse(payload ?? {});
    return getConfigDb().listSkillMarket(input);
  });
  ipcMain.handle(IPC_CHANNELS.SKILL_MARKET_INSTALL, async (_event, payload: unknown) => {
    const input = SkillMarketInstallInputSchema.parse(payload);
    return getConfigDb().installSkillFromMarket(input);
  });
  ipcMain.handle(IPC_CHANNELS.PLATFORM_ACCOUNTS_LIST, async () => withActiveWorkspaceDb((db) => db.listPlatformAccounts()));
  ipcMain.handle(IPC_CHANNELS.PLATFORM_ACCOUNTS_SAVE, async (_event, payload: unknown) => {
    const input = PlatformAccountSaveInputSchema.parse(payload);
    return withActiveWorkspaceDb((db) => db.savePlatformAccount(input));
  });
  ipcMain.handle(IPC_CHANNELS.TASK_SHEET_GET_BY_DATE, async (_event, payload: unknown) => {
    const input = z.object({ sheetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).parse(payload);
    return withActiveWorkspaceDb((db) => db.getTaskSheetByDate(input.sheetDate));
  });
  ipcMain.handle(IPC_CHANNELS.TASK_SHEET_GENERATE, async (_event, payload: unknown) => {
    const input = TaskGenerateInputSchema.parse(payload);
    return withActiveWorkspaceDb((db) => db.generateTaskSheet(input));
  });
  ipcMain.handle(IPC_CHANNELS.TASK_SHEET_EXPORT, async (_event, payload: unknown) => {
    const input = TaskExportInputSchema.parse(payload);
    const workspace = getActiveWorkspaceRecord();
    return withActiveWorkspaceDb((db) =>
      db.exportTaskSheet({
        ...input,
        workspaceId: workspace.id,
        macRootPath: workspace.macRootPath,
        winRootPath: workspace.winRootPath
      })
    );
  });
  ipcMain.handle(IPC_CHANNELS.TASK_STATUS_SCAN, async (_event, payload: unknown) => {
    const input = TaskStatusScanInputSchema.parse(payload);
    return withActiveWorkspaceDb((db) => db.scanTaskStatusFiles(input));
  });
  ipcMain.handle(IPC_CHANNELS.TASK_ROW_RETRY, async (_event, payload: unknown) => {
    const input = TaskRetryInputSchema.parse(payload);
    return withActiveWorkspaceDb((db) => db.retryTaskRow(input));
  });
  ipcMain.handle(IPC_CHANNELS.TASK_ROW_MARK_STATUS, async (_event, payload: unknown) => {
    const input = TaskManualStatusInputSchema.parse(payload);
    return withActiveWorkspaceDb((db) => db.markTaskRowStatus(input));
  });
  ipcMain.handle(IPC_CHANNELS.TASK_ROW_UPDATE, async (_event, payload: unknown) => {
    const input = TaskRowUpdateInputSchema.parse(payload);
    return withActiveWorkspaceDb((db) => db.updateTaskRow(input));
  });
  ipcMain.handle(IPC_CHANNELS.TASK_ROW_DELETE, async (_event, payload: unknown) => {
    const input = TaskRowDeleteInputSchema.parse(payload);
    return withActiveWorkspaceDb((db) => db.deleteTaskRow(input));
  });
  ipcMain.handle(IPC_CHANNELS.TASK_ROW_ADD, async (_event, payload: unknown) => {
    const input = TaskRowAddInputSchema.parse(payload);
    return withActiveWorkspaceDb((db) => db.addTaskRow(input));
  });
  ipcMain.handle(IPC_CHANNELS.TASK_ROWS_REPLACE_TITLES, async (_event, payload: unknown) => {
    const input = TaskBatchReplaceTitlesInputSchema.parse(payload);
    return withActiveWorkspaceDb((db) => db.batchReplaceTaskTitles(input));
  });

  ipcMain.handle(IPC_CHANNELS.SECRETS_SAVE_API_KEY, async (_event, payload: unknown) => {
    const input = ApiKeySaveInputSchema.parse(payload);
    let connectionTest: ApiKeyConnectionTestResult;
    if (input.apiKey) {
      connectionTest = await testApiKeyConnection(input);
    } else if (input.apiKeyId) {
      const { record, apiKey } = await getConfigDb().getApiKeySecret(input.apiKeyId);
      connectionTest = await testApiKeyConnection({
        kind: input.kind ?? record.kind,
        provider: input.provider,
        model: input.model ?? record.model,
        apiKey,
        providerConfig: input.providerConfig
      });
    } else {
      connectionTest = await testApiKeyConnection(input);
    }
    if (!connectionTest.ok) {
      throw new Error(`API 连通性测试失败：${connectionTest.errorCode ?? "ProviderError"}${connectionTest.errorMessage ? ` - ${connectionTest.errorMessage}` : ""}`);
    }
    const saved = await getConfigDb().saveApiKey(input);
    return saved;
  });

  ipcMain.handle(IPC_CHANNELS.SECRETS_LIST_API_KEYS, async () => getConfigDb().listApiKeys());
  ipcMain.handle(IPC_CHANNELS.SECRETS_AUDIT_STORAGE, async () => getConfigDb().auditApiKeyStorage());
  ipcMain.handle(IPC_CHANNELS.SECRETS_TEST_API_KEY, async (_event, payload: unknown) => {
    const input = ApiKeyConnectionTestInputSchema.parse(payload);
    return testApiKeyConnection(input);
  });
  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, async () => getConfigDb().getSettings());
  ipcMain.handle(IPC_CHANNELS.SETTINGS_SAVE, async (_event, payload: unknown) => {
    const input = AppSettingsSaveInputSchema.parse(payload);
    return getConfigDb().saveSettings(input);
  });
  ipcMain.handle(IPC_CHANNELS.MAINTENANCE_BACKUP_WORKSPACE, async (_event, payload: unknown) => {
    const input = WorkspaceBackupInputSchema.parse(payload);
    const workspace = getActiveWorkspaceRecord();
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = `backup_${safeBackupName(workspace.id)}_${timestamp}.zip`;
    const backupRelativePath = path.posix.join("_backup", fileName);
    const backupAbsolutePath = path.join(workspace.rootPath, backupRelativePath);
    await zipDirectory({
      sourcePath: workspace.rootPath,
      targetPath: backupAbsolutePath,
      workspaceName: workspace.id,
      scope: input.scope
    });
    await pruneWorkspaceBackups(path.join(workspace.rootPath, "_backup"), input.retentionCount);
    const backupStat = await stat(backupAbsolutePath);
    return {
      backupRelativePath,
      backupAbsolutePath,
      sizeBytes: backupStat.size
    };
  });
  ipcMain.handle(IPC_CHANNELS.MAINTENANCE_RESTORE_WORKSPACE, async (_event, payload: unknown) => {
    const input = WorkspaceRestoreInputSchema.parse(payload);
    const workspace = getActiveWorkspaceRecord();
    if (!input.backupAbsolutePath.endsWith(".zip")) {
      throw new Error("只支持从 zip 备份恢复");
    }
    const backupStat = await stat(input.backupAbsolutePath);
    if (!backupStat.isFile()) {
      throw new Error("备份文件不存在");
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const preRestoreFileName = `backup_${safeBackupName(workspace.id)}_pre_restore_${timestamp}.zip`;
    const preRestoreBackupRelativePath = path.posix.join("_backup", preRestoreFileName);
    const preRestoreBackupAbsolutePath = path.join(workspace.rootPath, preRestoreBackupRelativePath);
    await zipDirectory({
      sourcePath: workspace.rootPath,
      targetPath: preRestoreBackupAbsolutePath,
      workspaceName: workspace.id,
      scope: "all"
    });

    const extractRootPath = path.join(workspace.rootPath, "_backup", `.restore-${process.pid}-${Date.now()}`);
    await rm(extractRootPath, { recursive: true, force: true });
    await mkdir(extractRootPath, { recursive: true });
    try {
      await extractZip(input.backupAbsolutePath, { dir: extractRootPath });
      if (!existsSync(path.join(extractRootPath, "workspace.db"))) {
        throw new Error("备份包缺少 workspace.db，已停止恢复");
      }
      const entries = await readdir(extractRootPath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name === "_backup" || entry.name === "workspace.lock") {
          continue;
        }
        const targetPath = path.join(workspace.rootPath, entry.name);
        await rm(targetPath, { recursive: true, force: true });
        await cp(path.join(extractRootPath, entry.name), targetPath, { recursive: true });
      }
      const restoredFiles = await countFiles(extractRootPath);
      return {
        restoredFrom: input.backupAbsolutePath,
        preRestoreBackupRelativePath,
        preRestoreBackupAbsolutePath,
        restoredFiles
      };
    } finally {
      await rm(extractRootPath, { recursive: true, force: true });
    }
  });
  ipcMain.handle(IPC_CHANNELS.MAINTENANCE_CREATE_FEEDBACK_PACKAGE, async (_event, payload: unknown) => {
    const input = FeedbackPackageInputSchema.parse(payload);
    log.info("Creating feedback package", input.description);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const feedbackRootPath = path.join(app.getPath("userData"), "feedback", timestamp);
    const files: Array<{ absolutePath: string; archiveName: string }> = [];
    await rm(feedbackRootPath, { recursive: true, force: true });
    await mkdir(feedbackRootPath, { recursive: true });
    try {
      const descriptionPath = path.join(feedbackRootPath, "description.txt");
      await writeFile(descriptionPath, `${redactSensitiveText(input.description)}\n`, "utf8");
      files.push({ absolutePath: descriptionPath, archiveName: "description.txt" });

      if (input.includeSystemInfo) {
        const systemInfoPath = path.join(feedbackRootPath, "system-info.json");
        const workspace = getConfigDb().getRuntimeState();
        await writeFile(
          systemInfoPath,
          `${JSON.stringify(
            {
              appVersion: app.getVersion(),
              platform: process.platform,
              arch: process.arch,
              electron: process.versions.electron,
              node: process.versions.node,
              activeWorkspaceId: workspace.activeWorkspaceId,
              workspaceCount: workspace.workspaces.length
            },
            null,
            2
          )}\n`,
          "utf8"
        );
        files.push({ absolutePath: systemInfoPath, archiveName: "system-info.json" });
      }

      if (input.includeLogs) {
        const logsPath = path.join(app.getPath("userData"), "logs");
        const logEntries = await readdir(logsPath, { withFileTypes: true }).catch(() => []);
        for (const entry of logEntries) {
          if (!entry.isFile() || !entry.name.endsWith(".log")) {
            continue;
          }
          const sourcePath = path.join(logsPath, entry.name);
          const targetPath = path.join(feedbackRootPath, `redacted-${entry.name}`);
          const redacted = redactSensitiveText(await readFile(sourcePath, "utf8"));
          await writeFile(targetPath, redacted, "utf8");
          files.push({ absolutePath: targetPath, archiveName: path.posix.join("logs", `redacted-${entry.name}`) });
        }
      }

      const packageRelativePath = path.posix.join("feedback", `feedback_${timestamp}.zip`);
      const packageAbsolutePath = path.join(app.getPath("userData"), packageRelativePath);
      await createZipFromFiles({ targetPath: packageAbsolutePath, files });
      const packageStat = await stat(packageAbsolutePath);
      return {
        packageAbsolutePath,
        packageRelativePath,
        sizeBytes: packageStat.size,
        includedFiles: files.map((file) => file.archiveName)
      };
    } finally {
      await rm(feedbackRootPath, { recursive: true, force: true });
    }
  });
  ipcMain.handle(IPC_CHANNELS.MAINTENANCE_CLEAN_CACHES, async (_event, payload: unknown) => {
    const input = CacheCleanupInputSchema.parse(payload);
    const targets = Array.from(new Set(input.targets));
    let removedFiles = 0;
    let removedBytes = 0;

    for (const target of targets) {
      const targetPath = cacheTargetPath(target);
      const before = await inspectDirectory(targetPath);
      removedFiles += before.files;
      removedBytes += before.bytes;
      await rm(targetPath, { recursive: true, force: true });
      await mkdir(targetPath, { recursive: true });
    }

    return {
      removedFiles,
      removedBytes,
      cleanedTargets: targets
    };
  });
  ipcMain.handle(IPC_CHANNELS.MAINTENANCE_CHECK_FOR_UPDATES, async (_event, payload: unknown) => {
    SoftwareUpdateCheckInputSchema.parse(payload ?? {});
    return checkForSoftwareUpdates();
  });
  ipcMain.handle(IPC_CHANNELS.MAINTENANCE_GET_UPDATE_STATE, async () => softwareUpdateState);
  ipcMain.handle(IPC_CHANNELS.MAINTENANCE_DOWNLOAD_UPDATE, async () => downloadSoftwareUpdate());
  ipcMain.handle(IPC_CHANNELS.MAINTENANCE_INSTALL_UPDATE, async () => installSoftwareUpdate());
}

function startSchedulerLoop(): void {
  if (schedulerTimer) {
    return;
  }
  schedulerTimer = setInterval(() => {
    const state = configDb?.getRuntimeState();
    if (!state?.activeWorkspaceId) {
      return;
    }
    runDueScheduledJobsWithAdapters().catch((error: unknown) => {
      log.error("Scheduled job tick failed", error);
    });
  }, 5_000);
}

function registerLocalCacheProtocol(): void {
  protocol.handle(CACHE_PROTOCOL, (request) => {
    const requestUrl = new URL(request.url);
    const relativePath = decodeURIComponent(requestUrl.pathname.replace(/^\/+/, "")).replaceAll("\\", "/");
    if (!relativePath || relativePath.split("/").includes("..") || path.isAbsolute(relativePath)) {
      return new Response(null, { status: 403 });
    }

    const rootPath =
      requestUrl.hostname === "video-thumbnails"
        ? path.join(app.getPath("userData"), "cache", "video-thumbnails")
        : requestUrl.hostname === "cover-timeline"
          ? path.join(app.getPath("userData"), "cache", "cover-timeline")
        : requestUrl.hostname === "workspace-video"
          ? getActiveWorkspaceRootPath()
          : null;
    if (!rootPath) {
      return new Response(null, { status: 404 });
    }

    if (requestUrl.hostname === "workspace-video" && !relativePath.startsWith("videos/")) {
      return new Response(null, { status: 403 });
    }

    const resolvedRootPath = path.resolve(rootPath);
    const absolutePath = path.resolve(resolvedRootPath, relativePath);
    if (absolutePath !== resolvedRootPath && !absolutePath.startsWith(`${resolvedRootPath}${path.sep}`)) {
      return new Response(null, { status: 403 });
    }

    return net.fetch(pathToFileURL(absolutePath).toString());
  });
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 1120,
    minHeight: 720,
    title: "短视频运营工作台",
    backgroundColor: "#f7f7f8",
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.mjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    }
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void mainWindow.loadFile(
      path.join(__dirname, "../renderer/index.html"),
      process.env.ROSTER_E2E === "1" ? { query: { e2e: "1" } } : undefined
    );
  }
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app
  .whenReady()
  .then(async () => {
    configureLogging();
    configureAutoUpdater();
    configDb = await ConfigDatabase.open(app.getPath("userData"), { skillMarketFetcher: fetchSkillMarketBytes });
    registerLocalCacheProtocol();
    registerIpcHandlers();
    startSchedulerLoop();
    startUpdateCheckLoop();
    createWindow();
  })
  .catch((error: unknown) => {
    log.error("App bootstrap failed", error);
    dialog.showErrorBox("启动失败", error instanceof Error ? error.message : String(error));
    app.quit();
  });

app.on("before-quit", () => {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
  }
  if (updateCheckTimer) {
    clearInterval(updateCheckTimer);
    updateCheckTimer = null;
  }
  configDb?.close();
  configDb = null;
});
