import type { ApiKeyPublicRecord, AppSettings, ImageProviderConfig, LlmProviderConfig } from "@roster/shared-types";
import { containsSecretLikeToken, sanitizeImageProviderConfigs, sanitizeLlmProviderConfigs } from "@roster/shared-types";

export interface LlmModelOption {
  label?: string;
  provider: string;
  model: string;
  enabled?: boolean;
}

export interface ImageModelOption {
  label: string;
  provider: string;
  model: string;
  apiKeyId: string | null;
  keyLabel: string | null;
  enabled?: boolean;
}

export function enabledLlmProviderConfigs(settings: AppSettings | null | undefined): LlmProviderConfig[] {
  return sanitizeLlmProviderConfigs(settings?.llmProviderConfigs ?? []).filter((config) => config.enabled);
}

export function enabledImageProviderConfigs(settings: AppSettings | null | undefined): ImageProviderConfig[] {
  return sanitizeImageProviderConfigs(settings?.imageProviderConfigs ?? []).filter((config) => config.enabled);
}

export function providerDisplayName(settings: AppSettings | null | undefined, providerId: string): string {
  return enabledLlmProviderConfigs(settings).find((config) => config.id === providerId)?.label ?? providerId;
}

export function configuredLlmModelsFromApiKeys(
  settings: AppSettings | null | undefined,
  apiKeys: ApiKeyPublicRecord[] | null | undefined,
  options: { enableFirst?: boolean; modelFilter?: (option: LlmModelOption) => boolean } = {}
): LlmModelOption[] {
  const seen = new Set<string>();
  const models: LlmModelOption[] = [];
  const keysByProvider = new Map<string, ApiKeyPublicRecord[]>();
  for (const apiKey of apiKeys ?? []) {
    if (apiKey.kind !== "text") {
      continue;
    }
    if (containsSecretLikeToken(apiKey.provider) || containsSecretLikeToken(apiKey.label) || containsSecretLikeToken(apiKey.model)) {
      continue;
    }
    keysByProvider.set(apiKey.provider, [...(keysByProvider.get(apiKey.provider) ?? []), apiKey]);
  }

  for (const config of enabledLlmProviderConfigs(settings)) {
    const providerKeys = [...(keysByProvider.get(config.id) ?? [])].sort((left, right) => {
      if (left.isDefault !== right.isDefault) {
        return left.isDefault ? -1 : 1;
      }
      return right.updatedAt.localeCompare(left.updatedAt);
    });
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
      const option = {
        label: `${config.label} / ${model}`,
        provider: config.id,
        model,
        enabled: options.enableFirst ? models.length === 0 : false
      };
      if (options.modelFilter && !options.modelFilter(option)) {
        continue;
      }
      const key = `${config.id}:${model}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      models.push(option);
    }
  }
  return models;
}

export function configuredImageModelsFromApiKeys(
  settings: AppSettings | null | undefined,
  apiKeys: ApiKeyPublicRecord[] | null | undefined,
  options: { enableFirst?: boolean } = {}
): ImageModelOption[] {
  const imageKeysByProvider = new Map<string, ApiKeyPublicRecord[]>();
  for (const apiKey of apiKeys ?? []) {
    if (apiKey.kind !== "image") {
      continue;
    }
    if (containsSecretLikeToken(apiKey.provider) || containsSecretLikeToken(apiKey.label) || containsSecretLikeToken(apiKey.model)) {
      continue;
    }
    imageKeysByProvider.set(apiKey.provider, [...(imageKeysByProvider.get(apiKey.provider) ?? []), apiKey]);
  }

  const optionsList: ImageModelOption[] = [];
  for (const config of enabledImageProviderConfigs(settings)) {
    const providerKeys = [...(imageKeysByProvider.get(config.id) ?? [])].sort((left, right) => {
      if (left.isDefault !== right.isDefault) {
        return left.isDefault ? -1 : 1;
      }
      return right.updatedAt.localeCompare(left.updatedAt);
    });
    if (config.id !== "mock" && providerKeys.length === 0) {
      continue;
    }
    if (providerKeys.length === 0) {
      if (!containsSecretLikeToken(config.defaultModel)) {
        optionsList.push({
          label: `${config.label} / ${config.defaultModel}`,
          provider: config.id,
          model: config.defaultModel,
          apiKeyId: null,
          keyLabel: null,
          enabled: options.enableFirst ? optionsList.length === 0 : false
        });
      }
      continue;
    }
    for (const apiKey of providerKeys) {
      const model = apiKey.model ?? config.defaultModel;
      if (containsSecretLikeToken(model)) {
        continue;
      }
      optionsList.push({
        label: `${config.label} / ${model} / ${apiKey.label}`,
        provider: config.id,
        model,
        apiKeyId: apiKey.id,
        keyLabel: apiKey.label,
        enabled: options.enableFirst ? optionsList.length === 0 : false
      });
    }
  }
  return optionsList;
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
  options: { enableFirst?: boolean; modelFilter?: (option: LlmModelOption) => boolean } = {}
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
