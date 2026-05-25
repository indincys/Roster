import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import type {
  ImageReferenceFolderInspectResult,
  ImageReferenceFolderTask,
  ImageReferenceInput
} from "@roster/shared-types";

export const MAX_REFERENCE_IMAGES_PER_TASK = 15;

const SUPPORTED_REFERENCE_IMAGE_EXTENSIONS = new Map([
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"]
]);

export function imageReferenceMimeType(filePath: string): string | null {
  return SUPPORTED_REFERENCE_IMAGE_EXTENSIONS.get(path.extname(filePath).toLowerCase()) ?? null;
}

export async function toImageReferenceInput(absolutePath: string): Promise<ImageReferenceInput | null> {
  const mimeType = imageReferenceMimeType(absolutePath);
  if (!mimeType) {
    return null;
  }
  const fileStat = await stat(absolutePath);
  if (!fileStat.isFile()) {
    return null;
  }
  return {
    absolutePath,
    fileName: path.basename(absolutePath),
    mimeType,
    sizeBytes: fileStat.size
  };
}

async function imageReferencesInDirectory(directoryPath: string): Promise<ImageReferenceInput[]> {
  const entries = await readdir(directoryPath, { withFileTypes: true });
  const references = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && imageReferenceMimeType(entry.name))
      .map((entry) => toImageReferenceInput(path.join(directoryPath, entry.name)))
  );
  return references.filter((reference): reference is ImageReferenceInput => Boolean(reference));
}

function makeReferenceTask(input: {
  id: string;
  name: string;
  folderPath: string | null;
  references: ImageReferenceInput[];
}): ImageReferenceFolderTask {
  const references = input.references.slice(0, MAX_REFERENCE_IMAGES_PER_TASK);
  return {
    id: input.id,
    name: input.name,
    folderPath: input.folderPath,
    references,
    skipped: Math.max(0, input.references.length - references.length)
  };
}

export async function inspectImageReferenceFolder(
  folderPath: string,
  mixedMode?: "root" | "subfolders" | "all"
): Promise<ImageReferenceFolderInspectResult> {
  const folderStat = await stat(folderPath);
  if (!folderStat.isDirectory()) {
    throw new Error("请选择图片文件夹");
  }
  const entries = await readdir(folderPath, { withFileTypes: true });
  const rootImages = await imageReferencesInDirectory(folderPath);
  const subfolderTasks: ImageReferenceFolderTask[] = [];
  for (const entry of entries.filter((item) => item.isDirectory())) {
    const subfolderPath = path.join(folderPath, entry.name);
    const references = await imageReferencesInDirectory(subfolderPath);
    if (references.length > 0) {
      subfolderTasks.push(
        makeReferenceTask({
          id: `folder-${entry.name}`,
          name: entry.name,
          folderPath: subfolderPath,
          references
        })
      );
    }
  }

  const rootTasks = rootImages.map((reference, index) =>
    makeReferenceTask({
      id: `root-${index}-${reference.fileName}`,
      name: reference.fileName,
      folderPath,
      references: [reference]
    })
  );
  const hasRoot = rootTasks.length > 0;
  const hasSubfolders = subfolderTasks.length > 0;
  const structure = hasRoot && hasSubfolders ? "mixed" : hasSubfolders ? "nested" : hasRoot ? "flat" : "empty";
  const requiresMixedMode = structure === "mixed" && !mixedMode;
  const tasks = requiresMixedMode
    ? []
    : structure === "mixed"
      ? mixedMode === "root"
        ? rootTasks
        : mixedMode === "subfolders"
          ? subfolderTasks
          : [...rootTasks, ...subfolderTasks]
      : structure === "nested"
        ? subfolderTasks
        : rootTasks;
  const skipped = tasks.reduce((sum, task) => sum + task.skipped, 0);
  return {
    canceled: false,
    folderPath,
    structure,
    requiresMixedMode,
    rootImages,
    subfolderTasks,
    tasks,
    skipped,
    warnings:
      skipped > 0
        ? [`每个图生图任务最多使用 ${MAX_REFERENCE_IMAGES_PER_TASK} 张参考图，已跳过 ${skipped} 张。`]
        : []
  };
}
