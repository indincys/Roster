// @vitest-environment jsdom

import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { LibraryPage } from "../../apps/desktop/renderer/src/pages/LibraryPage";
import { TasksPage } from "../../apps/desktop/renderer/src/pages/TasksPage";
import { VideoLibraryPage } from "../../apps/desktop/renderer/src/pages/VideoLibraryPage";
import { useAppStore } from "../../apps/desktop/renderer/src/stores/app-store";
import type { ImageLibraryItem, PlatformAccountRecord, TaskRowRecord, TaskSheetRecord, VideoLibraryItem } from "@roster/shared-types";

vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: ({ count, estimateSize }: { count: number; estimateSize: () => number }) => {
    const size = estimateSize();
    return {
      getTotalSize: () => count * size,
      getVirtualItems: () =>
        Array.from({ length: Math.min(count, 24) }, (_, index) => ({
          index,
          key: index,
          start: index * size,
          size
        })),
      measure: vi.fn()
    };
  }
}));

function makeVideo(index: number): VideoLibraryItem {
  const id = `video-${index}`;
  return {
    id,
    relativePath: `videos/SKU-${index}/style-${index}.mp4`,
    fileName: `style-${index}.mp4`,
    sku: `SKU-${index}`,
    style: `style-${index}`,
    durationSeconds: 12,
    width: 1080,
    height: 1920,
    sizeBytes: 1024,
    status: "active",
    thumbnailRelativePath: null,
    thumbnailAbsolutePath: null,
    thumbnailUrl: null,
    previewUrl: null,
    currentAbsolutePath: `/workspace/videos/SKU-${index}/style-${index}.mp4`,
    hasCover: false,
    usedCount: 0,
    note: null,
    metadataError: null,
    lastScannedAt: null,
    lastUsedAt: null,
    createdAt: "2026-05-09T00:00:00.000Z",
    updatedAt: "2026-05-09T00:00:00.000Z"
  };
}

function makeImage(index: number): ImageLibraryItem {
  const id = `image-${index}`;
  return {
    id,
    promptId: null,
    relativePath: `images/main/SKU-${index}.jpg`,
    currentAbsolutePath: `/workspace/images/main/SKU-${index}.jpg`,
    fileName: `SKU-${index}.jpg`,
    scene: "主图",
    width: 1024,
    height: 1365,
    aspectRatio: "3:4",
    sourceModel: "mock-image",
    status: "active",
    tags: null,
    notes: null,
    generatedAt: null,
    createdAt: "2026-05-09T00:00:00.000Z",
    updatedAt: "2026-05-09T00:00:00.000Z"
  };
}

function makePlatformAccount(index: number): PlatformAccountRecord {
  return {
    id: `account-${index}`,
    platform: ["抖音", "视频号", "小红书", "快手"][index % 4] ?? `平台${index}`,
    accountName: `账号${index}`,
    enabled: true,
    createdAt: "2026-05-09T00:00:00.000Z",
    updatedAt: "2026-05-09T00:00:00.000Z"
  };
}

function makeTaskRow(index: number): TaskRowRecord {
  const account = makePlatformAccount(index);
  return {
    id: `task-${index}`,
    sheetId: "sheet-1",
    runKey: `task-${index}__attempt-1`,
    attemptNo: 1,
    sheetDate: "2026-05-09",
    publishAt: `2026-05-09T${String(index % 24).padStart(2, "0")}:00:00`,
    status: "pending",
    videoId: `video-${index}`,
    videoRelativePath: `videos/SKU-${index}/video-${index}.mp4`,
    videoFileName: `video-${index}.mp4`,
    sku: `SKU-${index}`,
    style: null,
    platformAccountId: account.id,
    platform: account.platform,
    accountName: account.accountName,
    titleId: `title-${index}`,
    titleText: `任务标题 ${index}`,
    tagGroup: index % 5 === 0 ? "test" : "default",
    tags: [`标签${index}`],
    coverRelativePath: null,
    errorCode: null,
    errorMessage: null,
    createdAt: "2026-05-09T00:00:00.000Z",
    updatedAt: "2026-05-09T00:00:00.000Z"
  };
}

function makeTaskSheet(count: number, overrides: Partial<TaskRowRecord> = {}): TaskSheetRecord {
  return {
    id: "sheet-1",
    sheetDate: "2026-05-09",
    name: "2026-05-09 任务单",
    status: "draft",
    exportRelativeDir: null,
    rows: Array.from({ length: count }, (_, index) => ({ ...makeTaskRow(index), ...overrides })),
    createdAt: "2026-05-09T00:00:00.000Z",
    updatedAt: "2026-05-09T00:00:00.000Z"
  };
}

function cloneTaskSheetWithStatus(sheet: TaskSheetRecord, status: TaskRowRecord["status"]): TaskSheetRecord {
  return {
    ...sheet,
    rows: sheet.rows.map((row, index) => (index === 0 ? { ...row, status } : row))
  };
}

function cloneTaskSheetWithDate(sheet: TaskSheetRecord, sheetDate: string): TaskSheetRecord {
  return {
    ...sheet,
    sheetDate,
    name: `${sheetDate} 任务单`,
    rows: sheet.rows.map((row) => ({
      ...row,
      sheetDate,
      publishAt: row.publishAt.replace(/^\d{4}-\d{2}-\d{2}/, sheetDate)
    }))
  };
}

function installResizeObserver(): void {
  class ResizeObserverMock {
    constructor(private readonly callback: ResizeObserverCallback) {}
    observe(target: Element): void {
      this.callback(
        [
          {
            target,
            contentRect: {
              x: 0,
              y: 0,
              width: 960,
              height: 360,
              top: 0,
              right: 960,
              bottom: 360,
              left: 0,
              toJSON: () => ({})
            },
            borderBoxSize: [],
            contentBoxSize: [],
            devicePixelContentBoxSize: []
          }
        ],
        this
      );
    }
    unobserve(): void {}
    disconnect(): void {}
  }
  window.ResizeObserver = ResizeObserverMock;
  Element.prototype.getBoundingClientRect = () => ({
    x: 0,
    y: 0,
    width: 960,
    height: 360,
    top: 0,
    right: 960,
    bottom: 360,
    left: 0,
    toJSON: () => ({})
  });
}

function makeRosterApiStub(): Window["roster"] {
  return {
    getBootstrap: vi.fn(),
    createWorkspace: vi.fn(),
    updateWorkspace: vi.fn(),
    deleteWorkspace: vi.fn(),
    switchWorkspace: vi.fn(),
    chooseWorkspaceDirectory: vi.fn(),
    validateWorkspacePaths: vi.fn(),
    checkWorkspaceCloudSync: vi.fn(),
    listVideos: vi.fn(),
    scanVideos: vi.fn(),
    updateVideo: vi.fn(),
    listTags: vi.fn(),
    importTagsCsv: vi.fn(),
    saveTag: vi.fn(),
    listTitles: vi.fn(),
    saveTitle: vi.fn(),
    listPrompts: vi.fn(),
    savePrompt: vi.fn(),
    listImages: vi.fn(),
    saveImage: vi.fn(),
    listScripts: vi.fn(),
    saveScript: vi.fn(),
    listPlatformAccounts: vi.fn(),
    savePlatformAccount: vi.fn(),
    getTaskSheetByDate: vi.fn(),
    generateTaskSheet: vi.fn(),
    exportTaskSheet: vi.fn(),
    scanTaskStatusFiles: vi.fn(),
    retryTaskRow: vi.fn(),
    markTaskRowStatus: vi.fn(),
    updateTaskRow: vi.fn(),
    deleteTaskRow: vi.fn(),
    addTaskRow: vi.fn(),
    batchReplaceTaskTitles: vi.fn(),
    saveApiKey: vi.fn(),
    listApiKeys: vi.fn(),
    auditApiKeyStorage: vi.fn()
  };
}

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
            name: "测试品牌",
            rootPath: "/workspace",
            macRootPath: "/workspace",
            winRootPath: "D:\\workspace",
            videoLibraryRootPath: "",
            videoLibraryMacRootPath: "",
            videoLibraryWinRootPath: "",
            color: "#2563eb",
            isDefault: true,
            isReadOnly: false,
            lastOpenedAt: null,
            createdAt: "2026-05-09T00:00:00.000Z",
            updatedAt: "2026-05-09T00:00:00.000Z"
          }
        ]
      }
    }
  });
}

describe("database virtualized rendering", () => {
  beforeAll(() => {
    installResizeObserver();
  });

  it("keeps the video library DOM bounded with 10000 records", async () => {
    const videos = Array.from({ length: 10_000 }, (_, index) => makeVideo(index));
    window.roster = {
      ...makeRosterApiStub(),
      listVideos: vi.fn(async () => videos),
      scanVideos: vi.fn(async () => ({ scanned: 0, added: 0, updated: 0, archived: 0, failedMetadata: 0, placeholders: 0 })),
      updateVideo: vi.fn(async (input) => videos.find((video) => video.id === input.videoId) ?? videos[0])
    };
    installWorkspaceState();

    render(<VideoLibraryPage />);

    await screen.findByText("style-0.mp4");
    await waitFor(() => expect(screen.queryByText("style-9999.mp4")).not.toBeInTheDocument());
    expect(document.querySelectorAll("[data-video-row]").length).toBeLessThan(120);
  });

  it("keeps the image library DOM bounded with 500 records", async () => {
    const images = Array.from({ length: 500 }, (_, index) => makeImage(index));
    window.roster = {
      ...makeRosterApiStub(),
      listImages: vi.fn(async () => images),
      saveImage: vi.fn(async (input) => images.find((image) => image.id === input.imageId) ?? images[0])
    };

    render(<LibraryPage page="lib_images" />);

    await screen.findByText("SKU-0.jpg");
    await waitFor(() => expect(screen.queryByText("SKU-499.jpg")).not.toBeInTheDocument());
    expect(document.querySelectorAll("[data-image-row]").length).toBeLessThan(120);

    fireEvent.change(screen.getByLabelText("搜索图片库"), { target: { value: "SKU-499" } });
    await screen.findByText("SKU-499.jpg");
  });

  it("keeps the task sheet DOM bounded with 1000 task rows", async () => {
    const sheet = makeTaskSheet(1_000);
    const accounts = Array.from({ length: 4 }, (_, index) => makePlatformAccount(index));
    window.roster = {
      ...makeRosterApiStub(),
      listPlatformAccounts: vi.fn(async () => accounts),
      getTaskSheetByDate: vi.fn(async () => sheet),
      generateTaskSheet: vi.fn(async () => sheet)
    };
    installWorkspaceState();

    render(<TasksPage />);

    await screen.findByText("任务标题 0");
    await waitFor(() => expect(screen.queryByText("任务标题 999")).not.toBeInTheDocument());
    expect(document.querySelectorAll("[data-task-row]").length).toBeLessThan(120);
  });

  it("polls task status files every 5 seconds and highlights changed rows", async () => {
    const initialSheet = makeTaskSheet(1);
    const updatedSheet = cloneTaskSheetWithStatus(initialSheet, "success");
    const accounts = [makePlatformAccount(0)];
    let intervalHandler: TimerHandler | null = null;
    const setIntervalSpy = vi.spyOn(window, "setInterval").mockImplementation((handler: TimerHandler) => {
      intervalHandler = handler;
      return 1;
    });
    const clearIntervalSpy = vi.spyOn(window, "clearInterval").mockImplementation(() => undefined);
    const scanTaskStatusFiles = vi.fn(async () => ({
      sheetDate: "2026-05-09",
      scanned: 1,
      processed: 1,
      duplicates: 0,
      ignoredTmp: 0,
      errors: []
    }));
    const getTaskSheetByDate = vi.fn(async () => (scanTaskStatusFiles.mock.calls.length > 0 ? updatedSheet : initialSheet));
    window.roster = {
      ...makeRosterApiStub(),
      listPlatformAccounts: vi.fn(async () => accounts),
      getTaskSheetByDate,
      generateTaskSheet: vi.fn(async () => initialSheet),
      scanTaskStatusFiles
    };
    installWorkspaceState();

    render(<TasksPage />);

    await screen.findByText("待执行");
    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 5_000);
    expect(intervalHandler).toEqual(expect.any(Function));
    await act(async () => {
      if (typeof intervalHandler === "function") {
        intervalHandler();
      }
    });
    await waitFor(() => expect(screen.getAllByText("成功").length).toBeGreaterThanOrEqual(2));
    expect(scanTaskStatusFiles).toHaveBeenCalledWith({ sheetDate: expect.any(String) });
    expect(document.querySelector("[data-task-row]")?.className).toContain("bg-amber-50");
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 1_050));
    });
    await waitFor(() => expect(document.querySelector("[data-task-row]")?.className).not.toContain("bg-amber-50"));
    setIntervalSpy.mockRestore();
    clearIntervalSpy.mockRestore();
  });

  it("batch replaces only selected task row titles", async () => {
    const initialSheet = makeTaskSheet(2);
    const replacedSheet: TaskSheetRecord = {
      ...initialSheet,
      rows: initialSheet.rows.map((row, index) =>
        index === 0 ? { ...row, titleId: "title-replaced", titleText: "批量换后的标题" } : row
      )
    };
    const accounts = [makePlatformAccount(0)];
    const batchReplaceTaskTitles = vi.fn(async () => replacedSheet);
    window.roster = {
      ...makeRosterApiStub(),
      listPlatformAccounts: vi.fn(async () => accounts),
      getTaskSheetByDate: vi.fn(async () => initialSheet),
      batchReplaceTaskTitles
    };
    installWorkspaceState();

    render(<TasksPage />);

    await screen.findByText("任务标题 0");
    fireEvent.click(screen.getByLabelText("选择任务 T-task-0"));
    fireEvent.click(screen.getByRole("button", { name: "换标题 (1)" }));

    await waitFor(() =>
      expect(batchReplaceTaskTitles).toHaveBeenCalledWith({
        sheetDate: expect.any(String),
        taskIds: ["task-0"],
        titleStrategy: "best_score"
      })
    );
    await screen.findByText("批量换后的标题");
    expect(screen.getByText("任务标题 1")).toBeInTheDocument();
  });

  it("keeps historical task sheets read-only but exportable", async () => {
    const historicalSheet = cloneTaskSheetWithDate(makeTaskSheet(1), "2026-05-08");
    const accounts = [makePlatformAccount(0)];
    const generateTaskSheet = vi.fn(async () => historicalSheet);
    const batchReplaceTaskTitles = vi.fn(async () => historicalSheet);
    const scanTaskStatusFiles = vi.fn(async () => ({
      sheetDate: "2026-05-08",
      scanned: 0,
      processed: 0,
      duplicates: 0,
      ignoredTmp: 0,
      errors: []
    }));
    const exportTaskSheet = vi.fn(async () => ({
      sheetDate: "2026-05-08",
      exportRelativeDir: "tasks/2026-05-08",
      exportAbsoluteDir: "/workspace/tasks/2026-05-08",
      statusRelativeDir: "tasks/2026-05-08/status",
      statusAbsoluteDir: "/workspace/tasks/2026-05-08/status",
      writtenFiles: ["tasks/2026-05-08/tasks.json"],
      preflight: {
        schemaVersion: 1,
        generatedOn: "macos" as const,
        targetPlatform: "windows" as const,
        workspaceId: "workspace-1",
        taskDate: "2026-05-08",
        items: []
      },
      warnings: []
    }));
    window.roster = {
      ...makeRosterApiStub(),
      listPlatformAccounts: vi.fn(async () => accounts),
      getTaskSheetByDate: vi.fn(async () => historicalSheet),
      generateTaskSheet,
      exportTaskSheet,
      scanTaskStatusFiles,
      batchReplaceTaskTitles
    };
    installWorkspaceState();

    render(<TasksPage />);

    fireEvent.change(screen.getByLabelText("任务日期"), { target: { value: "2026-05-08" } });
    await screen.findByText("历史任务单只读，可重新导出；不能重新生成、编辑、换标题、添加删除或手动改状态。");
    expect(screen.getByRole("button", { name: "重新生成" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "扫描状态" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "换标题" })).toBeDisabled();
    expect(screen.getByLabelText("选择任务 T-task-0")).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "导出" }));

    await waitFor(() =>
      expect(exportTaskSheet).toHaveBeenCalledWith({
        sheetDate: "2026-05-08",
        formats: ["xlsx", "csv", "json"],
        targetPlatform: "windows"
      })
    );
    expect(generateTaskSheet).not.toHaveBeenCalled();
    expect(batchReplaceTaskTitles).not.toHaveBeenCalled();
    expect(scanTaskStatusFiles).not.toHaveBeenCalled();
  });
});
