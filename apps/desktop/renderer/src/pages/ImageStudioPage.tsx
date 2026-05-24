import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CalendarClock,
  Check,
  ChevronDown,
  Eye,
  Filter,
  Folder,
  GitBranch,
  Info,
  LayoutGrid,
  List,
  Lock,
  Pencil,
  Plus,
  RotateCcw,
  Settings,
  Sparkles,
  Square,
  Upload,
  X,
  Zap
} from "lucide-react";
import {
  imageGenerationSize,
  IMAGE_GENERATION_PROMPT_MAX_LENGTH,
  IMAGE_GENERATION_RESOLUTIONS_BY_ASPECT_RATIO,
  type ImageGenerationOutputFormat,
  type ImageGenerationQuality,
  type ImageGenerationResolution,
  type ImageLibraryItem,
  type ImagePromptWorkspaceModel,
  type ImageSceneAspectRatio,
  type ImageSceneOutputSubdir,
  type ImageScenePreset,
  type ImageWorkspaceGenerationStrategy,
  type PromptRecord,
  type SkillRecord
} from "@roster/shared-types";
import { configuredImageModelsFromApiKeys, configuredLabeledLlmModelsFromApiKeys, type ImageModelOption } from "@/lib/provider-options";
import { cn } from "@/lib/utils";
import {
  BackButton,
  Drawer,
  imageOptionKey,
  imageOptionToTarget,
  ModeIcon,
  Photo,
  PipelineBar,
  ProviderGrid,
  SceneIcon,
  Tile,
  Toggle
} from "./image-studio/components";
import {
  formatClock,
  QUICK_RECENT_PROMPTS,
  readApprovedIds,
  SAMPLE_SKU_FOLDERS,
  SAMPLE_TEMPLATES,
  type SkuFolder,
  STUDIO_MODES,
  stagesFor,
  type DataSource,
  type ReviewVerdict,
  type StudioMode,
  writeApprovedIds
} from "./image-studio/studio-data";

const ASPECT_RATIOS: ImageSceneAspectRatio[] = ["1:1", "3:4", "9:16", "16:9"];
const IMAGE_COUNT_OPTIONS = [1, 2, 3, 4, 5, 6, 8, 10];
const QUALITY_OPTIONS: ImageGenerationQuality[] = ["auto", "low", "medium", "high"];
const OUTPUT_FORMAT_OPTIONS: ImageGenerationOutputFormat[] = ["png", "jpeg", "webp"];
const OUTPUT_SUBDIRS: ImageSceneOutputSubdir[] = ["main", "detail", "live_cover"];
const emptyPromptModel: ImagePromptWorkspaceModel = { provider: "mock", model: "" };

type LabeledModel = ImagePromptWorkspaceModel & { label: string };
type GenStatus = "idle" | "running" | "done" | "error";

interface UploadedRef {
  id: string;
  name: string;
  size: string;
}

function uniqueArray(values: string[]): string[] {
  return [...new Set(values)];
}

/* ════════════════════════════ Header ════════════════════════════ */

function StudioHead({
  totalImages,
  pendingCount,
  sceneCount,
  autoRunning,
  onCreateSchedule,
  onAutoRun
}: {
  totalImages: number;
  pendingCount: number;
  sceneCount: number;
  autoRunning: boolean;
  onCreateSchedule: () => void;
  onAutoRun: () => void;
}): JSX.Element {
  return (
    <div className="studio-head">
      <div>
        <div className="title">
          图片工作室
          <span className="chip brand dot" style={{ fontSize: 10 }}>
            模式 · 场景 · 流水线
          </span>
        </div>
        <div className="desc">把提示词生成与图片生产串成一条可追溯的本地工作流。</div>
      </div>
      <div className="head-actions">
        <div className="head-meta">
          <div className="meta-item">
            <span className="muted-2">已生成</span>
            <b>{totalImages}</b>
          </div>
          <div className="meta-item">
            <span className="muted-2">待验收</span>
            <b>{pendingCount}</b>
          </div>
          <div className="meta-item">
            <span className="muted-2">场景</span>
            <b>{sceneCount}</b>
          </div>
        </div>
        <button type="button" className="btn ghost" onClick={onCreateSchedule} data-create-image-schedule>
          <CalendarClock size={13} />
          定时
        </button>
        <button
          type="button"
          className={cn("auto-run", autoRunning && "running")}
          onClick={onAutoRun}
          disabled={autoRunning}
          data-image-auto-run
        >
          {autoRunning ? (
            <>
              <span className="spinner" style={{ borderColor: "#fff", borderTopColor: "transparent" }} />
              正在自动运行
            </>
          ) : (
            <>
              <Zap size={13} />
              全流程自动运行
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function SceneTabs({
  presets,
  currentId,
  countFor,
  onSelect,
  onAdd
}: {
  presets: ImageScenePreset[];
  currentId: string;
  countFor: (preset: ImageScenePreset) => number;
  onSelect: (id: string) => void;
  onAdd: () => void;
}): JSX.Element {
  return (
    <div className="scene-bar">
      {presets.map((preset, index) => {
        const count = countFor(preset);
        return (
          <button
            key={preset.id}
            type="button"
            className={cn("scene-tab", preset.id === currentId && "active")}
            onClick={() => onSelect(preset.id)}
            data-image-scene-preset={preset.name}
          >
            <SceneIcon index={index} />
            <span>{preset.name}</span>
            {count > 0 ? <span className="count">{count}</span> : null}
          </button>
        );
      })}
      <button type="button" className="scene-add" onClick={onAdd} data-image-add-scene>
        <Plus size={12} />
        新增场景
      </button>
    </div>
  );
}

function ContextStrip({
  mode,
  onChangeMode,
  sceneName,
  ratio,
  skillName,
  outputDir,
  autoLib,
  autoGen,
  onToggleAutoLib,
  onToggleAutoGen,
  onOpenSceneConfig
}: {
  mode: StudioMode;
  onChangeMode: (mode: StudioMode) => void;
  sceneName: string;
  ratio: string;
  skillName: string;
  outputDir: string;
  autoLib: boolean;
  autoGen: boolean;
  onToggleAutoLib: (value: boolean) => void;
  onToggleAutoGen: (value: boolean) => void;
  onOpenSceneConfig: () => void;
}): JSX.Element {
  return (
    <div className="ctx-strip">
      <div className="ctx-modes" data-image-mode={mode}>
        {STUDIO_MODES.map((item) => (
          <button
            key={item.id}
            type="button"
            className={cn("ctx-mode-btn", mode === item.id && "active")}
            onClick={() => onChangeMode(item.id)}
            data-image-mode-btn={item.id}
          >
            <span className="ico">
              <ModeIcon mode={item.id} />
            </span>
            <span>{item.name}</span>
          </button>
        ))}
      </div>
      <div className="ctx-right">
        <button type="button" className="ctx-chip" onClick={onOpenSceneConfig} title="编辑当前场景预设包">
          <span className="key">场景</span>
          <span className="val">{sceneName}</span>
          <span className="mute">·</span>
          <span className="val mono">{ratio}</span>
          <ChevronDown size={11} className="chev" />
        </button>
        <button type="button" className="ctx-chip" onClick={onOpenSceneConfig} title="提示词 Skill">
          <Sparkles size={12} className="ico" />
          <span className="key">Skill</span>
          <span className="val mono">{skillName}</span>
        </button>
        <button type="button" className="ctx-chip" onClick={onOpenSceneConfig} title="输出目录" data-image-scene-preset-summary>
          <Folder size={12} className="ico" />
          <span className="val mono">{outputDir}</span>
        </button>
        <div className="ctx-chip-divider" />
        <div className="ctx-chip toggle">
          <span className="key">自动入库</span>
          <Toggle on={autoLib} onChange={onToggleAutoLib} />
        </div>
        <div className="ctx-chip toggle">
          <span className="key">自动出图</span>
          <Toggle on={autoGen} onChange={onToggleAutoGen} />
        </div>
        <button type="button" className="icon-btn" onClick={onOpenSceneConfig} title="场景预设包详情">
          <Settings size={14} />
        </button>
      </div>
    </div>
  );
}

function StageHead({
  eyebrow,
  title,
  desc,
  actions
}: {
  eyebrow: string;
  title: string;
  desc: string;
  actions?: JSX.Element;
}): JSX.Element {
  return (
    <div className="stage-head">
      <div className="stage-title-block">
        <div className="eyebrow">
          <span className="line" />
          {eyebrow}
        </div>
        <h2>{title}</h2>
        <div className="desc">{desc}</div>
      </div>
      {actions ? <div className="stage-actions">{actions}</div> : null}
    </div>
  );
}

/* ════════════════════════ Batch · Seed stage ════════════════════════ */

interface SeedStageProps {
  eyebrow: string;
  dataSource: DataSource;
  onChangeDataSource: (value: DataSource) => void;
  seed: string;
  onSeed: (value: string) => void;
  promptCount: number;
  onPromptCount: (value: number) => void;
  skills: SkillRecord[];
  skillId: string;
  onSkill: (value: string) => void;
  textModels: LabeledModel[];
  promptModel: ImagePromptWorkspaceModel;
  onPromptModel: (value: ImagePromptWorkspaceModel) => void;
  skuFolders: SkuFolder[];
  onSkuFolders: (value: SkuFolder[]) => void;
  perPromptCount: number;
  onPerPromptCount: (value: number) => void;
  resolution: ImageGenerationResolution;
  onResolution: (value: ImageGenerationResolution) => void;
  quality: ImageGenerationQuality;
  onQuality: (value: ImageGenerationQuality) => void;
  outputFormat: ImageGenerationOutputFormat;
  onOutputFormat: (value: ImageGenerationOutputFormat) => void;
  aspectRatio: ImageSceneAspectRatio;
  providerGrid: JSX.Element;
  providerCount: number;
  sceneName: string;
  busy: boolean;
  onGenerate: () => void;
}

function SeedStage(props: SeedStageProps): JSX.Element {
  const isText = props.dataSource === "text";
  const selectedSkus = props.skuFolders.filter((folder) => folder.selected);
  const totalRefs = selectedSkus.reduce((sum, folder) => sum + folder.refCount, 0);
  const allSkuSelected = props.skuFolders.every((folder) => folder.selected);
  const canGenerate = isText
    ? Boolean(props.seed.trim()) && Boolean(props.skillId) && props.providerCount > 0
    : selectedSkus.length > 0 && props.providerCount > 0;

  return (
    <div className="stage">
      <StageHead
        eyebrow={props.eyebrow}
        title={isText ? "入口 A：文本种子生成提示词" : "入口 B：本地图片 / SKU 批量出图"}
        desc={
          isText
            ? "批量生产有两个并列入口。文本种子会先扩写成 N 条结构化提示词，再进入提示词确认、图片生成和验收。"
            : "批量生产有两个并列入口。本地图片 / SKU 会跳过提示词扩写，直接按 SKU 参考素材进入图片生成和验收。"
        }
      />

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="entry-definition">
          <div>
            <div className="entry-definition-title">批量生产入口（二选一）</div>
            <div className="entry-definition-desc">
              文本种子和本地图片 / SKU 不是上下游关系；它们是同一个批量生产模式下的两条起点，后续都会进入图片生成和验收。
            </div>
          </div>
          <div className="entry-flow" aria-label={isText ? "文本种子流程" : "本地图片 SKU 流程"}>
            {isText ? (
              <>
                <span className="flow-step active">文本种子</span>
                <span className="flow-arrow">→</span>
                <span className="flow-step">提示词确认</span>
                <span className="flow-arrow">→</span>
                <span className="flow-step">图片生成</span>
                <span className="flow-arrow">→</span>
                <span className="flow-step">验收溯源</span>
              </>
            ) : (
              <>
                <span className="flow-step active">SKU 素材装载</span>
                <span className="flow-arrow">→</span>
                <span className="flow-step">图片生成</span>
                <span className="flow-arrow">→</span>
                <span className="flow-step">验收溯源</span>
              </>
            )}
          </div>
        </div>
        <div className="ds-tabs">
          <button
            type="button"
            className={cn("ds-tab", isText && "active")}
            onClick={() => props.onChangeDataSource("text")}
            aria-pressed={isText}
          >
            <Sparkles size={14} />
            <div>
              <div className="ds-tab-name">入口 A · 文本种子</div>
              <div className="ds-tab-sub">从一句话生成提示词，再批量出图</div>
            </div>
          </button>
          <button
            type="button"
            className={cn("ds-tab", !isText && "active")}
            onClick={() => props.onChangeDataSource("folder")}
            aria-pressed={!isText}
          >
            <Folder size={14} />
            <div>
              <div className="ds-tab-name">入口 B · 本地图片 / SKU</div>
              <div className="ds-tab-sub">按 SKU 参考素材直接批量出图</div>
            </div>
          </button>
        </div>

        {isText ? (
          <div style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="field">
              <div className="label">
                种子描述<span className="req">*</span>
              </div>
              <textarea
                className="textarea"
                rows={3}
                value={props.seed}
                onChange={(event) => props.onSeed(event.target.value)}
                placeholder="例如：保温杯冬季生活方式主图，要有一点温度感和故事感"
                data-image-seed
              />
              <div className="row" style={{ justifyContent: "space-between", fontSize: 11, color: "var(--ink-3)" }}>
                <span>当前场景：{props.sceneName}</span>
                <span className="mono">{props.seed.length} 字</span>
              </div>
            </div>
            <div className="grid-3">
              <div className="field">
                <div className="label">提示词 Skill</div>
                <select
                  className="input"
                  value={props.skillId}
                  onChange={(event) => props.onSkill(event.target.value)}
                  data-image-prompt-skill
                  data-image-prompt-skill-select
                >
                  {props.skills.length === 0 ? <option value="">未启用图片提示词 Skill</option> : null}
                  {props.skills.map((skill) => (
                    <option key={skill.id} value={skill.id}>
                      {skill.displayName}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <div className="label">文本模型</div>
                <select
                  className="input"
                  value={`${props.promptModel.provider}:${props.promptModel.model}`}
                  disabled={props.textModels.length === 0}
                  onChange={(event) => {
                    const found = props.textModels.find(
                      (model) => `${model.provider}:${model.model}` === event.target.value
                    );
                    if (found) {
                      props.onPromptModel({ provider: found.provider, model: found.model });
                    }
                  }}
                >
                  {props.textModels.length === 0 ? <option value="">未配置文本模型</option> : null}
                  {props.textModels.map((model) => (
                    <option key={`${model.provider}:${model.model}`} value={`${model.provider}:${model.model}`}>
                      {model.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <div className="label">提示词数量</div>
                <input
                  className="input mono"
                  type="number"
                  min={1}
                  max={20}
                  value={props.promptCount}
                  onChange={(event) => props.onPromptCount(Math.max(1, Math.min(20, Number(event.target.value) || 1)))}
                />
              </div>
            </div>
          </div>
        ) : (
          <SkuFolderPicker
            folders={props.skuFolders}
            allSelected={allSkuSelected}
            perPromptCount={props.perPromptCount}
            onPerPromptCount={props.onPerPromptCount}
            onToggleAll={() => props.onSkuFolders(props.skuFolders.map((folder) => ({ ...folder, selected: !allSkuSelected })))}
            onToggle={(id) =>
              props.onSkuFolders(
                props.skuFolders.map((folder) => (folder.id === id ? { ...folder, selected: !folder.selected } : folder))
              )
            }
          />
        )}

        <GenerationParamsPanel
          resolution={props.resolution}
          onResolution={props.onResolution}
          quality={props.quality}
          onQuality={props.onQuality}
          outputFormat={props.outputFormat}
          onOutputFormat={props.onOutputFormat}
          aspectRatio={props.aspectRatio}
        />

        {props.providerGrid}

        <div
          className="row"
          style={{
            padding: "14px 22px",
            justifyContent: "space-between",
            borderTop: "1px solid var(--line-faint)",
            background: "var(--panel-2)"
          }}
        >
          <div className="row" style={{ gap: 14, fontSize: 12, color: "var(--ink-3)" }}>
            <span className="row" style={{ gap: 5 }}>
              <Info size={12} />
              {isText ? "预计耗时 6–12s" : `已选 ${selectedSkus.length} 个 SKU · ${totalRefs} 张参考`}
            </span>
            <span className="row" style={{ gap: 5 }}>
              <Lock size={12} />
              本地优先 · 结果落盘到工作空间
            </span>
          </div>
          <button
            type="button"
            className="btn primary lg"
            disabled={!canGenerate || props.busy}
            onClick={props.onGenerate}
            data-image-seed-generate
            data-generate-image-prompts
          >
            {isText ? (
              <>
                <Sparkles size={14} />
                生成 {props.promptCount} 条提示词
              </>
            ) : (
              <>
                <Zap size={14} />
                开始批量出图（{selectedSkus.length} SKU）
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function SkuFolderPicker({
  folders,
  allSelected,
  perPromptCount,
  onPerPromptCount,
  onToggleAll,
  onToggle
}: {
  folders: SkuFolder[];
  allSelected: boolean;
  perPromptCount: number;
  onPerPromptCount: (value: number) => void;
  onToggleAll: () => void;
  onToggle: (id: string) => void;
}): JSX.Element {
  return (
    <div style={{ padding: "18px 22px", display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="field">
        <div className="label">本地文件夹</div>
        <div className="row" style={{ gap: 8 }}>
          <button type="button" className="btn">
            <Folder size={13} />
            选择文件夹
          </button>
          <div
            className="input mono"
            style={{ flex: 1, display: "flex", alignItems: "center", color: "var(--ink-2)" }}
          >
            ~/Pictures/product_winter
          </div>
        </div>
      </div>
      <div>
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
          <div className="label" style={{ margin: 0 }}>
            检测到 {folders.length} 个 SKU 子目录
          </div>
          <button type="button" className="btn xs" onClick={onToggleAll}>
            <span className={cn("checkbox", allSelected && "checked")} style={{ width: 13, height: 13 }} />
            {allSelected ? "取消全选" : "全选"}
          </button>
        </div>
        <div className="sku-list">
          {folders.map((folder) => (
            <div
              key={folder.id}
              className={cn("sku-row", folder.selected && "selected")}
              onClick={() => onToggle(folder.id)}
            >
              <span className={cn("checkbox", folder.selected && "checked")} />
              <div className="sku-thumbs">
                {Array.from({ length: Math.min(folder.refCount, 3) }).map((_, index) => (
                  <div key={index} className="sku-thumb">
                    <Photo image={null} paletteKey={`${folder.id}-${index}`} />
                  </div>
                ))}
                {folder.refCount > 3 ? <div className="sku-thumb sku-more">+{folder.refCount - 3}</div> : null}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{folder.code}</div>
                <div className="mute small" style={{ marginTop: 1 }}>
                  {folder.name}
                </div>
              </div>
              <div className="mono small mute" style={{ whiteSpace: "nowrap" }}>
                {folder.refCount} 张参考
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="field" style={{ maxWidth: 280 }}>
        <div className="label">每个 SKU 生成张数</div>
        <div className="btn-group">
          {[2, 4, 6, 8, 10].map((value) => (
            <button
              key={value}
              type="button"
              className={cn(perPromptCount === value && "active")}
              onClick={() => onPerPromptCount(value)}
            >
              {value} 张
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function GenerationParamsPanel({
  resolution,
  onResolution,
  quality,
  onQuality,
  outputFormat,
  onOutputFormat,
  aspectRatio
}: {
  resolution: ImageGenerationResolution;
  onResolution: (value: ImageGenerationResolution) => void;
  quality: ImageGenerationQuality;
  onQuality: (value: ImageGenerationQuality) => void;
  outputFormat: ImageGenerationOutputFormat;
  onOutputFormat: (value: ImageGenerationOutputFormat) => void;
  aspectRatio: ImageSceneAspectRatio;
}): JSX.Element {
  const resolutionOptions = [...IMAGE_GENERATION_RESOLUTIONS_BY_ASPECT_RATIO[aspectRatio]];
  const safeResolution = resolutionOptions.includes(resolution) ? resolution : resolutionOptions[0];
  const pixelSize = imageGenerationSize(aspectRatio, safeResolution);
  return (
    <div className="generation-params">
      <div className="field">
        <div className="label">分辨率</div>
        <select className="input" value={safeResolution} onChange={(event) => onResolution(event.target.value as ImageGenerationResolution)}>
          {resolutionOptions.map((value) => (
            <option key={value} value={value}>
              {value.toUpperCase()} · {imageGenerationSize(aspectRatio, value)}
            </option>
          ))}
        </select>
        <div className="hint">接口 size: {pixelSize}</div>
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
        <div className="label">输出格式</div>
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
    </div>
  );
}

/* ════════════════════ Batch · Prompt confirm stage ════════════════════ */

interface DraftPrompt {
  id: string;
  text: string;
}

function PromptConfirmStage({
  eyebrow,
  drafts,
  selected,
  onToggle,
  onToggleAll,
  onEdit,
  perPromptCount,
  onPerPromptCount,
  resolution,
  onResolution,
  quality,
  onQuality,
  outputFormat,
  onOutputFormat,
  aspectRatio,
  providerCount,
  busy,
  onBack,
  onConfirm
}: {
  eyebrow: string;
  drafts: DraftPrompt[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  onEdit: (id: string, text: string) => void;
  perPromptCount: number;
  onPerPromptCount: (value: number) => void;
  resolution: ImageGenerationResolution;
  onResolution: (value: ImageGenerationResolution) => void;
  quality: ImageGenerationQuality;
  onQuality: (value: ImageGenerationQuality) => void;
  outputFormat: ImageGenerationOutputFormat;
  onOutputFormat: (value: ImageGenerationOutputFormat) => void;
  aspectRatio: ImageSceneAspectRatio;
  providerCount: number;
  busy: boolean;
  onBack: () => void;
  onConfirm: () => void;
}): JSX.Element {
  const [editingId, setEditingId] = useState<string | null>(null);
  const total = selected.size * perPromptCount;
  return (
    <div className="stage">
      <StageHead
        eyebrow={eyebrow}
        title="确认本批次要交付出图的提示词"
        desc="默认全选，可单独勾选或内联编辑。确认后选中的提示词会入库并按下方张数批量出图。"
      />

      <div className="card" style={{ padding: "12px 16px" }}>
        <div className="row" style={{ gap: 14, flexWrap: "wrap" }}>
          <div className="row" style={{ gap: 6 }}>
            <span
              className={cn("checkbox", selected.size === drafts.length && drafts.length > 0 && "checked")}
              onClick={onToggleAll}
            />
            <span className="small">全选</span>
          </div>
          <span className="mono small mute">
            已选 {selected.size}/{drafts.length} 条
          </span>
          <div className="filter-divider" />
          <div className="row" style={{ gap: 8 }}>
            <span className="small mute">每条出图</span>
            <div className="btn-group">
              {IMAGE_COUNT_OPTIONS.map((value) => (
                <button
                  key={value}
                  type="button"
                  className={cn(perPromptCount === value && "active")}
                  onClick={() => onPerPromptCount(value)}
                >
                  {value} 张
                </button>
              ))}
            </div>
          </div>
          <div className="filter-divider" />
          <span className="small mute">
            Provider：<b style={{ color: "var(--ink)" }}>{providerCount} 个</b>
          </span>
          <div style={{ marginLeft: "auto", fontSize: 12.5 }}>
            <span className="mute">总计 </span>
            <span className="mono">
              {selected.size} × {perPromptCount} ={" "}
            </span>
            <b style={{ color: "var(--brand)", fontSize: 14 }}>{total}</b> 张
          </div>
        </div>
      </div>
      <GenerationParamsPanel
        resolution={resolution}
        onResolution={onResolution}
        quality={quality}
        onQuality={onQuality}
        outputFormat={outputFormat}
        onOutputFormat={onOutputFormat}
        aspectRatio={aspectRatio}
      />

      <div className="prompt-list">
        {drafts.map((draft, index) => {
          const isSelected = selected.has(draft.id);
          const isEditing = editingId === draft.id;
          return (
            <div key={draft.id} className={cn("prompt-row", isSelected && "selected")} data-draft-image-prompt>
              <span className={cn("checkbox", isSelected && "checked")} onClick={() => onToggle(draft.id)} />
              <div className="pr-num">#{String(index + 1).padStart(2, "0")}</div>
              {isEditing ? (
                <textarea
                  className="textarea pr-textarea"
                  rows={3}
                  value={draft.text}
                  maxLength={IMAGE_GENERATION_PROMPT_MAX_LENGTH}
                  autoFocus
                  onChange={(event) => onEdit(draft.id, event.target.value)}
                  onBlur={() => setEditingId(null)}
                />
              ) : (
                <div className="pr-text">{draft.text}</div>
              )}
              <button
                type="button"
                className="edit-ico"
                title="内联编辑"
                onClick={() => setEditingId(isEditing ? null : draft.id)}
              >
                <Pencil size={14} />
              </button>
            </div>
          );
        })}
        {drafts.length === 0 ? (
          <div className="empty">
            <div className="e-ico">
              <Sparkles size={20} />
            </div>
            <div>还没有生成提示词草稿</div>
          </div>
        ) : null}
      </div>

      <div className="row" style={{ justifyContent: "space-between" }}>
        <span className="small mute">此步骤未调用图片 API</span>
        <BackButton onClick={onBack} />
        <button
          type="button"
          className="btn primary lg"
          disabled={selected.size === 0 || busy}
          onClick={onConfirm}
          data-save-image-prompts
        >
          确认，开始出图（{total} 张）
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}

/* ════════════════════════ Quick mode stage ════════════════════════ */

function QuickStage({
  eyebrow,
  text,
  onText,
  count,
  onCount,
  ratio,
  onRatio,
  resolution,
  onResolution,
  quality,
  onQuality,
  outputFormat,
  onOutputFormat,
  providerGrid,
  providerCount,
  busy,
  onGenerate
}: {
  eyebrow: string;
  text: string;
  onText: (value: string) => void;
  count: number;
  onCount: (value: number) => void;
  ratio: ImageSceneAspectRatio;
  onRatio: (value: ImageSceneAspectRatio) => void;
  resolution: ImageGenerationResolution;
  onResolution: (value: ImageGenerationResolution) => void;
  quality: ImageGenerationQuality;
  onQuality: (value: ImageGenerationQuality) => void;
  outputFormat: ImageGenerationOutputFormat;
  onOutputFormat: (value: ImageGenerationOutputFormat) => void;
  providerGrid: JSX.Element;
  providerCount: number;
  busy: boolean;
  onGenerate: () => void;
}): JSX.Element {
  return (
    <div className="stage">
      <StageHead
        eyebrow={eyebrow}
        title="直接写一条提示词，即刻出图"
        desc="不经过 AI 扩写，适合补图、试色、快速验证。提示词会入库便于后续复用。"
      />
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="field">
            <div className="label">
              提示词<span className="req">*</span>
            </div>
              <textarea
                className="textarea serif"
                rows={5}
                value={text}
                maxLength={IMAGE_GENERATION_PROMPT_MAX_LENGTH}
                onChange={(event) => onText(event.target.value)}
                placeholder="例如：俯拍角度，一支墨绿色保温杯与一束干花、几片橙红色枫叶……"
              />
            <div className="row" style={{ justifyContent: "flex-end", fontSize: 11, color: "var(--ink-3)" }}>
              <span className="mono">
                {text.length}/{IMAGE_GENERATION_PROMPT_MAX_LENGTH}
              </span>
            </div>
          </div>
          <div className="grid-2" style={{ maxWidth: 460 }}>
            <div className="field">
              <div className="label">生成数量</div>
              <div className="btn-group" style={{ alignSelf: "flex-start" }}>
                {IMAGE_COUNT_OPTIONS.map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={cn(count === value && "active")}
                    onClick={() => onCount(value)}
                  >
                    {value} 张
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <div className="label">比例</div>
              <select
                className="input"
                value={ratio}
                onChange={(event) => onRatio(event.target.value as ImageSceneAspectRatio)}
              >
                {ASPECT_RATIOS.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <GenerationParamsPanel
            resolution={resolution}
            onResolution={onResolution}
            quality={quality}
            onQuality={onQuality}
            outputFormat={outputFormat}
            onOutputFormat={onOutputFormat}
            aspectRatio={ratio}
          />
        </div>
        {providerGrid}
        <div
          className="row"
          style={{
            padding: "14px 22px",
            justifyContent: "flex-end",
            borderTop: "1px solid var(--line-faint)",
            background: "var(--panel-2)"
          }}
        >
          <button
            type="button"
            className="btn primary lg"
            disabled={!text.trim() || text.length > IMAGE_GENERATION_PROMPT_MAX_LENGTH || providerCount === 0 || busy}
            onClick={onGenerate}
          >
            <Zap size={14} />
            立即出 {count} 张
          </button>
        </div>
      </div>
      <div className="card" style={{ padding: "14px 18px", background: "var(--panel-2)" }}>
        <div className="label" style={{ marginBottom: 8 }}>
          最近用过
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {QUICK_RECENT_PROMPTS.map((recent) => (
            <button
              key={recent}
              type="button"
              className="serif"
              onClick={() => onText(recent)}
              style={{
                textAlign: "left",
                padding: "8px 12px",
                background: "var(--panel)",
                border: "1px solid var(--line)",
                borderRadius: 6,
                fontSize: 12.5,
                color: "var(--ink-2)",
                lineHeight: 1.55
              }}
            >
              {recent}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════ I2I mode stages ════════════════════════ */

function I2IUploadStage({
  eyebrow,
  files,
  onFiles,
  onNext
}: {
  eyebrow: string;
  files: UploadedRef[];
  onFiles: (value: UploadedRef[]) => void;
  onNext: () => void;
}): JSX.Element {
  const addSamples = (): void => {
    onFiles([
      { id: `ref-${Date.now()}-a`, name: "reference_a.jpg", size: "2.1MB" },
      { id: `ref-${Date.now()}-b`, name: "reference_b.png", size: "1.4MB" }
    ]);
  };
  return (
    <div className="stage">
      <StageHead
        eyebrow={eyebrow}
        title="上传 1–3 张参考图，AI 将基于它们出图"
        desc="支持风格迁移、场景换装、构图复用。多张参考会被加权合并。"
      />
      <button type="button" className="dropzone" onClick={addSamples}>
        <div className="dz-ico">
          <Upload size={20} />
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>点击上传 · 或拖拽图片到此处</div>
        <div style={{ fontSize: 12 }}>JPG / PNG / WebP · 单张不超过 10MB</div>
      </button>
      {files.length > 0 ? (
        <div>
          <div className="label" style={{ marginBottom: 10 }}>
            已上传 {files.length} 张
          </div>
          <div className="grid size-md">
            {files.map((file) => (
              <div key={file.id} className="tile">
                <div className="ar sq">
                  <Photo image={null} paletteKey={`ref-${file.id}`} />
                  <div className="badge-tl">
                    <span
                      className="chip"
                      style={{ background: "rgba(20,18,14,0.6)", color: "#fff", borderColor: "transparent" }}
                    >
                      权重 {(1 / files.length).toFixed(2)}
                    </span>
                  </div>
                </div>
                <div className="meta">
                  <div className="row1">
                    <span className="mono small" style={{ color: "var(--ink-2)" }}>
                      {file.name}
                    </span>
                    <span className="mute small">{file.size}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      <div className="row" style={{ justifyContent: "flex-end" }}>
        <button type="button" className="btn primary lg" disabled={files.length === 0} onClick={onNext}>
          下一步 · 辅助提示词
          <ArrowRight size={13} />
        </button>
      </div>
    </div>
  );
}

function I2IAssistStage({
  eyebrow,
  files,
  prompt,
  onPrompt,
  autoAssist,
  onAutoAssist,
  strength,
  onStrength,
  resolution,
  onResolution,
  quality,
  onQuality,
  outputFormat,
  onOutputFormat,
  aspectRatio,
  providerGrid,
  providerCount,
  busy,
  onBack,
  onGenerate
}: {
  eyebrow: string;
  files: UploadedRef[];
  prompt: string;
  onPrompt: (value: string) => void;
  autoAssist: boolean;
  onAutoAssist: (value: boolean) => void;
  strength: number;
  onStrength: (value: number) => void;
  resolution: ImageGenerationResolution;
  onResolution: (value: ImageGenerationResolution) => void;
  quality: ImageGenerationQuality;
  onQuality: (value: ImageGenerationQuality) => void;
  outputFormat: ImageGenerationOutputFormat;
  onOutputFormat: (value: ImageGenerationOutputFormat) => void;
  aspectRatio: ImageSceneAspectRatio;
  providerGrid: JSX.Element;
  providerCount: number;
  busy: boolean;
  onBack: () => void;
  onGenerate: () => void;
}): JSX.Element {
  return (
    <div className="stage">
      <StageHead
        eyebrow={eyebrow}
        title="可选 · 用文字补充想要的变化"
        desc="不填也能出图，仅按参考迁移。填了之后参考图作为风格基底，提示词决定主体变化。"
      />
      <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 18, alignItems: "flex-start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {files.map((file) => (
            <div key={file.id} className="tile" style={{ borderRadius: 6 }}>
              <div className="ar sq">
                <Photo image={null} paletteKey={`ref-${file.id}`} />
              </div>
            </div>
          ))}
        </div>
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="toggle">
              <div className="toggle-body">
                <div className="toggle-title">让 AI 先描述参考图，再补充提示词</div>
                <div className="toggle-desc">自动识别参考图的色彩、构图与产品，给出一条可编辑初稿。</div>
              </div>
              <Toggle on={autoAssist} onChange={onAutoAssist} />
            </div>
            <div className="field">
              <div className="label">提示词（可选）</div>
              <textarea
                className="textarea serif"
                rows={4}
                value={prompt}
                maxLength={IMAGE_GENERATION_PROMPT_MAX_LENGTH}
                onChange={(event) => onPrompt(event.target.value)}
                placeholder="例如：保留参考图的暖色风格，主体换成樱花粉色款保温杯，背景改为窗边雪景"
              />
              <div className="row" style={{ justifyContent: "flex-end", fontSize: 11, color: "var(--ink-3)" }}>
                <span className="mono">
                  {prompt.length}/{IMAGE_GENERATION_PROMPT_MAX_LENGTH}
                </span>
              </div>
            </div>
            <div className="field">
              <div className="label">
                参考强度 <span className="mono mute" style={{ fontWeight: 500 }}>{strength}%</span>
              </div>
              <input
                type="range"
                className="range"
                min={0}
                max={100}
                value={strength}
                onChange={(event) => onStrength(Number(event.target.value))}
              />
              <div className="row" style={{ justifyContent: "space-between", fontSize: 10.5, color: "var(--ink-4)" }}>
                <span>更自由</span>
                <span>更贴近参考</span>
              </div>
            </div>
          </div>
          <GenerationParamsPanel
            resolution={resolution}
            onResolution={onResolution}
            quality={quality}
            onQuality={onQuality}
            outputFormat={outputFormat}
            onOutputFormat={onOutputFormat}
            aspectRatio={aspectRatio}
          />
          {providerGrid}
        </div>
      </div>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <BackButton onClick={onBack} label="返回上传" />
        <button
          type="button"
          className="btn primary lg"
          disabled={providerCount === 0 || busy}
          onClick={onGenerate}
        >
          下一步 · 出图
          <ArrowRight size={13} />
        </button>
      </div>
    </div>
  );
}

/* ════════════════════════ Template mode stage ════════════════════════ */

function TemplateStage({
  eyebrow,
  templateId,
  onTemplate,
  slots,
  onSlots,
  resolution,
  onResolution,
  quality,
  onQuality,
  outputFormat,
  onOutputFormat,
  aspectRatio,
  providerGrid,
  providerCount,
  busy,
  onGenerate
}: {
  eyebrow: string;
  templateId: string;
  onTemplate: (value: string) => void;
  slots: boolean[];
  onSlots: (value: boolean[]) => void;
  resolution: ImageGenerationResolution;
  onResolution: (value: ImageGenerationResolution) => void;
  quality: ImageGenerationQuality;
  onQuality: (value: ImageGenerationQuality) => void;
  outputFormat: ImageGenerationOutputFormat;
  onOutputFormat: (value: ImageGenerationOutputFormat) => void;
  aspectRatio: ImageSceneAspectRatio;
  providerGrid: JSX.Element;
  providerCount: number;
  busy: boolean;
  onGenerate: () => void;
}): JSX.Element {
  const template = SAMPLE_TEMPLATES.find((item) => item.id === templateId) ?? SAMPLE_TEMPLATES[0];
  return (
    <div className="stage">
      <StageHead
        eyebrow={eyebrow}
        title="选定模板，把图片素材塞进对应槽位"
        desc="模板决定版式与文字位置，AI 负责填充画面。适合 SKU 主图、详情页等结构化素材。"
      />
      <div>
        <div className="label" style={{ marginBottom: 10 }}>
          选择模板
        </div>
        <div className="grid size-md">
          {SAMPLE_TEMPLATES.map((item) => (
            <button
              key={item.id}
              type="button"
              className="tile"
              style={{
                textAlign: "left",
                borderColor: item.id === templateId ? "var(--brand)" : undefined,
                boxShadow: item.id === templateId ? "0 0 0 2px var(--brand-soft)" : undefined
              }}
              onClick={() => onTemplate(item.id)}
            >
              <div className="ar wide">
                <Photo image={null} paletteKey={`tpl-${item.id}`} />
                <div className="corner">{item.slots} 槽位</div>
              </div>
              <div className="meta">
                <div style={{ fontWeight: 600, fontSize: 13, color: "var(--ink)" }}>{item.name}</div>
                <div className="mute small">{item.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px" }}>
          <div className="label" style={{ marginBottom: 12 }}>
            {template.name} · 槽位素材
          </div>
          <div className="grid size-sm">
            {Array.from({ length: template.slots }).map((_, index) => {
              const filled = slots[index] ?? false;
              return (
                <button
                  key={index}
                  type="button"
                  className="tile"
                  onClick={() => {
                    const next = Array.from({ length: template.slots }, (_, slotIndex) => slots[slotIndex] ?? false);
                    next[index] = !next[index];
                    onSlots(next);
                  }}
                >
                  <div className="ar sq">
                    {filled ? (
                      <Photo image={null} paletteKey={`slot-${template.id}-${index}`} />
                    ) : (
                      <div className="img" style={{ background: "var(--bg-2)", color: "var(--ink-4)" }}>
                        <div style={{ textAlign: "center", fontSize: 11 }}>
                          <Plus size={18} />
                          <div style={{ marginTop: 4 }}>槽位 {index + 1}</div>
                        </div>
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
        <GenerationParamsPanel
          resolution={resolution}
          onResolution={onResolution}
          quality={quality}
          onQuality={onQuality}
          outputFormat={outputFormat}
          onOutputFormat={onOutputFormat}
          aspectRatio={aspectRatio}
        />
        {providerGrid}
      </div>
      <div className="row" style={{ justifyContent: "flex-end" }}>
        <button type="button" className="btn primary lg" disabled={providerCount === 0 || busy} onClick={onGenerate}>
          下一步 · 渲染合成
          <ArrowRight size={13} />
        </button>
      </div>
    </div>
  );
}

/* ════════════════════════ Generation stage ════════════════════════ */

function GenerationStage({
  eyebrow,
  status,
  error,
  expectedCount,
  images,
  cornerFor,
  onBack,
  onReview
}: {
  eyebrow: string;
  status: GenStatus;
  error: string | null;
  expectedCount: number;
  images: ImageLibraryItem[];
  cornerFor: (image: ImageLibraryItem) => string;
  onBack: () => void;
  onReview: () => void;
}): JSX.Element {
  const done = status === "done";
  const placeholderCount = Math.max(expectedCount - images.length, done ? 0 : Math.max(expectedCount, 4));
  return (
    <div className="stage">
      <StageHead
        eyebrow={eyebrow}
        title={done ? "出图完成" : status === "error" ? "出图未完成" : "正在按批次出图"}
        desc="每张图都会标注来源标签，便于验收阶段溯源。生成期间请不要切换场景。"
        actions={
          done ? (
            <button type="button" className="btn primary" onClick={onReview} data-enter-image-review>
              进入验收
              <ArrowRight size={13} />
            </button>
          ) : undefined
        }
      />
      <div className="card" style={{ padding: "14px 18px" }}>
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 10, flexWrap: "wrap", gap: 10 }}>
          <div className="row" style={{ gap: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>
              {done ? "已完成" : status === "error" ? "已中断" : "出图中"}
            </span>
            <span className="mono small mute" data-image-generation-progress>
              {images.length} / {Math.max(expectedCount, images.length)}
            </span>
          </div>
          {error ? <span className="chip danger">{error}</span> : null}
        </div>
        <div className="prog">
          <div
            className={cn("prog-fill", status === "running" && "indeterminate")}
            style={status === "running" ? undefined : { width: done ? "100%" : "0%" }}
          />
        </div>
      </div>
      {status === "error" ? (
        <div className="info-box" style={{ borderStyle: "solid", borderColor: "var(--danger)" }}>
          <Info size={14} style={{ color: "var(--danger)", flexShrink: 0 }} />
          <span>出图失败：{error ?? "未知错误"}。可返回上一步检查 Provider 配置后重试。</span>
        </div>
      ) : null}
      <div className="grid size-md">
        {images.map((image) => (
          <Tile key={image.id} image={image} paletteKey={image.id} cornerLabel={cornerFor(image)} ratio={image.aspectRatio} />
        ))}
        {Array.from({ length: placeholderCount }).map((_, index) => (
          <Tile
            key={`placeholder-${index}`}
            image={null}
            paletteKey={`placeholder-${index}`}
            placeholder={status === "running" && index === 0 ? "generating" : "queued"}
          />
        ))}
      </div>
      <div>
        <BackButton onClick={onBack} label="返回" />
      </div>
    </div>
  );
}

/* ════════════════════════ Review stage ════════════════════════ */

interface ReviewImage {
  image: ImageLibraryItem;
  verdict: ReviewVerdict;
  isVariant: boolean;
  isNew: boolean;
  label: string;
  corner: string;
}

interface ReviewGroup {
  promptId: string;
  prompt: PromptRecord | null;
  promptIndex: number;
  items: ReviewImage[];
  hasVariants: boolean;
}

function ReviewStage({
  eyebrow,
  groups,
  stats,
  busy,
  onBack,
  onApprove,
  onReject,
  onApproveMany,
  onRejectMany,
  onApproveAllPending,
  onDetail,
  onRegen,
  onCompare
}: {
  eyebrow: string;
  groups: ReviewGroup[];
  stats: { total: number; pending: number; approved: number; rejected: number };
  busy: boolean;
  onBack: () => void;
  onApprove: (image: ImageLibraryItem) => void;
  onReject: (image: ImageLibraryItem) => void;
  onApproveMany: (ids: string[]) => void;
  onRejectMany: (ids: string[]) => void;
  onApproveAllPending: () => void;
  onDetail: (image: ImageLibraryItem) => void;
  onRegen: (image: ImageLibraryItem) => void;
  onCompare: (image: ImageLibraryItem) => void;
}): JSX.Element {
  const [view, setView] = useState<"grid-lg" | "grid-md" | "list">("grid-md");
  const [statusFilter, setStatusFilter] = useState<"all" | ReviewVerdict | "new">("all");
  const [promptFilter, setPromptFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const visibleGroups = groups
    .filter((group) => promptFilter === null || group.promptId === promptFilter)
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (statusFilter === "all") {
          return true;
        }
        if (statusFilter === "new") {
          return item.isNew;
        }
        return item.verdict === statusFilter;
      })
    }))
    .filter((group) => group.items.length > 0);

  const toggleSelect = (id: string): void => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const statCards: Array<{ key: string; label: string; value: number; color: string }> = [
    { key: "total", label: "总图数", value: stats.total, color: "var(--ink)" },
    { key: "pending", label: "待审", value: stats.pending, color: "var(--warn)" },
    { key: "approved", label: "已通过", value: stats.approved, color: "var(--success)" },
    { key: "rejected", label: "已拒绝", value: stats.rejected, color: "var(--danger)" }
  ];

  return (
    <div className="stage">
      <StageHead
        eyebrow={eyebrow}
        title="逐张核对，决定保留 / 重生 / 拒绝"
        desc="点击图片主体可选中批量审核；hover 图片触发详情 / 重生 / 对比。原图与变体收纳在同一变体组。"
      />

      <div className="stat-grid">
        {statCards.map((card) => (
          <div key={card.key} className="card stat-card">
            <div className="label" style={{ fontSize: 10.5 }}>
              {card.label}
            </div>
            <div className="stat-v" style={{ color: card.color }}>
              {card.value}
            </div>
          </div>
        ))}
      </div>

      <div className="filter-bar">
        <div className="seg">
          <span className="seg-label">状态</span>
          <div className="btn-group">
            {(
              [
                ["all", "全部"],
                ["pending", "待审"],
                ["approved", "通过"],
                ["rejected", "拒绝"],
                ["new", "新变体"]
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={cn(statusFilter === key && "active")}
                onClick={() => setStatusFilter(key)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="filter-divider" />
        <div className="seg">
          <span className="seg-label">提示词</span>
          <div className="btn-group">
            <button type="button" className={cn(promptFilter === null && "active")} onClick={() => setPromptFilter(null)}>
              全部
            </button>
            {groups.map((group) => (
              <button
                key={group.promptId}
                type="button"
                className={cn(promptFilter === group.promptId && "active")}
                onClick={() => setPromptFilter(group.promptId)}
              >
                #{String(group.promptIndex + 1).padStart(2, "0")}
              </button>
            ))}
          </div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
          {selected.size > 0 ? (
            <div className="bulk-bar">
              已选 <b className="mono">{selected.size}</b>
              <button
                type="button"
                className="btn xs success"
                data-batch-approve-images
                onClick={() => {
                  onApproveMany([...selected]);
                  setSelected(new Set());
                }}
              >
                <Check size={11} /> 批量通过
              </button>
              <button
                type="button"
                className="btn xs danger"
                data-batch-reject-images
                onClick={() => {
                  onRejectMany([...selected]);
                  setSelected(new Set());
                }}
              >
                <X size={11} /> 批量拒绝
              </button>
              <button type="button" className="btn xs ghost" onClick={() => setSelected(new Set())}>
                取消
              </button>
            </div>
          ) : null}
          <div className="btn-group">
            <button type="button" className={cn(view === "grid-lg" && "active")} onClick={() => setView("grid-lg")} title="大图">
              <Square size={13} />
            </button>
            <button type="button" className={cn(view === "grid-md" && "active")} onClick={() => setView("grid-md")} title="中图">
              <LayoutGrid size={13} />
            </button>
            <button type="button" className={cn(view === "list" && "active")} onClick={() => setView("list")} title="列表">
              <List size={13} />
            </button>
          </div>
        </div>
      </div>

      {visibleGroups.length === 0 ? (
        <div className="empty">
          <div className="e-ico">
            <Filter size={20} />
          </div>
          <div>当前筛选条件下没有图片</div>
        </div>
      ) : view === "list" ? (
        <ReviewList
          groups={visibleGroups}
          selected={selected}
          onToggleSelect={toggleSelect}
          onApprove={onApprove}
          onReject={onReject}
          onDetail={onDetail}
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {visibleGroups.map((group) => (
            <div className="variant-group" key={group.promptId}>
              <div className="vg-head">
                <div className="pnum">#{String(group.promptIndex + 1).padStart(2, "0")}</div>
                <div className="summary serif">{group.prompt?.text ?? "（未关联提示词）"}</div>
                <div className="vcount">
                  {group.items.length} 个版本
                  {group.hasVariants ? ` · ${group.items.filter((item) => item.isVariant).length} 变体` : ""}
                </div>
              </div>
              <div className="vg-body">
                {group.items.map((item) => (
                  <div
                    key={item.image.id}
                    className="vg-cell"
                    style={{ width: view === "grid-lg" ? 248 : 184 }}
                  >
                    <Tile
                      image={item.image}
                      paletteKey={item.image.id}
                      cornerLabel={item.corner}
                      ratio={item.image.aspectRatio}
                      verdict={item.verdict}
                      reviewMode
                      isNew={item.isNew}
                      hasVariants={group.hasVariants}
                      selected={selected.has(item.image.id)}
                      onSelectToggle={() => toggleSelect(item.image.id)}
                      onDetail={() => onDetail(item.image)}
                      onRegen={() => onRegen(item.image)}
                      onCompare={() => onCompare(item.image)}
                    />
                    <div className="vg-cell-label">{item.label}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="row" style={{ justifyContent: "space-between" }}>
        <BackButton onClick={onBack} label="返回生成阶段" />
        <button
          type="button"
          className="btn primary"
          disabled={stats.pending === 0 || busy}
          onClick={onApproveAllPending}
        >
          <Check size={13} />
          一键通过待审（{stats.pending}）
        </button>
      </div>
    </div>
  );
}

function ReviewList({
  groups,
  selected,
  onToggleSelect,
  onApprove,
  onReject,
  onDetail
}: {
  groups: ReviewGroup[];
  selected: Set<string>;
  onToggleSelect: (id: string) => void;
  onApprove: (image: ImageLibraryItem) => void;
  onReject: (image: ImageLibraryItem) => void;
  onDetail: (image: ImageLibraryItem) => void;
}): JSX.Element {
  const rows = groups.flatMap((group) =>
    group.items.map((item) => ({ group, item }))
  );
  return (
    <div className="list-tbl">
      <div className="list-row head">
        <div />
        <div>缩略</div>
        <div>来源提示词</div>
        <div>模型</div>
        <div>版本</div>
        <div>生成时间</div>
        <div>操作</div>
      </div>
      {rows.map(({ group, item }) => (
        <div className="list-row" key={item.image.id}>
          <span
            className={cn("checkbox", selected.has(item.image.id) && "checked")}
            onClick={() => onToggleSelect(item.image.id)}
          />
          <div className="thumb">
            <Photo image={item.image} paletteKey={item.image.id} />
          </div>
          <div>
            <div className="row" style={{ gap: 6, marginBottom: 3 }}>
              <span className="chip" style={{ fontSize: 10 }}>
                #{String(group.promptIndex + 1).padStart(2, "0")}
              </span>
              {item.isVariant ? (
                <span className="chip blue" style={{ fontSize: 10 }}>
                  {item.label}
                </span>
              ) : null}
            </div>
            <div className="lr-prompt">{group.prompt?.text ?? "（未关联提示词）"}</div>
          </div>
          <div className="lr-model">{item.image.sourceModel ?? "—"}</div>
          <div>
            {item.verdict === "pending" ? <span className="status pending">待审</span> : null}
            {item.verdict === "approved" ? <span className="status approved">通过</span> : null}
            {item.verdict === "rejected" ? <span className="status rejected">拒绝</span> : null}
          </div>
          <div className="lr-time">{formatClock(item.image.generatedAt ?? item.image.createdAt)}</div>
          <div className="row" style={{ gap: 4 }}>
            <button type="button" className="btn xs" onClick={() => onDetail(item.image)} title="详情">
              <Eye size={11} />
            </button>
            <button type="button" className="btn xs success" onClick={() => onApprove(item.image)} title="通过">
              <Check size={11} />
            </button>
            <button type="button" className="btn xs danger" onClick={() => onReject(item.image)} title="拒绝">
              <X size={11} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ════════════════════════ Drawers ════════════════════════ */

function SourceDrawer({
  image,
  prompt,
  promptIndex,
  outputDir,
  onClose,
  onApprove,
  onReject,
  onRegen
}: {
  image: ImageLibraryItem;
  prompt: PromptRecord | null;
  promptIndex: number;
  outputDir: string;
  onClose: () => void;
  onApprove: () => void;
  onReject: () => void;
  onRegen: () => void;
}): JSX.Element {
  return (
    <Drawer
      title={`提示词 #${String(promptIndex + 1).padStart(2, "0")} · 溯源`}
      sub={`图片 ID · ${image.id}`}
      wide
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onRegen}>
            <RotateCcw size={13} />
            重新生成
          </button>
          <div style={{ flex: 1 }} />
          <button
            type="button"
            className="btn danger"
            onClick={() => {
              onReject();
              onClose();
            }}
          >
            <X size={13} />
            拒绝
          </button>
          <button
            type="button"
            className="btn success"
            onClick={() => {
              onApprove();
              onClose();
            }}
          >
            <Check size={13} />
            通过
          </button>
        </>
      }
    >
      <div
        style={{
          aspectRatio: image.aspectRatio === "16:9" ? "16/9" : image.aspectRatio === "1:1" ? "1" : "3/4",
          borderRadius: 8,
          overflow: "hidden",
          maxWidth: 280,
          margin: "0 auto",
          position: "relative"
        }}
      >
        <Photo image={image} paletteKey={image.id} />
      </div>
      <div className="row" style={{ justifyContent: "center", gap: 8 }}>
        <span className="chip ghost mono">{image.aspectRatio ?? "—"}</span>
        <span className="chip ghost mono">{image.width ?? "?"}×{image.height ?? "?"}</span>
      </div>
      <hr className="divider" />
      <div>
        <div className="label" style={{ marginBottom: 14 }}>
          <GitBranch size={11} />
          生成链路
        </div>
        <div className="timeline">
          <div className="tl-node done">
            <div className="tl-bullet" />
            <div className="tl-content">
              <div className="tl-label">提示词</div>
              <div className="tl-text">{prompt?.text ?? "（未关联提示词）"}</div>
              {prompt?.notes ? (
                <div style={{ marginTop: 6 }}>
                  <span className="chip">{prompt.notes}</span>
                </div>
              ) : null}
            </div>
          </div>
          <div className="tl-node done">
            <div className="tl-bullet" />
            <div className="tl-content">
              <div className="tl-label">
                模型调用 <span className="ts">{formatClock(image.generatedAt ?? image.createdAt)}</span>
              </div>
              <div className="tl-text mono">
                {`model: ${image.sourceModel ?? "—"}\nratio: ${image.aspectRatio ?? "—"} · size: ${image.width ?? "?"}×${image.height ?? "?"}`}
              </div>
            </div>
          </div>
          <div className="tl-node done">
            <div className="tl-bullet" />
            <div className="tl-content">
              <div className="tl-label">输出落盘</div>
              <div className="tl-text mono">{image.relativePath}</div>
            </div>
          </div>
          <div className="tl-node">
            <div className="tl-bullet" />
            <div className="tl-content">
              <div className="tl-label">
                归属场景 · {image.scene} <span className="ts">{outputDir}</span>
              </div>
              <div className="tl-text mono">状态：{image.status}</div>
            </div>
          </div>
        </div>
      </div>
    </Drawer>
  );
}

function RegenDrawer({
  image,
  prompt,
  promptIndex,
  busy,
  onClose,
  onConfirm
}: {
  image: ImageLibraryItem;
  prompt: PromptRecord | null;
  promptIndex: number;
  busy: boolean;
  onClose: () => void;
  onConfirm: (tweak: string | null) => void;
}): JSX.Element {
  const [mode, setMode] = useState<"keep" | "tweak">("keep");
  const [tweak, setTweak] = useState("，雪天清晨的暖橙逆光，整体更安静一点");
  return (
    <Drawer
      title="重新生成变体"
      sub="原图不会被覆盖，新结果会作为变体并排展示。"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            取消
          </button>
          <div style={{ flex: 1 }} />
          <button
            type="button"
            className="btn primary"
            disabled={busy}
            onClick={() => onConfirm(mode === "tweak" ? tweak : null)}
            data-confirm-image-regenerate
          >
            <Sparkles size={13} />
            开始生成变体
          </button>
        </>
      }
    >
      <div className="card" style={{ display: "flex", gap: 14, padding: 14 }}>
        <div
          style={{
            width: 88,
            aspectRatio: "3/4",
            borderRadius: 6,
            overflow: "hidden",
            position: "relative",
            flexShrink: 0
          }}
        >
          <Photo image={image} paletteKey={image.id} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="row" style={{ gap: 6, marginBottom: 6 }}>
            <span className="chip" style={{ fontSize: 10.5 }}>
              #{String(promptIndex + 1).padStart(2, "0")}
            </span>
            <span className="small mute">原图</span>
          </div>
          <div className="serif" style={{ fontSize: 12, color: "var(--ink-2)", lineHeight: 1.55 }}>
            {prompt?.text ?? "（未关联提示词）"}
          </div>
        </div>
      </div>
      <div>
        <div className="label" style={{ marginBottom: 10 }}>
          生成方式
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button
            type="button"
            className="card"
            style={{
              padding: 14,
              display: "flex",
              gap: 12,
              textAlign: "left",
              borderColor: mode === "keep" ? "var(--brand)" : undefined,
              background: mode === "keep" ? "var(--brand-softer)" : undefined
            }}
            onClick={() => setMode("keep")}
          >
            <span className={cn("radio", mode === "keep" && "checked")} />
            <div>
              <div style={{ fontWeight: 600, fontSize: 13 }}>用原提示词直接重新生成</div>
              <div className="small mute" style={{ marginTop: 3 }}>
                靠随机性带来不同结果，速度最快。
              </div>
            </div>
          </button>
          <button
            type="button"
            className="card"
            style={{
              padding: 14,
              display: "flex",
              gap: 12,
              textAlign: "left",
              borderColor: mode === "tweak" ? "var(--brand)" : undefined,
              background: mode === "tweak" ? "var(--brand-softer)" : undefined
            }}
            onClick={() => setMode("tweak")}
          >
            <span className={cn("radio", mode === "tweak" && "checked")} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>微调提示词后生成</div>
              <div className="small mute" style={{ marginTop: 3 }}>
                在原文基础上追加片段，新增部分会在变体对比中高亮。
              </div>
              {mode === "tweak" ? (
                <textarea
                  className="textarea serif"
                  rows={3}
                  style={{ marginTop: 10 }}
                  value={tweak}
                  onChange={(event) => setTweak(event.target.value)}
                  onClick={(event) => event.stopPropagation()}
                />
              ) : null}
            </div>
          </button>
        </div>
      </div>
      <div className="info-box" style={{ borderStyle: "solid" }}>
        <Info size={14} style={{ color: "var(--blue)", flexShrink: 0 }} />
        <span>本次会生成 2 张变体，使用与原图相同的 Provider 与比例。</span>
      </div>
    </Drawer>
  );
}

function CompareView({
  original,
  variant,
  prompt,
  tweak,
  onBack,
  onApprove,
  onReject,
  verdictOf
}: {
  original: ImageLibraryItem;
  variant: ImageLibraryItem;
  prompt: PromptRecord | null;
  tweak: string | null;
  onBack: () => void;
  onApprove: (image: ImageLibraryItem) => void;
  onReject: (image: ImageLibraryItem) => void;
  verdictOf: (image: ImageLibraryItem) => ReviewVerdict;
}): JSX.Element {
  const panes: Array<{ key: string; image: ImageLibraryItem; label: string; isVariant: boolean }> = [
    { key: "original", image: original, label: "原图", isVariant: false },
    { key: "variant", image: variant, label: "变体", isVariant: true }
  ];
  return (
    <div className="stage">
      <StageHead
        eyebrow="对比视图 · 变体并排"
        title="挑选要保留的版本"
        desc="可同时通过两张，也可只保留一张。变体的提示词差异以高亮显示。"
        actions={<BackButton onClick={onBack} label="返回网格" />}
      />
      <div className="compare-grid">
        {panes.map((pane) => {
          const verdict = verdictOf(pane.image);
          return (
            <div key={pane.key} className={cn("cmp-pane", verdict === "approved" && "selected")}>
              <div className="cmp-head">
                <span className={cn("chip", pane.isVariant && "blue")}>{pane.label}</span>
                <span className="mono mute small">{pane.image.id}</span>
                <span style={{ marginLeft: "auto" }}>
                  {verdict === "pending" ? <span className="status pending">待审</span> : null}
                  {verdict === "approved" ? <span className="status approved">通过</span> : null}
                  {verdict === "rejected" ? <span className="status rejected">拒绝</span> : null}
                </span>
              </div>
              <div className="cmp-img">
                <Photo image={pane.image} paletteKey={pane.image.id} />
              </div>
              <div className="cmp-prompt">
                {prompt?.text ?? "（未关联提示词）"}
                {pane.isVariant && tweak ? <span className="new">{tweak}</span> : null}
              </div>
              <div className="cmp-foot">
                <button
                  type="button"
                  className={cn("btn block", verdict === "approved" && "success")}
                  onClick={() => onApprove(pane.image)}
                >
                  <Check size={13} />
                  通过
                </button>
                <button
                  type="button"
                  className={cn("btn block", verdict === "rejected" && "danger")}
                  onClick={() => onReject(pane.image)}
                >
                  <X size={13} />
                  放弃
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SceneDrawer({
  skills,
  imageModels,
  basePreset,
  busy,
  onClose,
  onSave
}: {
  skills: SkillRecord[];
  imageModels: ImageModelOption[];
  basePreset: ImageScenePreset | null;
  busy: boolean;
  onClose: () => void;
  onSave: (input: {
    name: string;
    skillId: string | null;
    defaultAspectRatio: ImageSceneAspectRatio;
    defaultPerPromptCount: number;
    defaultOutputSubdir: ImageSceneOutputSubdir;
    defaultImageModel: string;
  }) => void;
}): JSX.Element {
  const [name, setName] = useState("");
  const [skillId, setSkillId] = useState(basePreset?.skillId ?? skills[0]?.id ?? "");
  const [ratio, setRatio] = useState<ImageSceneAspectRatio>(basePreset?.defaultAspectRatio ?? "3:4");
  const [perPrompt, setPerPrompt] = useState(basePreset?.defaultPerPromptCount ?? 2);
  const [outputSubdir, setOutputSubdir] = useState<ImageSceneOutputSubdir>(basePreset?.defaultOutputSubdir ?? "main");
  const [imageModel, setImageModel] = useState(basePreset?.defaultImageModel ?? imageModels[0]?.model ?? "mock-image");
  return (
    <Drawer
      title="新增场景"
      sub="场景 = 一个预设包，决定本场景下的默认参数。"
      wide
      onClose={onClose}
      footer={
        <>
          <div style={{ flex: 1 }} />
          <button type="button" className="btn" onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className="btn primary"
            disabled={!name.trim() || busy}
            data-create-image-scene
            onClick={() =>
              onSave({
                name: name.trim(),
                skillId: skillId || null,
                defaultAspectRatio: ratio,
                defaultPerPromptCount: perPrompt,
                defaultOutputSubdir: outputSubdir,
                defaultImageModel: imageModel
              })
            }
          >
            <Check size={13} />
            保存场景
          </button>
        </>
      }
    >
      <div className="field">
        <div className="label">
          场景名称<span className="req">*</span>
        </div>
        <input
          className="input"
          placeholder="例如：种草贴封面"
          value={name}
          onChange={(event) => setName(event.target.value)}
          data-new-image-scene-name
        />
      </div>
      <div className="field">
        <div className="label">绑定提示词 Skill</div>
        <select className="input" value={skillId} onChange={(event) => setSkillId(event.target.value)}>
          <option value="">（暂不绑定）</option>
          {skills.map((skill) => (
            <option key={skill.id} value={skill.id}>
              {skill.displayName}
            </option>
          ))}
        </select>
      </div>
      <div className="grid-2">
        <div className="field">
          <div className="label">默认比例</div>
          <select
            className="input"
            value={ratio}
            onChange={(event) => setRatio(event.target.value as ImageSceneAspectRatio)}
            data-image-aspect-ratio
          >
            {ASPECT_RATIOS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <div className="label">每条出图张数</div>
          <select
            className="input"
            value={perPrompt}
            onChange={(event) => setPerPrompt(Number(event.target.value))}
          >
            {IMAGE_COUNT_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {value} 张
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid-2">
        <div className="field">
          <div className="label">输出目录</div>
          <select
            className="input"
            value={outputSubdir}
            onChange={(event) => setOutputSubdir(event.target.value as ImageSceneOutputSubdir)}
          >
            {OUTPUT_SUBDIRS.map((value) => (
              <option key={value} value={value}>
                images/{value}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <div className="label">默认图片模型</div>
          <select className="input" value={imageModel} onChange={(event) => setImageModel(event.target.value)}>
            {imageModels.length === 0 ? <option value="mock-image">mock-image</option> : null}
            {uniqueArray(imageModels.map((model) => model.model)).map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="info-box" style={{ borderStyle: "solid" }}>
        <Info size={14} style={{ color: "var(--blue)", flexShrink: 0 }} />
        <span>场景预设会成为该场景每次会话的默认值，可在「场景预设包」里随时调整。</span>
      </div>
    </Drawer>
  );
}

function SceneDetailDrawer({
  preset,
  outputDir,
  autoLib,
  autoGen,
  onToggleAutoLib,
  onToggleAutoGen,
  providerGrid,
  onClose
}: {
  preset: ImageScenePreset | null;
  outputDir: string;
  autoLib: boolean;
  autoGen: boolean;
  onToggleAutoLib: (value: boolean) => void;
  onToggleAutoGen: (value: boolean) => void;
  providerGrid: JSX.Element;
  onClose: () => void;
}): JSX.Element {
  return (
    <Drawer
      title={`${preset?.name ?? "场景"} · 预设包`}
      sub="场景级配置会自动继承到该场景每一次会话。"
      wide
      onClose={onClose}
      footer={
        <>
          <div style={{ flex: 1 }} />
          <button type="button" className="btn primary" onClick={onClose}>
            完成
          </button>
        </>
      }
    >
      <div className="card card-pad">
        <div className="label" style={{ marginBottom: 10 }}>
          基础参数
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "10px 18px", fontSize: 13 }}>
          <span className="mute">默认比例</span>
          <span className="mono">{preset?.defaultAspectRatio ?? "—"}</span>
          <span className="mute">每条张数</span>
          <span className="mono">{preset?.defaultPerPromptCount ?? "—"}</span>
          <span className="mute">输出目录</span>
          <span className="mono">{outputDir}</span>
          <span className="mute">默认模型</span>
          <span className="mono">{preset?.defaultImageModel ?? "—"}</span>
          <span className="mute">类型</span>
          <span>{preset?.isBuiltin ? "内置场景" : "自定义场景"}</span>
        </div>
      </div>
      <div className="card card-pad">
        <div className="label" style={{ marginBottom: 12 }}>
          自动化
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="toggle">
            <div className="toggle-body">
              <div className="toggle-title">生成后自动入库</div>
              <div className="toggle-desc">出图完成后图片自动保留在图片库（已默认开启）。</div>
            </div>
            <Toggle on={autoLib} onChange={onToggleAutoLib} />
          </div>
          <div className="toggle">
            <div className="toggle-body">
              <div className="toggle-title">提示词生成后自动出图</div>
              <div className="toggle-desc">批量生产时跳过手动确认，直接进入出图。</div>
            </div>
            <Toggle on={autoGen} onChange={onToggleAutoGen} />
          </div>
        </div>
      </div>
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "14px 22px 0" }}>
          <div className="label">默认 Provider</div>
        </div>
        {providerGrid}
      </div>
    </Drawer>
  );
}

/* ════════════════════════ Orchestrator ════════════════════════ */

export function ImageStudioPage(): JSX.Element {
  const [scenePresets, setScenePresets] = useState<ImageScenePreset[]>([]);
  const [scenePresetId, setScenePresetId] = useState("");
  const [prompts, setPrompts] = useState<PromptRecord[]>([]);
  const [images, setImages] = useState<ImageLibraryItem[]>([]);

  const [mode, setMode] = useState<StudioMode>("batch");
  const [dataSource, setDataSource] = useState<DataSource>("text");
  const [stage, setStage] = useState(0);

  const [seed, setSeed] = useState("保温杯冬季生活方式主图，要有一点温度感和故事感");
  const [promptCount, setPromptCount] = useState(5);
  const [skills, setSkills] = useState<SkillRecord[]>([]);
  const [skillId, setSkillId] = useState("");
  const [textModels, setTextModels] = useState<LabeledModel[]>([]);
  const [promptModel, setPromptModel] = useState<ImagePromptWorkspaceModel>(emptyPromptModel);

  const [drafts, setDrafts] = useState<DraftPrompt[]>([]);
  const [draftSelected, setDraftSelected] = useState<Set<string>>(new Set());

  const [perPromptCount, setPerPromptCount] = useState(2);
  const [aspectRatio, setAspectRatio] = useState<ImageSceneAspectRatio>("3:4");
  const [resolution, setResolution] = useState<ImageGenerationResolution>("1k");
  const [quality, setQuality] = useState<ImageGenerationQuality>("auto");
  const [outputFormat, setOutputFormat] = useState<ImageGenerationOutputFormat>("png");
  const [outputSubdir, setOutputSubdir] = useState<ImageSceneOutputSubdir>("main");
  const [imageModelOptions, setImageModelOptions] = useState<ImageModelOption[]>([]);
  const [selectedTargetKeys, setSelectedTargetKeys] = useState<Set<string>>(new Set());
  const [generationStrategy, setGenerationStrategy] = useState<ImageWorkspaceGenerationStrategy>("load_balance");

  const [skuFolders, setSkuFolders] = useState<SkuFolder[]>(SAMPLE_SKU_FOLDERS);
  const [quickText, setQuickText] = useState(
    "俯拍角度，一支墨绿色保温杯与一束干花、几片橙红色枫叶摆在白色亚麻布上"
  );
  const [quickCount, setQuickCount] = useState(4);
  const [quickRatio, setQuickRatio] = useState<ImageSceneAspectRatio>("3:4");
  const [i2iFiles, setI2iFiles] = useState<UploadedRef[]>([]);
  const [i2iPrompt, setI2iPrompt] = useState("保留参考图的暖色调，主体换成樱花粉色款保温杯");
  const [i2iAuto, setI2iAuto] = useState(true);
  const [i2iStrength, setI2iStrength] = useState(65);
  const [templateId, setTemplateId] = useState(SAMPLE_TEMPLATES[0].id);
  const [templateSlots, setTemplateSlots] = useState<boolean[]>([]);

  const [batchPromptIds, setBatchPromptIds] = useState<string[]>([]);
  const [expectedCount, setExpectedCount] = useState(0);
  const [genStatus, setGenStatus] = useState<GenStatus>("idle");
  const [genError, setGenError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [autoRunning, setAutoRunning] = useState(false);

  const [approvedIds, setApprovedIds] = useState<Set<string>>(() => readApprovedIds());
  const [variantImageIds, setVariantImageIds] = useState<Set<string>>(new Set());
  const [tweakNotes, setTweakNotes] = useState<Map<string, string>>(new Map());

  const [autoLib, setAutoLib] = useState(true);
  const [autoGen, setAutoGen] = useState(false);

  const [sourceImage, setSourceImage] = useState<ImageLibraryItem | null>(null);
  const [regenImage, setRegenImage] = useState<ImageLibraryItem | null>(null);
  const [sceneDrawerOpen, setSceneDrawerOpen] = useState(false);
  const [sceneDetailOpen, setSceneDetailOpen] = useState(false);
  const [compare, setCompare] = useState<{ original: ImageLibraryItem; variant: ImageLibraryItem } | null>(null);
  const [message, setMessage] = useState("");

  const normalizeResolutionForRatio = (ratio: ImageSceneAspectRatio, current: ImageGenerationResolution): ImageGenerationResolution =>
    IMAGE_GENERATION_RESOLUTIONS_BY_ASPECT_RATIO[ratio].includes(current)
      ? current
      : IMAGE_GENERATION_RESOLUTIONS_BY_ASPECT_RATIO[ratio][0];

  /* ---- derived ---- */
  const selectedPreset = useMemo(
    () => scenePresets.find((preset) => preset.id === scenePresetId) ?? scenePresets[0] ?? null,
    [scenePresetId, scenePresets]
  );
  const sceneName = selectedPreset?.name ?? "主图";
  const outputDir = `images/${outputSubdir}`;
  const skillName = useMemo(() => {
    const found = skills.find((skill) => skill.id === skillId);
    return found ? found.displayName : "未绑定";
  }, [skills, skillId]);

  const selectedOptions = useMemo(
    () => imageModelOptions.filter((option) => selectedTargetKeys.has(imageOptionKey(option))),
    [imageModelOptions, selectedTargetKeys]
  );
  const stages = useMemo(() => stagesFor(mode, dataSource), [mode, dataSource]);
  const genStageIndex = mode === "batch" ? (dataSource === "folder" ? 1 : 2) : mode === "i2i" ? 2 : 1;
  const reviewStageIndex = genStageIndex + 1;

  const batchImages = useMemo(() => {
    const idSet = new Set(batchPromptIds);
    return images.filter((image) => image.promptId && idSet.has(image.promptId) && image.status !== "archived");
  }, [images, batchPromptIds]);

  const verdictOf = (image: ImageLibraryItem): ReviewVerdict => {
    if (image.status === "soft_deleted") {
      return "rejected";
    }
    return approvedIds.has(image.id) ? "approved" : "pending";
  };

  const reviewGroups = useMemo<ReviewGroup[]>(() => {
    const byPrompt = new Map<string, ImageLibraryItem[]>();
    for (const image of batchImages) {
      const key = image.promptId ?? "—";
      byPrompt.set(key, [...(byPrompt.get(key) ?? []), image]);
    }
    return batchPromptIds
      .filter((promptId) => byPrompt.has(promptId))
      .map((promptId, promptIndex) => {
        const list = [...(byPrompt.get(promptId) ?? [])].sort((left, right) =>
          (left.createdAt ?? "").localeCompare(right.createdAt ?? "")
        );
        const originals = list.filter((image) => !variantImageIds.has(image.id));
        const variants = list.filter((image) => variantImageIds.has(image.id));
        const ordered = [...originals, ...variants];
        const items: ReviewImage[] = ordered.map((image) => {
          const isVariant = variantImageIds.has(image.id);
          const variantSeq = variants.indexOf(image) + 1;
          const originalSeq = originals.indexOf(image) + 1;
          const verdict: ReviewVerdict =
            image.status === "soft_deleted" ? "rejected" : approvedIds.has(image.id) ? "approved" : "pending";
          return {
            image,
            verdict,
            isVariant,
            isNew: isVariant,
            label: isVariant
              ? `变体 ${variantSeq}`
              : originals.length > 1
                ? `原图 ${originalSeq}`
                : "原图",
            corner: `#${String(promptIndex + 1).padStart(2, "0")}`
          };
        });
        return {
          promptId,
          prompt: prompts.find((prompt) => prompt.id === promptId) ?? null,
          promptIndex,
          items,
          hasVariants: variants.length > 0
        };
      });
  }, [batchImages, batchPromptIds, prompts, variantImageIds, approvedIds]);

  const reviewStats = useMemo(() => {
    let pending = 0;
    let approved = 0;
    let rejected = 0;
    for (const group of reviewGroups) {
      for (const item of group.items) {
        if (item.verdict === "approved") {
          approved += 1;
        } else if (item.verdict === "rejected") {
          rejected += 1;
        } else {
          pending += 1;
        }
      }
    }
    return { total: pending + approved + rejected, pending, approved, rejected };
  }, [reviewGroups]);

  /* ---- data loading ---- */
  async function loadData(): Promise<void> {
    const [nextPrompts, nextImages] = await Promise.all([window.roster.listPrompts(), window.roster.listImages()]);
    setPrompts(nextPrompts);
    setImages(nextImages);
  }

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    window.roster
      .listImageScenePresets()
      .then((presets) => {
        setScenePresets(presets);
        setScenePresetId((current) => current || presets.find((preset) => preset.name === "主图")?.id || presets[0]?.id || "");
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    window.roster
      .listEnabledSkills("image_prompt")
      .then((enabled) => {
        setSkills(enabled);
        setSkillId((current) => current || enabled[0]?.id || "");
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    Promise.all([window.roster.getSettings(), window.roster.listApiKeys()])
      .then(([settings, apiKeys]) => {
        const textOptions = configuredLabeledLlmModelsFromApiKeys(settings, apiKeys, {
          enableFirst: true,
          modelFilter: (option) => !option.model.includes("script")
        });
        setTextModels(textOptions);
        if (textOptions[0]) {
          setPromptModel({ provider: textOptions[0].provider, model: textOptions[0].model });
        }
        const imageOptions = configuredImageModelsFromApiKeys(settings, apiKeys, { enableFirst: true });
        setImageModelOptions(imageOptions);
        const enabledKeys = imageOptions.filter((option) => option.enabled).map(imageOptionKey);
        setSelectedTargetKeys(
          new Set(enabledKeys.length > 0 ? enabledKeys : imageOptions[0] ? [imageOptionKey(imageOptions[0])] : [])
        );
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!selectedPreset) {
      return;
    }
    setAspectRatio(selectedPreset.defaultAspectRatio);
    setResolution((current) => normalizeResolutionForRatio(selectedPreset.defaultAspectRatio, current));
    setPerPromptCount(selectedPreset.defaultPerPromptCount);
    setOutputSubdir(selectedPreset.defaultOutputSubdir);
    if (selectedPreset.skillId) {
      setSkillId(selectedPreset.skillId);
    }
  }, [selectedPreset]);

  const updateQuickRatio = (value: ImageSceneAspectRatio): void => {
    setQuickRatio(value);
    setResolution((current) => normalizeResolutionForRatio(value, current));
  };

  /* ---- helpers ---- */
  const sceneCountFor = (preset: ImageScenePreset): number =>
    images.filter((image) => image.scene === preset.name && image.status === "active").length;

  const eyebrowFor = (stageIndex: number): string =>
    `STEP ${stageIndex + 1} / ${stages.length} · ${stages[stageIndex] ?? ""}`;

  function toggleImageTarget(option: ImageModelOption): void {
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
  }

  function resetForMode(nextMode: StudioMode): void {
    setMode(nextMode);
    setStage(0);
    setGenStatus("idle");
    setGenError(null);
    setBatchPromptIds([]);
    setCompare(null);
  }

  const providerGrid = (
    <ProviderGrid
      options={imageModelOptions}
      selectedKeys={selectedTargetKeys}
      onToggle={toggleImageTarget}
      strategy={generationStrategy}
      onStrategy={setGenerationStrategy}
    />
  );

  /* ---- generation core ---- */
  async function performGeneration(
    payload:
      | { kind: "prompts"; promptIds: string[]; ratio: ImageSceneAspectRatio }
      | {
          kind: "adhoc";
          mode: StudioMode;
          prompts: Array<{ text: string; label?: string }>;
          ratio: ImageSceneAspectRatio;
          count?: number;
        }
  ): Promise<boolean> {
    if (selectedOptions.length === 0) {
      setMessage("请先选择至少一个图片 Provider");
      return false;
    }
    setGenStatus("running");
    setGenError(null);
    setBusy(true);
    const targets = selectedOptions.map(imageOptionToTarget);
    const multiplier = generationStrategy === "all_providers" ? Math.max(targets.length, 1) : 1;
    try {
      if (payload.kind === "prompts") {
        setExpectedCount(payload.promptIds.length * perPromptCount * multiplier);
        const result = await window.roster.generateImages({
          promptIds: payload.promptIds,
          provider: targets[0]?.provider,
          model: targets[0]?.model ?? "mock-image",
          targets,
          generationStrategy,
          aspectRatio: payload.ratio,
          resolution: normalizeResolutionForRatio(payload.ratio, resolution),
          quality,
          outputFormat,
          perPromptCount,
          outputSubdir
        });
        setBatchPromptIds(payload.promptIds);
        if (result.errors.length > 0) {
          setGenError(result.errors.join("；"));
        }
      } else {
        const adHocCount = payload.count ?? perPromptCount;
        setExpectedCount(payload.prompts.length * adHocCount * multiplier);
        const result = await window.roster.generateImagesAdHoc({
          mode: payload.mode,
          scene: sceneName,
          prompts: payload.prompts,
          provider: targets[0]?.provider,
          model: targets[0]?.model ?? "mock-image",
          targets,
          generationStrategy,
          aspectRatio: payload.ratio,
          resolution: normalizeResolutionForRatio(payload.ratio, resolution),
          quality,
          outputFormat,
          perPromptCount: adHocCount,
          outputSubdir
        });
        setBatchPromptIds(result.promptIds);
        if (result.errors.length > 0) {
          setGenError(result.errors.join("；"));
        }
      }
      await loadData();
      setGenStatus("done");
      return true;
    } catch (error) {
      setGenError(error instanceof Error ? error.message : String(error));
      setGenStatus("error");
      return false;
    } finally {
      setBusy(false);
    }
  }

  /* ---- stage actions ---- */
  async function generateDrafts(): Promise<DraftPrompt[]> {
    if (!skillId) {
      setMessage("请先在 Skill 中心启用图片提示词 Skill");
      return [];
    }
    if (!promptModel.model) {
      setMessage("请先到设置页配置文本模型");
      return [];
    }
    setBusy(true);
    try {
      const result = await window.roster.generateImagePrompts({
        skillId,
        scene: sceneName,
        seed,
        count: promptCount,
        model: promptModel
      });
      const next = result.prompts.map((text, index) => ({ id: `draft-${Date.now()}-${index}`, text }));
      setDrafts(next);
      setDraftSelected(new Set(next.map((draft) => draft.id)));
      setMessage(`已通过 ${result.provider} / ${result.model} 生成 ${next.length} 条提示词草稿`);
      return next;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
      return [];
    } finally {
      setBusy(false);
    }
  }

  async function saveDraftsAsPrompts(items: DraftPrompt[]): Promise<string[]> {
    const ids: string[] = [];
    for (const item of items) {
      const saved = await window.roster.savePrompt({ text: item.text, scene: sceneName, status: "active" });
      ids.push(saved.id);
    }
    return ids;
  }

  async function runBatchFromDrafts(items: DraftPrompt[]): Promise<boolean> {
    if (items.length === 0) {
      setMessage("请至少选择一条提示词");
      return false;
    }
    if (items.some((item) => item.text.length > IMAGE_GENERATION_PROMPT_MAX_LENGTH)) {
      setMessage(`提示词最多 ${IMAGE_GENERATION_PROMPT_MAX_LENGTH} 个字符，请先精简后再出图`);
      return false;
    }
    setBusy(true);
    setStage(2);
    try {
      const ids = await saveDraftsAsPrompts(items);
      await loadData();
      return await performGeneration({ kind: "prompts", promptIds: ids, ratio: aspectRatio });
    } catch (error) {
      setGenError(error instanceof Error ? error.message : String(error));
      setGenStatus("error");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function handleSeedGenerate(): Promise<void> {
    if (dataSource === "folder") {
      const selectedSkus = skuFolders.filter((folder) => folder.selected);
      if (selectedSkus.length === 0) {
        setMessage("请至少选择一个 SKU 子目录");
        return;
      }
      setStage(genStageIndex);
      await performGeneration({
        kind: "adhoc",
        mode: "batch",
        ratio: aspectRatio,
        prompts: selectedSkus.map((folder) => ({
          text: `${sceneName} · ${folder.name}，干净背景突出商品主体，冷暖对比，杂志静物风格`,
          label: folder.code
        }))
      });
      return;
    }
    const next = await generateDrafts();
    if (next.length === 0) {
      return;
    }
    setStage(1);
    if (autoGen) {
      void runBatchFromDrafts(next);
    }
  }

  function handleConfirmBatch(): void {
    const chosen = drafts.filter((draft) => draftSelected.has(draft.id));
    void runBatchFromDrafts(chosen);
  }

  async function handleQuickGenerate(): Promise<void> {
    if (!quickText.trim()) {
      setMessage("请先写一条提示词");
      return;
    }
    if (quickText.length > IMAGE_GENERATION_PROMPT_MAX_LENGTH) {
      setMessage(`提示词最多 ${IMAGE_GENERATION_PROMPT_MAX_LENGTH} 个字符`);
      return;
    }
    setStage(genStageIndex);
    await performGeneration({
      kind: "adhoc",
      mode: "quick",
      ratio: quickRatio,
      count: quickCount,
      prompts: [{ text: quickText.trim(), label: "快速单图" }]
    });
  }

  async function handleI2IGenerate(): Promise<void> {
    const base = i2iPrompt.trim() || "基于参考图迁移风格与构图";
    if (base.length > IMAGE_GENERATION_PROMPT_MAX_LENGTH) {
      setMessage(`提示词最多 ${IMAGE_GENERATION_PROMPT_MAX_LENGTH} 个字符`);
      return;
    }
    setStage(genStageIndex);
    await performGeneration({
      kind: "adhoc",
      mode: "i2i",
      ratio: aspectRatio,
      prompts: [{ text: `${base}（参考强度 ${i2iStrength}%）`, label: "图生图" }]
    });
  }

  async function handleTemplateGenerate(): Promise<void> {
    const template = SAMPLE_TEMPLATES.find((item) => item.id === templateId) ?? SAMPLE_TEMPLATES[0];
    setStage(genStageIndex);
    await performGeneration({
      kind: "adhoc",
      mode: "template",
      ratio: aspectRatio,
      prompts: [{ text: `模板套图 · ${template.name}（${template.slots} 槽位）`, label: template.name }]
    });
  }

  async function handleRegenerate(image: ImageLibraryItem, tweak: string | null): Promise<void> {
    if (!image.promptId) {
      setMessage("该图片没有来源提示词，无法重新生成");
      return;
    }
    if (selectedOptions.length === 0) {
      setMessage("请先选择至少一个图片 Provider");
      return;
    }
    setRegenImage(null);
    setBusy(true);
    setMessage("正在生成变体…");
    const before = new Set(images.map((item) => item.id));
    const targets = selectedOptions.map(imageOptionToTarget);
    try {
      await window.roster.generateImages({
        promptIds: [image.promptId],
        provider: targets[0]?.provider,
        model: targets[0]?.model ?? "mock-image",
        targets,
        generationStrategy: "load_balance",
        aspectRatio,
        resolution: normalizeResolutionForRatio(aspectRatio, resolution),
        quality,
        outputFormat,
        perPromptCount: 2,
        outputSubdir
      });
      const [nextImages, nextPrompts] = await Promise.all([
        window.roster.listImages(),
        window.roster.listPrompts()
      ]);
      const freshIds = nextImages.filter((item) => !before.has(item.id)).map((item) => item.id);
      setVariantImageIds((current) => {
        const next = new Set(current);
        freshIds.forEach((id) => next.add(id));
        return next;
      });
      if (tweak) {
        setTweakNotes((current) => {
          const next = new Map(current);
          freshIds.forEach((id) => next.set(id, tweak));
          return next;
        });
      }
      setImages(nextImages);
      setPrompts(nextPrompts);
      setMessage(`已再生成并入库 ${freshIds.length} 张变体`);
    } catch (error) {
      setMessage(`变体生成失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy(false);
    }
  }

  function approveImage(image: ImageLibraryItem): void {
    setApprovedIds((current) => {
      const next = new Set(current);
      next.add(image.id);
      writeApprovedIds(next);
      return next;
    });
  }

  async function rejectImage(image: ImageLibraryItem): Promise<void> {
    setApprovedIds((current) => {
      if (!current.has(image.id)) {
        return current;
      }
      const next = new Set(current);
      next.delete(image.id);
      writeApprovedIds(next);
      return next;
    });
    if (image.status === "soft_deleted") {
      return;
    }
    try {
      await window.roster.softDeleteImage({ imageId: image.id });
      await loadData();
    } catch (error) {
      setMessage(`拒绝失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  function approveMany(ids: string[]): void {
    setApprovedIds((current) => {
      const next = new Set(current);
      ids.forEach((id) => next.add(id));
      writeApprovedIds(next);
      return next;
    });
  }

  async function rejectMany(ids: string[]): Promise<void> {
    const targets = batchImages.filter((image) => ids.includes(image.id) && image.status === "active");
    setApprovedIds((current) => {
      const next = new Set(current);
      ids.forEach((id) => next.delete(id));
      writeApprovedIds(next);
      return next;
    });
    try {
      for (const image of targets) {
        await window.roster.softDeleteImage({ imageId: image.id });
      }
      await loadData();
      setMessage(`已批量拒绝 ${targets.length} 张图片`);
    } catch (error) {
      setMessage(`批量拒绝失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  function approveAllPending(): void {
    const pendingIds = reviewGroups
      .flatMap((group) => group.items)
      .filter((item) => item.verdict === "pending")
      .map((item) => item.image.id);
    approveMany(pendingIds);
    setMessage(`已通过 ${pendingIds.length} 张待审图片`);
  }

  function openCompare(image: ImageLibraryItem): void {
    const group = reviewGroups.find((candidate) => candidate.promptId === image.promptId);
    if (!group) {
      return;
    }
    const original = group.items.find((item) => !item.isVariant)?.image ?? null;
    const variant = variantImageIds.has(image.id)
      ? image
      : group.items.find((item) => item.isVariant)?.image ?? null;
    if (original && variant) {
      setCompare({ original, variant });
    } else {
      setMessage("该组还没有可对比的变体，先用「重生」生成一张");
    }
  }

  async function handleAutoRun(): Promise<void> {
    if (autoRunning) {
      return;
    }
    if (!skillId) {
      setMessage("全流程自动运行需要先启用图片提示词 Skill");
      return;
    }
    if (selectedOptions.length === 0) {
      setMessage("全流程自动运行需要先选择图片 Provider");
      return;
    }
    setAutoRunning(true);
    resetForMode("batch");
    setDataSource("text");
    try {
      const next = await generateDrafts();
      if (next.length === 0) {
        return;
      }
      setStage(1);
      const generated = await runBatchFromDrafts(next);
      if (generated) {
        setStage(3);
      }
    } catch (error) {
      setMessage(`自动运行中断：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setAutoRunning(false);
    }
  }

  async function handleCreateScheduleEntry(): Promise<void> {
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
  }

  async function handleSaveScene(input: {
    name: string;
    skillId: string | null;
    defaultAspectRatio: ImageSceneAspectRatio;
    defaultPerPromptCount: number;
    defaultOutputSubdir: ImageSceneOutputSubdir;
    defaultImageModel: string;
  }): Promise<void> {
    setBusy(true);
    try {
      const saved = await window.roster.saveImageScenePreset(input);
      const presets = await window.roster.listImageScenePresets();
      setScenePresets(presets);
      setScenePresetId(saved.id);
      setSceneDrawerOpen(false);
      setMessage(`已新增场景预设：${saved.name}`);
    } catch (error) {
      setMessage(`新增场景失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy(false);
    }
  }

  /* ---- corner label helper ---- */
  const cornerFor = (image: ImageLibraryItem): string => {
    const index = batchPromptIds.indexOf(image.promptId ?? "");
    return index >= 0 ? `#${String(index + 1).padStart(2, "0")}` : sceneName;
  };

  /* ---- stage renderer ---- */
  function renderStage(): JSX.Element {
    if (mode === "batch" && dataSource === "text") {
      if (stage === 0) {
        return (
          <SeedStage
            eyebrow={eyebrowFor(0)}
            dataSource={dataSource}
            onChangeDataSource={setDataSource}
            seed={seed}
            onSeed={setSeed}
            promptCount={promptCount}
            onPromptCount={setPromptCount}
            skills={skills}
            skillId={skillId}
            onSkill={setSkillId}
            textModels={textModels}
            promptModel={promptModel}
            onPromptModel={setPromptModel}
            skuFolders={skuFolders}
            onSkuFolders={setSkuFolders}
            perPromptCount={perPromptCount}
            onPerPromptCount={setPerPromptCount}
            resolution={resolution}
            onResolution={setResolution}
            quality={quality}
            onQuality={setQuality}
            outputFormat={outputFormat}
            onOutputFormat={setOutputFormat}
            aspectRatio={aspectRatio}
            providerGrid={providerGrid}
            providerCount={selectedOptions.length}
            sceneName={sceneName}
            busy={busy}
            onGenerate={() => void handleSeedGenerate()}
          />
        );
      }
      if (stage === 1) {
        return (
          <PromptConfirmStage
            eyebrow={eyebrowFor(1)}
            drafts={drafts}
            selected={draftSelected}
            onToggle={(id) =>
              setDraftSelected((current) => {
                const next = new Set(current);
                if (next.has(id)) {
                  next.delete(id);
                } else {
                  next.add(id);
                }
                return next;
              })
            }
            onToggleAll={() =>
              setDraftSelected((current) =>
                current.size === drafts.length ? new Set() : new Set(drafts.map((draft) => draft.id))
              )
            }
            onEdit={(id, text) => setDrafts((current) => current.map((draft) => (draft.id === id ? { ...draft, text } : draft)))}
            perPromptCount={perPromptCount}
            onPerPromptCount={setPerPromptCount}
            resolution={resolution}
            onResolution={setResolution}
            quality={quality}
            onQuality={setQuality}
            outputFormat={outputFormat}
            onOutputFormat={setOutputFormat}
            aspectRatio={aspectRatio}
            providerCount={selectedOptions.length}
            busy={busy}
            onBack={() => setStage(0)}
            onConfirm={() => void handleConfirmBatch()}
          />
        );
      }
      if (stage === 2) {
        return (
          <GenerationStage
            eyebrow={eyebrowFor(2)}
            status={genStatus}
            error={genError}
            expectedCount={expectedCount}
            images={batchImages}
            cornerFor={cornerFor}
            onBack={() => setStage(1)}
            onReview={() => setStage(3)}
          />
        );
      }
      return renderReview();
    }

    if (mode === "batch" && dataSource === "folder") {
      if (stage === 0) {
        return (
          <SeedStage
            eyebrow={eyebrowFor(0)}
            dataSource={dataSource}
            onChangeDataSource={setDataSource}
            seed={seed}
            onSeed={setSeed}
            promptCount={promptCount}
            onPromptCount={setPromptCount}
            skills={skills}
            skillId={skillId}
            onSkill={setSkillId}
            textModels={textModels}
            promptModel={promptModel}
            onPromptModel={setPromptModel}
            skuFolders={skuFolders}
            onSkuFolders={setSkuFolders}
            perPromptCount={perPromptCount}
            onPerPromptCount={setPerPromptCount}
            resolution={resolution}
            onResolution={setResolution}
            quality={quality}
            onQuality={setQuality}
            outputFormat={outputFormat}
            onOutputFormat={setOutputFormat}
            aspectRatio={aspectRatio}
            providerGrid={providerGrid}
            providerCount={selectedOptions.length}
            sceneName={sceneName}
            busy={busy}
            onGenerate={() => void handleSeedGenerate()}
          />
        );
      }
      if (stage === 1) {
        return (
          <GenerationStage
            eyebrow={eyebrowFor(1)}
            status={genStatus}
            error={genError}
            expectedCount={expectedCount}
            images={batchImages}
            cornerFor={cornerFor}
            onBack={() => setStage(0)}
            onReview={() => setStage(2)}
          />
        );
      }
      return renderReview();
    }

    if (mode === "quick") {
      if (stage === 0) {
        return (
          <QuickStage
            eyebrow={eyebrowFor(0)}
            text={quickText}
            onText={setQuickText}
            count={quickCount}
            onCount={setQuickCount}
            ratio={quickRatio}
            onRatio={updateQuickRatio}
            resolution={resolution}
            onResolution={setResolution}
            quality={quality}
            onQuality={setQuality}
            outputFormat={outputFormat}
            onOutputFormat={setOutputFormat}
            providerGrid={providerGrid}
            providerCount={selectedOptions.length}
            busy={busy}
            onGenerate={() => void handleQuickGenerate()}
          />
        );
      }
      if (stage === 1) {
        return (
          <GenerationStage
            eyebrow={eyebrowFor(1)}
            status={genStatus}
            error={genError}
            expectedCount={expectedCount}
            images={batchImages}
            cornerFor={cornerFor}
            onBack={() => setStage(0)}
            onReview={() => setStage(2)}
          />
        );
      }
      return renderReview();
    }

    if (mode === "i2i") {
      if (stage === 0) {
        return (
          <I2IUploadStage
            eyebrow={eyebrowFor(0)}
            files={i2iFiles}
            onFiles={setI2iFiles}
            onNext={() => setStage(1)}
          />
        );
      }
      if (stage === 1) {
        return (
          <I2IAssistStage
            eyebrow={eyebrowFor(1)}
            files={i2iFiles}
            prompt={i2iPrompt}
            onPrompt={setI2iPrompt}
            autoAssist={i2iAuto}
            onAutoAssist={setI2iAuto}
            strength={i2iStrength}
            onStrength={setI2iStrength}
            resolution={resolution}
            onResolution={setResolution}
            quality={quality}
            onQuality={setQuality}
            outputFormat={outputFormat}
            onOutputFormat={setOutputFormat}
            aspectRatio={aspectRatio}
            providerGrid={providerGrid}
            providerCount={selectedOptions.length}
            busy={busy}
            onBack={() => setStage(0)}
            onGenerate={() => void handleI2IGenerate()}
          />
        );
      }
      if (stage === 2) {
        return (
          <GenerationStage
            eyebrow={eyebrowFor(2)}
            status={genStatus}
            error={genError}
            expectedCount={expectedCount}
            images={batchImages}
            cornerFor={cornerFor}
            onBack={() => setStage(1)}
            onReview={() => setStage(3)}
          />
        );
      }
      return renderReview();
    }

    // template
    if (stage === 0) {
      return (
        <TemplateStage
          eyebrow={eyebrowFor(0)}
          templateId={templateId}
          onTemplate={setTemplateId}
          slots={templateSlots}
          onSlots={setTemplateSlots}
          resolution={resolution}
          onResolution={setResolution}
          quality={quality}
          onQuality={setQuality}
          outputFormat={outputFormat}
          onOutputFormat={setOutputFormat}
          aspectRatio={aspectRatio}
          providerGrid={providerGrid}
          providerCount={selectedOptions.length}
          busy={busy}
          onGenerate={() => void handleTemplateGenerate()}
        />
      );
    }
    if (stage === 1) {
      return (
        <GenerationStage
          eyebrow={eyebrowFor(1)}
          status={genStatus}
          error={genError}
          expectedCount={expectedCount}
          images={batchImages}
          cornerFor={cornerFor}
          onBack={() => setStage(0)}
          onReview={() => setStage(2)}
        />
      );
    }
    return renderReview();
  }

  function renderReview(): JSX.Element {
    return (
      <ReviewStage
        eyebrow={eyebrowFor(reviewStageIndex)}
        groups={reviewGroups}
        stats={reviewStats}
        busy={busy}
        onBack={() => setStage(genStageIndex)}
        onApprove={approveImage}
        onReject={(image) => void rejectImage(image)}
        onApproveMany={approveMany}
        onRejectMany={(ids) => void rejectMany(ids)}
        onApproveAllPending={approveAllPending}
        onDetail={setSourceImage}
        onRegen={setRegenImage}
        onCompare={openCompare}
      />
    );
  }

  const sourcePrompt = sourceImage ? prompts.find((prompt) => prompt.id === sourceImage.promptId) ?? null : null;
  const regenPrompt = regenImage ? prompts.find((prompt) => prompt.id === regenImage.promptId) ?? null : null;
  const comparePrompt = compare ? prompts.find((prompt) => prompt.id === compare.original.promptId) ?? null : null;
  const promptIndexOf = (image: ImageLibraryItem | null): number =>
    image ? batchPromptIds.indexOf(image.promptId ?? "") : -1;

  return (
    <div className="image-studio" data-image-studio>
      <StudioHead
        totalImages={images.filter((image) => image.status === "active").length}
        pendingCount={reviewStats.pending}
        sceneCount={scenePresets.length}
        autoRunning={autoRunning}
        onCreateSchedule={() => void handleCreateScheduleEntry()}
        onAutoRun={() => void handleAutoRun()}
      />
      <SceneTabs
        presets={scenePresets}
        currentId={selectedPreset?.id ?? ""}
        countFor={sceneCountFor}
        onSelect={(id) => {
          setScenePresetId(id);
          setStage(0);
          setGenStatus("idle");
          setBatchPromptIds([]);
          setCompare(null);
        }}
        onAdd={() => setSceneDrawerOpen(true)}
      />
      <ContextStrip
        mode={mode}
        onChangeMode={resetForMode}
        sceneName={sceneName}
        ratio={aspectRatio}
        skillName={skillName}
        outputDir={outputDir}
        autoLib={autoLib}
        autoGen={autoGen}
        onToggleAutoLib={setAutoLib}
        onToggleAutoGen={setAutoGen}
        onOpenSceneConfig={() => setSceneDetailOpen(true)}
      />

      {!compare ? <PipelineBar stages={stages} current={stage} onJump={(index) => setStage(index)} /> : null}

      {autoRunning ? (
        <div className="auto-banner">
          <div className="spinner" />
          <b>全流程自动运行中</b>
          <span className="mute small">依次走 种子描述 → 提示词 → 出图 → 验收</span>
        </div>
      ) : null}

      <div className="work-col">
        {compare ? (
          <CompareView
            original={compare.original}
            variant={compare.variant}
            prompt={comparePrompt}
            tweak={tweakNotes.get(compare.variant.id) ?? null}
            onBack={() => setCompare(null)}
            onApprove={approveImage}
            onReject={(image) => void rejectImage(image)}
            verdictOf={verdictOf}
          />
        ) : (
          renderStage()
        )}
      </div>

      {message ? (
        <div
          style={{
            position: "fixed",
            bottom: 18,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 40
          }}
        >
          <button
            type="button"
            className="card"
            style={{ padding: "10px 16px", fontSize: 12.5, boxShadow: "var(--shadow-lg)" }}
            onClick={() => setMessage("")}
          >
            {message}
          </button>
        </div>
      ) : null}

      {sourceImage ? (
        <SourceDrawer
          image={sourceImage}
          prompt={sourcePrompt}
          promptIndex={promptIndexOf(sourceImage)}
          outputDir={outputDir}
          onClose={() => setSourceImage(null)}
          onApprove={() => approveImage(sourceImage)}
          onReject={() => void rejectImage(sourceImage)}
          onRegen={() => {
            const target = sourceImage;
            setSourceImage(null);
            setRegenImage(target);
          }}
        />
      ) : null}

      {regenImage ? (
        <RegenDrawer
          image={regenImage}
          prompt={regenPrompt}
          promptIndex={promptIndexOf(regenImage)}
          busy={busy}
          onClose={() => setRegenImage(null)}
          onConfirm={(tweak) => void handleRegenerate(regenImage, tweak)}
        />
      ) : null}

      {sceneDrawerOpen ? (
        <SceneDrawer
          skills={skills}
          imageModels={imageModelOptions}
          basePreset={selectedPreset}
          busy={busy}
          onClose={() => setSceneDrawerOpen(false)}
          onSave={(input) => void handleSaveScene(input)}
        />
      ) : null}

      {sceneDetailOpen ? (
        <SceneDetailDrawer
          preset={selectedPreset}
          outputDir={outputDir}
          autoLib={autoLib}
          autoGen={autoGen}
          onToggleAutoLib={setAutoLib}
          onToggleAutoGen={setAutoGen}
          providerGrid={providerGrid}
          onClose={() => setSceneDetailOpen(false)}
        />
      ) : null}
    </div>
  );
}
