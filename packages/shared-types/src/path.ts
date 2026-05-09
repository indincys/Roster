import { z } from "zod";

export const RelativeWorkspacePathSchema = z
  .string()
  .min(1)
  .refine((value) => !value.startsWith("/") && !/^[A-Za-z]:/.test(value), {
    message: "业务路径必须是相对路径"
  })
  .refine((value) => !value.split("/").includes(".."), {
    message: "业务路径不能越界"
  });

export type RelativeWorkspacePath = z.infer<typeof RelativeWorkspacePathSchema>;

export type TargetPlatform = "macos" | "windows";
