import { useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Check, Clipboard, Download, FileText, Image, Plus, Search, Tags, Type, Upload, WandSparkles } from "lucide-react";
import type { ComponentType, SVGProps } from "react";
import type {
  ImageLibraryItem,
  ImageStatus,
  PromptRecord,
  PromptStatus,
  ScriptRecord,
  ScriptStatus,
  TagGroup,
  TagImportSummary,
  TagRecord,
  TitleRecord
} from "@roster/shared-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { AppPage } from "@/stores/app-store";

type LibraryPageId = "lib_tags" | "lib_titles" | "lib_scripts" | "lib_prompts" | "lib_images";

interface LibraryConfig {
  title: string;
  description: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  primaryAction: string;
  secondaryAction?: string;
  columns: string[];
  emptyTitle: string;
  emptyDescription: string;
}

interface TagFormState {
  skuCode: string;
  skuStyle: string;
  tag1: string;
  tag2: string;
  tag3: string;
  tag4: string;
  tag5: string;
  tagGroup: TagGroup;
  notes: string;
}

interface TitleFormState {
  text: string;
  sourceSkillId: string;
  score: string;
  status: "active" | "archived";
  notes: string;
}

interface PromptFormState {
  text: string;
  scene: string;
  status: PromptStatus;
  notes: string;
}

interface ScriptFormState {
  text: string;
  sourceSkillId: string;
  skuCode: string;
  status: ScriptStatus;
  notes: string;
}

interface ImageFormState {
  relativePath: string;
  promptId: string;
  scene: string;
  width: string;
  height: string;
  aspectRatio: string;
  sourceModel: string;
  status: ImageStatus;
  tags: string;
  notes: string;
  generatedAt: string;
}

const libraryConfigs: Record<LibraryPageId, LibraryConfig> = {
  lib_tags: {
    title: "标签库",
    description: "按 SKU 维护默认标签与测试标签，后续任务单会按比例抽取。",
    icon: Tags,
    primaryAction: "新增标签组",
    secondaryAction: "导入 CSV",
    columns: ["SKU", "款式", "标签一", "标签二", "标签三", "标签四", "标签五", "标签组", "备注"],
    emptyTitle: "还没有标签组",
    emptyDescription: "可先手动新增，或按 SKU、款式、标签一到标签五的结构导入 CSV。"
  },
  lib_titles: {
    title: "标题库",
    description: "沉淀可复用标题，记录来源 Skill、评分、使用次数和状态。",
    icon: Type,
    primaryAction: "新增标题",
    columns: ["标题", "来源", "评分", "使用次数", "最近使用", "状态"],
    emptyTitle: "标题库为空",
    emptyDescription: "标题工作区生成并入库后会显示在这里，也可以手动补充。"
  },
  lib_scripts: {
    title: "文案库",
    description: "管理视频文案生成结果，支持复制、筛选和导出。",
    icon: FileText,
    primaryAction: "新增文案",
    columns: ["文案摘要", "SKU", "来源", "使用次数", "创建时间", "状态"],
    emptyTitle: "文案库为空",
    emptyDescription: "文案工作区生成并入库后会显示在这里。"
  },
  lib_prompts: {
    title: "提示词库",
    description: "管理图片生成提示词，跟踪场景、生成数和入库率。",
    icon: WandSparkles,
    primaryAction: "新增提示词",
    columns: ["提示词", "场景", "生成数", "入库数", "入库率", "状态"],
    emptyTitle: "提示词库为空",
    emptyDescription: "图片工作室生成的提示词入库后会显示在这里。"
  },
  lib_images: {
    title: "图片库",
    description: "管理 AI 生成图片、场景、来源提示词、状态和软删记录。",
    icon: Image,
    primaryAction: "新增图片记录",
    columns: ["缩略图", "文件名", "场景", "来源提示词", "尺寸", "状态", "创建时间"],
    emptyTitle: "图片库为空",
    emptyDescription: "图片工作室生成并入库后会显示在这里，软删图片默认隐藏。"
  }
};

export function isLibraryPage(page: AppPage): page is LibraryPageId {
  return page in libraryConfigs;
}

export function LibraryPage({ page }: { page: LibraryPageId }): JSX.Element {
  const config = libraryConfigs[page];
  const Icon = config.icon;
  const [query, setQuery] = useState("");
  const [tags, setTags] = useState<TagRecord[]>([]);
  const [titles, setTitles] = useState<TitleRecord[]>([]);
  const [prompts, setPrompts] = useState<PromptRecord[]>([]);
  const [scripts, setScripts] = useState<ScriptRecord[]>([]);
  const [images, setImages] = useState<ImageLibraryItem[]>([]);
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [selectedTitleId, setSelectedTitleId] = useState<string | null>(null);
  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(null);
  const [selectedScriptId, setSelectedScriptId] = useState<string | null>(null);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [tagForm, setTagForm] = useState<TagFormState>({
    skuCode: "",
    skuStyle: "",
    tag1: "",
    tag2: "",
    tag3: "",
    tag4: "",
    tag5: "",
    tagGroup: "default",
    notes: ""
  });
  const [titleForm, setTitleForm] = useState<TitleFormState>({
    text: "",
    sourceSkillId: "",
    score: "",
    status: "active",
    notes: ""
  });
  const [promptForm, setPromptForm] = useState<PromptFormState>({
    text: "",
    scene: "主图",
    status: "active",
    notes: ""
  });
  const [scriptForm, setScriptForm] = useState<ScriptFormState>({
    text: "",
    sourceSkillId: "",
    skuCode: "",
    status: "active",
    notes: ""
  });
  const [imageForm, setImageForm] = useState<ImageFormState>({
    relativePath: "images/main/example.jpg",
    promptId: "",
    scene: "主图",
    width: "",
    height: "",
    aspectRatio: "",
    sourceModel: "",
    status: "active",
    tags: "",
    notes: "",
    generatedAt: ""
  });
  const [importSummary, setImportSummary] = useState<TagImportSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedScriptIds, setSelectedScriptIds] = useState<Set<string>>(new Set());
  const [scriptActionMessage, setScriptActionMessage] = useState("");
  const parentRef = useRef<HTMLDivElement>(null);
  const isTagsPage = page === "lib_tags";
  const isTitlesPage = page === "lib_titles";
  const isPromptsPage = page === "lib_prompts";
  const isScriptsPage = page === "lib_scripts";
  const isImagesPage = page === "lib_images";

  useEffect(() => {
    if (!isTagsPage && !isTitlesPage && !isPromptsPage && !isScriptsPage && !isImagesPage) {
      return;
    }
    setLoading(true);
    setError(null);
    const request = isTagsPage
      ? window.roster.listTags()
      : isTitlesPage
        ? window.roster.listTitles()
        : isPromptsPage
          ? window.roster.listPrompts()
          : isScriptsPage
            ? window.roster.listScripts()
            : window.roster.listImages();
    request
      .then((records) => {
        if (isTagsPage) {
          setTags(records as TagRecord[]);
        } else if (isTitlesPage) {
          setTitles(records as TitleRecord[]);
        } else if (isPromptsPage) {
          setPrompts(records as PromptRecord[]);
        } else if (isScriptsPage) {
          setScripts(records as ScriptRecord[]);
          setSelectedScriptIds(new Set());
          setScriptActionMessage("");
        } else {
          setImages(records as ImageLibraryItem[]);
        }
      })
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : String(caught)))
      .finally(() => setLoading(false));
  }, [isImagesPage, isPromptsPage, isScriptsPage, isTagsPage, isTitlesPage]);

  const filteredTags = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!isTagsPage || !normalizedQuery) {
      return tags;
    }
    return tags.filter((tag) =>
      [tag.skuCode, tag.skuStyle, tag.tag1, tag.tag2, tag.tag3, tag.tag4, tag.tag5, tag.tagGroup, tag.notes]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(normalizedQuery))
    );
  }, [isTagsPage, query, tags]);

  const filteredTitles = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!isTitlesPage || !normalizedQuery) {
      return titles;
    }
    return titles.filter((title) =>
      [title.text, title.sourceSkillId, title.status, title.notes]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(normalizedQuery))
    );
  }, [isTitlesPage, query, titles]);

  const filteredPrompts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!isPromptsPage || !normalizedQuery) {
      return prompts;
    }
    return prompts.filter((prompt) =>
      [prompt.text, prompt.scene, prompt.status, prompt.notes]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(normalizedQuery))
    );
  }, [isPromptsPage, prompts, query]);

  const filteredScripts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!isScriptsPage || !normalizedQuery) {
      return scripts;
    }
    return scripts.filter((script) =>
      [script.text, script.skuCode, script.sourceSkillId, script.status, script.notes]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(normalizedQuery))
    );
  }, [isScriptsPage, query, scripts]);

  const filteredImages = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!isImagesPage || !normalizedQuery) {
      return images;
    }
    return images.filter((image) =>
      [
        image.fileName,
        image.relativePath,
        image.currentAbsolutePath,
        image.scene,
        image.promptId,
        image.aspectRatio,
        image.sourceModel,
        image.status,
        image.tags,
        image.notes
      ]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(normalizedQuery))
    );
  }, [images, isImagesPage, query]);

  const rowVirtualizer = useVirtualizer({
    count: isImagesPage
      ? filteredImages.length
      : isScriptsPage
        ? filteredScripts.length
        : isPromptsPage
          ? filteredPrompts.length
          : isTitlesPage
            ? filteredTitles.length
            : filteredTags.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 36,
    initialRect: { width: 960, height: 360 },
    overscan: 12
  });

  const onImportTags = async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const summary = await window.roster.importTagsCsv();
      setImportSummary(summary);
      setTags(await window.roster.listTags());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setLoading(false);
    }
  };

  const totalCount = isTagsPage ? tags.length : 0;
  const activeCount = isTagsPage
      ? tags.filter((tag) => tag.tagGroup === "default").length
      : isTitlesPage
        ? titles.filter((title) => title.status === "active").length
        : isPromptsPage
          ? prompts.filter((prompt) => prompt.status === "active").length
          : isScriptsPage
            ? scripts.filter((script) => script.status === "active").length
            : images.filter((image) => image.status === "active").length;
  const testCount = isTagsPage
    ? tags.filter((tag) => tag.tagGroup === "test").length
    : isTitlesPage
      ? titles.filter((title) => title.status === "archived").length
      : isPromptsPage
        ? prompts.filter((prompt) => prompt.status !== "active").length
        : isScriptsPage
          ? scripts.filter((script) => script.status === "archived").length
          : images.filter((image) => image.status !== "active").length;
  const displayedCount = isTagsPage
    ? filteredTags.length
    : isTitlesPage
      ? filteredTitles.length
      : isPromptsPage
        ? filteredPrompts.length
        : isScriptsPage
          ? filteredScripts.length
          : isImagesPage
            ? filteredImages.length
          : 0;

  useEffect(() => {
    rowVirtualizer.measure();
  }, [displayedCount, rowVirtualizer]);

  const selectedScripts = useMemo(
    () => scripts.filter((script) => selectedScriptIds.has(script.id)),
    [scripts, selectedScriptIds]
  );

  function toggleScriptSelection(scriptId: string): void {
    setSelectedScriptIds((current) => {
      const next = new Set(current);
      if (next.has(scriptId)) {
        next.delete(scriptId);
      } else {
        next.add(scriptId);
      }
      return next;
    });
  }

  async function copyScriptsToClipboard(): Promise<void> {
    const targetScripts = selectedScripts.length > 0 ? selectedScripts : scripts;
    if (targetScripts.length === 0) {
      setScriptActionMessage("没有可复制的文案");
      return;
    }
    const text = targetScripts.map((script) => script.text).join("\n\n---\n\n");
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        throw new Error("Clipboard API unavailable");
      }
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.append(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
    }
    setScriptActionMessage(`已复制 ${targetScripts.length} 条文案`);
  }

  async function exportScripts(scriptIds: string[]): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const result = await window.roster.exportScripts({
        scriptIds,
        formats: ["txt", "csv"]
      });
      setScriptActionMessage(`已导出 ${result.exportedCount} 条文案到 ${result.exportRelativeDir}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setLoading(false);
    }
  }

  const openTag = (tag: TagRecord): void => {
    setSelectedTagId(tag.id);
    setTagForm({
      skuCode: tag.skuCode,
      skuStyle: tag.skuStyle ?? "",
      tag1: tag.tag1 ?? "",
      tag2: tag.tag2 ?? "",
      tag3: tag.tag3 ?? "",
      tag4: tag.tag4 ?? "",
      tag5: tag.tag5 ?? "",
      tagGroup: tag.tagGroup,
      notes: tag.notes ?? ""
    });
  };

  const startNewTag = (): void => {
    setSelectedTagId(null);
    setTagForm({
      skuCode: "",
      skuStyle: "",
      tag1: "",
      tag2: "",
      tag3: "",
      tag4: "",
      tag5: "",
      tagGroup: "default",
      notes: ""
    });
  };

  const openTitle = (title: TitleRecord): void => {
    setSelectedTitleId(title.id);
    setTitleForm({
      text: title.text,
      sourceSkillId: title.sourceSkillId ?? "",
      score: title.score === null ? "" : String(title.score),
      status: title.status,
      notes: title.notes ?? ""
    });
  };

  const startNewTitle = (): void => {
    setSelectedTitleId(null);
    setTitleForm({
      text: "",
      sourceSkillId: "",
      score: "",
      status: "active",
      notes: ""
    });
  };

  const openPrompt = (prompt: PromptRecord): void => {
    setSelectedPromptId(prompt.id);
    setPromptForm({
      text: prompt.text,
      scene: prompt.scene,
      status: prompt.status,
      notes: prompt.notes ?? ""
    });
  };

  const startNewPrompt = (): void => {
    setSelectedPromptId(null);
    setPromptForm({
      text: "",
      scene: "主图",
      status: "active",
      notes: ""
    });
  };

  const openScript = (script: ScriptRecord): void => {
    setSelectedScriptId(script.id);
    setScriptForm({
      text: script.text,
      sourceSkillId: script.sourceSkillId ?? "",
      skuCode: script.skuCode ?? "",
      status: script.status,
      notes: script.notes ?? ""
    });
  };

  const startNewScript = (): void => {
    setSelectedScriptId(null);
    setScriptForm({
      text: "",
      sourceSkillId: "",
      skuCode: "",
      status: "active",
      notes: ""
    });
  };

  const openImage = (image: ImageLibraryItem): void => {
    setSelectedImageId(image.id);
    setImageForm({
      relativePath: image.relativePath,
      promptId: image.promptId ?? "",
      scene: image.scene,
      width: image.width === null ? "" : String(image.width),
      height: image.height === null ? "" : String(image.height),
      aspectRatio: image.aspectRatio ?? "",
      sourceModel: image.sourceModel ?? "",
      status: image.status,
      tags: image.tags ?? "",
      notes: image.notes ?? "",
      generatedAt: image.generatedAt ?? ""
    });
  };

  const startNewImage = (): void => {
    setSelectedImageId(null);
    setImageForm({
      relativePath: "images/main/example.jpg",
      promptId: "",
      scene: "主图",
      width: "",
      height: "",
      aspectRatio: "",
      sourceModel: "",
      status: "active",
      tags: "",
      notes: "",
      generatedAt: ""
    });
  };

  const onSaveTag = async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const saved = await window.roster.saveTag({
        tagId: selectedTagId ?? undefined,
        skuCode: tagForm.skuCode,
        skuStyle: tagForm.skuStyle || null,
        tag1: tagForm.tag1 || null,
        tag2: tagForm.tag2 || null,
        tag3: tagForm.tag3 || null,
        tag4: tagForm.tag4 || null,
        tag5: tagForm.tag5 || null,
        tagGroup: tagForm.tagGroup,
        notes: tagForm.notes || null
      });
      setTags((current) => {
        const existing = current.some((tag) => tag.id === saved.id);
        return existing ? current.map((tag) => (tag.id === saved.id ? saved : tag)) : [...current, saved];
      });
      setSelectedTagId(saved.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setLoading(false);
    }
  };

  const onSaveTitle = async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const parsedScore = titleForm.score.trim() ? Number.parseInt(titleForm.score, 10) : null;
      const saved = await window.roster.saveTitle({
        titleId: selectedTitleId ?? undefined,
        text: titleForm.text,
        sourceSkillId: titleForm.sourceSkillId || null,
        score: Number.isFinite(parsedScore) ? parsedScore : null,
        status: titleForm.status,
        notes: titleForm.notes || null
      });
      setTitles((current) => {
        const existing = current.some((title) => title.id === saved.id);
        return existing ? current.map((title) => (title.id === saved.id ? saved : title)) : [saved, ...current];
      });
      setSelectedTitleId(saved.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setLoading(false);
    }
  };

  const onSavePrompt = async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const saved = await window.roster.savePrompt({
        promptId: selectedPromptId ?? undefined,
        text: promptForm.text,
        scene: promptForm.scene,
        status: promptForm.status,
        notes: promptForm.notes || null
      });
      setPrompts((current) => {
        const existing = current.some((prompt) => prompt.id === saved.id);
        return existing ? current.map((prompt) => (prompt.id === saved.id ? saved : prompt)) : [saved, ...current];
      });
      setSelectedPromptId(saved.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setLoading(false);
    }
  };

  const onSaveScript = async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const saved = await window.roster.saveScript({
        scriptId: selectedScriptId ?? undefined,
        text: scriptForm.text,
        sourceSkillId: scriptForm.sourceSkillId || null,
        skuCode: scriptForm.skuCode || null,
        status: scriptForm.status,
        notes: scriptForm.notes || null
      });
      setScripts((current) => {
        const existing = current.some((script) => script.id === saved.id);
        return existing ? current.map((script) => (script.id === saved.id ? saved : script)) : [saved, ...current];
      });
      setSelectedScriptId(saved.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setLoading(false);
    }
  };

  const onSaveImage = async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const parsedWidth = imageForm.width.trim() ? Number.parseInt(imageForm.width, 10) : null;
      const parsedHeight = imageForm.height.trim() ? Number.parseInt(imageForm.height, 10) : null;
      const saved = await window.roster.saveImage({
        imageId: selectedImageId ?? undefined,
        relativePath: imageForm.relativePath.replaceAll("\\", "/"),
        promptId: imageForm.promptId || null,
        scene: imageForm.scene,
        width: Number.isFinite(parsedWidth) ? parsedWidth : null,
        height: Number.isFinite(parsedHeight) ? parsedHeight : null,
        aspectRatio: imageForm.aspectRatio || null,
        sourceModel: imageForm.sourceModel || null,
        status: imageForm.status,
        tags: imageForm.tags || null,
        notes: imageForm.notes || null,
        generatedAt: imageForm.generatedAt || null
      });
      setImages((current) => {
        const existing = current.some((image) => image.id === saved.id);
        return existing ? current.map((image) => (image.id === saved.id ? saved : image)) : [saved, ...current];
      });
      setSelectedImageId(saved.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-full flex-col gap-4 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">{config.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{config.description}</p>
        </div>
        <div className="flex items-center gap-2">
          {isScriptsPage ? (
            <>
              <Button variant="outline" onClick={copyScriptsToClipboard} disabled={loading} data-copy-selected-scripts>
                <Clipboard />
                复制{selectedScriptIds.size > 0 ? `选中 ${selectedScriptIds.size}` : "全部"}
              </Button>
              <Button
                variant="outline"
                onClick={() => exportScripts([...selectedScriptIds])}
                disabled={loading || scripts.length === 0}
                data-export-selected-scripts
              >
                <Download />
                导出{selectedScriptIds.size > 0 ? "选中" : "全部"}
              </Button>
            </>
          ) : null}
          {config.secondaryAction ? (
            <Button variant="outline" onClick={isTagsPage ? onImportTags : undefined} disabled={loading}>
              <Upload />
              {config.secondaryAction}
            </Button>
          ) : null}
          <Button
            variant="primary"
            onClick={
              isTagsPage
                ? startNewTag
                : isTitlesPage
                  ? startNewTitle
                  : isPromptsPage
                    ? startNewPrompt
                    : isScriptsPage
                      ? startNewScript
                      : isImagesPage
                        ? startNewImage
                        : undefined
            }
          >
            <Plus />
            {config.primaryAction}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <Metric
          label="总数"
          value={String(isImagesPage ? images.length : isScriptsPage ? scripts.length : isPromptsPage ? prompts.length : isTitlesPage ? titles.length : totalCount)}
        />
        <Metric
          label={isTagsPage ? "默认标签" : isTitlesPage ? "可用标题" : isPromptsPage ? "可用提示词" : isScriptsPage ? "可用文案" : isImagesPage ? "可用图片" : "本周新增"}
          value={String(activeCount)}
        />
        <Metric
          label={isTagsPage ? "测试标签" : isTitlesPage ? "已归档" : isPromptsPage ? "非可用" : isScriptsPage ? "已归档" : isImagesPage ? "非可用" : "已使用"}
          value={String(testCount)}
        />
        <Metric label="待处理" value="0" />
      </div>

      <div className={isTagsPage || isTitlesPage || isPromptsPage || isScriptsPage || isImagesPage ? "grid min-h-0 grid-cols-[minmax(0,1fr)_320px] gap-4" : undefined}>
      <section className="min-w-0 rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="flex items-center gap-3">
            <Icon className="size-4 text-primary" />
            <h2 className="text-sm font-semibold">{config.title}列表</h2>
            <Badge variant="neutral">{displayedCount} 条</Badge>
            {importSummary ? (
              <span className="text-xs text-muted-foreground">
                导入 {importSummary.imported}，新增 {importSummary.inserted}，更新 {importSummary.updated}，跳过 {importSummary.skipped}
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              筛选
            </Button>
            <div className="w-72">
              <Input
                aria-label={`搜索${config.title}`}
                className="h-8"
                placeholder="搜索关键词、SKU、来源"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
          </div>
        </div>

        {error ? <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div> : null}
        {isScriptsPage && scriptActionMessage ? (
          <div className="border-b border-border bg-muted/40 px-4 py-2 text-sm" data-script-library-message>
            {scriptActionMessage}
          </div>
        ) : null}

        <div
          className="grid h-9 items-center border-b border-border bg-muted/50 px-4 text-xs font-medium text-muted-foreground"
          style={{ gridTemplateColumns: `repeat(${config.columns.length}, minmax(120px, 1fr))` }}
        >
          {config.columns.map((column) => (
            <div key={column} className="truncate">
              {column}
            </div>
          ))}
        </div>

        {isTagsPage && filteredTags.length > 0 ? (
          <div ref={parentRef} className="h-[calc(100vh-326px)] min-h-80 overflow-auto">
            <div className="relative" style={{ height: `${rowVirtualizer.getTotalSize()}px` }}>
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const tag = filteredTags[virtualRow.index];
                if (!tag) {
                  return null;
                }
                return (
                  <div
                    key={tag.id}
                    className="absolute left-0 grid w-full cursor-default grid-cols-[repeat(9,minmax(120px,1fr))] items-center border-b border-border/70 px-4 text-sm hover:bg-muted/50"
                    style={{ height: `${virtualRow.size}px`, transform: `translateY(${virtualRow.start}px)` }}
                    onClick={() => openTag(tag)}
                  >
                    <div className="truncate font-medium">{tag.skuCode}</div>
                    <div className="truncate text-muted-foreground">{tag.skuStyle ?? "-"}</div>
                    <TagCell value={tag.tag1} />
                    <TagCell value={tag.tag2} />
                    <TagCell value={tag.tag3} />
                    <TagCell value={tag.tag4} />
                    <TagCell value={tag.tag5} />
                    <div>
                      <Badge variant={tag.tagGroup === "test" ? "warning" : "success"}>{tag.tagGroup === "test" ? "测试" : "默认"}</Badge>
                    </div>
                    <div className="truncate text-muted-foreground">{tag.notes ?? "-"}</div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : isTitlesPage && filteredTitles.length > 0 ? (
          <div ref={parentRef} className="h-[calc(100vh-326px)] min-h-80 overflow-auto">
            <div className="relative" style={{ height: `${rowVirtualizer.getTotalSize()}px` }}>
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const title = filteredTitles[virtualRow.index];
                if (!title) {
                  return null;
                }
                return (
                  <div
                    key={title.id}
                    className="absolute left-0 grid w-full cursor-default grid-cols-[minmax(260px,2fr)_120px_80px_96px_120px_96px] items-center border-b border-border/70 px-4 text-sm hover:bg-muted/50"
                    style={{ height: `${virtualRow.size}px`, transform: `translateY(${virtualRow.start}px)` }}
                    onClick={() => openTitle(title)}
                  >
                    <div className="truncate font-medium">{title.text}</div>
                    <div className="truncate text-muted-foreground">{title.sourceSkillId ?? "手动"}</div>
                    <div className="text-xs text-muted-foreground">{title.score ?? "-"}</div>
                    <div className="text-xs text-muted-foreground">{title.useCount}</div>
                    <div className="truncate text-xs text-muted-foreground">{title.lastUsedAt ?? "-"}</div>
                    <div>
                      <Badge variant={title.status === "active" ? "success" : "neutral"}>{title.status === "active" ? "可用" : "归档"}</Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : isPromptsPage && filteredPrompts.length > 0 ? (
          <div ref={parentRef} className="h-[calc(100vh-326px)] min-h-80 overflow-auto">
            <div className="relative" style={{ height: `${rowVirtualizer.getTotalSize()}px` }}>
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const prompt = filteredPrompts[virtualRow.index];
                if (!prompt) {
                  return null;
                }
                const keptRate = prompt.generatedCount === 0 ? "-" : `${Math.round((prompt.keptCount / prompt.generatedCount) * 100)}%`;
                return (
                  <div
                    key={prompt.id}
                    className="absolute left-0 grid w-full cursor-default grid-cols-[minmax(300px,2fr)_100px_88px_88px_88px_96px] items-center border-b border-border/70 px-4 text-sm hover:bg-muted/50"
                    style={{ height: `${virtualRow.size}px`, transform: `translateY(${virtualRow.start}px)` }}
                    onClick={() => openPrompt(prompt)}
                  >
                    <div className="truncate font-medium">{prompt.text}</div>
                    <div className="truncate text-muted-foreground">{prompt.scene}</div>
                    <div className="text-xs text-muted-foreground">{prompt.generatedCount}</div>
                    <div className="text-xs text-muted-foreground">{prompt.keptCount}</div>
                    <div className="text-xs text-muted-foreground">{keptRate}</div>
                    <div>
                      <Badge variant={prompt.status === "active" ? "success" : prompt.status === "negative" ? "danger" : "neutral"}>
                        {prompt.status === "active" ? "可用" : prompt.status === "negative" ? "反面" : "归档"}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : isScriptsPage && filteredScripts.length > 0 ? (
          <div ref={parentRef} className="h-[calc(100vh-326px)] min-h-80 overflow-auto">
            <div className="relative" style={{ height: `${rowVirtualizer.getTotalSize()}px` }}>
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const script = filteredScripts[virtualRow.index];
                if (!script) {
                  return null;
                }
                return (
                  <div
                    key={script.id}
                    className="absolute left-0 grid w-full cursor-default grid-cols-[minmax(300px,2fr)_120px_120px_80px_140px_96px] items-center border-b border-border/70 px-4 text-sm hover:bg-muted/50"
                    style={{ height: `${virtualRow.size}px`, transform: `translateY(${virtualRow.start}px)` }}
                    onClick={() => openScript(script)}
                    data-script-row={script.id}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <button
                        className={cn(
                          "flex size-4 shrink-0 items-center justify-center rounded border",
                          selectedScriptIds.has(script.id)
                            ? "border-emerald-500 bg-emerald-500 text-white"
                            : "border-border bg-background"
                        )}
                        onClick={(event) => {
                          event.stopPropagation();
                          toggleScriptSelection(script.id);
                        }}
                        type="button"
                        aria-label={`选择文案 ${script.id}`}
                        data-select-script={script.id}
                      >
                        {selectedScriptIds.has(script.id) ? <Check className="size-3" /> : null}
                      </button>
                      <div className="truncate font-medium">{script.text}</div>
                    </div>
                    <div className="truncate text-muted-foreground">{script.skuCode ?? "-"}</div>
                    <div className="truncate text-muted-foreground">{script.sourceSkillId ?? "手动"}</div>
                    <div className="text-xs text-muted-foreground">{script.useCount}</div>
                    <div className="truncate text-xs text-muted-foreground">{script.createdAt}</div>
                    <div>
                      <Badge variant={script.status === "active" ? "success" : "neutral"}>{script.status === "active" ? "可用" : "归档"}</Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : isImagesPage && filteredImages.length > 0 ? (
          <div ref={parentRef} className="h-[calc(100vh-326px)] min-h-80 overflow-auto">
            <div className="relative" style={{ height: `${rowVirtualizer.getTotalSize()}px` }}>
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const image = filteredImages[virtualRow.index];
                if (!image) {
                  return null;
                }
                const size = image.width && image.height ? `${image.width}x${image.height}` : "-";
                return (
                  <div
                    key={image.id}
                    data-image-row
                    className="absolute left-0 grid w-full cursor-default grid-cols-[72px_minmax(160px,1.2fr)_100px_140px_88px_96px_140px] items-center border-b border-border/70 px-4 text-sm hover:bg-muted/50"
                    style={{ height: `${virtualRow.size}px`, transform: `translateY(${virtualRow.start}px)` }}
                    onClick={() => openImage(image)}
                  >
                    <div className="flex size-8 items-center justify-center rounded-md border border-border bg-muted text-[10px] text-muted-foreground">
                      IMG
                    </div>
                    <div>
                      <div className="truncate font-medium">{image.fileName}</div>
                      <div className="truncate text-xs text-muted-foreground">{image.currentAbsolutePath}</div>
                    </div>
                    <div className="truncate text-muted-foreground">{image.scene}</div>
                    <div className="truncate text-muted-foreground">{image.promptId ?? "-"}</div>
                    <div className="text-xs text-muted-foreground">{size}</div>
                    <div>
                      <Badge variant={image.status === "active" ? "success" : image.status === "soft_deleted" ? "warning" : "neutral"}>
                        {image.status === "active" ? "可用" : image.status === "soft_deleted" ? "软删" : "归档"}
                      </Badge>
                    </div>
                    <div className="truncate text-xs text-muted-foreground">{image.createdAt}</div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex min-h-80 flex-col items-center justify-center gap-3 px-4 py-10 text-center">
            <Icon className="size-10 text-muted-foreground" />
            <div className="text-sm font-medium">{isTagsPage && query ? "没有匹配的标签组" : config.emptyTitle}</div>
            <p className="max-w-md text-sm leading-6 text-muted-foreground">{config.emptyDescription}</p>
            <div className="flex items-center gap-2">
              {config.secondaryAction ? (
                <Button variant="outline" size="sm" onClick={isTagsPage ? onImportTags : undefined} disabled={loading}>
                  <Upload />
                  {config.secondaryAction}
                </Button>
              ) : null}
              <Button
                variant="primary"
                size="sm"
                onClick={
                  isTagsPage
                    ? startNewTag
                    : isTitlesPage
                      ? startNewTitle
                      : isPromptsPage
                        ? startNewPrompt
                        : isScriptsPage
                          ? startNewScript
                          : isImagesPage
                            ? startNewImage
                            : undefined
                }
              >
                <Plus />
                {config.primaryAction}
              </Button>
            </div>
          </div>
        )}
      </section>

      {isTagsPage ? (
        <aside className="min-h-0 rounded-lg border border-border bg-card">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold">{selectedTagId ? "编辑标签组" : "新增标签组"}</h2>
          </div>
          <div className="flex flex-col gap-3 p-4">
            <Input
              label="SKU"
              value={tagForm.skuCode}
              onChange={(event) => setTagForm((current) => ({ ...current, skuCode: event.target.value }))}
            />
            <Input
              label="款式"
              value={tagForm.skuStyle}
              onChange={(event) => setTagForm((current) => ({ ...current, skuStyle: event.target.value }))}
            />
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={tagForm.tagGroup === "default" ? "primary" : "outline"}
                size="sm"
                onClick={() => setTagForm((current) => ({ ...current, tagGroup: "default" }))}
              >
                默认
              </Button>
              <Button
                variant={tagForm.tagGroup === "test" ? "primary" : "outline"}
                size="sm"
                onClick={() => setTagForm((current) => ({ ...current, tagGroup: "test" }))}
              >
                测试
              </Button>
            </div>
            {(["tag1", "tag2", "tag3", "tag4", "tag5"] as const).map((key, index) => (
              <Input
                key={key}
                label={`标签${index + 1}`}
                value={tagForm[key]}
                onChange={(event) => setTagForm((current) => ({ ...current, [key]: event.target.value }))}
              />
            ))}
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-foreground">备注</span>
              <textarea
                className="min-h-20 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/15"
                value={tagForm.notes}
                onChange={(event) => setTagForm((current) => ({ ...current, notes: event.target.value }))}
              />
            </label>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button variant="outline" onClick={startNewTag}>
                清空
              </Button>
              <Button variant="primary" onClick={onSaveTag} disabled={loading}>
                保存
              </Button>
            </div>
          </div>
        </aside>
      ) : isTitlesPage ? (
        <aside className="min-h-0 rounded-lg border border-border bg-card">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold">{selectedTitleId ? "编辑标题" : "新增标题"}</h2>
          </div>
          <div className="flex flex-col gap-3 p-4">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-foreground">标题</span>
              <textarea
                className="min-h-24 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/15"
                value={titleForm.text}
                onChange={(event) => setTitleForm((current) => ({ ...current, text: event.target.value }))}
              />
            </label>
            <Input
              label="来源 Skill"
              value={titleForm.sourceSkillId}
              onChange={(event) => setTitleForm((current) => ({ ...current, sourceSkillId: event.target.value }))}
            />
            <Input
              label="评分"
              type="number"
              min={0}
              max={100}
              value={titleForm.score}
              onChange={(event) => setTitleForm((current) => ({ ...current, score: event.target.value }))}
            />
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={titleForm.status === "active" ? "primary" : "outline"}
                size="sm"
                onClick={() => setTitleForm((current) => ({ ...current, status: "active" }))}
              >
                可用
              </Button>
              <Button
                variant={titleForm.status === "archived" ? "primary" : "outline"}
                size="sm"
                onClick={() => setTitleForm((current) => ({ ...current, status: "archived" }))}
              >
                归档
              </Button>
            </div>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-foreground">备注</span>
              <textarea
                className="min-h-20 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/15"
                value={titleForm.notes}
                onChange={(event) => setTitleForm((current) => ({ ...current, notes: event.target.value }))}
              />
            </label>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button variant="outline" onClick={startNewTitle}>
                清空
              </Button>
              <Button variant="primary" onClick={onSaveTitle} disabled={loading}>
                保存
              </Button>
            </div>
          </div>
        </aside>
      ) : isPromptsPage ? (
        <aside className="min-h-0 rounded-lg border border-border bg-card">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold">{selectedPromptId ? "编辑提示词" : "新增提示词"}</h2>
          </div>
          <div className="flex flex-col gap-3 p-4">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-foreground">提示词</span>
              <textarea
                className="min-h-28 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/15"
                value={promptForm.text}
                onChange={(event) => setPromptForm((current) => ({ ...current, text: event.target.value }))}
              />
            </label>
            <Input
              label="场景"
              value={promptForm.scene}
              onChange={(event) => setPromptForm((current) => ({ ...current, scene: event.target.value }))}
            />
            <div className="grid grid-cols-3 gap-2">
              {(["active", "negative", "archived"] as const).map((status) => (
                <Button
                  key={status}
                  variant={promptForm.status === status ? "primary" : "outline"}
                  size="sm"
                  onClick={() => setPromptForm((current) => ({ ...current, status }))}
                >
                  {status === "active" ? "可用" : status === "negative" ? "反面" : "归档"}
                </Button>
              ))}
            </div>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-foreground">备注</span>
              <textarea
                className="min-h-20 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/15"
                value={promptForm.notes}
                onChange={(event) => setPromptForm((current) => ({ ...current, notes: event.target.value }))}
              />
            </label>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button variant="outline" onClick={startNewPrompt}>
                清空
              </Button>
              <Button variant="primary" onClick={onSavePrompt} disabled={loading}>
                保存
              </Button>
            </div>
          </div>
        </aside>
      ) : isScriptsPage ? (
        <aside className="min-h-0 rounded-lg border border-border bg-card">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold">{selectedScriptId ? "编辑文案" : "新增文案"}</h2>
          </div>
          <div className="flex flex-col gap-3 p-4">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-foreground">文案</span>
              <textarea
                className="min-h-36 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/15"
                value={scriptForm.text}
                onChange={(event) => setScriptForm((current) => ({ ...current, text: event.target.value }))}
              />
            </label>
            <Input
              label="来源 Skill"
              value={scriptForm.sourceSkillId}
              onChange={(event) => setScriptForm((current) => ({ ...current, sourceSkillId: event.target.value }))}
            />
            <Input
              label="关联 SKU（可选）"
              value={scriptForm.skuCode}
              onChange={(event) => setScriptForm((current) => ({ ...current, skuCode: event.target.value }))}
            />
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={scriptForm.status === "active" ? "primary" : "outline"}
                size="sm"
                onClick={() => setScriptForm((current) => ({ ...current, status: "active" }))}
              >
                可用
              </Button>
              <Button
                variant={scriptForm.status === "archived" ? "primary" : "outline"}
                size="sm"
                onClick={() => setScriptForm((current) => ({ ...current, status: "archived" }))}
              >
                归档
              </Button>
            </div>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-foreground">备注</span>
              <textarea
                className="min-h-20 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/15"
                value={scriptForm.notes}
                onChange={(event) => setScriptForm((current) => ({ ...current, notes: event.target.value }))}
              />
            </label>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button variant="outline" onClick={startNewScript}>
                清空
              </Button>
              <Button variant="primary" onClick={onSaveScript} disabled={loading}>
                保存
              </Button>
            </div>
          </div>
        </aside>
      ) : isImagesPage ? (
        <aside className="min-h-0 rounded-lg border border-border bg-card">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold">{selectedImageId ? "编辑图片记录" : "新增图片记录"}</h2>
          </div>
          <div className="flex flex-col gap-3 p-4">
            <Input
              label="相对路径"
              value={imageForm.relativePath}
              onChange={(event) => setImageForm((current) => ({ ...current, relativePath: event.target.value }))}
              hint="示例：images/main/SKU-001.jpg"
            />
            <Input
              label="来源提示词 ID"
              value={imageForm.promptId}
              onChange={(event) => setImageForm((current) => ({ ...current, promptId: event.target.value }))}
            />
            <Input
              label="场景"
              value={imageForm.scene}
              onChange={(event) => setImageForm((current) => ({ ...current, scene: event.target.value }))}
            />
            <div className="grid grid-cols-2 gap-2">
              <Input
                label="宽度"
                type="number"
                min={1}
                value={imageForm.width}
                onChange={(event) => setImageForm((current) => ({ ...current, width: event.target.value }))}
              />
              <Input
                label="高度"
                type="number"
                min={1}
                value={imageForm.height}
                onChange={(event) => setImageForm((current) => ({ ...current, height: event.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input
                label="比例"
                value={imageForm.aspectRatio}
                onChange={(event) => setImageForm((current) => ({ ...current, aspectRatio: event.target.value }))}
              />
              <Input
                label="生成模型"
                value={imageForm.sourceModel}
                onChange={(event) => setImageForm((current) => ({ ...current, sourceModel: event.target.value }))}
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(["active", "soft_deleted", "archived"] as const).map((status) => (
                <Button
                  key={status}
                  variant={imageForm.status === status ? "primary" : "outline"}
                  size="sm"
                  onClick={() => setImageForm((current) => ({ ...current, status }))}
                >
                  {status === "active" ? "可用" : status === "soft_deleted" ? "软删" : "归档"}
                </Button>
              ))}
            </div>
            <Input
              label="标签"
              value={imageForm.tags}
              onChange={(event) => setImageForm((current) => ({ ...current, tags: event.target.value }))}
            />
            <Input
              label="生成时间"
              value={imageForm.generatedAt}
              onChange={(event) => setImageForm((current) => ({ ...current, generatedAt: event.target.value }))}
              placeholder="ISO 时间，可留空"
            />
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-foreground">备注</span>
              <textarea
                className="min-h-20 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/15"
                value={imageForm.notes}
                onChange={(event) => setImageForm((current) => ({ ...current, notes: event.target.value }))}
              />
            </label>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button variant="outline" onClick={startNewImage}>
                清空
              </Button>
              <Button variant="primary" onClick={onSaveImage} disabled={loading}>
                保存
              </Button>
            </div>
          </div>
        </aside>
      ) : null}
      </div>
    </div>
  );
}

function TagCell({ value }: { value: string | null }): JSX.Element {
  return <div className="truncate text-muted-foreground">{value ?? "-"}</div>;
}

function Metric({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Search className="size-4 text-primary" />
      </div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </div>
  );
}
