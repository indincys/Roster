import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CalendarClock,
  Check,
  Folder,
  Image as ImageIcon,
  Info,
  LayoutGrid,
  Library,
  Settings,
  Sparkles,
  Upload,
  X,
  Zap
} from "lucide-react";
import {
  IMAGE_GENERATION_PROMPT_MAX_LENGTH,
  IMAGE_GENERATION_RESOLUTIONS_BY_ASPECT_RATIO,
  imageGenerationSize,
  type AppSettings,
  type ImageGenerationOutputFormat,
  type ImageGenerationQuality,
  type ImageGenerationResolution,
  type ImageLibraryItem,
  type ImageReferenceFolderMixedMode,
  type ImageReferenceFolderTask,
  type ImageReferenceInput,
  type ImageSceneAspectRatio,
  type ImageSceneOutputSubdir,
  type ImageStudioResultHandling,
  type ImageWorkspaceGenerationStrategy,
  type PromptRecord
} from "@roster/shared-types";
import { configuredImageModelsFromApiKeys, type ImageModelOption } from "@/lib/provider-options";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/app-store";
import { useImageGenerationTaskStore, type ImageGenerationTask } from "@/stores/image-generation-task-store";
import { imageOptionKey, imageOptionToTarget, Photo, ProviderGrid, Tile } from "./image-studio/components";

const ASPECT_RATIOS: ImageSceneAspectRatio[] = ["1:1", "3:4", "9:16", "16:9"];
const IMAGE_COUNT_OPTIONS = [1, 2, 3, 4, 5, 6, 8, 10];
const QUALITY_OPTIONS: ImageGenerationQuality[] = ["auto", "low", "medium", "high"];
const OUTPUT_FORMAT_OPTIONS: ImageGenerationOutputFormat[] = ["png", "jpeg", "webp"];
const OUTPUT_SUBDIRS: ImageSceneOutputSubdir[] = ["main", "detail", "live_cover"];

type PrimaryMode = "text" | "image";
type RunMode = "single" | "batch";
type PromptSource = "manual" | "library";
type BatchPromptMode = "all" | "manual" | "scene";
type PairingMode = "many_to_many" | "one_to_one";
type GenerationStatus = "idle" | "running" | "done" | "error";

interface ReviewImage {
  image: ImageLibraryItem;
  prompt: PromptRecord | null;
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}

function normalizeResolutionForRatio(
  ratio: ImageSceneAspectRatio,
  current: ImageGenerationResolution
): ImageGenerationResolution {
  return IMAGE_GENERATION_RESOLUTIONS_BY_ASPECT_RATIO[ratio].includes(current)
    ? current
    : IMAGE_GENERATION_RESOLUTIONS_BY_ASPECT_RATIO[ratio][0];
}

function resultHandlingLabel(value: ImageStudioResultHandling): string {
  return value === "manual_review" ? "人工验收后入库" : "生成后自动入库";
}

function referenceFromDroppedFile(file: File): ImageReferenceInput | null {
  const filePath = (file as File & { path?: string }).path;
  if (!filePath) {
    return null;
  }
  const extension = file.name.toLowerCase().split(".").pop() ?? "";
  const mimeType =
    file.type ||
    (extension === "png"
      ? "image/png"
      : extension === "webp"
        ? "image/webp"
        : extension === "jpg" || extension === "jpeg"
          ? "image/jpeg"
          : "");
  if (!["png", "jpg", "jpeg", "webp"].includes(extension) || !mimeType) {
    return null;
  }
  return {
    absolutePath: filePath,
    fileName: file.name,
    mimeType,
    sizeBytes: file.size
  };
}

function StudioHead({
  activeImages,
  pendingImages,
  resultHandling,
  onCreateSchedule,
  onOpenSettings
}: {
  activeImages: number;
  pendingImages: number;
  resultHandling: ImageStudioResultHandling;
  onCreateSchedule: () => void;
  onOpenSettings: () => void;
}): JSX.Element {
  return (
    <div className="studio-head">
      <div>
        <div className="title">
          图片工作室
          <span className="chip brand dot" style={{ fontSize: 10 }}>
            文生图 · 图生图
          </span>
        </div>
        <div className="desc">用提示词库和本地参考图生成图片，生成结果按设置进入自动入库或人工验收。</div>
      </div>
      <div className="head-actions">
        <div className="head-meta">
          <div className="meta-item">
            <span className="muted-2">可用图片</span>
            <b>{activeImages}</b>
          </div>
          <div className="meta-item">
            <span className="muted-2">待验收</span>
            <b>{pendingImages}</b>
          </div>
          <div className="meta-item">
            <span className="muted-2">结果处理</span>
            <b>{resultHandling === "manual_review" ? "人工" : "自动"}</b>
          </div>
        </div>
        <button type="button" className="btn ghost" onClick={onCreateSchedule} data-create-image-schedule>
          <CalendarClock size={13} />
          定时
        </button>
        <button type="button" className="btn ghost" onClick={onOpenSettings} data-image-open-settings>
          <Settings size={13} />
          设置
        </button>
      </div>
    </div>
  );
}

function ModeTabs({
  primaryMode,
  runMode,
  onPrimaryMode,
  onRunMode
}: {
  primaryMode: PrimaryMode;
  runMode: RunMode;
  onPrimaryMode: (value: PrimaryMode) => void;
  onRunMode: (value: RunMode) => void;
}): JSX.Element {
  return (
    <>
      <div className="scene-bar" data-image-primary-mode={primaryMode}>
        {(
          [
            ["text", "文生图", Sparkles],
            ["image", "图生图", ImageIcon]
          ] as const
        ).map(([key, label, Icon]) => (
          <button
            key={key}
            type="button"
            className={cn("scene-tab", primaryMode === key && "active")}
            onClick={() => onPrimaryMode(key)}
            data-image-primary-mode-btn={key}
          >
            <Icon size={14} className="ico" />
            <span>{label}</span>
          </button>
        ))}
      </div>
      <div className="ctx-strip">
        <div className="ctx-modes" data-image-run-mode={runMode}>
          {(
            [
              ["single", "单次"],
              ["batch", "批量"]
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={cn("ctx-mode-btn", runMode === key && "active")}
              onClick={() => onRunMode(key)}
              data-image-run-mode-btn={key}
            >
              {key === "single" ? <Zap size={14} /> : <LayoutGrid size={14} />}
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

function ParamsPanel({
  ratio,
  onRatio,
  resolution,
  onResolution,
  quality,
  onQuality,
  outputFormat,
  onOutputFormat,
  outputSubdir,
  onOutputSubdir,
  count,
  onCount
}: {
  ratio: ImageSceneAspectRatio;
  onRatio: (value: ImageSceneAspectRatio) => void;
  resolution: ImageGenerationResolution;
  onResolution: (value: ImageGenerationResolution) => void;
  quality: ImageGenerationQuality;
  onQuality: (value: ImageGenerationQuality) => void;
  outputFormat: ImageGenerationOutputFormat;
  onOutputFormat: (value: ImageGenerationOutputFormat) => void;
  outputSubdir: ImageSceneOutputSubdir;
  onOutputSubdir: (value: ImageSceneOutputSubdir) => void;
  count: number;
  onCount: (value: number) => void;
}): JSX.Element {
  const safeResolution = normalizeResolutionForRatio(ratio, resolution);
  return (
    <div className="generation-params">
      <div className="field">
        <div className="label">生成数量</div>
        <select className="input" value={count} onChange={(event) => onCount(Number(event.target.value))}>
          {IMAGE_COUNT_OPTIONS.map((value) => (
            <option key={value} value={value}>
              {value} 张
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <div className="label">比例</div>
        <select
          className="input"
          value={ratio}
          onChange={(event) => {
            const next = event.target.value as ImageSceneAspectRatio;
            onRatio(next);
            onResolution(normalizeResolutionForRatio(next, resolution));
          }}
        >
          {ASPECT_RATIOS.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <div className="label">分辨率</div>
        <select
          className="input"
          value={safeResolution}
          onChange={(event) => onResolution(event.target.value as ImageGenerationResolution)}
        >
          {IMAGE_GENERATION_RESOLUTIONS_BY_ASPECT_RATIO[ratio].map((value) => (
            <option key={value} value={value}>
              {value.toUpperCase()} · {imageGenerationSize(ratio, value)}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <div className="label">画质</div>
        <select className="input" value={quality} onChange={(event) => onQuality(event.target.value as ImageGenerationQuality)}>
          {QUALITY_OPTIONS.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <div className="label">格式</div>
        <select
          className="input"
          value={outputFormat}
          onChange={(event) => onOutputFormat(event.target.value as ImageGenerationOutputFormat)}
        >
          {OUTPUT_FORMAT_OPTIONS.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <div className="label">输出目录</div>
        <select
          className="input"
          value={outputSubdir}
          onChange={(event) => onOutputSubdir(event.target.value as ImageSceneOutputSubdir)}
        >
          {OUTPUT_SUBDIRS.map((value) => (
            <option key={value} value={value}>
              images/{value}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function PromptLibraryPicker({
  prompts,
  selectedId,
  onSelect,
  disabled
}: {
  prompts: PromptRecord[];
  selectedId: string;
  onSelect: (value: string) => void;
  disabled?: boolean;
}): JSX.Element {
  return (
    <select className="input" value={selectedId} disabled={disabled || prompts.length === 0} onChange={(event) => onSelect(event.target.value)}>
      {prompts.length === 0 ? <option value="">提示词库暂无可用提示词</option> : null}
      {prompts.map((prompt) => (
        <option key={prompt.id} value={prompt.id}>
          {prompt.scene} · {prompt.text.slice(0, 44)}
        </option>
      ))}
    </select>
  );
}

function BatchPromptSelector({
  prompts,
  mode,
  onMode,
  scene,
  onScene,
  selectedIds,
  onSelectedIds
}: {
  prompts: PromptRecord[];
  mode: BatchPromptMode;
  onMode: (value: BatchPromptMode) => void;
  scene: string;
  onScene: (value: string) => void;
  selectedIds: Set<string>;
  onSelectedIds: (value: Set<string>) => void;
}): JSX.Element {
  const scenes = unique(prompts.map((prompt) => prompt.scene));
  const filtered = mode === "scene" ? prompts.filter((prompt) => prompt.scene === scene) : prompts;
  const allVisibleSelected = filtered.length > 0 && filtered.every((prompt) => selectedIds.has(prompt.id));
  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="label">提示词库来源</div>
        <div className="btn-group" style={{ alignSelf: "flex-start" }} data-image-batch-prompt-mode={mode}>
          {(
            [
              ["all", "全选"],
              ["manual", "手动勾选"],
              ["scene", "按分类（场景）"]
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={cn(mode === key && "active")}
              onClick={() => {
                onMode(key);
                if (key === "all") {
                  onSelectedIds(new Set(prompts.map((prompt) => prompt.id)));
                } else if (key === "scene") {
                  const nextScene = scene || scenes[0] || "";
                  onScene(nextScene);
                  onSelectedIds(new Set(prompts.filter((prompt) => prompt.scene === nextScene).map((prompt) => prompt.id)));
                }
              }}
            >
              {label}
            </button>
          ))}
        </div>
        {mode === "scene" ? (
          <div className="field" style={{ maxWidth: 320 }}>
            <div className="label">分类（场景）</div>
            <select
              className="input"
              value={scene}
              onChange={(event) => {
                onScene(event.target.value);
                onSelectedIds(new Set(prompts.filter((prompt) => prompt.scene === event.target.value).map((prompt) => prompt.id)));
              }}
            >
              {scenes.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        {mode !== "all" ? (
          <div className="prompt-list" style={{ maxHeight: 280, overflow: "auto" }}>
            <div className="prompt-row" style={{ minHeight: 40 }}>
              <span
                className={cn("checkbox", allVisibleSelected && "checked")}
                onClick={() => {
                  const next = new Set(selectedIds);
                  if (allVisibleSelected) {
                    filtered.forEach((prompt) => next.delete(prompt.id));
                  } else {
                    filtered.forEach((prompt) => next.add(prompt.id));
                  }
                  onSelectedIds(next);
                }}
              />
              <div className="pr-text">全选当前列表</div>
            </div>
            {filtered.map((prompt, index) => (
              <div key={prompt.id} className={cn("prompt-row", selectedIds.has(prompt.id) && "selected")} data-image-prompt-option>
                <span
                  className={cn("checkbox", selectedIds.has(prompt.id) && "checked")}
                  onClick={() => {
                    const next = new Set(selectedIds);
                    if (next.has(prompt.id)) {
                      next.delete(prompt.id);
                    } else {
                      next.add(prompt.id);
                    }
                    onSelectedIds(next);
                  }}
                />
                <div className="pr-num">#{String(index + 1).padStart(2, "0")}</div>
                <div className="pr-text">
                  <span className="chip ghost">{prompt.scene}</span> {prompt.text}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="info-box">
            <Info size={14} />
            <span>将使用提示词库全部 {prompts.length} 条可用提示词。</span>
          </div>
        )}
      </div>
    </div>
  );
}

function ReferenceDropzone({
  references,
  onReferences,
  onChoose
}: {
  references: ImageReferenceInput[];
  onReferences: (value: ImageReferenceInput[]) => void;
  onChoose: () => void;
}): JSX.Element {
  return (
    <div>
      <button
        type="button"
        className="dropzone"
        data-image-reference-dropzone
        onClick={onChoose}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          const dropped = Array.from(event.dataTransfer.files)
            .map(referenceFromDroppedFile)
            .filter((reference): reference is ImageReferenceInput => Boolean(reference));
          if (dropped.length > 0) {
            onReferences(dropped.slice(0, 15));
          }
        }}
      >
        <div className="dz-ico">
          <Upload size={20} />
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>点击选择 · 或拖拽参考图</div>
        <div style={{ fontSize: 12 }}>PNG / JPG / WebP · 最多 15 张 · 单张 50MB 内</div>
      </button>
      {references.length > 0 ? (
        <div style={{ marginTop: 14 }}>
          <div className="label" style={{ marginBottom: 10 }}>
            已读取 {references.length} 张参考图
          </div>
          <div className="grid size-sm">
            {references.map((reference, index) => (
              <div key={`${reference.absolutePath}-${index}`} className="tile">
                <div className="ar sq">
                  <Photo image={null} paletteKey={reference.absolutePath} />
                  <div className="corner">{Math.round(reference.sizeBytes / 1024)}KB</div>
                </div>
                <div className="meta">
                  <div className="row1">
                    <span className="mono small truncate">{reference.fileName}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FolderTasks({
  folderPath,
  tasks,
  onChooseFolder,
  onMixedMode
}: {
  folderPath: string | null;
  tasks: ImageReferenceFolderTask[];
  onChooseFolder: () => void;
  onMixedMode: (mode: ImageReferenceFolderMixedMode) => void;
}): JSX.Element {
  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div className="label">参考图文件夹</div>
            <div className="mono small mute" style={{ marginTop: 4 }}>
              {folderPath ?? "尚未选择文件夹"}
            </div>
          </div>
          <button type="button" className="btn" onClick={onChooseFolder} data-image-choose-reference-folder>
            <Folder size={13} />
            选择文件夹
          </button>
        </div>
        {tasks.length > 0 ? (
          <div className="sku-list" data-image-reference-folder-tasks>
            {tasks.map((task) => (
              <div key={task.id} className="sku-row selected">
                <span className="checkbox checked" />
                <div className="sku-thumbs">
                  {task.references.slice(0, 3).map((reference) => (
                    <div key={reference.absolutePath} className="sku-thumb">
                      <Photo image={null} paletteKey={reference.absolutePath} />
                    </div>
                  ))}
                  {task.references.length > 3 ? <div className="sku-thumb sku-more">+{task.references.length - 3}</div> : null}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{task.name}</div>
                  <div className="mute small truncate">{task.folderPath ?? "根目录图片"}</div>
                </div>
                <div className="mono small mute">{task.references.length} 张参考</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="info-box">
            <Info size={14} />
            <span>批量图生图会按文件夹结构自动创建参考任务。</span>
          </div>
        )}
      </div>
      {folderPath ? (
        <div className="row" style={{ padding: "12px 20px", gap: 8, borderTop: "1px solid var(--line-faint)" }}>
          <span className="small mute">混合结构处理</span>
          <div className="btn-group">
            <button type="button" onClick={() => onMixedMode("root")}>
              仅根目录
            </button>
            <button type="button" onClick={() => onMixedMode("subfolders")}>
              仅子文件夹
            </button>
            <button type="button" onClick={() => onMixedMode("all")}>
              全部纳入
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function GenerationView({
  status,
  error,
  expectedCount,
  images,
  onReview,
  onBack
}: {
  status: GenerationStatus;
  error: string | null;
  expectedCount: number;
  images: ImageLibraryItem[];
  onReview: () => void;
  onBack: () => void;
}): JSX.Element {
  const done = status === "done";
  const placeholderCount = done ? 0 : Math.max(1, expectedCount - images.length);
  return (
    <div className="stage">
      <div className="stage-head">
        <div className="stage-title-block">
          <div className="eyebrow">
            <span className="line" />
            生成阶段
          </div>
          <h2>{done ? "出图完成" : status === "error" ? "出图失败" : "正在出图"}</h2>
          <div className="desc">文生图使用云雾 generations 流程；图生图使用 edits 流程并携带参考图文件。</div>
        </div>
        {done ? (
          <button type="button" className="btn primary" onClick={onReview} data-enter-image-review>
            查看验收
            <ArrowRight size={13} />
          </button>
        ) : null}
      </div>
      <div className="card" style={{ padding: "14px 18px" }}>
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 10 }}>
          <span style={{ fontWeight: 600 }}>{done ? "已完成" : status === "error" ? "已中断" : "生成中"}</span>
          <span className="mono small mute" data-image-generation-progress>
            {images.length} / {Math.max(expectedCount, images.length)}
          </span>
        </div>
        <div className="prog">
          <div
            className={cn("prog-fill", status === "running" && "indeterminate")}
            style={status === "running" ? undefined : { width: done ? "100%" : "0%" }}
          />
        </div>
      </div>
      {error ? (
        <div className="info-box" style={{ borderStyle: "solid", borderColor: "var(--danger)" }}>
          <Info size={14} style={{ color: "var(--danger)" }} />
          <span>{error}</span>
        </div>
      ) : null}
      <div className="grid size-md">
        {images.map((image) => (
          <Tile
            key={image.id}
            image={image}
            paletteKey={image.id}
            ratio={image.aspectRatio}
            verdict={image.status === "soft_deleted" ? "rejected" : image.reviewStatus === "approved" ? "approved" : "pending"}
          />
        ))}
        {Array.from({ length: placeholderCount }).map((_, index) => (
          <Tile key={`queued-${index}`} image={null} paletteKey={`queued-${index}`} placeholder={index === 0 ? "generating" : "queued"} />
        ))}
      </div>
      <button type="button" className="btn ghost" onClick={onBack}>
        返回配置
      </button>
    </div>
  );
}

function ReviewView({
  items,
  busy,
  onApprove,
  onReject,
  onApproveAll,
  onBack
}: {
  items: ReviewImage[];
  busy: boolean;
  onApprove: (image: ImageLibraryItem) => void;
  onReject: (image: ImageLibraryItem) => void;
  onApproveAll: () => void;
  onBack: () => void;
}): JSX.Element {
  const pending = items.filter((item) => item.image.status === "active" && item.image.reviewStatus === "pending").length;
  const approved = items.filter((item) => item.image.status === "active" && item.image.reviewStatus === "approved").length;
  const rejected = items.filter((item) => item.image.status === "soft_deleted").length;
  return (
    <div className="stage">
      <div className="stage-head">
        <div className="stage-title-block">
          <div className="eyebrow">
            <span className="line" />
            验收阶段
          </div>
          <h2>审核生成结果</h2>
          <div className="desc">待审图片通过后才会进入图片库；拒绝会软删除并移动到 _trash/images。</div>
        </div>
        <button type="button" className="btn primary" disabled={pending === 0 || busy} onClick={onApproveAll}>
          <Check size={13} />
          一键通过待审（{pending}）
        </button>
      </div>
      <div className="stat-grid">
        <div className="card stat-card">
          <div className="label">总图数</div>
          <div className="stat-v">{items.length}</div>
        </div>
        <div className="card stat-card">
          <div className="label">待审</div>
          <div className="stat-v" style={{ color: "var(--warn)" }}>
            {pending}
          </div>
        </div>
        <div className="card stat-card">
          <div className="label">已通过</div>
          <div className="stat-v" style={{ color: "var(--success)" }}>
            {approved}
          </div>
        </div>
        <div className="card stat-card">
          <div className="label">已拒绝</div>
          <div className="stat-v" style={{ color: "var(--danger)" }}>
            {rejected}
          </div>
        </div>
      </div>
      {items.length === 0 ? (
        <div className="empty">
          <div className="e-ico">
            <ImageIcon size={20} />
          </div>
          <div>本次还没有生成结果</div>
        </div>
      ) : (
        <div className="grid size-md">
          {items.map(({ image, prompt }) => (
            <div key={image.id} className="tile" data-image-review-card={image.id}>
              <Tile
                image={image}
                paletteKey={image.id}
                ratio={image.aspectRatio}
                verdict={image.status === "soft_deleted" ? "rejected" : image.reviewStatus === "approved" ? "approved" : "pending"}
              />
              <div style={{ padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                <div className="serif small" style={{ color: "var(--ink-2)", lineHeight: 1.5 }}>
                  {prompt?.text ?? "未关联提示词"}
                </div>
                <div className="row" style={{ gap: 6 }}>
                  <button
                    type="button"
                    className="btn xs success"
                    disabled={busy || image.status !== "active" || image.reviewStatus === "approved"}
                    onClick={() => onApprove(image)}
                    data-approve-image={image.id}
                  >
                    <Check size={11} />
                    通过
                  </button>
                  <button
                    type="button"
                    className="btn xs danger"
                    disabled={busy || image.status === "soft_deleted"}
                    onClick={() => onReject(image)}
                    data-reject-image={image.id}
                  >
                    <X size={11} />
                    拒绝
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <button type="button" className="btn ghost" onClick={onBack}>
        返回生成结果
      </button>
    </div>
  );
}

export function ImageStudioPage(): JSX.Element {
  const setPage = useAppStore((state) => state.setPage);
  const imageTasks = useImageGenerationTaskStore((state) => state.tasks);
  const selectedTaskId = useImageGenerationTaskStore((state) => state.selectedTaskId);
  const startImageTask = useImageGenerationTaskStore((state) => state.startTask);
  const selectImageTask = useImageGenerationTaskStore((state) => state.selectTask);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [prompts, setPrompts] = useState<PromptRecord[]>([]);
  const [images, setImages] = useState<ImageLibraryItem[]>([]);
  const [primaryMode, setPrimaryMode] = useState<PrimaryMode>("text");
  const [runMode, setRunMode] = useState<RunMode>("single");
  const [view, setView] = useState<"setup" | "generating" | "review">("setup");
  const [message, setMessage] = useState("");

  const [promptSource, setPromptSource] = useState<PromptSource>("manual");
  const [manualPrompt, setManualPrompt] = useState("俯拍角度，一支墨绿色保温杯与干花、枫叶摆在白色亚麻布上");
  const [selectedPromptId, setSelectedPromptId] = useState("");
  const [batchPromptMode, setBatchPromptMode] = useState<BatchPromptMode>("all");
  const [batchScene, setBatchScene] = useState("");
  const [selectedPromptIds, setSelectedPromptIds] = useState<Set<string>>(new Set());

  const [references, setReferences] = useState<ImageReferenceInput[]>([]);
  const [folderPath, setFolderPath] = useState<string | null>(null);
  const [folderTasks, setFolderTasks] = useState<ImageReferenceFolderTask[]>([]);
  const [pairingMode, setPairingMode] = useState<PairingMode>("many_to_many");

  const [count, setCount] = useState(1);
  const [ratio, setRatio] = useState<ImageSceneAspectRatio>("1:1");
  const [resolution, setResolution] = useState<ImageGenerationResolution>("1k");
  const [quality, setQuality] = useState<ImageGenerationQuality>("auto");
  const [outputFormat, setOutputFormat] = useState<ImageGenerationOutputFormat>("png");
  const [outputSubdir, setOutputSubdir] = useState<ImageSceneOutputSubdir>("main");
  const [imageModelOptions, setImageModelOptions] = useState<ImageModelOption[]>([]);
  const [selectedTargetKeys, setSelectedTargetKeys] = useState<Set<string>>(new Set());
  const [generationStrategy, setGenerationStrategy] = useState<ImageWorkspaceGenerationStrategy>("load_balance");

  const [busy, setBusy] = useState(false);

  const activePrompts = useMemo(() => prompts.filter((prompt) => prompt.status === "active"), [prompts]);
  const selectedOptions = useMemo(
    () => imageModelOptions.filter((option) => selectedTargetKeys.has(imageOptionKey(option))),
    [imageModelOptions, selectedTargetKeys]
  );
  const resultHandling = settings?.imageStudioResultHandling ?? "manual_review";
  const selectedTask = useMemo<ImageGenerationTask | null>(() => {
    const explicit = imageTasks.find((task) => task.id === selectedTaskId);
    return explicit ?? imageTasks.find((task) => task.status === "running") ?? imageTasks.find((task) => task.status === "done") ?? null;
  }, [imageTasks, selectedTaskId]);
  const generationStatus: GenerationStatus =
    selectedTask?.status === "running" ? "running" : selectedTask?.status === "done" ? "done" : selectedTask?.status === "failed" ? "error" : "idle";
  const generationError = selectedTask?.error ?? null;
  const expectedCount = selectedTask?.expectedCount ?? 0;
  const selectedTaskViewId = selectedTask?.id ?? null;
  const selectedTaskViewStatus = selectedTask?.status ?? null;
  const selectedTaskViewUpdatedAt = selectedTask?.updatedAt ?? null;
  const selectedPromptIdsArray = useMemo(() => {
    if (batchPromptMode === "all") {
      return activePrompts.map((prompt) => prompt.id);
    }
    if (batchPromptMode === "scene") {
      return activePrompts.filter((prompt) => prompt.scene === batchScene).map((prompt) => prompt.id);
    }
    return activePrompts.filter((prompt) => selectedPromptIds.has(prompt.id)).map((prompt) => prompt.id);
  }, [activePrompts, batchPromptMode, batchScene, selectedPromptIds]);
  const batchImages = useMemo(() => {
    const idSet = new Set(selectedTask?.imageIds ?? []);
    return images.filter((image) => idSet.has(image.id) && image.status !== "archived");
  }, [images, selectedTask?.imageIds]);
  const reviewItems = useMemo<ReviewImage[]>(
    () =>
      batchImages.map((image) => ({
        image,
        prompt: prompts.find((prompt) => prompt.id === image.promptId) ?? null
      })),
    [batchImages, prompts]
  );
  const activeImageCount = images.filter((image) => image.status === "active" && image.reviewStatus === "approved").length;
  const pendingImageCount = images.filter((image) => image.status === "active" && image.reviewStatus === "pending").length;

  const loadData = async (): Promise<void> => {
    const [nextSettings, nextPrompts, nextImages] = await Promise.all([
      window.roster.getSettings(),
      window.roster.listPrompts(),
      window.roster.listImages()
    ]);
    setSettings(nextSettings);
    setPrompts(nextPrompts);
    setImages(nextImages);
    setSelectedPromptId((current) => current || nextPrompts.find((prompt) => prompt.status === "active")?.id || "");
    setBatchScene((current) => current || nextPrompts.find((prompt) => prompt.status === "active")?.scene || "");
    setSelectedPromptIds((current) => (current.size > 0 ? current : new Set(nextPrompts.filter((prompt) => prompt.status === "active").map((prompt) => prompt.id))));
  };

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    if (!selectedTaskViewId || !selectedTaskViewStatus) {
      return;
    }
    if (selectedTaskViewStatus === "running") {
      setView("generating");
      return;
    }
    void loadData().then(() => {
      setView(selectedTaskViewStatus === "done" ? "review" : "generating");
    });
  }, [selectedTaskViewId, selectedTaskViewStatus, selectedTaskViewUpdatedAt]);

  useEffect(() => {
    Promise.all([window.roster.getSettings(), window.roster.listApiKeys()])
      .then(([nextSettings, apiKeys]) => {
        const options = configuredImageModelsFromApiKeys(nextSettings, apiKeys, { enableFirst: true });
        setImageModelOptions(options);
        const enabledKeys = options.filter((option) => option.enabled).map(imageOptionKey);
        setSelectedTargetKeys(new Set(enabledKeys.length > 0 ? enabledKeys : options[0] ? [imageOptionKey(options[0])] : []));
      })
      .catch(() => undefined);
  }, []);

  const resetFlow = (nextPrimary = primaryMode, nextRun = runMode): void => {
    setPrimaryMode(nextPrimary);
    setRunMode(nextRun);
    setView("setup");
  };

  const toggleImageTarget = (option: ImageModelOption): void => {
    setSelectedTargetKeys((current) => {
      const key = imageOptionKey(option);
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const providerGrid = (
    <ProviderGrid
      options={imageModelOptions}
      selectedKeys={selectedTargetKeys}
      onToggle={toggleImageTarget}
      strategy={generationStrategy}
      onStrategy={setGenerationStrategy}
    />
  );

  const generationMultiplier = (): number =>
    generationStrategy === "all_providers" ? Math.max(selectedOptions.length, 1) : 1;

  const runTextGeneration = (): void => {
    if (selectedOptions.length === 0) {
      setMessage("请先选择至少一个图片 Provider");
      return;
    }
    const targets = selectedOptions.map(imageOptionToTarget);
    try {
      if (runMode === "single") {
        if (promptSource === "library") {
          if (!selectedPromptId) {
            throw new Error("请选择提示词库中的提示词");
          }
          const expected = count * generationMultiplier();
          const taskId = startImageTask({
            title: "文生图 · 单次",
            kind: "text",
            runMode: "single",
            expectedCount: expected,
            run: () =>
              window.roster.generateImages({
                promptIds: [selectedPromptId],
                provider: targets[0]?.provider,
                model: targets[0]?.model ?? "mock-image",
                targets,
                generationStrategy,
                aspectRatio: ratio,
                resolution: normalizeResolutionForRatio(ratio, resolution),
                quality,
                outputFormat,
                perPromptCount: count,
                outputSubdir,
                resultHandling
              })
          });
          selectImageTask(taskId);
        } else {
          if (!manualPrompt.trim()) {
            throw new Error("请先输入提示词");
          }
          const expected = count * generationMultiplier();
          const promptText = manualPrompt.trim();
          const taskId = startImageTask({
            title: "文生图 · 单次",
            kind: "text",
            runMode: "single",
            expectedCount: expected,
            run: () =>
              window.roster.generateImagesAdHoc({
                mode: "quick",
                scene: batchScene || "主图",
                prompts: [{ text: promptText, label: "文生图单次" }],
                provider: targets[0]?.provider,
                model: targets[0]?.model ?? "mock-image",
                targets,
                generationStrategy,
                aspectRatio: ratio,
                resolution: normalizeResolutionForRatio(ratio, resolution),
                quality,
                outputFormat,
                perPromptCount: count,
                outputSubdir,
                resultHandling
              })
          });
          selectImageTask(taskId);
        }
      } else {
        if (selectedPromptIdsArray.length === 0) {
          throw new Error("请至少选择一条提示词");
        }
        const expected = selectedPromptIdsArray.length * count * generationMultiplier();
        const promptIds = [...selectedPromptIdsArray];
        const taskId = startImageTask({
          title: `文生图 · 批量 ${promptIds.length} 条`,
          kind: "text",
          runMode: "batch",
          expectedCount: expected,
          run: () =>
            window.roster.generateImages({
              promptIds,
              provider: targets[0]?.provider,
              model: targets[0]?.model ?? "mock-image",
              targets,
              generationStrategy,
              aspectRatio: ratio,
              resolution: normalizeResolutionForRatio(ratio, resolution),
              quality,
              outputFormat,
              perPromptCount: count,
              outputSubdir,
              resultHandling
            })
        });
        selectImageTask(taskId);
      }
      setView("generating");
      setMessage("已加入任务中心，生成会在后台继续执行。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  };

  const runImageGeneration = (): void => {
    if (selectedOptions.length === 0) {
      setMessage("请先选择至少一个图片 Provider");
      return;
    }
    const targets = selectedOptions.map(imageOptionToTarget);
    try {
      const jobs =
        runMode === "single"
          ? [
              {
                promptId: promptSource === "library" ? selectedPromptId || undefined : undefined,
                promptText: promptSource === "manual" ? manualPrompt.trim() : undefined,
                label: "图生图单次",
                references
              }
            ]
          : buildBatchImageJobs();
      if (jobs.length === 0) {
        throw new Error("请先准备图生图任务");
      }
      if (jobs.some((job) => job.references.length === 0)) {
        throw new Error("图生图任务必须包含参考图");
      }
      if (jobs.some((job) => !job.promptId && !job.promptText?.trim())) {
        throw new Error("图生图提示词为必填项");
      }
      const expected = jobs.length * count * generationMultiplier();
      const taskJobs = jobs.map((job) => ({ ...job, references: [...job.references] }));
      const taskId = startImageTask({
        title: `图生图 · ${runMode === "single" ? "单次" : `批量 ${taskJobs.length} 组`}`,
        kind: "image",
        runMode,
        expectedCount: expected,
        run: () =>
          window.roster.generateImageEdits({
            scene: batchScene || "主图",
            jobs: taskJobs,
            provider: targets[0]?.provider,
            model: targets[0]?.model ?? "mock-image",
            targets,
            generationStrategy,
            aspectRatio: ratio,
            resolution: normalizeResolutionForRatio(ratio, resolution),
            quality,
            outputFormat,
            perPromptCount: count,
            outputSubdir,
            resultHandling
          })
      });
      selectImageTask(taskId);
      setView("generating");
      setMessage("已加入任务中心，生成会在后台继续执行。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  };

  const buildBatchImageJobs = (): Array<{
    promptId?: string;
    promptText?: string;
    label?: string;
    references: ImageReferenceInput[];
  }> => {
    const selectedPrompts = selectedPromptIdsArray;
    if (folderTasks.length === 0 || selectedPrompts.length === 0) {
      return [];
    }
    if (pairingMode === "one_to_one") {
      if (folderTasks.length !== selectedPrompts.length) {
        return [];
      }
      return folderTasks.map((task, index) => ({
        promptId: selectedPrompts[index],
        label: task.name,
        references: task.references
      }));
    }
    return folderTasks.flatMap((task) =>
      selectedPrompts.map((promptId) => ({
        promptId,
        label: task.name,
        references: task.references
      }))
    );
  };

  const chooseReferences = async (): Promise<void> => {
    const result = await window.roster.chooseImageReferenceFiles();
    if (!result.canceled) {
      setReferences(result.references);
    }
  };

  const chooseFolder = async (): Promise<void> => {
    const result = await window.roster.chooseImageReferenceFolder();
    if (result.canceled || !result.folderPath) {
      return;
    }
    setFolderPath(result.folderPath);
    const inspected = await window.roster.inspectImageReferenceFolder({ folderPath: result.folderPath });
    if (inspected.requiresMixedMode) {
      setFolderTasks([]);
      setMessage("检测到根目录图片和子文件夹图片，请选择混合结构处理方式。");
      return;
    }
    setFolderTasks(inspected.tasks);
    setMessage(inspected.warnings.join(" "));
  };

  const applyMixedMode = async (mode: ImageReferenceFolderMixedMode): Promise<void> => {
    if (!folderPath) {
      return;
    }
    const inspected = await window.roster.inspectImageReferenceFolder({ folderPath, mixedMode: mode });
    setFolderTasks(inspected.tasks);
    setMessage(inspected.warnings.join(" "));
  };

  const createScheduleEntry = async (): Promise<void> => {
    try {
      const saved = await window.roster.saveScheduledJob({
        name: "图片生成定时",
        type: "image_generation",
        status: "enabled",
        scheduleLabel: "每 60 秒",
        nextRunAt: new Date(Date.now() + 60_000).toISOString(),
        missedRunPolicy: "catch_up_last",
        targetPage: "images"
      });
      setMessage(`已创建定时任务：${saved.name}`);
    } catch (error) {
      setMessage(`创建定时任务失败：${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const approveImage = async (image: ImageLibraryItem): Promise<void> => {
    setBusy(true);
    try {
      await window.roster.reviewImage({ imageId: image.id, reviewStatus: "approved" });
      await loadData();
    } finally {
      setBusy(false);
    }
  };

  const rejectImage = async (image: ImageLibraryItem): Promise<void> => {
    setBusy(true);
    try {
      await window.roster.softDeleteImage({ imageId: image.id });
      await loadData();
    } finally {
      setBusy(false);
    }
  };

  const approveAllPending = async (): Promise<void> => {
    const pending = reviewItems
      .map((item) => item.image)
      .filter((image) => image.status === "active" && image.reviewStatus === "pending");
    setBusy(true);
    try {
      for (const image of pending) {
        await window.roster.reviewImage({ imageId: image.id, reviewStatus: "approved" });
      }
      await loadData();
    } finally {
      setBusy(false);
    }
  };

  const canRunOneToOne = pairingMode !== "one_to_one" || folderTasks.length === selectedPromptIdsArray.length;

  const renderSetup = (): JSX.Element => (
    <div className="stage">
      <div className="stage-head">
        <div className="stage-title-block">
          <div className="eyebrow">
            <span className="line" />
            {primaryMode === "text" ? "文生图" : "图生图"} · {runMode === "single" ? "单次" : "批量"}
          </div>
          <h2>
            {primaryMode === "text"
              ? runMode === "single"
                ? "输入或引用一条提示词生成图片"
                : "从提示词库批量生成图片"
              : runMode === "single"
                ? "读取参考图并结合提示词生成"
                : "按文件夹和提示词库批量图生图"}
          </h2>
          <div className="desc">
            当前结果处理：{resultHandlingLabel(resultHandling)}。{primaryMode === "image" ? "图生图提示词为必填项。" : "提示词来源可手动输入或只读引用提示词库。"}
          </div>
        </div>
      </div>

      {runMode === "single" ? (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="field">
              <div className="label">提示词来源</div>
              <div className="btn-group" style={{ alignSelf: "flex-start" }}>
                <button type="button" className={cn(promptSource === "manual" && "active")} onClick={() => setPromptSource("manual")}>
                  手动输入
                </button>
                <button type="button" className={cn(promptSource === "library" && "active")} onClick={() => setPromptSource("library")}>
                  从提示词库引用
                </button>
              </div>
            </div>
            {promptSource === "manual" ? (
              <div className="field">
                <div className="label">
                  提示词<span className="req">*</span>
                </div>
                <textarea
                  className="textarea serif"
                  rows={5}
                  value={manualPrompt}
                  maxLength={IMAGE_GENERATION_PROMPT_MAX_LENGTH}
                  onChange={(event) => setManualPrompt(event.target.value)}
                  data-image-manual-prompt
                />
                <div className="row" style={{ justifyContent: "flex-end", fontSize: 11, color: "var(--ink-3)" }}>
                  <span className="mono">
                    {manualPrompt.length}/{IMAGE_GENERATION_PROMPT_MAX_LENGTH}
                  </span>
                </div>
              </div>
            ) : (
              <div className="field">
                <div className="label">
                  提示词库<span className="req">*</span>
                </div>
                <PromptLibraryPicker prompts={activePrompts} selectedId={selectedPromptId} onSelect={setSelectedPromptId} />
              </div>
            )}
            {primaryMode === "image" ? (
              <ReferenceDropzone references={references} onReferences={setReferences} onChoose={() => void chooseReferences()} />
            ) : null}
          </div>
        </div>
      ) : primaryMode === "text" ? (
        <BatchPromptSelector
          prompts={activePrompts}
          mode={batchPromptMode}
          onMode={setBatchPromptMode}
          scene={batchScene}
          onScene={setBatchScene}
          selectedIds={selectedPromptIds}
          onSelectedIds={setSelectedPromptIds}
        />
      ) : (
        <>
          <FolderTasks
            folderPath={folderPath}
            tasks={folderTasks}
            onChooseFolder={() => void chooseFolder()}
            onMixedMode={(mode) => void applyMixedMode(mode)}
          />
          <BatchPromptSelector
            prompts={activePrompts}
            mode={batchPromptMode}
            onMode={setBatchPromptMode}
            scene={batchScene}
            onScene={setBatchScene}
            selectedIds={selectedPromptIds}
            onSelectedIds={setSelectedPromptIds}
          />
          <div className="card card-pad">
            <div className="label" style={{ marginBottom: 8 }}>
              提示词与参考图对应模式
            </div>
            <div className="btn-group">
              <button type="button" className={cn(pairingMode === "many_to_many" && "active")} onClick={() => setPairingMode("many_to_many")}>
                多对多（笛卡尔积）
              </button>
              <button type="button" className={cn(pairingMode === "one_to_one" && "active")} onClick={() => setPairingMode("one_to_one")}>
                一对一
              </button>
            </div>
            {!canRunOneToOne ? (
              <div className="info-box" style={{ marginTop: 12, borderColor: "var(--warn)", borderStyle: "solid" }}>
                <Info size={14} />
                <span>
                  一对一要求参考任务数与提示词数相同。当前 {folderTasks.length} 个参考任务，{selectedPromptIdsArray.length} 条提示词。
                </span>
              </div>
            ) : null}
          </div>
        </>
      )}

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <ParamsPanel
          ratio={ratio}
          onRatio={setRatio}
          resolution={resolution}
          onResolution={setResolution}
          quality={quality}
          onQuality={setQuality}
          outputFormat={outputFormat}
          onOutputFormat={setOutputFormat}
          outputSubdir={outputSubdir}
          onOutputSubdir={setOutputSubdir}
          count={count}
          onCount={setCount}
        />
        {providerGrid}
      </div>

      <div className="row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div className="row" style={{ gap: 8 }}>
          <span className="chip ghost">
            <Library size={11} />
            可用提示词 {activePrompts.length}
          </span>
          <span className="chip ghost">Provider {selectedOptions.length}</span>
          <span className="chip ghost">输出 images/{outputSubdir}</span>
        </div>
        <button
          type="button"
          className="btn primary lg"
          disabled={busy || (primaryMode === "image" && runMode === "batch" && !canRunOneToOne)}
          onClick={() => void (primaryMode === "text" ? runTextGeneration() : runImageGeneration())}
          data-generate-images
        >
          <Zap size={14} />
          开始生成
        </button>
      </div>
    </div>
  );

  return (
    <div className="image-studio" data-image-studio>
      <StudioHead
        activeImages={activeImageCount}
        pendingImages={pendingImageCount}
        resultHandling={resultHandling}
        onCreateSchedule={createScheduleEntry}
        onOpenSettings={() => setPage("settings")}
      />
      <ModeTabs
        primaryMode={primaryMode}
        runMode={runMode}
        onPrimaryMode={(value) => resetFlow(value, runMode)}
        onRunMode={(value) => resetFlow(primaryMode, value)}
      />
      {message ? (
        <div className="auto-banner" style={{ borderColor: "var(--brand)", background: "var(--brand-softer)" }}>
          <Info size={14} />
          <span>{message}</span>
          <button type="button" className="btn xs ghost" onClick={() => setMessage("")} style={{ marginLeft: "auto" }}>
            关闭
          </button>
        </div>
      ) : null}
      <div className="work-col">
        {view === "setup" ? renderSetup() : null}
        {view === "generating" ? (
          <GenerationView
            status={generationStatus}
            error={generationError}
            expectedCount={expectedCount}
            images={batchImages}
            onReview={() => setView("review")}
            onBack={() => setView("setup")}
          />
        ) : null}
        {view === "review" ? (
          <ReviewView
            items={reviewItems}
            busy={busy}
            onApprove={(image) => void approveImage(image)}
            onReject={(image) => void rejectImage(image)}
            onApproveAll={() => void approveAllPending()}
            onBack={() => setView("generating")}
          />
        ) : null}
      </div>
    </div>
  );
}
