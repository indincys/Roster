import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { inspectImageReferenceFolder, toImageReferenceInput } from "../../apps/desktop/main/src/image-references";

const tempRoots: string[] = [];

async function makeRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "roster-reference-folder-"));
  tempRoots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("image reference folder inspection", () => {
  it("creates one task per root image for flat folders", async () => {
    const root = await makeRoot();
    await writeFile(path.join(root, "a.png"), "a");
    await writeFile(path.join(root, "b.webp"), "b");
    await writeFile(path.join(root, "ignored.txt"), "ignored");

    const result = await inspectImageReferenceFolder(root);

    expect(result.structure).toBe("flat");
    expect(result.requiresMixedMode).toBe(false);
    expect(result.tasks.map((task) => task.name).sort()).toEqual(["a.png", "b.webp"]);
    expect(result.tasks.every((task) => task.references.length === 1)).toBe(true);
  });

  it("groups direct child folders as nested reference tasks", async () => {
    const root = await makeRoot();
    await mkdir(path.join(root, "sku-a"));
    await mkdir(path.join(root, "sku-b"));
    await writeFile(path.join(root, "sku-a", "front.jpg"), "front");
    await writeFile(path.join(root, "sku-a", "side.jpeg"), "side");
    await writeFile(path.join(root, "sku-b", "main.png"), "main");

    const result = await inspectImageReferenceFolder(root);

    expect(result.structure).toBe("nested");
    expect(result.tasks.map((task) => task.name).sort()).toEqual(["sku-a", "sku-b"]);
    expect(result.tasks.find((task) => task.name === "sku-a")?.references).toHaveLength(2);
    expect(result.tasks.find((task) => task.name === "sku-b")?.references).toHaveLength(1);
  });

  it("requires a mixed-mode decision when root images and subfolder groups both exist", async () => {
    const root = await makeRoot();
    await mkdir(path.join(root, "group"));
    await writeFile(path.join(root, "root.png"), "root");
    await writeFile(path.join(root, "group", "ref.png"), "ref");

    const initial = await inspectImageReferenceFolder(root);
    const rootOnly = await inspectImageReferenceFolder(root, "root");
    const subfoldersOnly = await inspectImageReferenceFolder(root, "subfolders");
    const all = await inspectImageReferenceFolder(root, "all");

    expect(initial).toMatchObject({ structure: "mixed", requiresMixedMode: true, tasks: [] });
    expect(rootOnly.tasks.map((task) => task.name)).toEqual(["root.png"]);
    expect(subfoldersOnly.tasks.map((task) => task.name)).toEqual(["group"]);
    expect(all.tasks.map((task) => task.name).sort()).toEqual(["group", "root.png"]);
  });

  it("limits each reference task to fifteen images", async () => {
    const root = await makeRoot();
    await mkdir(path.join(root, "oversized"));
    await Promise.all(
      Array.from({ length: 17 }, (_, index) => writeFile(path.join(root, "oversized", `ref-${index}.png`), "ref"))
    );

    const result = await inspectImageReferenceFolder(root);

    expect(result.structure).toBe("nested");
    expect(result.tasks[0]?.references).toHaveLength(15);
    expect(result.skipped).toBe(2);
    expect(result.warnings[0]).toContain("最多使用 15 张参考图");
  });

  it("reads file metadata for supported local reference images only", async () => {
    const root = await makeRoot();
    const imagePath = path.join(root, "reference.jpeg");
    const unsupportedPath = path.join(root, "reference.gif");
    await writeFile(imagePath, "jpeg");
    await writeFile(unsupportedPath, "gif");

    await expect(toImageReferenceInput(unsupportedPath)).resolves.toBeNull();
    await expect(toImageReferenceInput(imagePath)).resolves.toMatchObject({
      absolutePath: imagePath,
      fileName: "reference.jpeg",
      mimeType: "image/jpeg",
      sizeBytes: 4
    });
  });
});
