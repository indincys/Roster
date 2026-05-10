import { z } from "zod";
import { DEFAULT_LLM_PROVIDER_CONFIGS, LlmProviderConfigSchema } from "./provider";

export const AppSettingsSchema = z.object({
  scanFrequency: z.enum(["realtime", "interval", "manual"]).default("manual"),
  scanIntervalMinutes: z.number().int().min(1).max(1440).default(10),
  scanOnStartup: z.boolean().default(true),
  defaultExportFormats: z.array(z.enum(["xlsx", "csv", "json"])).min(1).default(["xlsx", "csv", "json"]),
  excelFieldNaming: z.enum(["zh", "en"]).default("zh"),
  softDeleteRetentionDays: z.number().int().min(0).max(3650).default(90),
  logRetentionDays: z.number().int().min(1).max(3650).default(90),
  apiLogRetentionDays: z.number().int().min(1).max(3650).default(365),
  providerConcurrencyLimit: z.number().int().min(1).max(20).default(3),
  providerRetryCount: z.number().int().min(0).max(10).default(3),
  providerRetryBaseDelayMs: z.number().int().min(100).max(60_000).default(1000),
  llmProviderConfigs: z.array(LlmProviderConfigSchema).default([...DEFAULT_LLM_PROVIDER_CONFIGS]),
  monthlyBudgetWarningCents: z.number().int().min(0).max(100_000_000).default(0),
  backupScope: z.enum(["database", "database_skills", "all"]).default("all"),
  backupRetentionCount: z.number().int().min(1).max(100).default(7),
  backupFrequency: z.enum(["manual", "daily", "weekly"]).default("manual"),
  updateChannel: z.enum(["stable", "beta"]).default("stable")
});

export const AppSettingsSaveInputSchema = AppSettingsSchema.partial();

export type AppSettings = z.infer<typeof AppSettingsSchema>;
export type AppSettingsSaveInput = z.infer<typeof AppSettingsSaveInputSchema>;
