import type { BootstrapState, RosterApi, SoftwareUpdateCheckResult } from "@roster/shared-types";

/**
 * Preview-only stub for `window.roster`. Active ONLY when running the renderer
 * in a plain browser (e.g. `vite serve`) for visual design preview. In real
 * Electron the preload script defines `window.roster` before this file runs,
 * so `installPreviewStub` is a no-op.
 */
export function installPreviewStub(): void {
  if (typeof window === "undefined") {
    return;
  }
  if ((window as unknown as { roster?: RosterApi }).roster) {
    return;
  }

  const now = new Date().toISOString();
  const makeWorkspace = (id: string, name: string, color: string, root: string): BootstrapState["workspace"]["workspaces"][number] => ({
    id,
    name,
    rootPath: root,
    macRootPath: root,
    winRootPath: root,
    color,
    isDefault: false,
    isReadOnly: false,
    lastOpenedAt: now,
    createdAt: now,
    updatedAt: now
  });
  const bootstrap: BootstrapState = {
    appVersion: "preview",
    platform: "darwin",
    userDataPath: "/preview",
    workspace: {
      activeWorkspaceId: "ws_warmlife",
      workspaces: [
        makeWorkspace("ws_warmlife", "暖心生活 · 主品牌", "#D97757", "/preview/warmlife"),
        makeWorkspace("ws_pillar", "pillar 设计 · 配饰线", "#7A5AE0", "/preview/pillar")
      ]
    },
    apiKeys: []
  };

  const idleUpdate: SoftwareUpdateCheckResult = {
    state: "idle",
    latestVersion: null,
    progressPercent: null,
    error: null
  } as SoftwareUpdateCheckResult;

  const noop = (): void => {};

  const fallback = (key: string) => {
    if (key === "getBootstrap") return () => Promise.resolve(bootstrap);
    if (key === "getUpdateState" || key === "checkForUpdates" || key === "downloadUpdate") {
      return () => Promise.resolve(idleUpdate);
    }
    if (key.startsWith("on") && key.endsWith("Event")) {
      return () => noop;
    }
    if (key.startsWith("list") || key.startsWith("scan") || key.startsWith("get")) {
      return () => Promise.resolve([]);
    }
    return () => Promise.resolve({});
  };

  const handler: ProxyHandler<Record<string, unknown>> = {
    get(_target, prop) {
      if (typeof prop !== "string") return undefined;
      return fallback(prop);
    }
  };

  (window as unknown as { roster: RosterApi }).roster = new Proxy({}, handler) as unknown as RosterApi;
}
