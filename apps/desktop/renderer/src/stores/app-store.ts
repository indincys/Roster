import { create } from "zustand";
import type {
  ApiKeyPublicRecord,
  BootstrapState,
  SoftwareUpdateCheckResult,
  WorkspaceCreateInput,
  WorkspaceRecord
} from "@roster/shared-types";

export type AppPage =
  | "dashboard"
  | "tasks"
  | "titles"
  | "images"
  | "covers"
  | "scripts"
  | "lib_videos"
  | "lib_tags"
  | "lib_titles"
  | "lib_scripts"
  | "lib_prompts"
  | "lib_images"
  | "skills"
  | "market"
  | "schedules"
  | "settings"
  | "feedback";

interface AppStore {
  bootstrap: BootstrapState | null;
  updateState: SoftwareUpdateCheckResult | null;
  page: AppPage;
  loading: boolean;
  error: string | null;
  setPage(page: AppPage): void;
  setUpdateState(updateState: SoftwareUpdateCheckResult): void;
  loadUpdateState(): Promise<void>;
  checkForUpdates(): Promise<SoftwareUpdateCheckResult>;
  downloadUpdate(): Promise<SoftwareUpdateCheckResult>;
  installUpdate(): Promise<void>;
  loadBootstrap(): Promise<void>;
  createWorkspace(input: WorkspaceCreateInput): Promise<void>;
  switchWorkspace(workspaceId: string): Promise<void>;
  saveApiKey(input: { provider: "openai" | "anthropic" | "google" | "mock"; label: string; apiKey: string }): Promise<ApiKeyPublicRecord>;
}

export function activeWorkspace(bootstrap: BootstrapState | null): WorkspaceRecord | null {
  if (!bootstrap?.workspace.activeWorkspaceId) {
    return null;
  }
  return bootstrap.workspace.workspaces.find((workspace) => workspace.id === bootstrap.workspace.activeWorkspaceId) ?? null;
}

export const useAppStore = create<AppStore>((set, get) => ({
  bootstrap: null,
  updateState: null,
  page: "dashboard",
  loading: false,
  error: null,
  setPage: (page) => set({ page }),
  setUpdateState: (updateState) => set({ updateState }),
  loadUpdateState: async () => {
    const updateState = await window.roster.getUpdateState();
    set({ updateState });
  },
  checkForUpdates: async () => {
    const updateState = await window.roster.checkForUpdates({ forceRefresh: true });
    set({ updateState });
    return updateState;
  },
  downloadUpdate: async () => {
    const updateState = await window.roster.downloadUpdate();
    set({ updateState });
    return updateState;
  },
  installUpdate: async () => {
    await window.roster.installUpdate();
  },
  loadBootstrap: async () => {
    set({ loading: true, error: null });
    try {
      const bootstrap = await window.roster.getBootstrap();
      set({ bootstrap, loading: false });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error), loading: false });
    }
  },
  createWorkspace: async (input) => {
    set({ loading: true, error: null });
    try {
      const workspace = await window.roster.createWorkspace(input);
      const current = get().bootstrap;
      set({
        bootstrap: current ? { ...current, workspace } : null,
        page: "dashboard",
        loading: false
      });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error), loading: false });
      throw error;
    }
  },
  switchWorkspace: async (workspaceId) => {
    set({ loading: true, error: null });
    try {
      const workspace = await window.roster.switchWorkspace(workspaceId);
      const current = get().bootstrap;
      set({
        bootstrap: current ? { ...current, workspace } : null,
        page: "dashboard",
        loading: false
      });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error), loading: false });
      throw error;
    }
  },
  saveApiKey: async (input) => {
    const saved = await window.roster.saveApiKey(input);
    const apiKeys = await window.roster.listApiKeys();
    const current = get().bootstrap;
    if (current) {
      set({ bootstrap: { ...current, apiKeys } });
    }
    return saved;
  }
}));
