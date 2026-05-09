import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";

export default defineConfig({
  main: {
    plugins: [
      externalizeDepsPlugin({
        include: ["better-sqlite3", "electron-updater"],
        exclude: ["@roster/shared-types", "@roster/db", "@roster/ffmpeg-utils", "@roster/image-providers", "@roster/llm-providers", "@roster/skill-engine", "fluent-ffmpeg"]
      })
    ],
    build: {
      rollupOptions: {
        input: resolve(__dirname, "main/src/index.ts")
      }
    },
    resolve: {
      alias: {
        "@roster/shared-types": resolve(__dirname, "../../packages/shared-types/src/index.ts"),
        "@roster/db": resolve(__dirname, "../../packages/db/src/index.ts"),
        "@roster/ffmpeg-utils": resolve(__dirname, "../../packages/ffmpeg-utils/src/index.ts")
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin({ exclude: ["@roster/shared-types"] })],
    build: {
      rollupOptions: {
        input: resolve(__dirname, "preload/src/index.ts")
      }
    },
    resolve: {
      alias: {
        "@roster/shared-types": resolve(__dirname, "../../packages/shared-types/src/index.ts")
      }
    }
  },
  renderer: {
    root: resolve(__dirname, "renderer"),
    plugins: [react()],
    build: {
      rollupOptions: {
        input: resolve(__dirname, "renderer/index.html")
      }
    },
    resolve: {
      alias: {
        "@": resolve(__dirname, "renderer/src"),
        "@roster/shared-types": resolve(__dirname, "../../packages/shared-types/src/index.ts")
      }
    }
  }
});
