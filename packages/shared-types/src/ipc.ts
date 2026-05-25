import type {
  ApiKeyConnectionTestInput,
  ApiKeyConnectionTestResult,
  ApiKeyPublicRecord,
  ApiKeySaveInput,
  ApiKeyStorageAudit
} from "./security";
import type { ImageLibraryItem, ImageReviewInput, ImageSaveInput, ImageSoftDeleteInput, ImageSoftDeleteResult } from "./image";
import type {
  ImageReferenceFileChooseResult,
  ImageReferenceFolderChooseResult,
  ImageReferenceFolderInspectInput,
  ImageReferenceFolderInspectResult,
  ImagePromptWorkspaceGenerateInput,
  ImagePromptWorkspaceGenerateResult,
  ImageScenePreset,
  ImageScenePresetSaveInput,
  ImageWorkspaceAdHocGenerateInput,
  ImageWorkspaceAdHocGenerateResult,
  ImageWorkspaceEditGenerateInput,
  ImageWorkspaceGenerateInput,
  ImageWorkspaceGenerateResult
} from "./image-workspace";
import type {
  CacheCleanupInput,
  CacheCleanupResult,
  FeedbackPackageInput,
  FeedbackPackageResult,
  SoftwareUpdateCheckInput,
  SoftwareUpdateCheckResult,
  SoftwareUpdateInstallResult,
  WorkspaceBackupInput,
  WorkspaceBackupResult,
  WorkspaceRestoreInput,
  WorkspaceRestoreResult
} from "./maintenance";
import type { PromptRecord, PromptSaveInput } from "./prompt";
import type {
  ScheduledJobRecord,
  ScheduledJobRunRecord,
  ScheduledJobRunsListInput,
  ScheduledJobSaveInput,
  ScheduledJobToggleInput
} from "./schedule";
import type { ScriptExportInput, ScriptExportResult, ScriptRecord, ScriptSaveInput } from "./script";
import type { AppSettings, AppSettingsSaveInput } from "./settings";
import type {
  ScriptWorkspaceGenerateInput,
  ScriptWorkspaceGenerateResult,
  ScriptWorkspaceStreamCancelInput,
  ScriptWorkspaceStreamEvent,
  ScriptWorkspaceStreamStartResult,
  ScriptWorkspaceSaveInput,
  ScriptWorkspaceSaveResult
} from "./script-workspace";
import type {
  SkillActivationConfig,
  SkillActivationUpdateInput,
  SkillContent,
  SkillContentRequest,
  SkillCreateOfficialCopyInput,
  SkillFile,
  SkillFileSaveInput,
  SkillOfficialCopyInput,
  SkillRecord,
  SkillSaveInput,
  SkillSnapshot,
  SkillSnapshotRestoreInput,
  SkillTestInput,
  SkillTestResult,
  SkillWorkflowType
} from "./skill";
import type {
  SkillMarketInstallInput,
  SkillMarketInstallResult,
  SkillMarketListInput,
  SkillMarketState
} from "./skill-market";
import type { TagImportSummary, TagRecord, TagSaveInput } from "./tag";
import type {
  PlatformAccountRecord,
  PlatformAccountSaveInput,
  TaskExportInput,
  TaskExportResult,
  TaskBatchReplaceTitlesInput,
  TaskGenerateInput,
  TaskManualStatusInput,
  TaskRowAddInput,
  TaskRowDeleteInput,
  TaskRetryInput,
  TaskRowRecord,
  TaskRowUpdateInput,
  TaskSheetRecord,
  TaskStatusScanInput,
  TaskStatusScanResult
} from "./task";
import type { TitleRecord, TitleSaveInput } from "./title";
import type {
  TitleWorkspaceGenerateInput,
  TitleWorkspaceGenerateResult,
  TitleWorkspaceStreamCancelInput,
  TitleWorkspaceStreamEvent,
  TitleWorkspaceStreamStartResult,
  TitleWorkspaceSaveInput,
  TitleWorkspaceSaveResult
} from "./title-workspace";
import type {
  CoverApplyInput,
  CoverApplyResult,
  CoverBatchApplyFirstFrameInput,
  CoverBatchApplyFirstFrameResult,
  CoverPreviewFrameInput,
  CoverPreviewFrameResult,
  CoverTimelineInput,
  CoverTimelineResult,
  VideoBatchUpdateInput,
  VideoLibraryItem,
  VideoScanSummary,
  VideoUpdateInput
} from "./video";
import type {
  WorkspaceCloudSyncCheckResult,
  WorkspaceCreateInput,
  WorkspaceDeleteInput,
  WorkspacePathValidationInput,
  WorkspacePathValidationResult,
  WorkspaceRuntimeState,
  WorkspaceUpdateInput
} from "./workspace";

export const IPC_CHANNELS = {
  APP_GET_BOOTSTRAP: "app:getBootstrap",
  WORKSPACE_CREATE: "workspace:create",
  WORKSPACE_UPDATE: "workspace:update",
  WORKSPACE_DELETE: "workspace:delete",
  WORKSPACE_SWITCH: "workspace:switch",
  WORKSPACE_CHOOSE_DIRECTORY: "workspace:chooseDirectory",
  WORKSPACE_VALIDATE_PATHS: "workspace:validatePaths",
  WORKSPACE_CHECK_CLOUD_SYNC: "workspace:checkCloudSync",
  VIDEOS_LIST: "videos:list",
  VIDEOS_SCAN: "videos:scan",
  VIDEOS_UPDATE: "videos:update",
  VIDEOS_BATCH_UPDATE: "videos:batchUpdate",
  COVERS_GET_TIMELINE: "covers:getTimeline",
  COVERS_GET_PREVIEW_FRAME: "covers:getPreviewFrame",
  COVERS_APPLY: "covers:apply",
  COVERS_BATCH_APPLY_FIRST_FRAME: "covers:batchApplyFirstFrame",
  TAGS_LIST: "tags:list",
  TAGS_IMPORT_CSV: "tags:importCsv",
  TAGS_SAVE: "tags:save",
  TITLES_LIST: "titles:list",
  TITLES_SAVE: "titles:save",
  TITLE_WORKSPACE_GENERATE: "titleWorkspace:generate",
  TITLE_WORKSPACE_STREAM_START: "titleWorkspace:streamStart",
  TITLE_WORKSPACE_STREAM_CANCEL: "titleWorkspace:streamCancel",
  TITLE_WORKSPACE_STREAM_EVENT: "titleWorkspace:streamEvent",
  TITLE_WORKSPACE_SAVE_SELECTED: "titleWorkspace:saveSelected",
  PROMPTS_LIST: "prompts:list",
  PROMPTS_SAVE: "prompts:save",
  IMAGES_LIST: "images:list",
  IMAGES_SAVE: "images:save",
  IMAGES_SOFT_DELETE: "images:softDelete",
  IMAGES_REVIEW: "images:review",
  IMAGE_PROMPT_WORKSPACE_GENERATE: "imagePromptWorkspace:generate",
  IMAGE_SCENE_PRESETS_LIST: "imageScenePresets:list",
  IMAGE_SCENE_PRESETS_SAVE: "imageScenePresets:save",
  IMAGE_WORKSPACE_GENERATE: "imageWorkspace:generate",
  IMAGE_WORKSPACE_GENERATE_ADHOC: "imageWorkspace:generateAdHoc",
  IMAGE_WORKSPACE_GENERATE_EDITS: "imageWorkspace:generateEdits",
  IMAGE_REFERENCE_FILES_CHOOSE: "imageReferences:chooseFiles",
  IMAGE_REFERENCE_FOLDER_CHOOSE: "imageReferences:chooseFolder",
  IMAGE_REFERENCE_FOLDER_INSPECT: "imageReferences:inspectFolder",
  SCRIPTS_LIST: "scripts:list",
  SCRIPTS_SAVE: "scripts:save",
  SCRIPTS_EXPORT: "scripts:export",
  SCRIPT_WORKSPACE_GENERATE: "scriptWorkspace:generate",
  SCRIPT_WORKSPACE_STREAM_START: "scriptWorkspace:streamStart",
  SCRIPT_WORKSPACE_STREAM_CANCEL: "scriptWorkspace:streamCancel",
  SCRIPT_WORKSPACE_STREAM_EVENT: "scriptWorkspace:streamEvent",
  SCRIPT_WORKSPACE_SAVE_SELECTED: "scriptWorkspace:saveSelected",
  SKILLS_LIST: "skills:list",
  SKILLS_SAVE: "skills:save",
  SKILLS_READ_CONTENT: "skills:readContent",
  SKILLS_LIST_FILES: "skills:listFiles",
  SKILLS_SAVE_FILE: "skills:saveFile",
  SKILLS_LIST_SNAPSHOTS: "skills:listSnapshots",
  SKILLS_RESTORE_SNAPSHOT: "skills:restoreSnapshot",
  SKILLS_CREATE_OFFICIAL_COPY: "skills:createOfficialCopy",
  SKILLS_RESTORE_OFFICIAL_COPY: "skills:restoreOfficialCopy",
  SKILLS_UPGRADE_OFFICIAL_COPY: "skills:upgradeOfficialCopy",
  SKILLS_TEST: "skills:test",
  SKILLS_LIST_ENABLED: "skills:listEnabled",
  SKILLS_GET_ACTIVATION: "skills:getActivation",
  SKILLS_UPDATE_ACTIVATION: "skills:updateActivation",
  SKILL_MARKET_LIST: "skillMarket:list",
  SKILL_MARKET_INSTALL: "skillMarket:install",
  PLATFORM_ACCOUNTS_LIST: "platformAccounts:list",
  PLATFORM_ACCOUNTS_SAVE: "platformAccounts:save",
  TASK_SHEET_GET_BY_DATE: "taskSheet:getByDate",
  TASK_SHEET_GENERATE: "taskSheet:generate",
  TASK_SHEET_EXPORT: "taskSheet:export",
  TASK_STATUS_SCAN: "taskStatus:scan",
  TASK_ROW_RETRY: "taskRow:retry",
  TASK_ROW_MARK_STATUS: "taskRow:markStatus",
  TASK_ROW_UPDATE: "taskRow:update",
  TASK_ROW_DELETE: "taskRow:delete",
  TASK_ROW_ADD: "taskRow:add",
  TASK_ROWS_REPLACE_TITLES: "taskRows:replaceTitles",
  SECRETS_SAVE_API_KEY: "secrets:saveApiKey",
  SECRETS_LIST_API_KEYS: "secrets:listApiKeys",
  SECRETS_AUDIT_STORAGE: "secrets:auditStorage",
  SECRETS_TEST_API_KEY: "secrets:testApiKey",
  SETTINGS_GET: "settings:get",
  SETTINGS_SAVE: "settings:save",
  MAINTENANCE_BACKUP_WORKSPACE: "maintenance:backupWorkspace",
  MAINTENANCE_RESTORE_WORKSPACE: "maintenance:restoreWorkspace",
  MAINTENANCE_CREATE_FEEDBACK_PACKAGE: "maintenance:createFeedbackPackage",
  MAINTENANCE_CLEAN_CACHES: "maintenance:cleanCaches",
  MAINTENANCE_GET_UPDATE_STATE: "maintenance:getUpdateState",
  MAINTENANCE_CHECK_FOR_UPDATES: "maintenance:checkForUpdates",
  MAINTENANCE_DOWNLOAD_UPDATE: "maintenance:downloadUpdate",
  MAINTENANCE_INSTALL_UPDATE: "maintenance:installUpdate",
  MAINTENANCE_UPDATE_EVENT: "maintenance:updateEvent",
  SCHEDULED_JOBS_LIST: "scheduledJobs:list",
  SCHEDULED_JOBS_SAVE: "scheduledJobs:save",
  SCHEDULED_JOBS_TOGGLE: "scheduledJobs:toggle",
  SCHEDULED_JOBS_RUN_DUE: "scheduledJobs:runDue",
  SCHEDULED_JOB_RUNS_LIST: "scheduledJobRuns:list"
} as const;

export interface BootstrapState {
  appVersion: string;
  platform: NodeJS.Platform;
  userDataPath: string;
  workspace: WorkspaceRuntimeState;
  apiKeys: ApiKeyPublicRecord[];
}

export interface DirectorySelection {
  canceled: boolean;
  path: string | null;
}

export interface IpcChannelMap {
  [IPC_CHANNELS.APP_GET_BOOTSTRAP]: {
    request: undefined;
    response: BootstrapState;
  };
  [IPC_CHANNELS.WORKSPACE_CREATE]: {
    request: WorkspaceCreateInput;
    response: WorkspaceRuntimeState;
  };
  [IPC_CHANNELS.WORKSPACE_UPDATE]: {
    request: WorkspaceUpdateInput;
    response: WorkspaceRuntimeState;
  };
  [IPC_CHANNELS.WORKSPACE_DELETE]: {
    request: WorkspaceDeleteInput;
    response: WorkspaceRuntimeState;
  };
  [IPC_CHANNELS.WORKSPACE_SWITCH]: {
    request: { workspaceId: string };
    response: WorkspaceRuntimeState;
  };
  [IPC_CHANNELS.WORKSPACE_CHOOSE_DIRECTORY]: {
    request: undefined;
    response: DirectorySelection;
  };
  [IPC_CHANNELS.WORKSPACE_VALIDATE_PATHS]: {
    request: WorkspacePathValidationInput;
    response: WorkspacePathValidationResult;
  };
  [IPC_CHANNELS.WORKSPACE_CHECK_CLOUD_SYNC]: {
    request: undefined;
    response: WorkspaceCloudSyncCheckResult;
  };
  [IPC_CHANNELS.VIDEOS_LIST]: {
    request: undefined;
    response: VideoLibraryItem[];
  };
  [IPC_CHANNELS.VIDEOS_SCAN]: {
    request: undefined;
    response: VideoScanSummary;
  };
  [IPC_CHANNELS.VIDEOS_UPDATE]: {
    request: VideoUpdateInput;
    response: VideoLibraryItem;
  };
  [IPC_CHANNELS.VIDEOS_BATCH_UPDATE]: {
    request: VideoBatchUpdateInput;
    response: VideoLibraryItem[];
  };
  [IPC_CHANNELS.COVERS_GET_TIMELINE]: {
    request: CoverTimelineInput;
    response: CoverTimelineResult;
  };
  [IPC_CHANNELS.COVERS_GET_PREVIEW_FRAME]: {
    request: CoverPreviewFrameInput;
    response: CoverPreviewFrameResult;
  };
  [IPC_CHANNELS.COVERS_APPLY]: {
    request: CoverApplyInput;
    response: CoverApplyResult;
  };
  [IPC_CHANNELS.COVERS_BATCH_APPLY_FIRST_FRAME]: {
    request: CoverBatchApplyFirstFrameInput;
    response: CoverBatchApplyFirstFrameResult;
  };
  [IPC_CHANNELS.TAGS_LIST]: {
    request: undefined;
    response: TagRecord[];
  };
  [IPC_CHANNELS.TAGS_IMPORT_CSV]: {
    request: undefined;
    response: TagImportSummary;
  };
  [IPC_CHANNELS.TAGS_SAVE]: {
    request: TagSaveInput;
    response: TagRecord;
  };
  [IPC_CHANNELS.TITLES_LIST]: {
    request: undefined;
    response: TitleRecord[];
  };
  [IPC_CHANNELS.TITLES_SAVE]: {
    request: TitleSaveInput;
    response: TitleRecord;
  };
  [IPC_CHANNELS.TITLE_WORKSPACE_GENERATE]: {
    request: TitleWorkspaceGenerateInput;
    response: TitleWorkspaceGenerateResult;
  };
  [IPC_CHANNELS.TITLE_WORKSPACE_STREAM_START]: {
    request: TitleWorkspaceGenerateInput;
    response: TitleWorkspaceStreamStartResult;
  };
  [IPC_CHANNELS.TITLE_WORKSPACE_STREAM_CANCEL]: {
    request: TitleWorkspaceStreamCancelInput;
    response: { canceled: boolean };
  };
  [IPC_CHANNELS.TITLE_WORKSPACE_STREAM_EVENT]: {
    request: undefined;
    response: TitleWorkspaceStreamEvent;
  };
  [IPC_CHANNELS.TITLE_WORKSPACE_SAVE_SELECTED]: {
    request: TitleWorkspaceSaveInput;
    response: TitleWorkspaceSaveResult;
  };
  [IPC_CHANNELS.PROMPTS_LIST]: {
    request: undefined;
    response: PromptRecord[];
  };
  [IPC_CHANNELS.PROMPTS_SAVE]: {
    request: PromptSaveInput;
    response: PromptRecord;
  };
  [IPC_CHANNELS.IMAGES_LIST]: {
    request: undefined;
    response: ImageLibraryItem[];
  };
  [IPC_CHANNELS.IMAGES_SAVE]: {
    request: ImageSaveInput;
    response: ImageLibraryItem;
  };
  [IPC_CHANNELS.IMAGES_SOFT_DELETE]: {
    request: ImageSoftDeleteInput;
    response: ImageSoftDeleteResult;
  };
  [IPC_CHANNELS.IMAGES_REVIEW]: {
    request: ImageReviewInput;
    response: ImageLibraryItem;
  };
  [IPC_CHANNELS.IMAGE_PROMPT_WORKSPACE_GENERATE]: {
    request: ImagePromptWorkspaceGenerateInput;
    response: ImagePromptWorkspaceGenerateResult;
  };
  [IPC_CHANNELS.IMAGE_SCENE_PRESETS_LIST]: {
    request: undefined;
    response: ImageScenePreset[];
  };
  [IPC_CHANNELS.IMAGE_SCENE_PRESETS_SAVE]: {
    request: ImageScenePresetSaveInput;
    response: ImageScenePreset;
  };
  [IPC_CHANNELS.IMAGE_WORKSPACE_GENERATE]: {
    request: ImageWorkspaceGenerateInput;
    response: ImageWorkspaceGenerateResult;
  };
  [IPC_CHANNELS.IMAGE_WORKSPACE_GENERATE_ADHOC]: {
    request: ImageWorkspaceAdHocGenerateInput;
    response: ImageWorkspaceAdHocGenerateResult;
  };
  [IPC_CHANNELS.IMAGE_WORKSPACE_GENERATE_EDITS]: {
    request: ImageWorkspaceEditGenerateInput;
    response: ImageWorkspaceGenerateResult & { promptIds: string[] };
  };
  [IPC_CHANNELS.IMAGE_REFERENCE_FILES_CHOOSE]: {
    request: undefined;
    response: ImageReferenceFileChooseResult;
  };
  [IPC_CHANNELS.IMAGE_REFERENCE_FOLDER_CHOOSE]: {
    request: undefined;
    response: ImageReferenceFolderChooseResult;
  };
  [IPC_CHANNELS.IMAGE_REFERENCE_FOLDER_INSPECT]: {
    request: ImageReferenceFolderInspectInput;
    response: ImageReferenceFolderInspectResult;
  };
  [IPC_CHANNELS.SCRIPTS_LIST]: {
    request: undefined;
    response: ScriptRecord[];
  };
  [IPC_CHANNELS.SCRIPTS_SAVE]: {
    request: ScriptSaveInput;
    response: ScriptRecord;
  };
  [IPC_CHANNELS.SCRIPTS_EXPORT]: {
    request: ScriptExportInput;
    response: ScriptExportResult;
  };
  [IPC_CHANNELS.SCRIPT_WORKSPACE_GENERATE]: {
    request: ScriptWorkspaceGenerateInput;
    response: ScriptWorkspaceGenerateResult;
  };
  [IPC_CHANNELS.SCRIPT_WORKSPACE_STREAM_START]: {
    request: ScriptWorkspaceGenerateInput;
    response: ScriptWorkspaceStreamStartResult;
  };
  [IPC_CHANNELS.SCRIPT_WORKSPACE_STREAM_CANCEL]: {
    request: ScriptWorkspaceStreamCancelInput;
    response: { canceled: boolean };
  };
  [IPC_CHANNELS.SCRIPT_WORKSPACE_STREAM_EVENT]: {
    request: undefined;
    response: ScriptWorkspaceStreamEvent;
  };
  [IPC_CHANNELS.SCRIPT_WORKSPACE_SAVE_SELECTED]: {
    request: ScriptWorkspaceSaveInput;
    response: ScriptWorkspaceSaveResult;
  };
  [IPC_CHANNELS.SKILLS_LIST]: {
    request: undefined;
    response: SkillRecord[];
  };
  [IPC_CHANNELS.SKILLS_SAVE]: {
    request: SkillSaveInput;
    response: SkillRecord;
  };
  [IPC_CHANNELS.SKILLS_READ_CONTENT]: {
    request: SkillContentRequest;
    response: SkillContent;
  };
  [IPC_CHANNELS.SKILLS_LIST_FILES]: {
    request: SkillContentRequest;
    response: SkillFile[];
  };
  [IPC_CHANNELS.SKILLS_SAVE_FILE]: {
    request: SkillFileSaveInput;
    response: SkillContent;
  };
  [IPC_CHANNELS.SKILLS_LIST_SNAPSHOTS]: {
    request: SkillContentRequest;
    response: SkillSnapshot[];
  };
  [IPC_CHANNELS.SKILLS_RESTORE_SNAPSHOT]: {
    request: SkillSnapshotRestoreInput;
    response: SkillContent;
  };
  [IPC_CHANNELS.SKILLS_CREATE_OFFICIAL_COPY]: {
    request: SkillCreateOfficialCopyInput;
    response: SkillRecord;
  };
  [IPC_CHANNELS.SKILLS_RESTORE_OFFICIAL_COPY]: {
    request: SkillOfficialCopyInput;
    response: SkillContent;
  };
  [IPC_CHANNELS.SKILLS_UPGRADE_OFFICIAL_COPY]: {
    request: SkillOfficialCopyInput;
    response: SkillContent;
  };
  [IPC_CHANNELS.SKILLS_TEST]: {
    request: SkillTestInput;
    response: SkillTestResult;
  };
  [IPC_CHANNELS.SKILLS_LIST_ENABLED]: {
    request: { type?: SkillWorkflowType };
    response: SkillRecord[];
  };
  [IPC_CHANNELS.SKILLS_GET_ACTIVATION]: {
    request: undefined;
    response: SkillActivationConfig;
  };
  [IPC_CHANNELS.SKILLS_UPDATE_ACTIVATION]: {
    request: SkillActivationUpdateInput;
    response: SkillActivationConfig;
  };
  [IPC_CHANNELS.SKILL_MARKET_LIST]: {
    request: SkillMarketListInput;
    response: SkillMarketState;
  };
  [IPC_CHANNELS.SKILL_MARKET_INSTALL]: {
    request: SkillMarketInstallInput;
    response: SkillMarketInstallResult;
  };
  [IPC_CHANNELS.PLATFORM_ACCOUNTS_LIST]: {
    request: undefined;
    response: PlatformAccountRecord[];
  };
  [IPC_CHANNELS.PLATFORM_ACCOUNTS_SAVE]: {
    request: PlatformAccountSaveInput;
    response: PlatformAccountRecord;
  };
  [IPC_CHANNELS.TASK_SHEET_GET_BY_DATE]: {
    request: { sheetDate: string };
    response: TaskSheetRecord | null;
  };
  [IPC_CHANNELS.TASK_SHEET_GENERATE]: {
    request: TaskGenerateInput;
    response: TaskSheetRecord;
  };
  [IPC_CHANNELS.TASK_SHEET_EXPORT]: {
    request: TaskExportInput;
    response: TaskExportResult;
  };
  [IPC_CHANNELS.TASK_STATUS_SCAN]: {
    request: TaskStatusScanInput;
    response: TaskStatusScanResult;
  };
  [IPC_CHANNELS.TASK_ROW_RETRY]: {
    request: TaskRetryInput;
    response: TaskRowRecord;
  };
  [IPC_CHANNELS.TASK_ROW_MARK_STATUS]: {
    request: TaskManualStatusInput;
    response: TaskRowRecord;
  };
  [IPC_CHANNELS.TASK_ROW_UPDATE]: {
    request: TaskRowUpdateInput;
    response: TaskRowRecord;
  };
  [IPC_CHANNELS.TASK_ROW_DELETE]: {
    request: TaskRowDeleteInput;
    response: TaskSheetRecord;
  };
  [IPC_CHANNELS.TASK_ROW_ADD]: {
    request: TaskRowAddInput;
    response: TaskRowRecord;
  };
  [IPC_CHANNELS.TASK_ROWS_REPLACE_TITLES]: {
    request: TaskBatchReplaceTitlesInput;
    response: TaskSheetRecord;
  };
  [IPC_CHANNELS.SECRETS_SAVE_API_KEY]: {
    request: ApiKeySaveInput;
    response: ApiKeyPublicRecord;
  };
  [IPC_CHANNELS.SECRETS_LIST_API_KEYS]: {
    request: undefined;
    response: ApiKeyPublicRecord[];
  };
  [IPC_CHANNELS.SECRETS_AUDIT_STORAGE]: {
    request: undefined;
    response: ApiKeyStorageAudit;
  };
  [IPC_CHANNELS.SECRETS_TEST_API_KEY]: {
    request: ApiKeyConnectionTestInput;
    response: ApiKeyConnectionTestResult;
  };
  [IPC_CHANNELS.SETTINGS_GET]: {
    request: undefined;
    response: AppSettings;
  };
  [IPC_CHANNELS.SETTINGS_SAVE]: {
    request: AppSettingsSaveInput;
    response: AppSettings;
  };
  [IPC_CHANNELS.MAINTENANCE_BACKUP_WORKSPACE]: {
    request: WorkspaceBackupInput;
    response: WorkspaceBackupResult;
  };
  [IPC_CHANNELS.MAINTENANCE_RESTORE_WORKSPACE]: {
    request: WorkspaceRestoreInput;
    response: WorkspaceRestoreResult;
  };
  [IPC_CHANNELS.MAINTENANCE_CREATE_FEEDBACK_PACKAGE]: {
    request: FeedbackPackageInput;
    response: FeedbackPackageResult;
  };
  [IPC_CHANNELS.MAINTENANCE_CLEAN_CACHES]: {
    request: CacheCleanupInput;
    response: CacheCleanupResult;
  };
  [IPC_CHANNELS.MAINTENANCE_GET_UPDATE_STATE]: {
    request: undefined;
    response: SoftwareUpdateCheckResult;
  };
  [IPC_CHANNELS.MAINTENANCE_CHECK_FOR_UPDATES]: {
    request: SoftwareUpdateCheckInput;
    response: SoftwareUpdateCheckResult;
  };
  [IPC_CHANNELS.MAINTENANCE_DOWNLOAD_UPDATE]: {
    request: undefined;
    response: SoftwareUpdateCheckResult;
  };
  [IPC_CHANNELS.MAINTENANCE_INSTALL_UPDATE]: {
    request: undefined;
    response: SoftwareUpdateInstallResult;
  };
  [IPC_CHANNELS.MAINTENANCE_UPDATE_EVENT]: {
    request: undefined;
    response: SoftwareUpdateCheckResult;
  };
  [IPC_CHANNELS.SCHEDULED_JOBS_LIST]: {
    request: undefined;
    response: ScheduledJobRecord[];
  };
  [IPC_CHANNELS.SCHEDULED_JOBS_SAVE]: {
    request: ScheduledJobSaveInput;
    response: ScheduledJobRecord;
  };
  [IPC_CHANNELS.SCHEDULED_JOBS_TOGGLE]: {
    request: ScheduledJobToggleInput;
    response: ScheduledJobRecord;
  };
  [IPC_CHANNELS.SCHEDULED_JOBS_RUN_DUE]: {
    request: undefined;
    response: ScheduledJobRunRecord[];
  };
  [IPC_CHANNELS.SCHEDULED_JOB_RUNS_LIST]: {
    request: ScheduledJobRunsListInput;
    response: ScheduledJobRunRecord[];
  };
}

export type IpcChannel = keyof IpcChannelMap;

export interface RosterApi {
  getBootstrap(): Promise<BootstrapState>;
  createWorkspace(input: WorkspaceCreateInput): Promise<WorkspaceRuntimeState>;
  updateWorkspace(input: WorkspaceUpdateInput): Promise<WorkspaceRuntimeState>;
  deleteWorkspace(input: WorkspaceDeleteInput): Promise<WorkspaceRuntimeState>;
  switchWorkspace(workspaceId: string): Promise<WorkspaceRuntimeState>;
  chooseWorkspaceDirectory(): Promise<DirectorySelection>;
  validateWorkspacePaths(input: WorkspacePathValidationInput): Promise<WorkspacePathValidationResult>;
  checkWorkspaceCloudSync(): Promise<WorkspaceCloudSyncCheckResult>;
  listVideos(): Promise<VideoLibraryItem[]>;
  scanVideos(): Promise<VideoScanSummary>;
  updateVideo(input: VideoUpdateInput): Promise<VideoLibraryItem>;
  batchUpdateVideos(input: VideoBatchUpdateInput): Promise<VideoLibraryItem[]>;
  getCoverTimeline(input: CoverTimelineInput): Promise<CoverTimelineResult>;
  getCoverPreviewFrame(input: CoverPreviewFrameInput): Promise<CoverPreviewFrameResult>;
  applyCover(input: CoverApplyInput): Promise<CoverApplyResult>;
  batchApplyFirstFrameCovers(input: CoverBatchApplyFirstFrameInput): Promise<CoverBatchApplyFirstFrameResult>;
  listTags(): Promise<TagRecord[]>;
  importTagsCsv(): Promise<TagImportSummary>;
  saveTag(input: TagSaveInput): Promise<TagRecord>;
  listTitles(): Promise<TitleRecord[]>;
  saveTitle(input: TitleSaveInput): Promise<TitleRecord>;
  generateTitleWorkspace(input: TitleWorkspaceGenerateInput): Promise<TitleWorkspaceGenerateResult>;
  startTitleWorkspaceStream(input: TitleWorkspaceGenerateInput): Promise<TitleWorkspaceStreamStartResult>;
  cancelTitleWorkspaceStream(input: TitleWorkspaceStreamCancelInput): Promise<{ canceled: boolean }>;
  onTitleWorkspaceStreamEvent(callback: (event: TitleWorkspaceStreamEvent) => void): () => void;
  saveTitleWorkspaceSelection(input: TitleWorkspaceSaveInput): Promise<TitleWorkspaceSaveResult>;
  listPrompts(): Promise<PromptRecord[]>;
  savePrompt(input: PromptSaveInput): Promise<PromptRecord>;
  listImages(): Promise<ImageLibraryItem[]>;
  saveImage(input: ImageSaveInput): Promise<ImageLibraryItem>;
  softDeleteImage(input: ImageSoftDeleteInput): Promise<ImageSoftDeleteResult>;
  reviewImage(input: ImageReviewInput): Promise<ImageLibraryItem>;
  generateImagePrompts(input: ImagePromptWorkspaceGenerateInput): Promise<ImagePromptWorkspaceGenerateResult>;
  listImageScenePresets(): Promise<ImageScenePreset[]>;
  saveImageScenePreset(input: ImageScenePresetSaveInput): Promise<ImageScenePreset>;
  generateImages(input: ImageWorkspaceGenerateInput): Promise<ImageWorkspaceGenerateResult>;
  generateImagesAdHoc(input: ImageWorkspaceAdHocGenerateInput): Promise<ImageWorkspaceAdHocGenerateResult>;
  generateImageEdits(input: ImageWorkspaceEditGenerateInput): Promise<ImageWorkspaceGenerateResult & { promptIds: string[] }>;
  chooseImageReferenceFiles(): Promise<ImageReferenceFileChooseResult>;
  chooseImageReferenceFolder(): Promise<ImageReferenceFolderChooseResult>;
  inspectImageReferenceFolder(input: ImageReferenceFolderInspectInput): Promise<ImageReferenceFolderInspectResult>;
  listScripts(): Promise<ScriptRecord[]>;
  saveScript(input: ScriptSaveInput): Promise<ScriptRecord>;
  exportScripts(input: ScriptExportInput): Promise<ScriptExportResult>;
  generateScriptWorkspace(input: ScriptWorkspaceGenerateInput): Promise<ScriptWorkspaceGenerateResult>;
  startScriptWorkspaceStream(input: ScriptWorkspaceGenerateInput): Promise<ScriptWorkspaceStreamStartResult>;
  cancelScriptWorkspaceStream(input: ScriptWorkspaceStreamCancelInput): Promise<{ canceled: boolean }>;
  onScriptWorkspaceStreamEvent(callback: (event: ScriptWorkspaceStreamEvent) => void): () => void;
  saveScriptWorkspaceSelection(input: ScriptWorkspaceSaveInput): Promise<ScriptWorkspaceSaveResult>;
  listSkills(): Promise<SkillRecord[]>;
  saveSkill(input: SkillSaveInput): Promise<SkillRecord>;
  readSkillContent(skillId: string, relativePath?: string): Promise<SkillContent>;
  listSkillFiles(skillId: string): Promise<SkillFile[]>;
  saveSkillFile(input: SkillFileSaveInput): Promise<SkillContent>;
  listSkillSnapshots(skillId: string): Promise<SkillSnapshot[]>;
  restoreSkillSnapshot(input: SkillSnapshotRestoreInput): Promise<SkillContent>;
  createOfficialSkillCopy(input: SkillCreateOfficialCopyInput): Promise<SkillRecord>;
  restoreOfficialSkillCopy(input: SkillOfficialCopyInput): Promise<SkillContent>;
  upgradeOfficialSkillCopy(input: SkillOfficialCopyInput): Promise<SkillContent>;
  testSkill(input: SkillTestInput): Promise<SkillTestResult>;
  listEnabledSkills(type?: SkillWorkflowType): Promise<SkillRecord[]>;
  getSkillActivation(): Promise<SkillActivationConfig>;
  updateSkillActivation(input: SkillActivationUpdateInput): Promise<SkillActivationConfig>;
  listSkillMarket(input?: SkillMarketListInput): Promise<SkillMarketState>;
  installSkillFromMarket(input: SkillMarketInstallInput): Promise<SkillMarketInstallResult>;
  listPlatformAccounts(): Promise<PlatformAccountRecord[]>;
  savePlatformAccount(input: PlatformAccountSaveInput): Promise<PlatformAccountRecord>;
  getTaskSheetByDate(sheetDate: string): Promise<TaskSheetRecord | null>;
  generateTaskSheet(input: TaskGenerateInput): Promise<TaskSheetRecord>;
  exportTaskSheet(input: TaskExportInput): Promise<TaskExportResult>;
  scanTaskStatusFiles(input: TaskStatusScanInput): Promise<TaskStatusScanResult>;
  retryTaskRow(input: TaskRetryInput): Promise<TaskRowRecord>;
  markTaskRowStatus(input: TaskManualStatusInput): Promise<TaskRowRecord>;
  updateTaskRow(input: TaskRowUpdateInput): Promise<TaskRowRecord>;
  deleteTaskRow(input: TaskRowDeleteInput): Promise<TaskSheetRecord>;
  addTaskRow(input: TaskRowAddInput): Promise<TaskRowRecord>;
  batchReplaceTaskTitles(input: TaskBatchReplaceTitlesInput): Promise<TaskSheetRecord>;
  saveApiKey(input: ApiKeySaveInput): Promise<ApiKeyPublicRecord>;
  listApiKeys(): Promise<ApiKeyPublicRecord[]>;
  auditApiKeyStorage(): Promise<ApiKeyStorageAudit>;
  testApiKey(input: ApiKeyConnectionTestInput): Promise<ApiKeyConnectionTestResult>;
  getSettings(): Promise<AppSettings>;
  saveSettings(input: AppSettingsSaveInput): Promise<AppSettings>;
  backupWorkspace(input: WorkspaceBackupInput): Promise<WorkspaceBackupResult>;
  restoreWorkspace(input: WorkspaceRestoreInput): Promise<WorkspaceRestoreResult>;
  createFeedbackPackage(input: FeedbackPackageInput): Promise<FeedbackPackageResult>;
  cleanCaches(input: CacheCleanupInput): Promise<CacheCleanupResult>;
  getUpdateState(): Promise<SoftwareUpdateCheckResult>;
  checkForUpdates(input?: SoftwareUpdateCheckInput): Promise<SoftwareUpdateCheckResult>;
  downloadUpdate(): Promise<SoftwareUpdateCheckResult>;
  installUpdate(): Promise<SoftwareUpdateInstallResult>;
  onSoftwareUpdateEvent(callback: (event: SoftwareUpdateCheckResult) => void): () => void;
  listScheduledJobs(): Promise<ScheduledJobRecord[]>;
  saveScheduledJob(input: ScheduledJobSaveInput): Promise<ScheduledJobRecord>;
  toggleScheduledJob(input: ScheduledJobToggleInput): Promise<ScheduledJobRecord>;
  runDueScheduledJobs(): Promise<ScheduledJobRunRecord[]>;
  listScheduledJobRuns(input: ScheduledJobRunsListInput): Promise<ScheduledJobRunRecord[]>;
}
