import { z } from "zod";
import { ProviderIdSchema } from "./provider";

export const ScriptWorkspaceModelSchema = z.object({
  provider: ProviderIdSchema,
  model: z.string().trim().min(1)
});

export const ScriptWorkspaceGenerateInputSchema = z.object({
  skillId: z.string().trim().min(1),
  taskPrompt: z.string().trim().optional().default(""),
  skuCode: z.string().trim().nullable().optional(),
  models: z.array(ScriptWorkspaceModelSchema).min(1)
});

export const ScriptWorkspaceColumnResultSchema = z.object({
  columnId: z.string().min(1),
  provider: ProviderIdSchema,
  model: z.string().min(1),
  status: z.enum(["success", "failed"]),
  text: z.string(),
  scripts: z.array(z.string()),
  error: z.string().nullable(),
  usage: z
    .object({
      inputTokens: z.number().int().nonnegative(),
      outputTokens: z.number().int().nonnegative(),
      totalTokens: z.number().int().nonnegative()
    })
    .nullable()
});

export const ScriptWorkspaceGenerateResultSchema = z.object({
  skillId: z.string().min(1),
  skuCode: z.string().nullable(),
  columns: z.array(ScriptWorkspaceColumnResultSchema)
});

export const ScriptWorkspaceStreamStartResultSchema = z.object({
  streamId: z.string().min(1)
});

export const ScriptWorkspaceStreamCancelInputSchema = z.object({
  streamId: z.string().min(1)
});

export const ScriptWorkspaceStreamEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("started"),
    streamId: z.string().min(1),
    columns: z.array(
      z.object({
        columnId: z.string().min(1),
        provider: ProviderIdSchema,
        model: z.string().min(1)
      })
    )
  }),
  z.object({
    type: z.literal("chunk"),
    streamId: z.string().min(1),
    columnId: z.string().min(1),
    text: z.string()
  }),
  z.object({
    type: z.literal("columnComplete"),
    streamId: z.string().min(1),
    column: ScriptWorkspaceColumnResultSchema
  }),
  z.object({
    type: z.literal("done"),
    streamId: z.string().min(1),
    canceled: z.boolean()
  })
]);

export const ScriptWorkspaceSaveInputSchema = z.object({
  skillId: z.string().trim().min(1),
  skuCode: z.string().trim().nullable().optional(),
  scripts: z.array(z.string().trim().min(1)).min(1)
});

export const ScriptWorkspaceSaveResultSchema = z.object({
  savedCount: z.number().int().nonnegative(),
  scriptIds: z.array(z.string())
});

export type ScriptWorkspaceModel = z.infer<typeof ScriptWorkspaceModelSchema>;
export type ScriptWorkspaceGenerateInput = z.infer<typeof ScriptWorkspaceGenerateInputSchema>;
export type ScriptWorkspaceColumnResult = z.infer<typeof ScriptWorkspaceColumnResultSchema>;
export type ScriptWorkspaceGenerateResult = z.infer<typeof ScriptWorkspaceGenerateResultSchema>;
export type ScriptWorkspaceStreamStartResult = z.infer<typeof ScriptWorkspaceStreamStartResultSchema>;
export type ScriptWorkspaceStreamCancelInput = z.infer<typeof ScriptWorkspaceStreamCancelInputSchema>;
export type ScriptWorkspaceStreamEvent = z.infer<typeof ScriptWorkspaceStreamEventSchema>;
export type ScriptWorkspaceSaveInput = z.infer<typeof ScriptWorkspaceSaveInputSchema>;
export type ScriptWorkspaceSaveResult = z.infer<typeof ScriptWorkspaceSaveResultSchema>;
