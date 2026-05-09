import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Check, ImageIcon, Library, Paintbrush, Plus, RotateCcw, Sparkles, Trash2 } from "lucide-react";
import type {
  ImageLibraryItem,
  ImagePromptWorkspaceModel,
  ImageSceneAspectRatio,
  ImageSceneOutputSubdir,
  ImageScenePreset,
  PromptRecord,
  SkillRecord
} from "@roster/shared-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type ImageStudioTab = "prompt" | "library" | "generate";

const progressStorageKey = "roster:image-studio:generation-progress:v1";
const imageModelOptions = [
  { label: "Mock 本地", value: "mock-image" },
  { label: "OpenAI GPT Image", value: "gpt-image-1.5" }
] as const;
const textModelOptions: Array<ImagePromptWorkspaceModel & { label: string }> = [
  { label: "Mock 文本", provider: "mock", model: "mock-title-fast" },
  { label: "OpenAI GPT", provider: "openai", model: "gpt-5.4-mini" },
  { label: "Anthropic Claude", provider: "anthropic", model: "claude-sonnet-4-5" },
  { label: "Google Gemini", provider: "google", model: "gemini-2.5-flash" }
];

interface ImageGenerationProgress {
  status: "idle" | "running" | "completed" | "failed";
  promptIds: string[];
  total: number;
  completed: number;
  generatedImageIds: string[];
  error: string | null;
  updatedAt: string;
}

function emptyProgress(): ImageGenerationProgress {
  return {
    status: "idle",
    promptIds: [],
    total: 0,
    completed: 0,
    generatedImageIds: [],
    error: null,
    updatedAt: new Date().toISOString()
  };
}

function readStoredProgress(): ImageGenerationProgress {
  try {
    const raw = window.localStorage.getItem(progressStorageKey);
    if (!raw) {
      return emptyProgress();
    }
    const parsed = JSON.parse(raw) as Partial<ImageGenerationProgress>;
    if (!Array.isArray(parsed.promptIds) || typeof parsed.completed !== "number" || typeof parsed.total !== "number") {
      return emptyProgress();
    }
    return {
      status: parsed.status === "running" || parsed.status === "completed" || parsed.status === "failed" ? parsed.status : "idle",
      promptIds: parsed.promptIds.filter((item): item is string => typeof item === "string"),
      total: Math.max(0, parsed.total),
      completed: Math.max(0, parsed.completed),
      generatedImageIds: Array.isArray(parsed.generatedImageIds)
        ? parsed.generatedImageIds.filter((item): item is string => typeof item === "string")
        : [],
      error: typeof parsed.error === "string" ? parsed.error : null,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString()
    };
  } catch {
    return emptyProgress();
  }
}

function writeStoredProgress(progress: ImageGenerationProgress): void {
  window.localStorage.setItem(progressStorageKey, JSON.stringify(progress));
}

export function ImageStudioPage(): JSX.Element {
  const [tab, setTab] = useState<ImageStudioTab>("prompt");
  const [scenePresets, setScenePresets] = useState<ImageScenePreset[]>([]);
  const [scenePresetId, setScenePresetId] = useState("");
  const [seed, setSeed] = useState("保温杯冬季生活方式主图");
  const [promptCount, setPromptCount] = useState(5);
  const [promptSkills, setPromptSkills] = useState<SkillRecord[]>([]);
  const [selectedPromptSkillId, setSelectedPromptSkillId] = useState("");
  const [promptModel, setPromptModel] = useState<ImagePromptWorkspaceModel>(textModelOptions[0]);
  const [newSceneName, setNewSceneName] = useState("");
  const [draftPrompts, setDraftPrompts] = useState<string[]>([]);
  const [selectedDrafts, setSelectedDrafts] = useState<Set<string>>(new Set());
  const [prompts, setPrompts] = useState<PromptRecord[]>([]);
  const [images, setImages] = useState<ImageLibraryItem[]>([]);
  const [selectedPromptIds, setSelectedPromptIds] = useState<Set<string>>(new Set());
  const [perPromptCount, setPerPromptCount] = useState(2);
  const [imageModel, setImageModel] = useState<string>("mock-image");
  const [aspectRatio, setAspectRatio] = useState<ImageSceneAspectRatio>("1:1");
  const [outputSubdir, setOutputSubdir] = useState<ImageSceneOutputSubdir>("main");
  const [message, setMessage] = useState("");
  const [highlightPromptId, setHighlightPromptId] = useState<string | null>(null);
  const [showDeletedImages, setShowDeletedImages] = useState(false);
  const [selectedImageIds, setSelectedImageIds] = useState<Set<string>>(new Set());
  const [generationProgress, setGenerationProgress] = useState<ImageGenerationProgress>(() => readStoredProgress());
  const [generationRunning, setGenerationRunning] = useState(false);

  const selectedPrompts = useMemo(
    () => prompts.filter((prompt) => selectedPromptIds.has(prompt.id)),
    [prompts, selectedPromptIds]
  );
  const visibleImages = useMemo(
    () => images.filter((image) => showDeletedImages || image.status !== "soft_deleted"),
    [images, showDeletedImages]
  );
  const selectedScenePreset = useMemo(
    () => scenePresets.find((preset) => preset.id === scenePresetId) ?? scenePresets.find((preset) => preset.name === "主图") ?? scenePresets[0] ?? null,
    [scenePresetId, scenePresets]
  );
  const scene = selectedScenePreset?.name ?? "主图";

  async function loadData(): Promise<void> {
    const [nextPrompts, nextImages] = await Promise.all([window.roster.listPrompts(), window.roster.listImages()]);
    setPrompts(nextPrompts);
    setImages(nextImages);
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function loadScenePresets(): Promise<void> {
    const presets = await window.roster.listImageScenePresets();
    setScenePresets(presets);
    setScenePresetId((current) => current || presets.find((preset) => preset.name === "主图")?.id || presets[0]?.id || "");
  }

  useEffect(() => {
    void loadScenePresets();
  }, []);

  async function loadPromptSkills(): Promise<void> {
    const enabled = await window.roster.listEnabledSkills("image_prompt");
    setPromptSkills(enabled);
    if (enabled.length > 0) {
      setSelectedPromptSkillId((current) => current || enabled[0].id);
    }
  }

  useEffect(() => {
    void loadPromptSkills();
  }, []);

  useEffect(() => {
    if (!selectedScenePreset) {
      return;
    }
    setAspectRatio(selectedScenePreset.defaultAspectRatio);
    setPerPromptCount(selectedScenePreset.defaultPerPromptCount);
    setOutputSubdir(selectedScenePreset.defaultOutputSubdir);
    setImageModel(selectedScenePreset.defaultImageModel);
    if (selectedScenePreset.skillId) {
      setSelectedPromptSkillId(selectedScenePreset.skillId);
    }
  }, [selectedScenePreset]);

  async function createScenePreset(): Promise<void> {
    const name = newSceneName.trim();
    if (!name) {
      setMessage("请填写场景名称");
      return;
    }
    const saved = await window.roster.saveImageScenePreset({
      name,
      skillId: selectedPromptSkillId || null,
      defaultAspectRatio: aspectRatio,
      defaultPerPromptCount: perPromptCount,
      defaultOutputSubdir: outputSubdir,
      defaultImageModel: imageModel
    });
    const presets = await window.roster.listImageScenePresets();
    setScenePresets(presets);
    setScenePresetId(saved.id);
    setNewSceneName("");
    setMessage(`已新增场景预设：${saved.name}`);
  }

  function updateGenerationProgress(next: ImageGenerationProgress): void {
    setGenerationProgress(next);
    writeStoredProgress(next);
  }

  async function createDraftPrompts(): Promise<void> {
    if (!selectedPromptSkillId) {
      setMessage("请先在 Skill 中心启用图片提示词 Skill");
      return;
    }
    try {
      const result = await window.roster.generateImagePrompts({
        skillId: selectedPromptSkillId,
        scene,
        seed,
        count: promptCount,
        model: promptModel
      });
      setDraftPrompts(result.prompts);
      setSelectedDrafts(new Set(result.prompts));
      setMessage(`已通过 ${result.provider}/${result.model} 生成提示词草稿；此步骤未调用图片 API`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function saveDraftPrompts(): Promise<void> {
    const selected = [...selectedDrafts];
    for (const text of selected) {
      await window.roster.savePrompt({
        text,
        scene,
        status: "active"
      });
    }
    await loadData();
    setMessage(`已入提示词库 ${selected.length} 条`);
    setTab("library");
  }

  function toggleDraft(text: string): void {
    setSelectedDrafts((current) => {
      const next = new Set(current);
      if (next.has(text)) {
        next.delete(text);
      } else {
        next.add(text);
      }
      return next;
    });
  }

  function togglePrompt(promptId: string): void {
    setSelectedPromptIds((current) => {
      const next = new Set(current);
      if (next.has(promptId)) {
        next.delete(promptId);
      } else {
        next.add(promptId);
      }
      return next;
    });
  }

  function useSelectedPromptsForImages(): void {
    setTab("generate");
    setMessage(`已带入 ${selectedPromptIds.size} 条提示词`);
  }

  async function runImageGenerationBatch(promptIds: string[], actionLabel = "生成"): Promise<void> {
    const uniquePromptIds = [...new Set(promptIds)].filter(Boolean);
    if (uniquePromptIds.length === 0) {
      setMessage("请先在提示词库选择提示词");
      return;
    }
    setGenerationRunning(true);
    const initialProgress: ImageGenerationProgress = {
      status: "running",
      promptIds: uniquePromptIds,
      total: uniquePromptIds.length * perPromptCount,
      completed: 0,
      generatedImageIds: [],
      error: null,
      updatedAt: new Date().toISOString()
    };
    updateGenerationProgress(initialProgress);
    let nextProgress = initialProgress;
    try {
      for (const promptId of uniquePromptIds) {
        const result = await window.roster.generateImages({
          promptIds: [promptId],
          model: imageModel,
          aspectRatio,
          perPromptCount,
          outputSubdir
        });
        nextProgress = {
          ...nextProgress,
          completed: nextProgress.completed + result.savedImages.length,
          generatedImageIds: [...nextProgress.generatedImageIds, ...result.savedImages.map((image) => image.id)],
          updatedAt: new Date().toISOString()
        };
        updateGenerationProgress(nextProgress);
        await loadData();
      }
      const completedProgress = {
        ...nextProgress,
        status: "completed" as const,
        updatedAt: new Date().toISOString()
      };
      updateGenerationProgress(completedProgress);
      setSelectedImageIds(new Set());
      setMessage(`已${actionLabel}并入库 ${completedProgress.completed} 张图片`);
    } catch (error) {
      const failedProgress = {
        ...nextProgress,
        status: "failed" as const,
        error: error instanceof Error ? error.message : String(error),
        updatedAt: new Date().toISOString()
      };
      updateGenerationProgress(failedProgress);
      setMessage(`图片${actionLabel}失败：${failedProgress.error}`);
    } finally {
      setGenerationRunning(false);
      await loadData();
    }
  }

  async function generateImages(): Promise<void> {
    await runImageGenerationBatch([...selectedPromptIds], "生成");
  }

  async function softDeleteImage(imageId: string): Promise<void> {
    const result = await window.roster.softDeleteImage({ imageId });
    await loadData();
    setMessage(
      result.suggestedNegativePrompt
        ? "已软删图片并移动到 _trash；该提示词保留率为 0%，建议标记为反面"
        : "已软删图片并移动到 _trash"
    );
  }

  function toggleImageSelection(imageId: string): void {
    setSelectedImageIds((current) => {
      const next = new Set(current);
      if (next.has(imageId)) {
        next.delete(imageId);
      } else {
        next.add(imageId);
      }
      return next;
    });
  }

  async function regenerateImage(image: ImageLibraryItem): Promise<void> {
    if (!image.promptId) {
      setMessage("这张图片没有来源提示词，无法再生成");
      return;
    }
    await runImageGenerationBatch([image.promptId], "再生成");
  }

  async function batchRegenerateSelectedImages(): Promise<void> {
    const selectedImages = images.filter((image) => selectedImageIds.has(image.id) && image.promptId);
    if (selectedImages.length === 0) {
      setMessage("请先选择带来源提示词的图片");
      return;
    }
    await runImageGenerationBatch(selectedImages.map((image) => image.promptId as string), "批量再生成");
  }

  async function batchSoftDeleteSelectedImages(): Promise<void> {
    const activeImageIds = images
      .filter((image) => selectedImageIds.has(image.id) && image.status === "active")
      .map((image) => image.id);
    if (activeImageIds.length === 0) {
      setMessage("请先选择可软删的图片");
      return;
    }
    let suggestedNegative = false;
    for (const imageId of activeImageIds) {
      const result = await window.roster.softDeleteImage({ imageId });
      suggestedNegative = suggestedNegative || result.suggestedNegativePrompt;
    }
    setSelectedImageIds(new Set());
    await loadData();
    setMessage(
      suggestedNegative
        ? `已批量软删 ${activeImageIds.length} 张图片；存在提示词保留率为 0%，建议标记为反面`
        : `已批量软删 ${activeImageIds.length} 张图片`
    );
  }

  async function createScheduleEntry(): Promise<void> {
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
  }

  function jumpToPrompt(promptId: string | null): void {
    if (!promptId) {
      return;
    }
    setHighlightPromptId(promptId);
    setTab("library");
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 p-5" data-image-studio>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">图片工作室</h1>
          <p className="mt-1 text-sm text-muted-foreground">提示词生成、提示词库和图片生成三段式本地工作流。</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={createScheduleEntry} data-create-image-schedule>
            <CalendarClock />
            定时
          </Button>
          {(["prompt", "library", "generate"] as const).map((item) => (
            <Button key={item} variant={tab === item ? "primary" : "outline"} onClick={() => setTab(item)} data-image-tab={item}>
              {item === "prompt" ? "提示词生成" : item === "library" ? "提示词库" : "图片生成"}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-2">
        {scenePresets.map((preset) => (
          <button
            key={preset.id}
            className={cn(
              "rounded-md border px-3 py-1.5 text-sm",
              scenePresetId === preset.id ? "border-blue-200 bg-blue-50 text-blue-700" : "border-border"
            )}
            onClick={() => setScenePresetId(preset.id)}
            type="button"
            data-image-scene-preset={preset.name}
          >
            {preset.name}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <input
            className="h-8 w-32 rounded-md border border-input bg-background px-2 text-sm outline-none"
            value={newSceneName}
            onChange={(event) => setNewSceneName(event.target.value)}
            placeholder="新增场景"
            data-new-image-scene-name
          />
          <Button variant="outline" size="sm" onClick={() => void createScenePreset()} data-create-image-scene>
            <Plus />
            新增场景
          </Button>
        </div>
      </div>

      {tab === "prompt" ? (
        <section className="grid min-h-0 flex-1 grid-cols-[360px_minmax(0,1fr)] gap-4">
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between gap-2 text-sm font-semibold">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-primary" />
                当前预设：{scene}
                {selectedScenePreset?.isBuiltin ? <Badge variant="neutral">内置</Badge> : <Badge variant="info">自定义</Badge>}
              </div>
              <Button variant="outline" size="sm" onClick={() => void loadPromptSkills()} data-refresh-image-prompt-skills>
                刷新 Skill
              </Button>
            </div>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-foreground">提示词 Skill</span>
              <select
                className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none"
                value={selectedPromptSkillId}
                onChange={(event) => setSelectedPromptSkillId(event.target.value)}
                data-image-prompt-skill-select
              >
                {promptSkills.length === 0 ? <option value="">当前工作空间未启用图片提示词 Skill</option> : null}
                {promptSkills.map((skill) => (
                  <option key={skill.id} value={skill.id}>
                    {skill.displayName}
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-3 flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-foreground">文本模型</span>
              <select
                className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none"
                value={`${promptModel.provider}:${promptModel.model}`}
                onChange={(event) => {
                  const selected = textModelOptions.find((option) => `${option.provider}:${option.model}` === event.target.value);
                  if (selected) {
                    setPromptModel({ provider: selected.provider, model: selected.model });
                  }
                }}
                data-image-prompt-model
              >
                {textModelOptions.map((model) => (
                  <option key={`${model.provider}:${model.model}`} value={`${model.provider}:${model.model}`}>
                    {model.label}
                  </option>
                ))}
              </select>
            </label>
            <Input label="种子描述" value={seed} onChange={(event) => setSeed(event.target.value)} data-image-seed />
            <div className="mt-3">
              <Input
                label="生成数量"
                type="number"
                min={1}
                max={100}
                value={promptCount}
                onChange={(event) => setPromptCount(Number(event.target.value))}
                data-image-prompt-count
              />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground" data-image-scene-preset-summary>
              <span>默认比例：{aspectRatio}</span>
              <span>每条张数：{perPromptCount}</span>
              <span>输出目录：images/{outputSubdir}</span>
              <span>图片模型：{imageModel}</span>
            </div>
            <Button
              className="mt-4 w-full"
              variant="primary"
              onClick={() => void createDraftPrompts()}
              disabled={!selectedPromptSkillId}
              data-generate-image-prompts
            >
              <Sparkles />
              生成提示词
            </Button>
            <Button className="mt-2 w-full" variant="outline" onClick={saveDraftPrompts} disabled={selectedDrafts.size === 0} data-save-image-prompts>
              <Library />
              入提示词库 {selectedDrafts.size}
            </Button>
          </div>
          <div className="min-h-0 overflow-y-auto rounded-lg border border-border bg-card p-4">
            <div className="mb-3 text-sm font-semibold">生成结果</div>
            <div className="flex flex-col gap-2">
              {draftPrompts.map((prompt) => {
                const selected = selectedDrafts.has(prompt);
                return (
                  <button
                    key={prompt}
                    className={cn("rounded-md border p-3 text-left text-sm leading-6", selected ? "border-emerald-200 bg-emerald-50" : "border-border")}
                    onClick={() => toggleDraft(prompt)}
                    type="button"
                    data-draft-image-prompt
                  >
                    {selected ? <Check className="mr-2 inline size-4 text-emerald-600" /> : null}
                    {prompt}
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      ) : null}

      {tab === "library" ? (
        <section className="min-h-0 flex-1 overflow-hidden rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Library className="size-4 text-primary" />
              提示词库
              <Badge>{prompts.length} 条</Badge>
            </div>
            <Button variant="primary" onClick={useSelectedPromptsForImages} disabled={selectedPromptIds.size === 0} data-use-prompts-for-images>
              <Paintbrush />
              用选中提示词去生成图 {selectedPromptIds.size}
            </Button>
          </div>
          <div className="h-full min-h-0 overflow-y-auto">
            {prompts.map((prompt) => {
              const selected = selectedPromptIds.has(prompt.id);
              const highlighted = highlightPromptId === prompt.id;
              return (
                <button
                  key={prompt.id}
                  className={cn(
                    "grid w-full grid-cols-[32px_minmax(320px,1fr)_120px_100px_100px] items-center border-b border-border px-4 py-2 text-left text-sm",
                    highlighted && "bg-amber-50",
                    selected && "text-primary"
                  )}
                  onClick={() => togglePrompt(prompt.id)}
                  type="button"
                  data-prompt-row={prompt.id}
                >
                  <span>{selected ? <Check className="size-4" /> : null}</span>
                  <span className="truncate">{prompt.text}</span>
                  <span>{prompt.scene}</span>
                  <span>{prompt.generatedCount ? `${Math.round((prompt.keptCount / prompt.generatedCount) * 100)}%` : "-"}</span>
                  <Badge variant={prompt.status === "active" ? "success" : prompt.status === "negative" ? "danger" : "neutral"}>{prompt.status}</Badge>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      {tab === "generate" ? (
        <section className="grid min-h-0 flex-1 grid-cols-[300px_minmax(0,1fr)] gap-4">
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="mb-3 text-sm font-semibold">当前批次：{selectedPrompts.length} 条提示词</div>
            <Input
              label="每条生成张数"
              type="number"
              min={1}
              max={8}
              value={perPromptCount}
              onChange={(event) => setPerPromptCount(Number(event.target.value))}
              data-image-per-prompt
            />
            <label className="mt-3 flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-foreground">模型</span>
              <select
                className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none"
                value={imageModel}
                onChange={(event) => setImageModel(event.target.value as typeof imageModel)}
                data-image-model
              >
                {imageModelOptions.map((model) => (
                  <option key={model.value} value={model.value}>
                    {model.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-3 flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-foreground">比例</span>
              <select
                className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none"
                value={aspectRatio}
                onChange={(event) => setAspectRatio(event.target.value as typeof aspectRatio)}
                data-image-aspect-ratio
              >
                {["1:1", "3:4", "9:16", "16:9"].map((ratio) => (
                  <option key={ratio} value={ratio}>
                    {ratio}
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-3 flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-foreground">输出目录</span>
              <select
                className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none"
                value={outputSubdir}
                onChange={(event) => setOutputSubdir(event.target.value as ImageSceneOutputSubdir)}
                data-image-output-subdir
              >
                <option value="main">main 主图素材</option>
                <option value="detail">detail 详情页素材</option>
                <option value="live_cover">live_cover 封面素材</option>
              </select>
            </label>
            <Button className="mt-4 w-full" variant="primary" onClick={generateImages} disabled={generationRunning} data-generate-images>
              <ImageIcon />
              开始生成
            </Button>
            <div className="mt-4 rounded-md border border-border bg-background p-3 text-xs" data-image-generation-progress>
              <div className="font-medium text-foreground">
                进度：{generationProgress.completed}/{generationProgress.total}
              </div>
              <div className="mt-1 text-muted-foreground">
                状态：
                {generationProgress.status === "running"
                  ? "生成中"
                  : generationProgress.status === "completed"
                    ? "已完成"
                    : generationProgress.status === "failed"
                      ? "失败"
                      : "未开始"}
              </div>
              {generationProgress.status === "failed" ? (
                <Button
                  className="mt-3 w-full"
                  variant="outline"
                  size="sm"
                  onClick={() => runImageGenerationBatch(generationProgress.promptIds, "继续生成")}
                  data-resume-image-batch
                >
                  <RotateCcw />
                  继续
                </Button>
              ) : null}
            </div>
          </div>
          <div className="min-h-0 overflow-y-auto rounded-lg border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="text-sm font-semibold">图片网格</div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={batchRegenerateSelectedImages}
                  disabled={selectedImageIds.size === 0 || generationRunning}
                  data-batch-regenerate-images
                >
                  <RotateCcw />
                  批量再生成 {selectedImageIds.size}
                </Button>
                <Button
                  variant="outline"
                  onClick={batchSoftDeleteSelectedImages}
                  disabled={selectedImageIds.size === 0}
                  data-batch-soft-delete-images
                >
                  <Trash2 />
                  批量软删
                </Button>
                <Button
                  variant={showDeletedImages ? "primary" : "outline"}
                  onClick={() => setShowDeletedImages((current) => !current)}
                  data-show-deleted-images
                >
                  {showDeletedImages ? "隐藏软删" : "查看软删"}
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-3">
              {visibleImages.map((image) => (
                <div key={image.id} className="rounded-lg border border-border p-2" data-image-card={image.id}>
                  <div className="flex aspect-square items-center justify-center rounded-md bg-muted text-xs text-muted-foreground">
                    {image.fileName}
                  </div>
                  <div className="mt-2 truncate text-xs">{image.scene}</div>
                  <div className="mt-1 flex items-center justify-between">
                    <Badge variant={image.status === "active" ? "success" : image.status === "soft_deleted" ? "warning" : "neutral"}>{image.status}</Badge>
                    <button className="text-xs text-primary" onClick={() => jumpToPrompt(image.promptId)} type="button" data-jump-to-prompt={image.promptId ?? ""}>
                      跳转到提示词
                    </button>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <Button
                      className="flex-1"
                      variant={selectedImageIds.has(image.id) ? "primary" : "outline"}
                      size="sm"
                      onClick={() => toggleImageSelection(image.id)}
                      data-select-image={image.id}
                    >
                      {selectedImageIds.has(image.id) ? "已选" : "选择"}
                    </Button>
                    <Button
                      className="flex-1"
                      variant="outline"
                      size="sm"
                      onClick={() => regenerateImage(image)}
                      disabled={!image.promptId || generationRunning}
                      data-regenerate-image={image.id}
                    >
                      <RotateCcw />
                      再生成
                    </Button>
                  </div>
                  {image.status === "active" ? (
                    <Button className="mt-2 w-full" variant="outline" onClick={() => softDeleteImage(image.id)} data-soft-delete-image={image.id}>
                      <Trash2 />
                      软删
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {message ? <div className="rounded-md border border-border bg-card px-4 py-3 text-sm" data-image-studio-message>{message}</div> : null}
    </div>
  );
}
