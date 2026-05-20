import { configDefaults, defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@roster/shared-types": path.resolve(__dirname, "packages/shared-types/src/index.ts"),
      "@roster/db": path.resolve(__dirname, "packages/db/src/index.ts"),
      "@roster/llm-providers": path.resolve(__dirname, "packages/llm-providers/src/index.ts"),
      "@roster/image-providers": path.resolve(__dirname, "packages/image-providers/src/index.ts"),
      "@roster/skill-engine": path.resolve(__dirname, "packages/skill-engine/src/index.ts"),
      "@roster/rpa-bridge": path.resolve(__dirname, "packages/rpa-bridge/src/index.ts"),
      "@roster/ffmpeg-utils": path.resolve(__dirname, "packages/ffmpeg-utils/src/index.ts"),
      "@": path.resolve(__dirname, "apps/desktop/renderer/src")
    }
  },
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    exclude: [...configDefaults.exclude, ".claude/**", ".codex/**"],
    coverage: {
      reporter: ["text", "html"]
    }
  }
});
