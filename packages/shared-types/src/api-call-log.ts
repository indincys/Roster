import { z } from "zod";
import { ProviderIdSchema } from "./provider";

export const ApiCallProviderSchema = ProviderIdSchema;
export const ApiCallWorkflowSchema = z.enum([
  "title_workspace",
  "script_workspace",
  "image_prompt_workspace",
  "image_workspace",
  "settings_test",
  "skill_test",
  "scheduler"
]);
export const ApiCallStatusSchema = z.enum(["success", "failed", "canceled"]);

export const ApiCallLogSaveInputSchema = z.object({
  provider: ApiCallProviderSchema,
  model: z.string().trim().min(1),
  workflow: ApiCallWorkflowSchema,
  status: ApiCallStatusSchema,
  startedAt: z.string(),
  finishedAt: z.string(),
  durationMs: z.number().int().nonnegative(),
  inputTokens: z.number().int().nonnegative().nullable().optional(),
  outputTokens: z.number().int().nonnegative().nullable().optional(),
  totalTokens: z.number().int().nonnegative().nullable().optional(),
  errorCode: z.string().trim().nullable().optional(),
  errorMessage: z.string().trim().nullable().optional()
});

export type ApiCallProvider = z.infer<typeof ApiCallProviderSchema>;
export type ApiCallWorkflow = z.infer<typeof ApiCallWorkflowSchema>;
export type ApiCallStatus = z.infer<typeof ApiCallStatusSchema>;
export type ApiCallLogSaveInput = z.infer<typeof ApiCallLogSaveInputSchema>;
