import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Standalone vite config used for browser-only design preview (not the
// Electron app). `installPreviewStub` in main.tsx fills in window.roster so
// the renderer mounts without a preload. Run `npx vite` from this directory.
export default defineConfig({
  root: __dirname,
  plugins: [react()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
      "@roster/shared-types": resolve(__dirname, "../../../packages/shared-types/src/index.ts")
    }
  },
  server: {
    port: 5173,
    strictPort: true
  }
});
