import { z } from "zod";

export const ProviderKindSchema = z.enum(["openai", "anthropic", "google", "mock"]);

export const ApiKeySaveInputSchema = z.object({
  provider: ProviderKindSchema,
  label: z.string().trim().min(1).default("默认凭证"),
  apiKey: z.string().min(8, "API key 长度不足")
});

export const ApiKeyPublicRecordSchema = z.object({
  id: z.string(),
  provider: ProviderKindSchema,
  label: z.string(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const ApiKeyStorageAuditSchema = z.object({
  plaintextFound: z.boolean(),
  checkedFiles: z.array(z.string())
});

export const ApiKeyConnectionTestInputSchema = z.object({
  apiKeyId: z.string().min(1)
});

export const ApiKeyConnectionTestResultSchema = z.object({
  apiKeyId: z.string().min(1),
  provider: ProviderKindSchema,
  ok: z.boolean(),
  checkedAt: z.string(),
  models: z.array(z.string()),
  modelCount: z.number().int().nonnegative(),
  errorCode: z
    .enum(["InvalidAPIKey", "RateLimited", "NetworkError", "ProviderError", "UnsupportedProvider", "NotFound"])
    .nullable(),
  errorMessage: z.string().nullable()
});

export type ProviderKind = z.infer<typeof ProviderKindSchema>;
export type ApiKeySaveInput = z.infer<typeof ApiKeySaveInputSchema>;
export type ApiKeyPublicRecord = z.infer<typeof ApiKeyPublicRecordSchema>;
export type ApiKeyStorageAudit = z.infer<typeof ApiKeyStorageAuditSchema>;
export type ApiKeyConnectionTestInput = z.infer<typeof ApiKeyConnectionTestInputSchema>;
export type ApiKeyConnectionTestResult = z.infer<typeof ApiKeyConnectionTestResultSchema>;
