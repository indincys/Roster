import { contextBridge, ipcRenderer } from "electron";
import {
  IPC_CHANNELS,
  type ApiKeyConnectionTestInput,
  type CacheCleanupInput,
  type ApiKeySaveInput,
  type CoverApplyInput,
  type CoverBatchApplyFirstFrameInput,
  type CoverTimelineInput,
  type FeedbackPackageInput,
  type ImageSaveInput,
  type ImageSoftDeleteInput,
  type ImagePromptWorkspaceGenerateInput,
  type ImageScenePresetSaveInput,
  type ImageWorkspaceAdHocGenerateInput,
  type ImageWorkspaceGenerateInput,
  type PlatformAccountSaveInput,
  type PromptSaveInput,
  type ScheduledJobRunsListInput,
  type RosterApi,
  type ScheduledJobSaveInput,
  type ScheduledJobToggleInput,
  type ScriptExportInput,
  type ScriptSaveInput,
  type ScriptWorkspaceGenerateInput,
  type ScriptWorkspaceStreamCancelInput,
  type ScriptWorkspaceSaveInput,
  type AppSettingsSaveInput,
  type SoftwareUpdateCheckInput,
  type SkillActivationUpdateInput,
  type SkillCreateOfficialCopyInput,
  type SkillFileSaveInput,
  type SkillMarketInstallInput,
  type SkillMarketListInput,
  type SkillOfficialCopyInput,
  type SkillSaveInput,
  type SkillSnapshotRestoreInput,
  type SkillTestInput,
  type SkillWorkflowType,
  type TagSaveInput,
  type TaskBatchReplaceTitlesInput,
  type TaskExportInput,
  type TaskGenerateInput,
  type TaskManualStatusInput,
  type TaskRowAddInput,
  type TaskRowDeleteInput,
  type TaskRetryInput,
  type TaskRowUpdateInput,
  type TaskStatusScanInput,
  type TitleWorkspaceGenerateInput,
  type TitleWorkspaceStreamCancelInput,
  type TitleWorkspaceSaveInput,
  type TitleSaveInput,
  type VideoBatchUpdateInput,
  type VideoUpdateInput,
  type WorkspaceBackupInput,
  type WorkspaceCreateInput,
  type WorkspaceDeleteInput,
  type WorkspacePathValidationInput,
  type WorkspaceUpdateInput,
  type WorkspaceRestoreInput
} from "@roster/shared-types";

const api: RosterApi = {
  getBootstrap: () => ipcRenderer.invoke(IPC_CHANNELS.APP_GET_BOOTSTRAP),
  createWorkspace: (input: WorkspaceCreateInput) => ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_CREATE, input),
  updateWorkspace: (input: WorkspaceUpdateInput) => ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_UPDATE, input),
  deleteWorkspace: (input: WorkspaceDeleteInput) => ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_DELETE, input),
  switchWorkspace: (workspaceId: string) => ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_SWITCH, { workspaceId }),
  chooseWorkspaceDirectory: () => ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_CHOOSE_DIRECTORY),
  validateWorkspacePaths: (input: WorkspacePathValidationInput) =>
    ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_VALIDATE_PATHS, input),
  checkWorkspaceCloudSync: () => ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_CHECK_CLOUD_SYNC),
  listVideos: () => ipcRenderer.invoke(IPC_CHANNELS.VIDEOS_LIST),
  scanVideos: () => ipcRenderer.invoke(IPC_CHANNELS.VIDEOS_SCAN),
  updateVideo: (input: VideoUpdateInput) => ipcRenderer.invoke(IPC_CHANNELS.VIDEOS_UPDATE, input),
  batchUpdateVideos: (input: VideoBatchUpdateInput) => ipcRenderer.invoke(IPC_CHANNELS.VIDEOS_BATCH_UPDATE, input),
  getCoverTimeline: (input: CoverTimelineInput) => ipcRenderer.invoke(IPC_CHANNELS.COVERS_GET_TIMELINE, input),
  applyCover: (input: CoverApplyInput) => ipcRenderer.invoke(IPC_CHANNELS.COVERS_APPLY, input),
  batchApplyFirstFrameCovers: (input: CoverBatchApplyFirstFrameInput) =>
    ipcRenderer.invoke(IPC_CHANNELS.COVERS_BATCH_APPLY_FIRST_FRAME, input),
  listTags: () => ipcRenderer.invoke(IPC_CHANNELS.TAGS_LIST),
  importTagsCsv: () => ipcRenderer.invoke(IPC_CHANNELS.TAGS_IMPORT_CSV),
  saveTag: (input: TagSaveInput) => ipcRenderer.invoke(IPC_CHANNELS.TAGS_SAVE, input),
  listTitles: () => ipcRenderer.invoke(IPC_CHANNELS.TITLES_LIST),
  saveTitle: (input: TitleSaveInput) => ipcRenderer.invoke(IPC_CHANNELS.TITLES_SAVE, input),
  generateTitleWorkspace: (input: TitleWorkspaceGenerateInput) =>
    ipcRenderer.invoke(IPC_CHANNELS.TITLE_WORKSPACE_GENERATE, input),
  startTitleWorkspaceStream: (input: TitleWorkspaceGenerateInput) =>
    ipcRenderer.invoke(IPC_CHANNELS.TITLE_WORKSPACE_STREAM_START, input),
  cancelTitleWorkspaceStream: (input: TitleWorkspaceStreamCancelInput) =>
    ipcRenderer.invoke(IPC_CHANNELS.TITLE_WORKSPACE_STREAM_CANCEL, input),
  onTitleWorkspaceStreamEvent: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: unknown): void => {
      callback(payload as Parameters<typeof callback>[0]);
    };
    ipcRenderer.on(IPC_CHANNELS.TITLE_WORKSPACE_STREAM_EVENT, listener);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.TITLE_WORKSPACE_STREAM_EVENT, listener);
  },
  saveTitleWorkspaceSelection: (input: TitleWorkspaceSaveInput) =>
    ipcRenderer.invoke(IPC_CHANNELS.TITLE_WORKSPACE_SAVE_SELECTED, input),
  listPrompts: () => ipcRenderer.invoke(IPC_CHANNELS.PROMPTS_LIST),
  savePrompt: (input: PromptSaveInput) => ipcRenderer.invoke(IPC_CHANNELS.PROMPTS_SAVE, input),
  listImages: () => ipcRenderer.invoke(IPC_CHANNELS.IMAGES_LIST),
  saveImage: (input: ImageSaveInput) => ipcRenderer.invoke(IPC_CHANNELS.IMAGES_SAVE, input),
  softDeleteImage: (input: ImageSoftDeleteInput) => ipcRenderer.invoke(IPC_CHANNELS.IMAGES_SOFT_DELETE, input),
  generateImagePrompts: (input: ImagePromptWorkspaceGenerateInput) =>
    ipcRenderer.invoke(IPC_CHANNELS.IMAGE_PROMPT_WORKSPACE_GENERATE, input),
  listImageScenePresets: () => ipcRenderer.invoke(IPC_CHANNELS.IMAGE_SCENE_PRESETS_LIST),
  saveImageScenePreset: (input: ImageScenePresetSaveInput) =>
    ipcRenderer.invoke(IPC_CHANNELS.IMAGE_SCENE_PRESETS_SAVE, input),
  generateImages: (input: ImageWorkspaceGenerateInput) => ipcRenderer.invoke(IPC_CHANNELS.IMAGE_WORKSPACE_GENERATE, input),
  generateImagesAdHoc: (input: ImageWorkspaceAdHocGenerateInput) =>
    ipcRenderer.invoke(IPC_CHANNELS.IMAGE_WORKSPACE_GENERATE_ADHOC, input),
  listScripts: () => ipcRenderer.invoke(IPC_CHANNELS.SCRIPTS_LIST),
  saveScript: (input: ScriptSaveInput) => ipcRenderer.invoke(IPC_CHANNELS.SCRIPTS_SAVE, input),
  exportScripts: (input: ScriptExportInput) => ipcRenderer.invoke(IPC_CHANNELS.SCRIPTS_EXPORT, input),
  generateScriptWorkspace: (input: ScriptWorkspaceGenerateInput) =>
    ipcRenderer.invoke(IPC_CHANNELS.SCRIPT_WORKSPACE_GENERATE, input),
  startScriptWorkspaceStream: (input: ScriptWorkspaceGenerateInput) =>
    ipcRenderer.invoke(IPC_CHANNELS.SCRIPT_WORKSPACE_STREAM_START, input),
  cancelScriptWorkspaceStream: (input: ScriptWorkspaceStreamCancelInput) =>
    ipcRenderer.invoke(IPC_CHANNELS.SCRIPT_WORKSPACE_STREAM_CANCEL, input),
  onScriptWorkspaceStreamEvent: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: unknown): void => {
      callback(payload as Parameters<typeof callback>[0]);
    };
    ipcRenderer.on(IPC_CHANNELS.SCRIPT_WORKSPACE_STREAM_EVENT, listener);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.SCRIPT_WORKSPACE_STREAM_EVENT, listener);
  },
  saveScriptWorkspaceSelection: (input: ScriptWorkspaceSaveInput) =>
    ipcRenderer.invoke(IPC_CHANNELS.SCRIPT_WORKSPACE_SAVE_SELECTED, input),
  listScheduledJobs: () => ipcRenderer.invoke(IPC_CHANNELS.SCHEDULED_JOBS_LIST),
  saveScheduledJob: (input: ScheduledJobSaveInput) => ipcRenderer.invoke(IPC_CHANNELS.SCHEDULED_JOBS_SAVE, input),
  toggleScheduledJob: (input: ScheduledJobToggleInput) => ipcRenderer.invoke(IPC_CHANNELS.SCHEDULED_JOBS_TOGGLE, input),
  runDueScheduledJobs: () => ipcRenderer.invoke(IPC_CHANNELS.SCHEDULED_JOBS_RUN_DUE),
  listScheduledJobRuns: (input: ScheduledJobRunsListInput) => ipcRenderer.invoke(IPC_CHANNELS.SCHEDULED_JOB_RUNS_LIST, input),
  listSkills: () => ipcRenderer.invoke(IPC_CHANNELS.SKILLS_LIST),
  saveSkill: (input: SkillSaveInput) => ipcRenderer.invoke(IPC_CHANNELS.SKILLS_SAVE, input),
  readSkillContent: (skillId: string, relativePath?: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SKILLS_READ_CONTENT, { skillId, relativePath }),
  listSkillFiles: (skillId: string) => ipcRenderer.invoke(IPC_CHANNELS.SKILLS_LIST_FILES, { skillId }),
  saveSkillFile: (input: SkillFileSaveInput) => ipcRenderer.invoke(IPC_CHANNELS.SKILLS_SAVE_FILE, input),
  listSkillSnapshots: (skillId: string) => ipcRenderer.invoke(IPC_CHANNELS.SKILLS_LIST_SNAPSHOTS, { skillId }),
  restoreSkillSnapshot: (input: SkillSnapshotRestoreInput) =>
    ipcRenderer.invoke(IPC_CHANNELS.SKILLS_RESTORE_SNAPSHOT, input),
  createOfficialSkillCopy: (input: SkillCreateOfficialCopyInput) =>
    ipcRenderer.invoke(IPC_CHANNELS.SKILLS_CREATE_OFFICIAL_COPY, input),
  restoreOfficialSkillCopy: (input: SkillOfficialCopyInput) =>
    ipcRenderer.invoke(IPC_CHANNELS.SKILLS_RESTORE_OFFICIAL_COPY, input),
  upgradeOfficialSkillCopy: (input: SkillOfficialCopyInput) =>
    ipcRenderer.invoke(IPC_CHANNELS.SKILLS_UPGRADE_OFFICIAL_COPY, input),
  testSkill: (input: SkillTestInput) => ipcRenderer.invoke(IPC_CHANNELS.SKILLS_TEST, input),
  listEnabledSkills: (type?: SkillWorkflowType) => ipcRenderer.invoke(IPC_CHANNELS.SKILLS_LIST_ENABLED, { type }),
  getSkillActivation: () => ipcRenderer.invoke(IPC_CHANNELS.SKILLS_GET_ACTIVATION),
  updateSkillActivation: (input: SkillActivationUpdateInput) =>
    ipcRenderer.invoke(IPC_CHANNELS.SKILLS_UPDATE_ACTIVATION, input),
  listSkillMarket: (input?: SkillMarketListInput) => ipcRenderer.invoke(IPC_CHANNELS.SKILL_MARKET_LIST, input ?? {}),
  installSkillFromMarket: (input: SkillMarketInstallInput) => ipcRenderer.invoke(IPC_CHANNELS.SKILL_MARKET_INSTALL, input),
  listPlatformAccounts: () => ipcRenderer.invoke(IPC_CHANNELS.PLATFORM_ACCOUNTS_LIST),
  savePlatformAccount: (input: PlatformAccountSaveInput) => ipcRenderer.invoke(IPC_CHANNELS.PLATFORM_ACCOUNTS_SAVE, input),
  getTaskSheetByDate: (sheetDate: string) => ipcRenderer.invoke(IPC_CHANNELS.TASK_SHEET_GET_BY_DATE, { sheetDate }),
  generateTaskSheet: (input: TaskGenerateInput) => ipcRenderer.invoke(IPC_CHANNELS.TASK_SHEET_GENERATE, input),
  exportTaskSheet: (input: TaskExportInput) => ipcRenderer.invoke(IPC_CHANNELS.TASK_SHEET_EXPORT, input),
  scanTaskStatusFiles: (input: TaskStatusScanInput) => ipcRenderer.invoke(IPC_CHANNELS.TASK_STATUS_SCAN, input),
  retryTaskRow: (input: TaskRetryInput) => ipcRenderer.invoke(IPC_CHANNELS.TASK_ROW_RETRY, input),
  markTaskRowStatus: (input: TaskManualStatusInput) => ipcRenderer.invoke(IPC_CHANNELS.TASK_ROW_MARK_STATUS, input),
  updateTaskRow: (input: TaskRowUpdateInput) => ipcRenderer.invoke(IPC_CHANNELS.TASK_ROW_UPDATE, input),
  deleteTaskRow: (input: TaskRowDeleteInput) => ipcRenderer.invoke(IPC_CHANNELS.TASK_ROW_DELETE, input),
  addTaskRow: (input: TaskRowAddInput) => ipcRenderer.invoke(IPC_CHANNELS.TASK_ROW_ADD, input),
  batchReplaceTaskTitles: (input: TaskBatchReplaceTitlesInput) => ipcRenderer.invoke(IPC_CHANNELS.TASK_ROWS_REPLACE_TITLES, input),
  saveApiKey: (input: ApiKeySaveInput) => ipcRenderer.invoke(IPC_CHANNELS.SECRETS_SAVE_API_KEY, input),
  listApiKeys: () => ipcRenderer.invoke(IPC_CHANNELS.SECRETS_LIST_API_KEYS),
  auditApiKeyStorage: () => ipcRenderer.invoke(IPC_CHANNELS.SECRETS_AUDIT_STORAGE),
  testApiKey: (input: ApiKeyConnectionTestInput) => ipcRenderer.invoke(IPC_CHANNELS.SECRETS_TEST_API_KEY, input),
  getSettings: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET),
  saveSettings: (input: AppSettingsSaveInput) => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SAVE, input),
  backupWorkspace: (input: WorkspaceBackupInput) => ipcRenderer.invoke(IPC_CHANNELS.MAINTENANCE_BACKUP_WORKSPACE, input),
  restoreWorkspace: (input: WorkspaceRestoreInput) => ipcRenderer.invoke(IPC_CHANNELS.MAINTENANCE_RESTORE_WORKSPACE, input),
  createFeedbackPackage: (input: FeedbackPackageInput) =>
    ipcRenderer.invoke(IPC_CHANNELS.MAINTENANCE_CREATE_FEEDBACK_PACKAGE, input),
  cleanCaches: (input: CacheCleanupInput) => ipcRenderer.invoke(IPC_CHANNELS.MAINTENANCE_CLEAN_CACHES, input),
  getUpdateState: () => ipcRenderer.invoke(IPC_CHANNELS.MAINTENANCE_GET_UPDATE_STATE),
  checkForUpdates: (input?: SoftwareUpdateCheckInput) => ipcRenderer.invoke(IPC_CHANNELS.MAINTENANCE_CHECK_FOR_UPDATES, input ?? {}),
  downloadUpdate: () => ipcRenderer.invoke(IPC_CHANNELS.MAINTENANCE_DOWNLOAD_UPDATE),
  installUpdate: () => ipcRenderer.invoke(IPC_CHANNELS.MAINTENANCE_INSTALL_UPDATE),
  onSoftwareUpdateEvent: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: unknown): void => {
      callback(payload as Parameters<typeof callback>[0]);
    };
    ipcRenderer.on(IPC_CHANNELS.MAINTENANCE_UPDATE_EVENT, listener);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.MAINTENANCE_UPDATE_EVENT, listener);
  }
};

contextBridge.exposeInMainWorld("roster", api);
