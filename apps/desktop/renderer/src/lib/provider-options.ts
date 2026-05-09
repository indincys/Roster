import type { AppSettings, LlmProviderConfig } from "@roster/shared-types";

export interface LlmModelOption {
  label?: string;
  provider: string;
  model: string;
  enabled?: boolean;
}

export function enabledLlmProviderConfigs(settings: AppSettings | null | undefined): LlmProviderConfig[] {
  return settings?.llmProviderConfigs.filter((config) => config.enabled) ?? [];
}

export function providerDisplayName(settings: AppSettings | null | undefined, providerId: string): string {
  return settings?.llmProviderConfigs.find((config) => config.id === providerId)?.label ?? providerId;
}

export function mergeConfiguredLlmModels(defaults: LlmModelOption[], settings: AppSettings | null | undefined): LlmModelOption[] {
  const seen = new Set<string>();
  const merged: LlmModelOption[] = [];
  for (const option of defaults) {
    const key = `${option.provider}:${option.model}`;
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(option);
    }
  }
  for (const config of enabledLlmProviderConfigs(settings)) {
    const key = `${config.id}:${config.defaultModel}`;
    if (!seen.has(key)) {
      seen.add(key);
      merged.push({
        label: `${config.label} / ${config.defaultModel}`,
        provider: config.id,
        model: config.defaultModel,
        enabled: false
      });
    }
  }
  return merged;
}

export interface LabeledLlmModelOption extends Omit<LlmModelOption, "label"> {
  label: string;
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
