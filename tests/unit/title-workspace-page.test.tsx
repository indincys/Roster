// @vitest-environment jsdom

import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TitleWorkspacePage } from "../../apps/desktop/renderer/src/pages/TitleWorkspacePage";
import { useAppStore } from "../../apps/desktop/renderer/src/stores/app-store";
import type { AppSettings, SkillRecord } from "@roster/shared-types";
import { DEFAULT_LLM_PROVIDER_CONFIGS } from "@roster/shared-types";

function makeSettings(): AppSettings {
  return {
    scanFrequency: "manual",
    scanIntervalMinutes: 10,
    scanOnStartup: true,
    defaultExportFormats: ["xlsx", "csv", "json"],
    excelFieldNaming: "zh",
    softDeleteRetentionDays: 90,
    logRetentionDays: 90,
    apiLogRetentionDays: 365,
    providerConcurrencyLimit: 3,
    providerRetryCount: 3,
    providerRetryBaseDelayMs: 1000,
    llmProviderConfigs: [
      { ...DEFAULT_LLM_PROVIDER_CONFIGS.find((config) => config.id === "openai")!, enabled: true },
      { ...DEFAULT_LLM_PROVIDER_CONFIGS.find((config) => config.id === "deepseek")!, enabled: true }
    ],
    monthlyBudgetWarningCents: 0,
    backupScope: "all",
    backupRetentionCount: 7,
    backupFrequency: "manual",
    updateChannel: "stable"
  };
}

const titleSkill: SkillRecord = {
  id: "title-skill",
  displayName: "标题 Skill",
  type: "title",
  sourceType: "user",
  version: "0.1.0",
  description: "",
  defaultModel: null,
  supportedModels: [],
  origin: null,
  rootPath: "/tmp/title-skill",
  isEditable: true,
  isRestorable: false,
  isMissing: false,
  updatedAt: "2026-05-10T00:00:00.000Z"
};

function installWorkspaceState(): void {
  useAppStore.setState({
    bootstrap: {
      appVersion: "0.1.0",
      platform: "darwin",
      userDataPath: "/tmp/roster-user-data",
      apiKeys: [],
      workspace: {
        activeWorkspaceId: "workspace-1",
        workspaces: [
          {
            id: "workspace-1",
            name: "测试空间",
            rootPath: "/workspace",
            macRootPath: "/workspace",
            winRootPath: "D:\\workspace",
            color: "#2563eb",
            isDefault: true,
            isReadOnly: false,
            lastOpenedAt: null,
            createdAt: "2026-05-10T00:00:00.000Z",
            updatedAt: "2026-05-10T00:00:00.000Z"
          }
        ]
      }
    }
  });
}

describe("TitleWorkspacePage provider model rendering", () => {
  beforeEach(() => {
    installWorkspaceState();
  });

  it("renders only saved-key models and keeps secret-looking values out of the UI", async () => {
    window.roster = {
      listEnabledSkills: vi.fn(async () => [titleSkill]),
      getSettings: vi.fn(async () => makeSettings()),
      listApiKeys: vi.fn(async () => [
        {
          id: "deepseek-key",
          provider: "deepseek",
          label: "DeepSeek 主账号",
          model: "deepseek-chat",
          isDefault: true,
          createdAt: "2026-05-10T00:00:00.000Z",
          updatedAt: "2026-05-10T00:00:00.000Z"
        },
        {
          id: "leaked-key",
          provider: "deepseek",
          label: "DeepSeek 错误配置",
          model: "sk-2576628c6e1f4a08805a22ab97050000",
          isDefault: false,
          createdAt: "2026-05-10T00:00:00.000Z",
          updatedAt: "2026-05-10T00:00:00.000Z"
        }
      ]),
      onTitleWorkspaceStreamEvent: vi.fn(() => () => undefined),
      startTitleWorkspaceStream: vi.fn(),
      cancelTitleWorkspaceStream: vi.fn(),
      generateTitleWorkspace: vi.fn(),
      saveTitleWorkspaceSelection: vi.fn(),
      saveScheduledJob: vi.fn()
    } as unknown as Window["roster"];

    render(<TitleWorkspacePage />);

    await screen.findByText("deepseek/deepseek-chat");
    await waitFor(() => expect(screen.queryByText(/openai\/gpt-5\.4-mini/i)).not.toBeInTheDocument());
    expect(document.body.textContent).not.toContain("sk-2576628c");
  });

  it("requires score confirmation before saving selected titles", async () => {
    const saveTitleWorkspaceSelection = vi.fn(async () => ({ savedCount: 1, titleIds: ["title-1"] }));
    window.roster = {
      listEnabledSkills: vi.fn(async () => [titleSkill]),
      getSettings: vi.fn(async () => makeSettings()),
      listApiKeys: vi.fn(async () => [
        {
          id: "deepseek-key",
          provider: "deepseek",
          label: "DeepSeek 主账号",
          model: "deepseek-chat",
          isDefault: true,
          createdAt: "2026-05-10T00:00:00.000Z",
          updatedAt: "2026-05-10T00:00:00.000Z"
        }
      ]),
      onTitleWorkspaceStreamEvent: vi.fn((callback) => {
        callback({
          type: "started",
          streamId: "stream-1",
          columns: [{ columnId: "deepseek:deepseek-chat:0", provider: "deepseek", model: "deepseek-chat" }]
        });
        callback({
          type: "columnComplete",
          streamId: "stream-1",
          column: {
            columnId: "deepseek:deepseek-chat:0",
            provider: "deepseek",
            model: "deepseek-chat",
            status: "success",
            text: "1. 选中标题",
            titles: ["选中标题"],
            error: null,
            usage: null
          }
        });
        callback({ type: "done", streamId: "stream-1", canceled: false });
        return () => undefined;
      }),
      startTitleWorkspaceStream: vi.fn(async () => ({ streamId: "stream-1" })),
      cancelTitleWorkspaceStream: vi.fn(),
      generateTitleWorkspace: vi.fn(),
      saveTitleWorkspaceSelection,
      saveScheduledJob: vi.fn()
    } as unknown as Window["roster"];

    render(<TitleWorkspacePage />);

    fireEvent.click(await screen.findByText("选中标题"));
    fireEvent.click(screen.getByText("入库选中 1"));
    await screen.findByText("入标题库");
    fireEvent.change(screen.getByLabelText("爆款分数"), { target: { value: "8" } });
    fireEvent.click(screen.getByText("入库"));

    await waitFor(() =>
      expect(saveTitleWorkspaceSelection).toHaveBeenCalledWith({
        skillId: "title-skill",
        titles: ["选中标题"],
        score: 8
      })
    );
  });
});
