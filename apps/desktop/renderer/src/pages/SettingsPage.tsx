import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import type {
  ApiKeyConnectionTestResult,
  ApiKeyKind,
  ApiKeyPublicRecord,
  AppSettings,
  ImageProviderAdapter,
  ImageProviderConfig,
  LlmProviderAdapter,
  LlmProviderConfig,
  PlatformAccountRecord,
  SoftwareUpdateCheckResult,
  WorkspaceCloudSyncCheckResult
} from "@roster/shared-types";
import { DEFAULT_IMAGE_PROVIDER_CONFIGS, DEFAULT_LLM_PROVIDER_CONFIGS, ProviderIdSchema } from "@roster/shared-types";
import {
  Archive,
  Cloud,
  FolderOpen,
  KeyRound,
  MessageSquareWarning,
  Pencil,
  Plus,
  RotateCcw,
  ShieldCheck,
  Trash2
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatusStrip, WorkbenchHeader } from "@/components/workbench";
import { activeWorkspace, useAppStore } from "@/stores/app-store";

interface SimpleProviderPreset {
  id: string;
  label: string;
  vendor: string;
  adapter: LlmProviderAdapter | ImageProviderAdapter;
  baseUrl: string | null;
  defaultModel: string;
}

const SIMPLE_PROVIDER_PRESETS: SimpleProviderPreset[] = [
  {
    id: "openai",
    label: "OpenAI",
    vendor: "OpenAI",
    adapter: "openai",
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-5.4-mini"
  },
  {
    id: "anthropic",
    label: "Anthropic",
    vendor: "Anthropic",
    adapter: "anthropic",
    baseUrl: "https://api.anthropic.com/v1",
    defaultModel: "claude-sonnet-4-5"
  },
  {
    id: "google",
    label: "Google Gemini",
    vendor: "Google Gemini",
    adapter: "google",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    defaultModel: "gemini-2.5-flash"
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    vendor: "DeepSeek",
    adapter: "openai-compatible",
    baseUrl: "https://api.deepseek.com/v1",
    defaultModel: "deepseek-chat"
  },
  {
    id: "kimi",
    label: "Kimi",
    vendor: "Kimi",
    adapter: "openai-compatible",
    baseUrl: "https://api.moonshot.cn/v1",
    defaultModel: "moonshot-v1-8k"
  },
  {
    id: "doubao",
    label: "Doubao",
    vendor: "Doubao",
    adapter: "openai-compatible",
    baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    defaultModel: "doubao-seed-1-6"
  },
  {
    id: "qwen",
    label: "Qwen",
    vendor: "Qwen",
    adapter: "openai-compatible",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    defaultModel: "qwen-plus"
  },
  {
    id: "glm",
    label: "GLM",
    vendor: "GLM",
    adapter: "openai-compatible",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    defaultModel: "glm-4-plus"
  },
  {
    id: "mock",
    label: "Mock 本地测试",
    vendor: "Mock 本地测试",
    adapter: "mock",
    baseUrl: null,
    defaultModel: "mock-title-fast"
  }
];

const IMAGE_PROVIDER_PRESETS: SimpleProviderPreset[] = [
  {
    id: "openai",
    label: "OpenAI Image",
    vendor: "OpenAI",
    adapter: "openai-image",
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-image-1.5"
  },
  {
    id: "yunwu",
    label: "云雾 Image",
    vendor: "云雾",
    adapter: "openai-image",
    baseUrl: "https://yunwu.ai/v1",
    defaultModel: "gpt-image-1.5"
  },
  {
    id: "mock",
    label: "Mock 图片本地测试",
    vendor: "Mock 图片本地测试",
    adapter: "mock",
    baseUrl: null,
    defaultModel: "mock-image"
  }
];

function presetsForKind(kind: ApiKeyKind): SimpleProviderPreset[] {
  return kind === "image" ? IMAGE_PROVIDER_PRESETS : SIMPLE_PROVIDER_PRESETS;
}

function presetForVendor(vendor: string, kind: ApiKeyKind = "text"): SimpleProviderPreset | null {
  const presets = presetsForKind(kind);
  const normalized = vendor.trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  if (normalized.includes("deepseek")) {
    return presets.find((preset) => preset.id === "deepseek") ?? null;
  }
  if (normalized.includes("kimi") || normalized.includes("moonshot")) {
    return presets.find((preset) => preset.id === "kimi") ?? null;
  }
  if (normalized.includes("doubao") || normalized.includes("豆包") || normalized.includes("volcano") || normalized.includes("火山")) {
    return presets.find((preset) => preset.id === "doubao") ?? null;
  }
  if (normalized.includes("qwen") || normalized.includes("通义") || normalized.includes("千问") || normalized.includes("dashscope")) {
    return presets.find((preset) => preset.id === "qwen") ?? null;
  }
  if (normalized.includes("glm") || normalized.includes("智谱")) {
    return presets.find((preset) => preset.id === "glm") ?? null;
  }
  if (normalized.includes("gemini") || normalized.includes("google")) {
    return presets.find((preset) => preset.id === "google") ?? null;
  }
  if (normalized.includes("anthropic") || normalized.includes("claude")) {
    return presets.find((preset) => preset.id === "anthropic") ?? null;
  }
  if (normalized.includes("openai")) {
    return presets.find((preset) => preset.id === "openai") ?? null;
  }
  if (normalized === "yunwu" || normalized === "云雾" || normalized === "yunwu image" || normalized === "云雾 image") {
    return presets.find((preset) => preset.id === "yunwu") ?? null;
  }
  if (normalized.includes("mock")) {
    return presets.find((preset) => preset.id === "mock") ?? null;
  }
  return presets.find((preset) => preset.vendor.toLowerCase() === normalized || preset.label.toLowerCase() === normalized) ?? null;
}

function hashVendor(vendor: string): string {
  let hash = 0;
  for (const char of vendor) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return hash.toString(36);
}

function providerIdForVendor(vendor: string, kind: ApiKeyKind): string {
  const preset = presetForVendor(vendor, kind);
  if (preset) {
    return preset.id;
  }
  const asciiSlug = vendor
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return asciiSlug || `custom-${hashVendor(vendor)}`;
}

function textAdapterForVendor(vendor: string): LlmProviderAdapter {
  const adapter = presetForVendor(vendor, "text")?.adapter;
  return adapter === "mock" || adapter === "openai" || adapter === "anthropic" || adapter === "google" || adapter === "openai-compatible"
    ? adapter
    : "openai-compatible";
}

function imageAdapterForVendor(vendor: string): ImageProviderAdapter {
  const adapter = presetForVendor(vendor, "image")?.adapter;
  return adapter === "mock" || adapter === "openai-image" ? adapter : "openai-image";
}

export function SettingsPage(): JSX.Element {
  const {
    bootstrap,
    updateState,
    createWorkspace,
    updateWorkspace,
    deleteWorkspace,
    saveApiKey,
    checkForUpdates: checkForUpdatesFromStore,
    loading,
    error
  } = useAppStore();
  const workspace = activeWorkspace(bootstrap);
  const apiKeys = bootstrap?.apiKeys ?? [];
  const workspaceId = workspace?.id;
  const [workspaceName, setWorkspaceName] = useState("");
  const [rootPath, setRootPath] = useState("");
  const [macRootPath, setMacRootPath] = useState("");
  const [winRootPath, setWinRootPath] = useState("");
  const [videoLibraryRootPath, setVideoLibraryRootPath] = useState("");
  const [videoLibraryMacRootPath, setVideoLibraryMacRootPath] = useState("");
  const [videoLibraryWinRootPath, setVideoLibraryWinRootPath] = useState("");
  const [apiKeyKind, setApiKeyKind] = useState<ApiKeyKind>("text");
  const [editingApiKeyId, setEditingApiKeyId] = useState<string | null>(null);
  const [modelVendor, setModelVendor] = useState("OpenAI");
  const [modelId, setModelId] = useState("gpt-5.4-mini");
  const [baseUrl, setBaseUrl] = useState("https://api.openai.com/v1");
  const [apiKey, setApiKey] = useState("");
  const [apiKeyLabel, setApiKeyLabel] = useState("");
  const [apiKeyDefault, setApiKeyDefault] = useState(true);
  const [apiConnectionTestResult, setApiConnectionTestResult] = useState<ApiKeyConnectionTestResult | null>(null);
  const [apiFormHydrated, setApiFormHydrated] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [backupPath, setBackupPath] = useState<string | null>(null);
  const [restorePath, setRestorePath] = useState("");
  const [feedbackDescription, setFeedbackDescription] = useState("");
  const [feedbackPackagePath, setFeedbackPackagePath] = useState<string | null>(null);
  const [cacheCleanupSummary, setCacheCleanupSummary] = useState<string | null>(null);
  const [updateCheck, setUpdateCheck] = useState<SoftwareUpdateCheckResult | null>(updateState);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [platformAccounts, setPlatformAccounts] = useState<PlatformAccountRecord[]>([]);
  const [platformAccountId, setPlatformAccountId] = useState<string | null>(null);
  const [platform, setPlatform] = useState("抖音");
  const [platformAccountName, setPlatformAccountName] = useState("");
  const [platformAccountEnabled, setPlatformAccountEnabled] = useState(true);
  const [cloudSyncCheck, setCloudSyncCheck] = useState<WorkspaceCloudSyncCheckResult | null>(null);

  const canCreateWorkspace = useMemo(
    () => workspaceName.trim() && rootPath.trim() && macRootPath.trim(),
    [macRootPath, rootPath, workspaceName]
  );

  const chooseDirectory = async (): Promise<void> => {
    const selected = await window.roster.chooseWorkspaceDirectory();
    if (!selected.canceled && selected.path) {
      setRootPath(selected.path);
      setMacRootPath(selected.path);
    }
  };

  const chooseVideoLibraryDirectory = async (): Promise<void> => {
    const selected = await window.roster.chooseWorkspaceDirectory();
    if (!selected.canceled && selected.path) {
      setVideoLibraryRootPath(selected.path);
      setVideoLibraryMacRootPath(selected.path);
    }
  };

  useEffect(() => {
    window.roster
      .getSettings()
      .then(setSettings)
      .catch((loadError: unknown) => setSavedMessage(loadError instanceof Error ? loadError.message : String(loadError)));
  }, []);

  useEffect(() => {
    if (!workspaceId) {
      setPlatformAccounts([]);
      setCloudSyncCheck(null);
      return;
    }
    window.roster
      .listPlatformAccounts()
      .then(setPlatformAccounts)
      .catch((loadError: unknown) => setSavedMessage(loadError instanceof Error ? loadError.message : String(loadError)));
  }, [workspaceId]);

  useEffect(() => {
    setUpdateCheck(updateState);
  }, [updateState]);

  useEffect(() => {
    if (!workspace) {
      return;
    }
    setWorkspaceName(workspace.name);
    setRootPath(workspace.rootPath);
    setMacRootPath(workspace.macRootPath);
    setWinRootPath(workspace.winRootPath);
    setVideoLibraryRootPath(workspace.videoLibraryRootPath ?? "");
    setVideoLibraryMacRootPath(workspace.videoLibraryMacRootPath ?? "");
    setVideoLibraryWinRootPath(workspace.videoLibraryWinRootPath ?? "");
  }, [workspace]);

  useEffect(() => {
    if (apiFormHydrated || !settings) {
      return;
    }
    const firstConfig = settings.llmProviderConfigs.find((config) => config.id !== "mock") ?? settings.llmProviderConfigs[0];
    if (!firstConfig) {
      return;
    }
    setModelVendor(firstConfig.vendor || firstConfig.label);
    setModelId(firstConfig.defaultModel);
    setBaseUrl(firstConfig.baseUrl ?? "");
    setApiFormHydrated(true);
  }, [apiFormHydrated, settings]);

  useEffect(() => {
    if (!apiFormHydrated || !settings) {
      return;
    }
    const firstConfig =
      apiKeyKind === "image"
        ? settings.imageProviderConfigs.find((config) => config.id !== "mock") ?? settings.imageProviderConfigs[0]
        : settings.llmProviderConfigs.find((config) => config.id !== "mock") ?? settings.llmProviderConfigs[0];
    if (!firstConfig) {
      return;
    }
    setModelVendor(firstConfig.vendor || firstConfig.label);
    setModelId(firstConfig.defaultModel);
    setBaseUrl(firstConfig.baseUrl ?? "");
    setApiConnectionTestResult(null);
  }, [apiFormHydrated, apiKeyKind, settings]);

  const saveSettings = async (input: Partial<AppSettings>): Promise<void> => {
    const saved = await window.roster.saveSettings(input);
    setSettings(saved);
    setSavedMessage("设置已保存并立即生效。");
  };

  const reloadSettings = async (): Promise<AppSettings> => {
    const saved = await window.roster.getSettings();
    setSettings(saved);
    return saved;
  };

  const providerConfigs = useMemo(() => settings?.llmProviderConfigs ?? [...DEFAULT_LLM_PROVIDER_CONFIGS], [settings?.llmProviderConfigs]);
  const imageProviderConfigs = useMemo(
    () => settings?.imageProviderConfigs ?? [...DEFAULT_IMAGE_PROVIDER_CONFIGS],
    [settings?.imageProviderConfigs]
  );
  const normalizeProviderConfig = (config: LlmProviderConfig): LlmProviderConfig => ({
    ...config,
    id: ProviderIdSchema.parse(config.id),
    baseUrl: config.baseUrl?.trim() ? config.baseUrl.trim().replace(/\/+$/, "") : null
  });

  const normalizeImageProviderConfig = (config: ImageProviderConfig): ImageProviderConfig => ({
    ...config,
    id: ProviderIdSchema.parse(config.id),
    baseUrl: config.baseUrl?.trim() ? config.baseUrl.trim().replace(/\/+$/, "") : null
  });

  const submitWorkspace = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    const validation = await window.roster.validateWorkspacePaths({
      rootPath,
      macRootPath,
      winRootPath,
      videoLibraryRootPath,
      videoLibraryMacRootPath,
      videoLibraryWinRootPath,
      requireRpaPath: false
    });
    if (!validation.ok) {
      setSavedMessage(validation.errors.join("；"));
      return;
    }
    const input = {
      name: workspaceName,
      rootPath: validation.normalized.rootPath,
      macRootPath: validation.normalized.macRootPath,
      winRootPath: validation.normalized.winRootPath,
      videoLibraryRootPath: validation.normalized.videoLibraryRootPath,
      videoLibraryMacRootPath: validation.normalized.videoLibraryMacRootPath,
      videoLibraryWinRootPath: validation.normalized.videoLibraryWinRootPath
    };
    if (workspace) {
      await updateWorkspace({ workspaceId: workspace.id, ...input });
      setSavedMessage("工作空间已更新。");
    } else {
      await createWorkspace(input);
      setSavedMessage("工作空间已创建并切换。");
    }
  };

  const resetWorkspaceForm = (): void => {
    setWorkspaceName("");
    setRootPath("");
    setMacRootPath("");
    setWinRootPath("");
    setVideoLibraryRootPath("");
    setVideoLibraryMacRootPath("");
    setVideoLibraryWinRootPath("");
    setCloudSyncCheck(null);
  };

  const removeCurrentWorkspace = async (): Promise<void> => {
    if (!workspace) {
      return;
    }
    await deleteWorkspace({ workspaceId: workspace.id });
    resetWorkspaceForm();
    setSavedMessage("工作空间记录已删除，本地目录和数据文件保留。");
  };

  const selectPreset = (vendor: string): void => {
    const preset = presetForVendor(vendor, apiKeyKind);
    if (!preset) {
      setModelVendor(vendor);
      setApiConnectionTestResult(null);
      return;
    }
    setModelVendor(preset.vendor);
    setModelId(preset.defaultModel);
    setBaseUrl(preset.baseUrl ?? "");
    setApiConnectionTestResult(null);
  };

  const resetApiKeyForm = (): void => {
    setEditingApiKeyId(null);
    setApiKey("");
    setApiKeyLabel("");
    setApiKeyDefault(true);
    setApiConnectionTestResult(null);
  };

  const editApiKey = (record: ApiKeyPublicRecord): void => {
    const config =
      record.kind === "image"
        ? imageProviderConfigs.find((candidate) => candidate.id === record.provider)
        : providerConfigs.find((candidate) => candidate.id === record.provider);
    setEditingApiKeyId(record.id);
    setApiKeyKind(record.kind);
    setModelVendor(config?.vendor || config?.label || record.provider);
    setModelId(record.model || config?.defaultModel || "");
    setBaseUrl(config?.baseUrl ?? "");
    setApiKeyLabel(record.label);
    setApiKeyDefault(record.isDefault);
    setApiKey("");
    setApiConnectionTestResult(null);
  };

  const buildProviderConfigFromSimpleForm = (): LlmProviderConfig => {
    const vendor = modelVendor.trim();
    const preset = presetForVendor(vendor, "text");
    const normalizedBaseUrl = baseUrl.trim().replace(/\/+$/, "");
    return {
      id: providerIdForVendor(vendor, "text"),
      label: preset?.label ?? vendor,
      vendor,
      adapter: textAdapterForVendor(vendor),
      baseUrl: normalizedBaseUrl ? normalizedBaseUrl : null,
      defaultModel: modelId.trim(),
      enabled: true,
      isBuiltin: preset ? DEFAULT_LLM_PROVIDER_CONFIGS.some((config) => config.id === preset.id) : false
    };
  };

  const buildImageProviderConfigFromSimpleForm = (): ImageProviderConfig => {
    const vendor = modelVendor.trim();
    const preset = presetForVendor(vendor, "image");
    const normalizedBaseUrl = baseUrl.trim().replace(/\/+$/, "");
    return {
      id: providerIdForVendor(vendor, "image"),
      label: preset?.label ?? vendor,
      vendor,
      adapter: imageAdapterForVendor(vendor),
      baseUrl: normalizedBaseUrl ? normalizedBaseUrl : null,
      defaultModel: modelId.trim(),
      enabled: true,
      isBuiltin: preset ? DEFAULT_IMAGE_PROVIDER_CONFIGS.some((config) => config.id === preset.id) : false
    };
  };

  const submitApiKey = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setApiConnectionTestResult(null);
    try {
      const provider =
        apiKeyKind === "image"
          ? normalizeImageProviderConfig(buildImageProviderConfigFromSimpleForm())
          : normalizeProviderConfig(buildProviderConfigFromSimpleForm());
      const model = provider.defaultModel;
      const label = apiKeyLabel.trim() || `${provider.label} / ${model}`;
      const savedKey = await saveApiKey({
        apiKeyId: editingApiKeyId ?? undefined,
        kind: apiKeyKind,
        provider: provider.id,
        label,
        model,
        isDefault: apiKeyDefault,
        apiKey: apiKey.trim() ? apiKey : undefined,
        providerConfig: provider
      });
      const result = await window.roster.testApiKey({ apiKeyId: savedKey.id });
      setApiConnectionTestResult(result);
      await reloadSettings();
      setEditingApiKeyId(null);
      setApiKey("");
      setApiKeyLabel("");
      setSavedMessage(`API 已保存，连接测试成功：读取到 ${result.modelCount} 个模型。`);
    } catch (saveError) {
      await reloadSettings();
      setSavedMessage(saveError instanceof Error ? saveError.message : String(saveError));
    }
  };

  const backupWorkspace = async (): Promise<void> => {
    const result = await window.roster.backupWorkspace({
      scope: settings?.backupScope ?? "all",
      retentionCount: settings?.backupRetentionCount ?? 7
    });
    setBackupPath(result.backupAbsolutePath);
    setRestorePath(result.backupAbsolutePath);
    setSavedMessage(`已生成备份 ${(result.sizeBytes / 1024).toFixed(1)} KB。`);
  };

  const restoreWorkspace = async (): Promise<void> => {
    if (!restorePath.trim()) {
      setSavedMessage("请先填写要恢复的备份 zip 路径。");
      return;
    }
    const result = await window.roster.restoreWorkspace({ backupAbsolutePath: restorePath.trim() });
    setSavedMessage(`已恢复 ${result.restoredFiles} 个文件；恢复前备份已保存。`);
    setBackupPath(result.preRestoreBackupAbsolutePath);
  };

  const createFeedbackPackage = async (): Promise<void> => {
    const result = await window.roster.createFeedbackPackage({
      description: feedbackDescription,
      includeLogs: true,
      includeSystemInfo: true
    });
    setFeedbackPackagePath(result.packageAbsolutePath);
    setSavedMessage(`已生成反馈包 ${(result.sizeBytes / 1024).toFixed(1)} KB。`);
  };

  const cleanCaches = async (): Promise<void> => {
    const result = await window.roster.cleanCaches({
      targets: ["video_thumbnails", "cover_timeline", "skill_market"]
    });
    const summary = `已清理 ${result.removedFiles} 个缓存文件，释放 ${(result.removedBytes / 1024).toFixed(1)} KB。`;
    setCacheCleanupSummary(summary);
    setSavedMessage(summary);
  };

  const checkForUpdates = async (): Promise<void> => {
    const result = await checkForUpdatesFromStore();
    setUpdateCheck(result);
    setSavedMessage(result.error ? "检查更新失败，请查看详情。" : result.updateAvailable ? "发现新版本。" : "当前已是最新版本。");
  };

  const checkCloudSync = async (): Promise<void> => {
    const result = await window.roster.checkWorkspaceCloudSync();
    setCloudSyncCheck(result);
    setSavedMessage(result.likelySynced ? "云同步状态自检通过。" : "云同步状态自检完成，请查看警告。");
  };

  const resetPlatformAccountForm = (): void => {
    setPlatformAccountId(null);
    setPlatform("抖音");
    setPlatformAccountName("");
    setPlatformAccountEnabled(true);
  };

  const editPlatformAccount = (account: PlatformAccountRecord): void => {
    setPlatformAccountId(account.id);
    setPlatform(account.platform);
    setPlatformAccountName(account.accountName);
    setPlatformAccountEnabled(account.enabled);
  };

  const savePlatformAccount = async (): Promise<void> => {
    const saved = await window.roster.savePlatformAccount({
      accountId: platformAccountId ?? undefined,
      platform,
      accountName: platformAccountName,
      enabled: platformAccountEnabled
    });
    setPlatformAccounts((current) => [...current.filter((account) => account.id !== saved.id), saved]);
    resetPlatformAccountForm();
    setSavedMessage("平台账号已保存。");
  };

  const togglePlatformAccount = async (account: PlatformAccountRecord): Promise<void> => {
    const saved = await window.roster.savePlatformAccount({
      accountId: account.id,
      platform: account.platform,
      accountName: account.accountName,
      enabled: !account.enabled
    });
    setPlatformAccounts((current) => current.map((item) => (item.id === saved.id ? saved : item)));
    setSavedMessage(saved.enabled ? "平台账号已启用。" : "平台账号已停用。");
  };

  return (
    <div className="flex min-h-full flex-col gap-4 p-5">
      <WorkbenchHeader
        eyebrow="系统配置"
        title="设置"
        description="按路径、账号、Provider、备份和更新分组管理基础能力。风险和检查结果会靠近对应配置。"
      />

      <StatusStrip
        items={[
          { label: "工作空间", value: workspace ? 1 : 0, hint: workspace?.name ?? "未创建", tone: workspace ? "success" : "warning" },
          { label: "API Key", value: apiKeys.length, hint: `文本 ${apiKeys.filter((record) => record.kind === "text").length} / 图片 ${apiKeys.filter((record) => record.kind === "image").length}`, tone: apiKeys.length > 0 ? "info" : "warning" },
          { label: "平台账号", value: platformAccounts.length, hint: `${platformAccounts.filter((account) => account.enabled).length} 个启用`, tone: platformAccounts.length > 0 ? "success" : "neutral" },
          { label: "更新状态", value: updateCheck ? 1 : 0, hint: updateCheck?.state ?? "未检查", tone: updateCheck?.state === "error" ? "danger" : "neutral" }
        ]}
      />

      {error ? <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
      {savedMessage ? <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{savedMessage}</div> : null}

      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>API 设置</CardTitle>
            <ShieldCheck className="size-4 text-emerald-600" />
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <form className="flex flex-col gap-3" onSubmit={(event) => void submitApiKey(event)} data-api-config-form>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium text-foreground">Key 类型</span>
                <select
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none"
                  value={apiKeyKind}
                  onChange={(event) => setApiKeyKind(event.target.value as ApiKeyKind)}
                  data-api-key-kind
                >
                  <option value="text">文本大模型</option>
                  <option value="image">图片生成大模型</option>
                </select>
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium text-foreground">大模型厂商</span>
                <input
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/15"
                  list="model-vendor-presets"
                  value={modelVendor}
                  onChange={(event) => selectPreset(event.target.value)}
                  placeholder={apiKeyKind === "image" ? "OpenAI Image、自定义图片 Provider" : "OpenAI、DeepSeek、Kimi、豆包、Qwen、GLM、自定义厂商"}
                  data-model-vendor
                />
                <datalist id="model-vendor-presets">
                  {presetsForKind(apiKeyKind).map((preset) => (
                    <option key={`${apiKeyKind}-${preset.id}`} value={preset.vendor} />
                  ))}
                </datalist>
              </label>
              <Input
                label="模型 ID"
                value={modelId}
                onChange={(event) => {
                  setModelId(event.target.value);
                  setApiConnectionTestResult(null);
                }}
                placeholder={apiKeyKind === "image" ? "gpt-image-1.5" : "gpt-5.4-mini"}
                data-model-id
              />
              <Input
                label="Key 名称"
                value={apiKeyLabel}
                onChange={(event) => setApiKeyLabel(event.target.value)}
                placeholder="例如：DeepSeek 主账号 / 备用额度"
                data-api-key-label
              />
              <Input
                label="baseURL"
                value={baseUrl}
                onChange={(event) => {
                  setBaseUrl(event.target.value);
                  setApiConnectionTestResult(null);
                }}
                placeholder="https://api.example.com/v1"
                data-provider-config-base-url
              />
              <Input
                label="API key"
                type="password"
                value={apiKey}
                onChange={(event) => {
                  setApiKey(event.target.value);
                  setApiConnectionTestResult(null);
                }}
                data-api-key-value
                placeholder={editingApiKeyId ? "留空则保留已保存 key" : ""}
                hint="保存前会先做连通性测试；测试通过后才使用本机密钥 AES-GCM 加密写入。"
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={apiKeyDefault}
                  onChange={(event) => setApiKeyDefault(event.target.checked)}
                  data-api-key-default
                />
                设为该 Provider 默认 Key
              </label>
              <Button
                variant="primary"
                type="submit"
                disabled={
                  !modelVendor.trim() ||
                  !modelId.trim() ||
                  (!editingApiKeyId && !apiKey.trim()) ||
                  ((apiKeyKind === "image" ? imageAdapterForVendor(modelVendor) !== "mock" : textAdapterForVendor(modelVendor) !== "mock") &&
                    !baseUrl.trim())
                }
                data-save-api-key
                data-test-api-key
              >
                <KeyRound />
                {editingApiKeyId ? "测试并保存修改" : "保存并测试 API"}
              </Button>
              {editingApiKeyId ? (
                <Button variant="outline" onClick={resetApiKeyForm}>
                  取消编辑
                </Button>
              ) : null}
              {apiConnectionTestResult ? (
                <div className="rounded-md border border-border bg-background p-2 text-xs" data-api-key-test-result={apiConnectionTestResult.apiKeyId}>
                  <div className={apiConnectionTestResult.ok ? "text-emerald-700" : "text-red-700"}>
                    {apiConnectionTestResult.ok
                      ? `连接成功，模型 ${apiConnectionTestResult.modelCount} 个`
                      : `连接失败：${apiConnectionTestResult.errorCode ?? "ProviderError"}`}
                  </div>
                  {apiConnectionTestResult.models.length ? (
                    <div className="mt-1 truncate font-mono text-muted-foreground">{apiConnectionTestResult.models.slice(0, 5).join(" / ")}</div>
                  ) : null}
                </div>
              ) : null}
              <div className="flex flex-col gap-2 rounded-md border border-border bg-background p-3" data-api-key-list>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-foreground">已保存 API key</span>
                  <Badge variant="neutral">
                    文本 {apiKeys.filter((record) => record.kind === "text").length} / 图片 {apiKeys.filter((record) => record.kind === "image").length}
                  </Badge>
                </div>
                {apiKeys.length === 0 ? (
                  <div className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">
                    暂无凭证；保存后模型才会出现在生成工作区。
                  </div>
                ) : (
                  <div className="flex max-h-48 flex-col gap-2 overflow-auto">
                    {apiKeys.map((record) => (
                      <div
                        key={record.id}
                        className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-md border border-border px-3 py-2 text-xs"
                        data-api-key-row={record.id}
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">{record.label}</div>
                          <div className="truncate font-mono text-muted-foreground">
                            {record.provider}{record.model ? ` / ${record.model}` : ""}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Badge variant={record.kind === "image" ? "info" : "neutral"}>{record.kind === "image" ? "图片" : "文本"}</Badge>
                          <Badge variant={record.isDefault ? "success" : "neutral"}>{record.isDefault ? "默认" : "备用"}</Badge>
                          <Button variant="ghost" size="icon" aria-label="编辑 API key" onClick={() => editApiKey(record)} data-edit-api-key={record.id}>
                            <Pencil />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>工作空间</CardTitle>
            <Badge variant={workspace ? "success" : "warning"}>{workspace ? "已打开" : "未创建"}</Badge>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {workspace ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Info label="当前空间" value={workspace.name} />
                <Info label="空间根目录" value={workspace.rootPath} />
                <Info label="当前设备路径" value={workspace.macRootPath} />
                <Info label="RPA 执行路径" value={workspace.winRootPath || "未配置"} />
                <Info
                  label="视频库根目录"
                  value={workspace.videoLibraryRootPath || `${workspace.rootPath}/videos（默认）`}
                />
                <Info label="视频库 Windows 路径" value={workspace.videoLibraryWinRootPath || "未配置"} />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">创建工作空间后，应用会初始化目录结构和独立数据库。</p>
            )}

            <form className="flex flex-col gap-3 border-t border-border pt-4" onSubmit={(event) => void submitWorkspace(event)}>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Input label="工作空间名称" value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} placeholder="暖心生活" />
                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="font-medium text-foreground">工作空间根目录</span>
                  <div className="flex gap-2">
                    <input
                      className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/15"
                      value={rootPath}
                      onChange={(event) => setRootPath(event.target.value)}
                      placeholder="/Users/name/OneDrive/品牌A"
                    />
                    <Button variant="outline" size="icon" aria-label="选择目录" onClick={() => void chooseDirectory()}>
                      <FolderOpen />
                    </Button>
                  </div>
                </label>
                <Input label="Mac 根路径" value={macRootPath} onChange={(event) => setMacRootPath(event.target.value)} />
                <Input
                  label="RPA 执行路径"
                  value={winRootPath}
                  onChange={(event) => setWinRootPath(event.target.value)}
                  placeholder="D:\\CloudSync\\品牌A"
                  hint="可留空；仅任务单导出和 RPA 执行会受影响。"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 border-t border-border pt-3 md:grid-cols-2" data-video-library-section>
                <label className="flex flex-col gap-1.5 text-sm md:col-span-2">
                  <span className="font-medium text-foreground">视频库根目录（可选）</span>
                  <div className="flex gap-2">
                    <input
                      className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/15"
                      value={videoLibraryRootPath}
                      onChange={(event) => setVideoLibraryRootPath(event.target.value)}
                      placeholder="/Users/name/OneDrive/视频库"
                      data-video-library-root-path
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label="选择视频库目录"
                      onClick={() => void chooseVideoLibraryDirectory()}
                      type="button"
                    >
                      <FolderOpen />
                    </Button>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    留空时使用工作空间下的 `videos/` 目录；填写后视频扫描会直接读取此目录里的 SKU 子文件夹。
                  </span>
                </label>
                <Input
                  label="视频库 Mac 路径"
                  value={videoLibraryMacRootPath}
                  onChange={(event) => setVideoLibraryMacRootPath(event.target.value)}
                  placeholder="/Users/name/OneDrive/视频库"
                  hint="Mac 端视频库绝对路径，留空时跟随当前设备路径。"
                  data-video-library-mac-root-path
                />
                <Input
                  label="视频库 Windows 路径"
                  value={videoLibraryWinRootPath}
                  onChange={(event) => setVideoLibraryWinRootPath(event.target.value)}
                  placeholder="D:\\OneDrive\\视频库"
                  hint="供任务单导出和 RPA 拼接 Windows 视频路径使用。"
                  data-video-library-win-root-path
                />
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                {workspace ? (
                  <>
                    <Button variant="outline" onClick={resetWorkspaceForm} type="button">
                      新建表单
                    </Button>
                    <Button variant="danger" onClick={() => void removeCurrentWorkspace()} type="button" disabled={loading}>
                      <Trash2 />
                      删除记录
                    </Button>
                  </>
                ) : null}
                <Button variant="primary" type="submit" disabled={!canCreateWorkspace || loading}>
                  {workspace ? <Pencil /> : <Plus />}
                  {workspace ? "保存工作空间" : "创建并切换"}
                </Button>
              </div>
            </form>

            <div className="border-t border-border pt-4" data-cloud-sync-section>
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium">云同步状态</div>
                  <p className="mt-1 text-xs text-muted-foreground">检查当前工作空间是否位于常见云盘同步目录，并确认本机可读写。</p>
                </div>
                <Button variant="outline" onClick={() => void checkCloudSync()} disabled={!workspace} data-check-cloud-sync>
                  <Cloud />
                  自检
                </Button>
              </div>
              {cloudSyncCheck ? (
                <div className="flex flex-col gap-2 rounded-md border border-border bg-background p-3 text-sm" data-cloud-sync-result>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{cloudSyncCheck.provider ? cloudProviderLabel(cloudSyncCheck.provider) : "未识别云盘"}</span>
                    <Badge variant={cloudSyncCheck.likelySynced ? "success" : "warning"}>
                      {cloudSyncCheck.likelySynced ? "可同步" : "需确认"}
                    </Badge>
                  </div>
                  <div className="font-mono text-xs text-muted-foreground">{cloudSyncCheck.rootPath}</div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <span>根目录：{cloudSyncCheck.rootExists ? "存在" : "不可访问"}</span>
                    <span>权限：{cloudSyncCheck.rootWritable ? "可读写" : "不可读写"}</span>
                  </div>
                  {cloudSyncCheck.warnings.length ? (
                    <ul className="flex flex-col gap-1 text-xs text-amber-700">
                      {cloudSyncCheck.warnings.map((warning) => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="border-t border-border pt-4" data-platform-accounts-section>
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium">平台账号</div>
                  <p className="mt-1 text-xs text-muted-foreground">维护当前工作空间内的发布账号，任务单生成只使用已启用账号。</p>
                </div>
                <Badge variant="neutral">{platformAccounts.length} 个</Badge>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="font-medium text-foreground">平台</span>
                  <select
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none"
                    value={platform}
                    onChange={(event) => setPlatform(event.target.value)}
                    data-platform-account-platform
                  >
                    <option value="抖音">抖音</option>
                    <option value="视频号">视频号</option>
                    <option value="小红书">小红书</option>
                    <option value="快手">快手</option>
                  </select>
                </label>
                <Input
                  label="账号名称"
                  value={platformAccountName}
                  onChange={(event) => setPlatformAccountName(event.target.value)}
                  data-platform-account-name
                />
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={platformAccountEnabled}
                    onChange={(event) => setPlatformAccountEnabled(event.target.checked)}
                    data-platform-account-enabled
                  />
                  启用账号
                </label>
                <div className="flex items-center gap-2">
                  {platformAccountId ? (
                    <Button variant="outline" onClick={resetPlatformAccountForm}>
                      取消编辑
                    </Button>
                  ) : null}
                  <Button
                    variant="primary"
                    onClick={() => void savePlatformAccount()}
                    disabled={!workspace || !platformAccountName.trim()}
                    data-save-platform-account
                  >
                    <Plus />
                    {platformAccountId ? "保存账号" : "新增账号"}
                  </Button>
                </div>
              </div>
              <div className="mt-3 flex max-h-48 flex-col gap-2 overflow-auto">
                {platformAccounts.length ? (
                  platformAccounts.map((account) => (
                    <div
                      key={account.id}
                      className="grid grid-cols-[1fr_auto_auto] items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm"
                      data-platform-account-row={account.id}
                    >
                      <div className="min-w-0">
                        <div className="truncate font-medium">
                          {account.platform} / {account.accountName}
                        </div>
                        <div className="font-mono text-xs text-muted-foreground">{account.id.slice(0, 8)}</div>
                      </div>
                      <Badge variant={account.enabled ? "success" : "warning"}>{account.enabled ? "启用" : "停用"}</Badge>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="编辑平台账号"
                          onClick={() => editPlatformAccount(account)}
                          data-edit-platform-account={account.id}
                        >
                          <Pencil />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void togglePlatformAccount(account)}
                          data-toggle-platform-account={account.id}
                        >
                          {account.enabled ? "停用" : "启用"}
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">暂无平台账号</div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>备份</CardTitle>
              <Archive className="size-4 text-primary" />
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p className="text-sm leading-6 text-muted-foreground">生成当前工作空间 zip 备份，默认保存到 `_backup/`。</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="font-medium text-foreground">备份范围</span>
                  <select
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none"
                    value={settings?.backupScope ?? "all"}
                    onChange={(event) => void saveSettings({ backupScope: event.target.value as AppSettings["backupScope"] })}
                    data-setting-backup-scope
                  >
                    <option value="database">仅数据库</option>
                    <option value="database_skills">数据库 + Skill 配置</option>
                    <option value="all">全部数据</option>
                  </select>
                </label>
                <Input
                  label="保留份数"
                  min={1}
                  max={100}
                  type="number"
                  value={settings?.backupRetentionCount ?? 7}
                  onChange={(event) => void saveSettings({ backupRetentionCount: Number.parseInt(event.target.value, 10) || 7 })}
                  data-setting-backup-retention
                />
              </div>
              <Button variant="primary" onClick={() => void backupWorkspace()} disabled={!workspace} data-backup-workspace>
                <Archive />
                立即备份全部数据
              </Button>
              {backupPath ? (
                <div className="rounded-md border border-border bg-background p-3 font-mono text-xs" data-backup-path>
                  {backupPath}
                </div>
              ) : null}
              <div className="border-t border-border pt-3">
                <Input
                  label="恢复备份 zip 路径"
                  value={restorePath}
                  onChange={(event) => setRestorePath(event.target.value)}
                  data-restore-backup-path
                />
                <Button
                  className="mt-3 w-full"
                  variant="outline"
                  onClick={() => void restoreWorkspace()}
                  disabled={!workspace || !restorePath.trim()}
                  data-restore-workspace
                >
                  <RotateCcw />
                  恢复此备份
                </Button>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  恢复会覆盖当前工作空间内容；执行前会自动生成一份 pre_restore 备份。
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>系统策略</CardTitle>
              <ShieldCheck className="size-4 text-primary" />
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="font-medium text-foreground">扫描频率</span>
                  <select
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none"
                    value={settings?.scanFrequency ?? "manual"}
                    onChange={(event) => void saveSettings({ scanFrequency: event.target.value as AppSettings["scanFrequency"] })}
                    data-setting-scan-frequency
                  >
                    <option value="realtime">实时监听</option>
                    <option value="interval">每 X 分钟</option>
                    <option value="manual">仅手动</option>
                  </select>
                </label>
                <Input
                  label="扫描间隔分钟"
                  min={1}
                  max={1440}
                  type="number"
                  value={settings?.scanIntervalMinutes ?? 10}
                  onChange={(event) => void saveSettings({ scanIntervalMinutes: Number.parseInt(event.target.value, 10) || 10 })}
                  data-setting-scan-interval
                />
                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="font-medium text-foreground">Excel 字段</span>
                  <select
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none"
                    value={settings?.excelFieldNaming ?? "zh"}
                    onChange={(event) => void saveSettings({ excelFieldNaming: event.target.value as AppSettings["excelFieldNaming"] })}
                    data-setting-excel-naming
                  >
                    <option value="zh">中文字段</option>
                    <option value="en">英文字段</option>
                  </select>
                </label>
                <Input
                  label="软删保留天数"
                  min={0}
                  max={3650}
                  type="number"
                  value={settings?.softDeleteRetentionDays ?? 90}
                  onChange={(event) => void saveSettings({ softDeleteRetentionDays: Number.parseInt(event.target.value, 10) || 0 })}
                  data-setting-soft-delete-retention
                />
                <Input
                  label="Provider 并发"
                  min={1}
                  max={20}
                  type="number"
                  value={settings?.providerConcurrencyLimit ?? 3}
                  onChange={(event) => void saveSettings({ providerConcurrencyLimit: Number.parseInt(event.target.value, 10) || 3 })}
                  data-setting-provider-concurrency
                />
                <Input
                  label="Provider 重试次数"
                  min={0}
                  max={10}
                  type="number"
                  value={settings?.providerRetryCount ?? 3}
                  onChange={(event) => void saveSettings({ providerRetryCount: Number.parseInt(event.target.value, 10) || 0 })}
                  data-setting-provider-retry
                />
                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="font-medium text-foreground">图片工作室结果处理</span>
                  <select
                    className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/15"
                    value={settings?.imageStudioResultHandling ?? "manual_review"}
                    onChange={(event) =>
                      void saveSettings({
                        imageStudioResultHandling: event.target.value as AppSettings["imageStudioResultHandling"]
                      })
                    }
                    data-setting-image-studio-result-handling
                  >
                    <option value="manual_review">人工验收后入库</option>
                    <option value="auto_library">生成后自动入库</option>
                  </select>
                </label>
              </div>
              <div className="grid grid-cols-1 gap-3 border-t border-border pt-3 sm:grid-cols-2">
                <Info label="当前版本" value={bootstrap?.appVersion ?? "-"} />
                <Info label="更新通道" value={settings?.updateChannel === "beta" ? "Beta" : "Stable"} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>软件维护</CardTitle>
              <Trash2 className="size-4 text-primary" />
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Info label="当前版本" value={bootstrap?.appVersion ?? "-"} />
                <Info label="更新通道" value={settings?.updateChannel === "beta" ? "Beta" : "Stable"} />
              </div>
              <Button variant="outline" onClick={() => void checkForUpdates()} data-check-for-updates>
                <Cloud />
                检查更新
              </Button>
              {updateCheck ? (
                <div className="rounded-md border border-border bg-background p-3 text-sm" data-update-check-result>
                  <div className="flex items-center justify-between gap-2">
                    <span>{updateCheck.updateAvailable ? "发现新版本" : updateCheck.error ? "检查失败" : "已是最新"}</span>
                    <Badge variant={updateCheck.updateAvailable ? "info" : updateCheck.error ? "warning" : "success"}>
                      {updateCheck.latestVersion ?? updateCheck.currentVersion}
                    </Badge>
                  </div>
                  {updateCheck.downloadUrl ? <div className="mt-2 truncate font-mono text-xs text-muted-foreground">{updateCheck.downloadUrl}</div> : null}
                  {updateCheck.releaseNotes ? <div className="mt-2 text-xs leading-5 text-muted-foreground">{updateCheck.releaseNotes}</div> : null}
                  {updateCheck.error ? <div className="mt-2 text-xs text-red-700">{updateCheck.error}</div> : null}
                </div>
              ) : null}
              <p className="text-sm leading-6 text-muted-foreground">
                清理视频缩略图、封面时间轴和 Skill 市场缓存；业务数据、任务单、Skill 正本和工作空间文件不会删除。
              </p>
              <Button variant="outline" onClick={() => void cleanCaches()} data-clean-caches>
                <Trash2 />
                清理本地缓存
              </Button>
              {cacheCleanupSummary ? (
                <div className="rounded-md border border-border bg-background p-3 text-sm" data-cache-cleanup-summary>
                  {cacheCleanupSummary}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>反馈包</CardTitle>
              <MessageSquareWarning className="size-4 text-primary" />
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium text-foreground">问题描述</span>
                <textarea
                  className="min-h-24 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/15"
                  value={feedbackDescription}
                  onChange={(event) => setFeedbackDescription(event.target.value)}
                  data-feedback-description
                />
              </label>
              <Button variant="outline" onClick={() => void createFeedbackPackage()} data-create-feedback-package>
                <Archive />
                生成本地反馈包
              </Button>
              {feedbackPackagePath ? (
                <div className="rounded-md border border-border bg-background p-3 font-mono text-xs" data-feedback-package-path>
                  {feedbackPackagePath}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="min-w-0 rounded-md border border-border bg-background p-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="mt-1 block break-all font-mono text-xs">{value}</span>
    </div>
  );
}

function cloudProviderLabel(provider: NonNullable<WorkspaceCloudSyncCheckResult["provider"]>): string {
  const labels: Record<NonNullable<WorkspaceCloudSyncCheckResult["provider"]>, string> = {
    onedrive: "OneDrive",
    dropbox: "Dropbox",
    jianguoyun: "坚果云",
    icloud: "iCloud",
    unknown: "未知云盘"
  };
  return labels[provider];
}
