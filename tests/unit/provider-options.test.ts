import { describe, expect, it } from "vitest";
import type { ApiKeyPublicRecord, AppSettings } from "@roster/shared-types";
import { DEFAULT_LLM_PROVIDER_CONFIGS } from "@roster/shared-types";
import { configuredLlmModelsFromApiKeys } from "../../apps/desktop/renderer/src/lib/provider-options";

function makeSettings(configs: AppSettings["llmProviderConfigs"]): AppSettings {
  return {
    scanFrequency: "manual",
    scanIntervalMinutes: 10,
    scanOnStartup: true,
    defaultExportFormats: ["xlsx", "csv", "json"],
    excelFieldNaming: "zh",
    softDeleteRetentionDays: 90,
    logRetentionDays: 90,
    apiLogRetentionDays: 365,
    providerConcurrencyLimit: 3,
    providerRetryCount: 3,
    providerRetryBaseDelayMs: 1000,
    llmProviderConfigs: configs,
    monthlyBudgetWarningCents: 0,
    backupScope: "all",
    backupRetentionCount: 7,
    backupFrequency: "manual",
    updateChannel: "stable"
  };
}

function makeKey(input: Partial<ApiKeyPublicRecord> & Pick<ApiKeyPublicRecord, "provider" | "label">): ApiKeyPublicRecord {
  return {
    id: input.id ?? `${input.provider}-${input.label}`,
    provider: input.provider,
    label: input.label,
    model: input.model ?? null,
    isDefault: input.isDefault ?? false,
    createdAt: "2026-05-10T00:00:00.000Z",
    updatedAt: "2026-05-10T00:00:00.000Z"
  };
}

describe("configuredLlmModelsFromApiKeys", () => {
  it("only exposes enabled providers that have saved API keys", () => {
    const settings = makeSettings([
      { ...DEFAULT_LLM_PROVIDER_CONFIGS.find((config) => config.id === "openai")!, enabled: true },
      { ...DEFAULT_LLM_PROVIDER_CONFIGS.find((config) => config.id === "deepseek")!, enabled: true },
      { ...DEFAULT_LLM_PROVIDER_CONFIGS.find((config) => config.id === "anthropic")!, enabled: true }
    ]);

    expect(
      configuredLlmModelsFromApiKeys(settings, [
        makeKey({ provider: "deepseek", label: "DeepSeek 主账号", model: "deepseek-chat", isDefault: true })
      ])
    ).toEqual([
      expect.objectContaining({
        provider: "deepseek",
        model: "deepseek-chat",
        enabled: false
      })
    ]);
  });

  it("filters secret-looking provider metadata before rendering model buttons", () => {
    const settings = makeSettings([
      {
        id: "deepseek",
        label: "DeepSeek",
        vendor: "DeepSeek",
        adapter: "openai-compatible",
        baseUrl: "https://api.deepseek.com/v1",
        defaultModel: "deepseek-chat",
        enabled: true,
        isBuiltin: true
      }
    ]);

    const models = configuredLlmModelsFromApiKeys(settings, [
      makeKey({ provider: "deepseek", label: "DeepSeek 主账号", model: "sk-2576628c6e1f4a08805a22ab97050000" }),
      makeKey({ provider: "deepseek", label: "DeepSeek 备用", model: "deepseek-reasoner" })
    ]);

    expect(models).toEqual([expect.objectContaining({ provider: "deepseek", model: "deepseek-reasoner" })]);
    expect(models.map((model) => `${model.provider}/${model.model}`).join("\n")).not.toContain("sk-");
  });
});
