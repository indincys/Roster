import { create } from "zustand";
import type { ImageLibraryItem, ImageWorkspaceGenerateResult } from "@roster/shared-types";

export type ImageGenerationTaskKind = "text" | "image";
export type ImageGenerationTaskRunMode = "single" | "batch";
export type ImageGenerationTaskStatus = "running" | "done" | "failed";

export interface ImageGenerationTaskResult extends ImageWorkspaceGenerateResult {
  promptIds?: string[];
}

export interface ImageGenerationTask {
  id: string;
  title: string;
  kind: ImageGenerationTaskKind;
  runMode: ImageGenerationTaskRunMode;
  status: ImageGenerationTaskStatus;
  expectedCount: number;
  promptIds: string[];
  imageIds: string[];
  error: string | null;
  createdAt: string;
  updatedAt: string;
  finishedAt: string | null;
}

interface ImageGenerationTaskStartInput {
  title: string;
  kind: ImageGenerationTaskKind;
  runMode: ImageGenerationTaskRunMode;
  expectedCount: number;
  run: () => Promise<ImageGenerationTaskResult>;
}

interface ImageGenerationTaskStore {
  tasks: ImageGenerationTask[];
  selectedTaskId: string | null;
  startTask(input: ImageGenerationTaskStartInput): string;
  selectTask(taskId: string): void;
  clearFinished(): void;
}

function taskId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `image-task-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function notifyTask(task: ImageGenerationTask): void {
  if (typeof window === "undefined" || typeof window.Notification === "undefined") {
    return;
  }
  const title = task.status === "failed" ? "图片生成失败" : "图片生成完成";
  const body = task.status === "failed" ? task.error ?? task.title : `${task.title}，${task.imageIds.length} 张图片待处理`;
  const show = (): void => {
    new window.Notification(title, { body });
  };
  if (window.Notification.permission === "granted") {
    show();
  } else if (window.Notification.permission !== "denied") {
    void window.Notification.requestPermission().then((permission) => {
      if (permission === "granted") {
        show();
      }
    });
  }
}

function imageIdsFromResult(images: ImageLibraryItem[]): string[] {
  return images.map((image) => image.id);
}

export const useImageGenerationTaskStore = create<ImageGenerationTaskStore>((set, get) => ({
  tasks: [],
  selectedTaskId: null,
  startTask: (input) => {
    const id = taskId();
    const timestamp = new Date().toISOString();
    const task: ImageGenerationTask = {
      id,
      title: input.title,
      kind: input.kind,
      runMode: input.runMode,
      status: "running",
      expectedCount: input.expectedCount,
      promptIds: [],
      imageIds: [],
      error: null,
      createdAt: timestamp,
      updatedAt: timestamp,
      finishedAt: null
    };
    set((state) => ({ tasks: [task, ...state.tasks], selectedTaskId: id }));
    void input
      .run()
      .then((result) => {
        const finishedAt = new Date().toISOString();
        const error = result.errors.length > 0 ? result.errors.join("；") : null;
        let nextTask: ImageGenerationTask | null = null;
        set((state) => ({
          tasks: state.tasks.map((item) => {
            if (item.id !== id) {
              return item;
            }
            nextTask = {
              ...item,
              status: result.savedImages.length > 0 ? "done" : "failed",
              promptIds: result.promptIds ?? item.promptIds,
              imageIds: imageIdsFromResult(result.savedImages),
              error,
              updatedAt: finishedAt,
              finishedAt
            };
            return nextTask;
          })
        }));
        if (nextTask) {
          notifyTask(nextTask);
        }
      })
      .catch((error) => {
        const finishedAt = new Date().toISOString();
        let nextTask: ImageGenerationTask | null = null;
        set((state) => ({
          tasks: state.tasks.map((item) => {
            if (item.id !== id) {
              return item;
            }
            nextTask = {
              ...item,
              status: "failed",
              error: error instanceof Error ? error.message : String(error),
              updatedAt: finishedAt,
              finishedAt
            };
            return nextTask;
          })
        }));
        if (nextTask) {
          notifyTask(nextTask);
        }
      });
    return id;
  },
  selectTask: (taskId) => {
    if (!get().tasks.some((task) => task.id === taskId)) {
      return;
    }
    set({ selectedTaskId: taskId });
  },
  clearFinished: () =>
    set((state) => {
      const tasks = state.tasks.filter((task) => task.status === "running");
      return {
        tasks,
        selectedTaskId: tasks.some((task) => task.id === state.selectedTaskId) ? state.selectedTaskId : tasks[0]?.id ?? null
      };
    })
}));
