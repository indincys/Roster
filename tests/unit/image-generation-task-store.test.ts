// @vitest-environment jsdom

import { act, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  useImageGenerationTaskStore,
  type ImageGenerationTaskResult
} from "../../apps/desktop/renderer/src/stores/image-generation-task-store";
import type { ImageLibraryItem } from "@roster/shared-types";

function image(id: string): ImageLibraryItem {
  return {
    id,
    promptId: `prompt-${id}`,
    relativePath: `images/main/${id}.svg`,
    currentAbsolutePath: `/workspace/images/main/${id}.svg`,
    fileName: `${id}.svg`,
    scene: "主图",
    width: 1024,
    height: 1024,
    aspectRatio: "1:1",
    sourceModel: "mock/mock-image",
    status: "active",
    reviewStatus: "pending",
    tags: null,
    notes: null,
    generatedAt: "2026-05-25T00:00:00.000Z",
    createdAt: "2026-05-25T00:00:00.000Z",
    updatedAt: "2026-05-25T00:00:00.000Z"
  };
}

afterEach(() => {
  useImageGenerationTaskStore.setState({ tasks: [], selectedTaskId: null });
});

describe("image generation task store", () => {
  it("keeps a background task recoverable after the starter component is gone", async () => {
    let resolveTask: (value: ImageGenerationTaskResult) => void = () => undefined;
    const taskPromise = new Promise<ImageGenerationTaskResult>((resolve) => {
      resolveTask = resolve;
    });

    let taskId = "";
    act(() => {
      taskId = useImageGenerationTaskStore.getState().startTask({
        title: "文生图 · 单次",
        kind: "text",
        runMode: "single",
        expectedCount: 1,
        run: () => taskPromise
      });
    });

    expect(useImageGenerationTaskStore.getState().selectedTaskId).toBe(taskId);
    expect(useImageGenerationTaskStore.getState().tasks[0]).toMatchObject({
      id: taskId,
      status: "running",
      expectedCount: 1,
      imageIds: []
    });

    resolveTask({
      requested: 1,
      savedImages: [image("image-a")],
      failed: 0,
      errors: [],
      promptIds: ["prompt-image-a"]
    });

    await waitFor(() => expect(useImageGenerationTaskStore.getState().tasks[0]?.status).toBe("done"));
    expect(useImageGenerationTaskStore.getState().tasks[0]).toMatchObject({
      id: taskId,
      promptIds: ["prompt-image-a"],
      imageIds: ["image-a"],
      error: null
    });
  });

  it("tracks text and image generation as independent concurrent tasks", async () => {
    let resolveText: (value: ImageGenerationTaskResult) => void = () => undefined;
    let resolveImage: (value: ImageGenerationTaskResult) => void = () => undefined;
    const textPromise = new Promise<ImageGenerationTaskResult>((resolve) => {
      resolveText = resolve;
    });
    const imagePromise = new Promise<ImageGenerationTaskResult>((resolve) => {
      resolveImage = resolve;
    });

    act(() => {
      useImageGenerationTaskStore.getState().startTask({
        title: "文生图 · 批量",
        kind: "text",
        runMode: "batch",
        expectedCount: 2,
        run: () => textPromise
      });
      useImageGenerationTaskStore.getState().startTask({
        title: "图生图 · 单次",
        kind: "image",
        runMode: "single",
        expectedCount: 1,
        run: () => imagePromise
      });
    });

    expect(useImageGenerationTaskStore.getState().tasks.map((task) => task.status)).toEqual(["running", "running"]);

    resolveImage({ requested: 1, savedImages: [image("image-edit")], failed: 0, errors: [], promptIds: ["prompt-edit"] });
    await waitFor(() => expect(useImageGenerationTaskStore.getState().tasks.find((task) => task.kind === "image")?.status).toBe("done"));
    expect(useImageGenerationTaskStore.getState().tasks.find((task) => task.kind === "text")?.status).toBe("running");

    resolveText({
      requested: 2,
      savedImages: [image("image-text-a"), image("image-text-b")],
      failed: 0,
      errors: [],
      promptIds: ["prompt-text-a", "prompt-text-b"]
    });
    await waitFor(() => expect(useImageGenerationTaskStore.getState().tasks.every((task) => task.status === "done")).toBe(true));
  });
});
