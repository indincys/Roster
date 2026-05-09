import { z } from "zod";
import { ProviderIdSchema } from "./provider";

export const TitleWorkspaceModelSchema = z.object({
  provider: ProviderIdSchema,
  model: z.string().trim().min(1)
});

export const TitleWorkspaceGenerateInputSchema = z.object({
  skillId: z.string().trim().min(1),
  taskPrompt: z.string().trim().optional().default(""),
  count: z.number().int().min(1).max(100).default(20),
  models: z.array(TitleWorkspaceModelSchema).min(1)
});

export const TitleWorkspaceColumnResultSchema = z.object({
  columnId: z.string().min(1),
  provider: ProviderIdSchema,
  model: z.string().min(1),
  status: z.enum(["success", "failed"]),
  text: z.string(),
  titles: z.array(z.string()),
  error: z.string().nullable(),
  usage: z
    .object({
      inputTokens: z.number().int().nonnegative(),
      outputTokens: z.number().int().nonnegative(),
      totalTokens: z.number().int().nonnegative()
    })
    .nullable()
});

export const TitleWorkspaceGenerateResultSchema = z.object({
  skillId: z.string().min(1),
  columns: z.array(TitleWorkspaceColumnResultSchema)
});

export const TitleWorkspaceStreamStartResultSchema = z.object({
  streamId: z.string().min(1)
});

export const TitleWorkspaceStreamCancelInputSchema = z.object({
  streamId: z.string().min(1)
});

export const TitleWorkspaceStreamEventSchema = z.discriminatedUnion("type", [
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
    column: TitleWorkspaceColumnResultSchema
  }),
  z.object({
    type: z.literal("done"),
    streamId: z.string().min(1),
    canceled: z.boolean()
  })
]);

export const TitleWorkspaceSaveInputSchema = z.object({
  skillId: z.string().trim().min(1),
  titles: z.array(z.string().trim().min(1)).min(1),
  score: z.number().int().min(0).max(100).nullable().optional()
});

export const TitleWorkspaceSaveResultSchema = z.object({
  savedCount: z.number().int().nonnegative(),
  titleIds: z.array(z.string())
});

export type TitleWorkspaceModel = z.infer<typeof TitleWorkspaceModelSchema>;
export type TitleWorkspaceGenerateInput = z.infer<typeof TitleWorkspaceGenerateInputSchema>;
export type TitleWorkspaceColumnResult = z.infer<typeof TitleWorkspaceColumnResultSchema>;
export type TitleWorkspaceGenerateResult = z.infer<typeof TitleWorkspaceGenerateResultSchema>;
export type TitleWorkspaceStreamStartResult = z.infer<typeof TitleWorkspaceStreamStartResultSchema>;
export type TitleWorkspaceStreamCancelInput = z.infer<typeof TitleWorkspaceStreamCancelInputSchema>;
export type TitleWorkspaceStreamEvent = z.infer<typeof TitleWorkspaceStreamEventSchema>;
export type TitleWorkspaceSaveInput = z.infer<typeof TitleWorkspaceSaveInputSchema>;
export type TitleWorkspaceSaveResult = z.infer<typeof TitleWorkspaceSaveResultSchema>;
