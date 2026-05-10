import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import type {
  ApiKeyConnectionTestResult,
  AppSettings,
  LlmProviderAdapter,
  LlmProviderConfig,
  PlatformAccountRecord,
  SoftwareUpdateCheckResult,
  WorkspaceCloudSyncCheckResult
} from "@roster/shared-types";
import { DEFAULT_LLM_PROVIDER_CONFIGS, ProviderIdSchema } from "@roster/shared-types";
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
import { activeWorkspace, useAppStore } from "@/stores/app-store";

interface SimpleProviderPreset {
  id: string;
  label: string;
  vendor: string;
  adapter: LlmProviderAdapter;
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

function presetForVendor(vendor: string): SimpleProviderPreset | null {
  const normalized = vendor.trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  if (normalized.includes("deepseek")) {
    return SIMPLE_PROVIDER_PRESETS.find((preset) => preset.id === "deepseek") ?? null;
  }
  if (normalized.includes("kimi") || normalized.includes("moonshot")) {
    return SIMPLE_PROVIDER_PRESETS.find((preset) => preset.id === "kimi") ?? null;
  }
  if (normalized.includes("doubao") || normalized.includes("豆包") || normalized.includes("volcano") || normalized.includes("火山")) {
    return SIMPLE_PROVIDER_PRESETS.find((preset) => preset.id === "doubao") ?? null;
  }
  if (normalized.includes("qwen") || normalized.includes("通义") || normalized.includes("千问") || normalized.includes("dashscope")) {
    return SIMPLE_PROVIDER_PRESETS.find((preset) => preset.id === "qwen") ?? null;
  }
  if (normalized.includes("glm") || normalized.includes("智谱")) {
    return SIMPLE_PROVIDER_PRESETS.find((preset) => preset.id === "glm") ?? null;
  }
  if (normalized.includes("gemini") || normalized.includes("google")) {
    return SIMPLE_PROVIDER_PRESETS.find((preset) => preset.id === "google") ?? null;
  }
  if (normalized.includes("anthropic") || normalized.includes("claude")) {
    return SIMPLE_PROVIDER_PRESETS.find((preset) => preset.id === "anthropic") ?? null;
  }
  if (normalized.includes("openai")) {
    return SIMPLE_PROVIDER_PRESETS.find((preset) => preset.id === "openai") ?? null;
  }
  if (normalized.includes("mock")) {
    return SIMPLE_PROVIDER_PRESETS.find((preset) => preset.id === "mock") ?? null;
  }
  return SIMPLE_PROVIDER_PRESETS.find((preset) => preset.vendor.toLowerCase() === normalized || preset.label.toLowerCase() === normalized) ?? null;
}

function hashVendor(vendor: string): string {
  let hash = 0;
  for (const char of vendor) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return hash.toString(36);
}

function providerIdForVendor(vendor: string): string {
  const preset = presetForVendor(vendor);
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

function adapterForVendor(vendor: string): LlmProviderAdapter {
  return presetForVendor(vendor)?.adapter ?? "openai-compatible";
}

export function SettingsPage(): JSX.Element {
  const { bootstrap, updateState, createWorkspace, saveApiKey, checkForUpdates: checkForUpdatesFromStore, loading, error } = useAppStore();
  const workspace = activeWorkspace(bootstrap);
  const apiKeys = bootstrap?.apiKeys ?? [];
  const workspaceId = workspace?.id;
  const [workspaceName, setWorkspaceName] = useState("");
  const [rootPath, setRootPath] = useState("");
  const [macRootPath, setMacRootPath] = useState("");
  const [winRootPath, setWinRootPath] = useState("");
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
    () => workspaceName.trim() && rootPath.trim() && macRootPath.trim() && winRootPath.trim(),
    [macRootPath, rootPath, winRootPath, workspaceName]
  );

  const chooseDirectory = async (): Promise<void> => {
    const selected = await window.roster.chooseWorkspaceDirectory();
    if (!selected.canceled && selected.path) {
      setRootPath(selected.path);
      setMacRootPath(selected.path);
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

  const saveSettings = async (input: Partial<AppSettings>): Promise<void> => {
    const saved = await window.roster.saveSettings(input);
    setSettings(saved);
    setSavedMessage("设置已保存并立即生效。");
  };

  const providerConfigs = useMemo(() => settings?.llmProviderConfigs ?? [...DEFAULT_LLM_PROVIDER_CONFIGS], [settings?.llmProviderConfigs]);
  const saveProviderConfigs = async (configs: LlmProviderConfig[], message = "Provider 配置已保存。"): Promise<AppSettings> => {
    const saved = await window.roster.saveSettings({ llmProviderConfigs: configs });
    setSettings(saved);
    setSavedMessage(message);
    return saved;
  };

  const upsertProviderConfig = async (config: LlmProviderConfig, message?: string): Promise<LlmProviderConfig> => {
    const parsed = {
      ...config,
      id: ProviderIdSchema.parse(config.id),
      baseUrl: config.baseUrl?.trim() ? config.baseUrl.trim().replace(/\/+$/, "") : null
    };
    const next = [...providerConfigs.filter((candidate) => candidate.id !== parsed.id), parsed].sort((left, right) =>
      left.label.localeCompare(right.label, "zh-Hans-CN")
    );
    await saveProviderConfigs(next, message);
    return parsed;
  };

  const submitWorkspace = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    await createWorkspace({
      name: workspaceName,
      rootPath,
      macRootPath,
      winRootPath
    });
    setWorkspaceName("");
    setRootPath("");
    setMacRootPath("");
    setWinRootPath("");
    setSavedMessage("工作空间已创建并切换。");
  };

  const selectPreset = (vendor: string): void => {
    const preset = presetForVendor(vendor);
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

  const buildProviderConfigFromSimpleForm = (): LlmProviderConfig => {
    const vendor = modelVendor.trim();
    const preset = presetForVendor(vendor);
    const normalizedBaseUrl = baseUrl.trim().replace(/\/+$/, "");
    return {
      id: providerIdForVendor(vendor),
      label: preset?.label ?? vendor,
      vendor,
      adapter: adapterForVendor(vendor),
      baseUrl: normalizedBaseUrl ? normalizedBaseUrl : null,
      defaultModel: modelId.trim(),
      enabled: true,
      isBuiltin: preset ? DEFAULT_LLM_PROVIDER_CONFIGS.some((config) => config.id === preset.id) : false
    };
  };

  const submitApiKey = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setApiConnectionTestResult(null);
    const provider = await upsertProviderConfig(buildProviderConfigFromSimpleForm(), "API 配置已保存，正在测试连接。");
    const model = provider.defaultModel;
    const label = apiKeyLabel.trim() || `${provider.label} / ${model}`;
    const savedKey = await saveApiKey({ provider: provider.id, label, model, isDefault: apiKeyDefault, apiKey });
    const result = await window.roster.testApiKey({ apiKeyId: savedKey.id });
    setApiConnectionTestResult(result);
    setApiKey("");
    setApiKeyLabel("");
    setSavedMessage(result.ok ? `API 已保存，连接测试成功：读取到 ${result.modelCount} 个模型。` : `API 已保存，连接测试失败：${result.errorCode ?? "ProviderError"}`);
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
    <div className="flex flex-col gap-4 p-5">
      <div>
        <h1 className="text-xl font-semibold">设置</h1>
        <p className="mt-1 text-sm text-muted-foreground">管理工作空间、路径映射、凭证和基础维护能力。</p>
      </div>

      {error ? <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
      {savedMessage ? <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{savedMessage}</div> : null}

      <div className="grid grid-cols-[1fr_420px] gap-4">
        <Card>
          <CardHeader>
            <CardTitle>工作空间</CardTitle>
            <Badge variant={workspace ? "success" : "warning"}>{workspace ? "已打开" : "未创建"}</Badge>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {workspace ? (
              <div className="grid grid-cols-2 gap-3">
                <Info label="当前空间" value={workspace.name} />
                <Info label="空间根目录" value={workspace.rootPath} />
                <Info label="当前设备路径" value={workspace.macRootPath} />
                <Info label="RPA 执行路径" value={workspace.winRootPath} />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">创建工作空间后，应用会初始化目录结构和独立数据库。</p>
            )}

            <form className="flex flex-col gap-3 border-t border-border pt-4" onSubmit={(event) => void submitWorkspace(event)}>
              <div className="grid grid-cols-2 gap-3">
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
                <Input label="Windows 根路径" value={winRootPath} onChange={(event) => setWinRootPath(event.target.value)} placeholder="D:\\CloudSync\\品牌A" />
              </div>
              <div className="flex justify-end">
                <Button variant="primary" type="submit" disabled={!canCreateWorkspace || loading}>
                  <Plus />
                  创建并切换
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
              <div className="grid grid-cols-2 gap-3">
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
              <CardTitle>凭证</CardTitle>
              <ShieldCheck className="size-4 text-emerald-600" />
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <form className="flex flex-col gap-3" onSubmit={(event) => void submitApiKey(event)} data-api-config-form>
                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="font-medium text-foreground">大模型厂商</span>
                  <input
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/15"
                    list="model-vendor-presets"
                    value={modelVendor}
                    onChange={(event) => selectPreset(event.target.value)}
                    placeholder="OpenAI、DeepSeek、Kimi、豆包、Qwen、GLM、自定义厂商"
                    data-model-vendor
                  />
                  <datalist id="model-vendor-presets">
                    {SIMPLE_PROVIDER_PRESETS.map((preset) => (
                      <option key={preset.id} value={preset.vendor} />
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
                  placeholder="gpt-5.4-mini"
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
                  hint="保存时使用本机密钥 AES-GCM 加密，不明文写入 config.db。"
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
                  disabled={!modelVendor.trim() || !modelId.trim() || !apiKey.trim() || (adapterForVendor(modelVendor) !== "mock" && !baseUrl.trim())}
                  data-save-api-key
                  data-test-api-key
                >
                  <KeyRound />
                  保存并测试 API
                </Button>
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
                    <Badge variant="neutral">{apiKeys.length} 个</Badge>
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
                          className="grid grid-cols-[1fr_auto] items-center gap-2 rounded-md border border-border px-3 py-2 text-xs"
                          data-api-key-row={record.id}
                        >
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium">{record.label}</div>
                            <div className="truncate font-mono text-muted-foreground">
                              {record.provider}{record.model ? ` / ${record.model}` : ""}
                            </div>
                          </div>
                          <Badge variant={record.isDefault ? "success" : "neutral"}>{record.isDefault ? "默认" : "备用"}</Badge>
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
              <CardTitle>备份</CardTitle>
              <Archive className="size-4 text-primary" />
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p className="text-sm leading-6 text-muted-foreground">生成当前工作空间 zip 备份，默认保存到 `_backup/`。</p>
              <div className="grid grid-cols-2 gap-3">
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
              <div className="grid grid-cols-2 gap-3">
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
              </div>
              <div className="grid grid-cols-2 gap-3 border-t border-border pt-3">
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
              <div className="grid grid-cols-2 gap-3">
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
    <div className="flex flex-col gap-1 rounded-md border border-border bg-background p-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="truncate font-mono text-xs">{value}</span>
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
