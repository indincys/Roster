import { z } from "zod";

export const ProviderIdSchema = z
  .string()
  .trim()
  .min(2)
  .max(64)
  .regex(/^[a-z0-9][a-z0-9._-]*$/, "Provider ID 只能使用小写字母、数字、点、下划线或连字符");

export const LlmProviderAdapterSchema = z.enum(["mock", "openai", "anthropic", "google", "openai-compatible"]);

export const DEFAULT_LLM_PROVIDER_CONFIGS = [
  {
    id: "mock",
    label: "Mock 本地测试",
    vendor: "Mock",
    adapter: "mock",
    baseUrl: null,
    defaultModel: "mock-title-fast",
    enabled: false,
    isBuiltin: true
  },
  {
    id: "openai",
    label: "OpenAI",
    vendor: "OpenAI",
    adapter: "openai",
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-5.4-mini",
    enabled: false,
    isBuiltin: true
  },
  {
    id: "anthropic",
    label: "Anthropic",
    vendor: "Anthropic",
    adapter: "anthropic",
    baseUrl: "https://api.anthropic.com/v1",
    defaultModel: "claude-sonnet-4-5",
    enabled: false,
    isBuiltin: true
  },
  {
    id: "google",
    label: "Google Gemini",
    vendor: "Google",
    adapter: "google",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    defaultModel: "gemini-2.5-flash",
    enabled: false,
    isBuiltin: true
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    vendor: "DeepSeek",
    adapter: "openai-compatible",
    baseUrl: "https://api.deepseek.com/v1",
    defaultModel: "deepseek-chat",
    enabled: false,
    isBuiltin: true
  },
  {
    id: "kimi",
    label: "Kimi",
    vendor: "Moonshot AI",
    adapter: "openai-compatible",
    baseUrl: "https://api.moonshot.cn/v1",
    defaultModel: "moonshot-v1-8k",
    enabled: false,
    isBuiltin: true
  },
  {
    id: "doubao",
    label: "Doubao",
    vendor: "ByteDance Volcano Ark",
    adapter: "openai-compatible",
    baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    defaultModel: "doubao-seed-1-6",
    enabled: false,
    isBuiltin: true
  },
  {
    id: "qwen",
    label: "Qwen",
    vendor: "Alibaba Cloud DashScope",
    adapter: "openai-compatible",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    defaultModel: "qwen-plus",
    enabled: false,
    isBuiltin: true
  },
  {
    id: "glm",
    label: "GLM",
    vendor: "Zhipu AI",
    adapter: "openai-compatible",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    defaultModel: "glm-4-plus",
    enabled: false,
    isBuiltin: true
  }
] as const;

const SECRET_LIKE_PATTERN = /(sk-[A-Za-z0-9_-]{8,}|AIza[A-Za-z0-9_-]{8,}|anthropic[A-Za-z0-9_-]{8,}|Bearer\s+[A-Za-z0-9._~+/-]+=*)/i;

export function containsSecretLikeToken(value: string | null | undefined): boolean {
  return typeof value === "string" && SECRET_LIKE_PATTERN.test(value);
}

export function isSafeLlmProviderConfig(config: {
  id: string;
  label: string;
  vendor: string;
  baseUrl?: string | null;
  defaultModel: string;
}): boolean {
  return ![config.id, config.label, config.vendor, config.baseUrl ?? "", config.defaultModel].some((value) =>
    containsSecretLikeToken(value)
  );
}

export function sanitizeLlmProviderConfigs<T extends {
  id: string;
  label: string;
  vendor: string;
  baseUrl?: string | null;
  defaultModel: string;
}>(configs: readonly T[]): T[] {
  const seen = new Set<string>();
  const sanitized: T[] = [];
  for (const config of configs) {
    if (!isSafeLlmProviderConfig(config)) {
      continue;
    }
    const key = `${config.id}:${config.defaultModel}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    sanitized.push(config);
  }
  return sanitized;
}

export const LlmProviderConfigSchema = z
  .object({
    id: ProviderIdSchema,
    label: z.string().trim().min(1).max(80),
    vendor: z.string().trim().min(1).max(80),
    adapter: LlmProviderAdapterSchema,
    baseUrl: z.string().trim().url().nullable().default(null),
    defaultModel: z.string().trim().min(1).max(160),
    enabled: z.boolean().default(true),
    isBuiltin: z.boolean().default(false)
  })
  .superRefine((config, ctx) => {
    if (config.adapter === "openai-compatible" && !config.baseUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["baseUrl"],
        message: "OpenAI-compatible Provider 必须填写 baseURL"
      });
    }
  });

export type ProviderId = z.infer<typeof ProviderIdSchema>;
export type LlmProviderAdapter = z.infer<typeof LlmProviderAdapterSchema>;
export type LlmProviderConfig = z.infer<typeof LlmProviderConfigSchema>;
