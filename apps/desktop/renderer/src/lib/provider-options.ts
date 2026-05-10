import type { ApiKeyPublicRecord, AppSettings, LlmProviderConfig } from "@roster/shared-types";
import { containsSecretLikeToken, sanitizeLlmProviderConfigs } from "@roster/shared-types";

export interface LlmModelOption {
  label?: string;
  provider: string;
  model: string;
  enabled?: boolean;
}

export function enabledLlmProviderConfigs(settings: AppSettings | null | undefined): LlmProviderConfig[] {
  return sanitizeLlmProviderConfigs(settings?.llmProviderConfigs ?? []).filter((config) => config.enabled);
}

export function providerDisplayName(settings: AppSettings | null | undefined, providerId: string): string {
  return enabledLlmProviderConfigs(settings).find((config) => config.id === providerId)?.label ?? providerId;
}

export function configuredLlmModelsFromApiKeys(
  settings: AppSettings | null | undefined,
  apiKeys: ApiKeyPublicRecord[] | null | undefined,
  options: { enableFirst?: boolean } = {}
): LlmModelOption[] {
  const seen = new Set<string>();
  const models: LlmModelOption[] = [];
  const keysByProvider = new Map<string, ApiKeyPublicRecord[]>();
  for (const apiKey of apiKeys ?? []) {
    if (containsSecretLikeToken(apiKey.provider) || containsSecretLikeToken(apiKey.label) || containsSecretLikeToken(apiKey.model)) {
      continue;
    }
    keysByProvider.set(apiKey.provider, [...(keysByProvider.get(apiKey.provider) ?? []), apiKey]);
  }

  for (const config of enabledLlmProviderConfigs(settings)) {
    const providerKeys = keysByProvider.get(config.id) ?? [];
    if (config.id !== "mock" && providerKeys.length === 0) {
      continue;
    }
    const candidateModels =
      providerKeys.length > 0
        ? providerKeys.map((apiKey) => apiKey.model ?? config.defaultModel).filter((model): model is string => Boolean(model))
        : [config.defaultModel];

    for (const model of candidateModels) {
      if (containsSecretLikeToken(model)) {
        continue;
      }
      const key = `${config.id}:${model}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      models.push({
        label: `${config.label} / ${model}`,
        provider: config.id,
        model,
        enabled: options.enableFirst ? models.length === 0 : false
      });
    }
  }
  return models;
}

export function mergeConfiguredLlmModels(defaults: LlmModelOption[], settings: AppSettings | null | undefined): LlmModelOption[] {
  const seen = new Set<string>();
  const merged: LlmModelOption[] = [];
  for (const option of defaults) {
    if (containsSecretLikeToken(option.provider) || containsSecretLikeToken(option.model) || containsSecretLikeToken(option.label)) {
      continue;
    }
    const config = enabledLlmProviderConfigs(settings).find((candidate) => candidate.id === option.provider);
    if (option.provider !== "mock" && !config) {
      continue;
    }
    const key = `${option.provider}:${option.model}`;
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(option);
    }
  }
  return merged;
}

export interface LabeledLlmModelOption extends Omit<LlmModelOption, "label"> {
  label: string;
}

export function configuredLabeledLlmModelsFromApiKeys(
  settings: AppSettings | null | undefined,
  apiKeys: ApiKeyPublicRecord[] | null | undefined,
  options: { enableFirst?: boolean } = {}
): LabeledLlmModelOption[] {
  return configuredLlmModelsFromApiKeys(settings, apiKeys, options).map((option) => ({
    ...option,
    label: option.label ?? `${option.provider} / ${option.model}`
  }));
}

export function mergeConfiguredLabeledLlmModels(
  defaults: LabeledLlmModelOption[],
  settings: AppSettings | null | undefined
): LabeledLlmModelOption[] {
  return mergeConfiguredLlmModels(defaults, settings).map((option) => ({
    ...option,
    label: option.label ?? `${option.provider} / ${option.model}`
  }));
}
