import { z } from "zod";
import { SkillWorkflowTypeSchema } from "./skill";

export const SkillMarketManifestFileSchema = z.object({
  path: z.string().trim().min(1),
  sha256: z.string().trim().regex(/^[a-f0-9]{64}$/i, "sha256 必须是 64 位十六进制")
});

export const SkillMarketSkillSchema = z.object({
  name: z.string().trim().min(1),
  displayName: z.string().trim().min(1),
  type: SkillWorkflowTypeSchema,
  version: z.string().trim().min(1),
  description: z.string().trim().optional().default(""),
  defaultModel: z.string().trim().optional().nullable().default(null),
  supportedModels: z.array(z.string().trim().min(1)).optional().default([]),
  files: z.array(SkillMarketManifestFileSchema).min(2)
});

export const SkillMarketManifestSchema = z.object({
  manifestVersion: z.literal(1),
  updatedAt: z.string().trim().min(1),
  skills: z.array(SkillMarketSkillSchema)
});

export const SkillMarketListInputSchema = z.object({
  manifestUrl: z.string().trim().min(1).optional(),
  forceRefresh: z.boolean().optional().default(false)
});

export const SkillMarketInstallInputSchema = z.object({
  name: z.string().trim().min(1),
  manifestUrl: z.string().trim().min(1).optional()
});

export const SkillMarketEntrySchema = SkillMarketSkillSchema.extend({
  installedVersion: z.string().nullable(),
  status: z.enum(["not_installed", "installed", "update_available"]),
  updateAvailable: z.boolean()
});

export const SkillMarketStateSchema = z.object({
  manifestUrl: z.string().min(1),
  fetchedAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
  offline: z.boolean(),
  error: z.string().nullable(),
  skills: z.array(SkillMarketEntrySchema)
});

export const SkillMarketInstallResultSchema = z.object({
  skillId: z.string().min(1),
  name: z.string().min(1),
  version: z.string().min(1),
  rootPath: z.string().min(1),
  installedFiles: z.array(z.string().min(1))
});

export type SkillMarketManifestFile = z.infer<typeof SkillMarketManifestFileSchema>;
export type SkillMarketSkill = z.infer<typeof SkillMarketSkillSchema>;
export type SkillMarketManifest = z.infer<typeof SkillMarketManifestSchema>;
export type SkillMarketListInput = z.infer<typeof SkillMarketListInputSchema>;
export type SkillMarketInstallInput = z.infer<typeof SkillMarketInstallInputSchema>;
export type SkillMarketEntry = z.infer<typeof SkillMarketEntrySchema>;
export type SkillMarketState = z.infer<typeof SkillMarketStateSchema>;
export type SkillMarketInstallResult = z.infer<typeof SkillMarketInstallResultSchema>;
