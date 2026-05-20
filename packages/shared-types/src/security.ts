import { z } from "zod";
import { ImageProviderConfigSchema, LlmProviderConfigSchema, ProviderIdSchema } from "./provider";

export const ProviderKindSchema = ProviderIdSchema;
export const ApiKeyKindSchema = z.enum(["text", "image"]);

export const ApiKeySaveInputSchema = z.object({
  apiKeyId: z.string().min(1).optional(),
  kind: ApiKeyKindSchema.default("text"),
  provider: ProviderKindSchema,
  label: z.string().trim().min(1).default("默认凭证"),
  model: z.string().trim().min(1).max(160).nullable().optional(),
  isDefault: z.boolean().optional().default(false),
  apiKey: z.string().min(8, "API key 长度不足").optional(),
  providerConfig: z.union([LlmProviderConfigSchema, ImageProviderConfigSchema]).optional()
}).refine((input) => Boolean(input.apiKeyId) || Boolean(input.apiKey), {
  message: "新增 API key 时必须填写 key；编辑已保存 key 时可保留原 key"
});

export const ApiKeyPublicRecordSchema = z.object({
  id: z.string(),
  kind: ApiKeyKindSchema.default("text"),
  provider: ProviderKindSchema,
  label: z.string(),
  model: z.string().nullable(),
  isDefault: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const ApiKeyStorageAuditSchema = z.object({
  plaintextFound: z.boolean(),
  checkedFiles: z.array(z.string())
});

export const ApiKeyConnectionTestInputSchema = z.object({
  apiKeyId: z.string().min(1).optional(),
  kind: ApiKeyKindSchema.optional(),
  provider: ProviderKindSchema.optional(),
  model: z.string().trim().min(1).max(160).nullable().optional(),
  apiKey: z.string().min(8, "API key 长度不足").optional(),
  providerConfig: z.union([LlmProviderConfigSchema, ImageProviderConfigSchema]).optional()
}).refine((input) => Boolean(input.apiKeyId) || Boolean(input.kind && input.provider && input.apiKey), {
  message: "需要选择已保存 API key，或提供待测试的 Provider、类型和 API key"
});

export const ApiKeyConnectionTestResultSchema = z.object({
  apiKeyId: z.string().min(1).nullable(),
  provider: ProviderKindSchema,
  kind: ApiKeyKindSchema,
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
export type ApiKeyKind = z.infer<typeof ApiKeyKindSchema>;
export type ApiKeySaveInput = z.infer<typeof ApiKeySaveInputSchema>;
export type ApiKeyPublicRecord = z.infer<typeof ApiKeyPublicRecordSchema>;
export type ApiKeyStorageAudit = z.infer<typeof ApiKeyStorageAuditSchema>;
export type ApiKeyConnectionTestInput = z.infer<typeof ApiKeyConnectionTestInputSchema>;
export type ApiKeyConnectionTestResult = z.infer<typeof ApiKeyConnectionTestResultSchema>;
