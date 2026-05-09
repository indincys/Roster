import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { AlertTriangle, Archive, Clapperboard, Database, ImageIcon, RefreshCw, SquarePen, Trash2 } from "lucide-react";
import type { VideoLibraryItem, VideoScanSummary, VideoStatus } from "@roster/shared-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { activeWorkspace, useAppStore } from "@/stores/app-store";
import { cn } from "@/lib/utils";

const statusLabel: Record<VideoStatus, string> = {
  active: "可用",
  used: "已使用",
  archived: "已归档",
  metadata_error: "元数据异常",
  placeholder: "未同步"
};

const statusVariant: Record<VideoStatus, "neutral" | "success" | "warning" | "danger" | "info"> = {
  active: "success",
  used: "info",
  archived: "neutral",
  metadata_error: "danger",
  placeholder: "warning"
};

function formatBytes(value: number | null): string {
  if (value === null) {
    return "-";
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function formatDuration(value: number | null): string {
  if (value === null) {
    return "-";
  }
  const minutes = Math.floor(value / 60);
  const seconds = Math.round(value % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function emptySummary(): VideoScanSummary {
  return {
    scanned: 0,
    added: 0,
    updated: 0,
    archived: 0,
    failedMetadata: 0,
    placeholders: 0
  };
}

export function VideoLibraryPage(): JSX.Element {
  const { bootstrap, setPage } = useAppStore();
  const workspace = activeWorkspace(bootstrap);
  const [videos, setVideos] = useState<VideoLibraryItem[]>([]);
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [hoverPreviewVideoId, setHoverPreviewVideoId] = useState<string | null>(null);
  const [editSku, setEditSku] = useState("");
  const [editStyle, setEditStyle] = useState("");
  const [editNote, setEditNote] = useState("");
  const [query, setQuery] = useState("");
  const [skuFilter, setSkuFilter] = useState("all");
  const [styleFilter, setStyleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<VideoStatus | "all">("all");
  const [coverFilter, setCoverFilter] = useState<"all" | "with" | "without">("all");
  const [sortMode, setSortMode] = useState<"path" | "created_desc" | "used_asc">("path");
  const [selectedVideoIds, setSelectedVideoIds] = useState<Set<string>>(new Set());
  const [batchSku, setBatchSku] = useState("");
  const [batchStyle, setBatchStyle] = useState("");
  const [summary, setSummary] = useState<VideoScanSummary>(emptySummary);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const parentRef = useRef<HTMLDivElement>(null);
  const workspaceId = workspace?.id;

  const loadVideos = useCallback(async (): Promise<void> => {
    if (!workspaceId) {
      setVideos([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const nextVideos = await window.roster.listVideos();
      setVideos(nextVideos);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void loadVideos();
  }, [loadVideos]);

  const filteredVideos = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = videos.filter((video) => {
      if (skuFilter !== "all" && (video.sku ?? "") !== skuFilter) {
        return false;
      }
      if (styleFilter !== "all" && (video.style ?? "") !== styleFilter) {
        return false;
      }
      if (statusFilter !== "all" && video.status !== statusFilter) {
        return false;
      }
      if (coverFilter === "with" && !video.hasCover) {
        return false;
      }
      if (coverFilter === "without" && video.hasCover) {
        return false;
      }
      if (!normalizedQuery) {
        return true;
      }
      return [video.fileName, video.relativePath, video.sku, video.style, video.status]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(normalizedQuery));
    });
    return [...filtered].sort((left, right) => {
      if (sortMode === "created_desc") {
        return right.createdAt.localeCompare(left.createdAt);
      }
      if (sortMode === "used_asc") {
        return left.usedCount - right.usedCount || left.relativePath.localeCompare(right.relativePath);
      }
      return left.relativePath.localeCompare(right.relativePath);
    });
  }, [coverFilter, query, skuFilter, sortMode, statusFilter, styleFilter, videos]);

  const optionSample = useMemo(() => videos.slice(0, 500), [videos]);
  const skuOptions = useMemo(
    () => [...new Set(optionSample.map((video) => video.sku).filter((value): value is string => Boolean(value)))].sort(),
    [optionSample]
  );
  const styleOptions = useMemo(
    () => [...new Set(optionSample.map((video) => video.style).filter((value): value is string => Boolean(value)))].sort(),
    [optionSample]
  );

  const selectedVideo = useMemo(
    () => videos.find((video) => video.id === selectedVideoId) ?? null,
    [selectedVideoId, videos]
  );

  const totals = useMemo(
    () => ({
      all: videos.length,
      active: videos.filter((video) => video.status === "active").length,
      archived: videos.filter((video) => video.status === "archived").length,
      warning: videos.filter((video) => video.status === "metadata_error" || video.status === "placeholder").length
    }),
    [videos]
  );

  const rowVirtualizer = useVirtualizer({
    count: filteredVideos.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 36,
    initialRect: { width: 960, height: 360 },
    overscan: 16
  });

  useEffect(() => {
    rowVirtualizer.measure();
  }, [filteredVideos.length, rowVirtualizer]);

  useEffect(() => {
    setSelectedVideoIds((current) => {
      const visibleIds = new Set(filteredVideos.map((video) => video.id));
      return new Set([...current].filter((id) => visibleIds.has(id)));
    });
  }, [filteredVideos]);

  const onScan = async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const nextSummary = await window.roster.scanVideos();
      setSummary(nextSummary);
      setVideos(await window.roster.listVideos());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setLoading(false);
    }
  };

  const openVideoDetail = (video: VideoLibraryItem): void => {
    setSelectedVideoId(video.id);
    setEditSku(video.sku ?? "");
    setEditStyle(video.style ?? "");
    setEditNote(video.note ?? "");
  };

  const onSaveVideo = async (): Promise<void> => {
    if (!selectedVideo) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const updated = await window.roster.updateVideo({
        videoId: selectedVideo.id,
        sku: editSku.trim() || null,
        style: editStyle.trim() || null,
        note: editNote.trim() || null
      });
      setVideos((current) => current.map((video) => (video.id === updated.id ? updated : video)));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setLoading(false);
    }
  };

  function toggleVideoSelection(videoId: string): void {
    setSelectedVideoIds((current) => {
      const next = new Set(current);
      if (next.has(videoId)) {
        next.delete(videoId);
      } else {
        next.add(videoId);
      }
      return next;
    });
  }

  async function applyBatchMetadata(): Promise<void> {
    if (selectedVideoIds.size === 0 || (!batchSku.trim() && !batchStyle.trim())) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const updated = await window.roster.batchUpdateVideos({
        videoIds: [...selectedVideoIds],
        sku: batchSku.trim() || undefined,
        style: batchStyle.trim() || undefined
      });
      setVideos((current) => current.map((video) => updated.find((item) => item.id === video.id) ?? video));
      setBatchSku("");
      setBatchStyle("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setLoading(false);
    }
  }

  async function archiveSelectedVideos(): Promise<void> {
    if (selectedVideoIds.size === 0) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const updated = await window.roster.batchUpdateVideos({
        videoIds: [...selectedVideoIds],
        status: "archived"
      });
      setVideos((current) => current.map((video) => updated.find((item) => item.id === video.id) ?? video));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setLoading(false);
    }
  }

  function goToCoverWorkspace(): void {
    setPage("covers");
  }

  if (!workspace) {
    return (
      <div className="flex min-h-full items-center justify-center p-8">
        <div className="flex w-full max-w-xl flex-col items-center gap-3 rounded-lg border border-border bg-card p-8 text-center">
          <Database className="size-10 text-muted-foreground" />
          <h1 className="text-base font-semibold">先创建品牌工作空间</h1>
          <p className="text-sm leading-6 text-muted-foreground">视频库索引当前工作空间的 `videos/` 目录，并只保存相对路径。</p>
          <Button variant="primary" onClick={() => setPage("settings")}>
            去设置中创建
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col gap-4 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">视频库</h1>
          <p className="mt-1 text-sm text-muted-foreground">索引 `videos/` 下的视频文件，不复制原文件；数据库仅保存相对路径。</p>
        </div>
        <Button variant="primary" onClick={onScan} disabled={loading}>
          <RefreshCw className={cn(loading && "animate-spin")} />
          重新扫描
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <Metric label="视频总数" value={totals.all} icon={Clapperboard} />
        <Metric label="可用素材" value={totals.active} icon={Database} />
        <Metric label="已归档" value={totals.archived} icon={Archive} />
        <Metric label="待处理" value={totals.warning} icon={AlertTriangle} />
      </div>

      <div className="grid min-h-0 grid-cols-[minmax(0,1fr)_320px] gap-4">
      <div className="min-w-0 rounded-lg border border-border bg-card">
        <div className="flex flex-col gap-3 border-b border-border px-4 py-3">
          <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold">素材列表</h2>
            <Badge variant="neutral">{filteredVideos.length} 条</Badge>
            {summary.scanned > 0 ? (
              <span className="text-xs text-muted-foreground">
                本次扫描 {summary.scanned}，新增 {summary.added}，归档 {summary.archived}
              </span>
            ) : null}
          </div>
          <div className="w-72">
            <Input
              aria-label="搜索视频"
              className="h-8"
              placeholder="搜索文件名、SKU、路径"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          </div>
          <div className="grid grid-cols-5 gap-2">
            <SelectControl label="SKU" value={skuFilter} onChange={setSkuFilter} dataAttr="data-video-filter-sku">
              <option value="all">全部 SKU</option>
              {skuOptions.map((sku) => (
                <option key={sku} value={sku}>{sku}</option>
              ))}
            </SelectControl>
            <SelectControl label="款式" value={styleFilter} onChange={setStyleFilter} dataAttr="data-video-filter-style">
              <option value="all">全部款式</option>
              {styleOptions.map((style) => (
                <option key={style} value={style}>{style}</option>
              ))}
            </SelectControl>
            <SelectControl label="状态" value={statusFilter} onChange={(value) => setStatusFilter(value as VideoStatus | "all")} dataAttr="data-video-filter-status">
              <option value="all">全部状态</option>
              {Object.entries(statusLabel).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </SelectControl>
            <SelectControl label="封面" value={coverFilter} onChange={(value) => setCoverFilter(value as typeof coverFilter)} dataAttr="data-video-filter-cover">
              <option value="all">全部封面</option>
              <option value="with">有封面</option>
              <option value="without">无封面</option>
            </SelectControl>
            <SelectControl label="排序" value={sortMode} onChange={(value) => setSortMode(value as typeof sortMode)} dataAttr="data-video-sort">
              <option value="path">路径 A-Z</option>
              <option value="created_desc">入库时间新到旧</option>
              <option value="used_asc">低使用优先</option>
            </SelectControl>
          </div>
          {selectedVideoIds.size > 0 ? (
            <div className="grid grid-cols-[auto_140px_140px_auto_auto_auto] items-end gap-2 rounded-md border border-border bg-background p-2" data-video-batch-bar>
              <div className="pb-2 text-sm font-medium">已选 {selectedVideoIds.size}</div>
              <Input label="批量 SKU" value={batchSku} onChange={(event) => setBatchSku(event.target.value)} data-video-batch-sku />
              <Input label="批量款式" value={batchStyle} onChange={(event) => setBatchStyle(event.target.value)} data-video-batch-style />
              <Button variant="outline" onClick={applyBatchMetadata} disabled={loading || (!batchSku.trim() && !batchStyle.trim())} data-video-batch-apply>
                <SquarePen />
                批量改
              </Button>
              <Button variant="outline" onClick={goToCoverWorkspace} data-video-go-covers>
                <ImageIcon />
                去做封面
              </Button>
              <Button variant="outline" onClick={archiveSelectedVideos} disabled={loading} data-video-batch-archive>
                <Trash2 />
                标记删除
              </Button>
            </div>
          ) : null}
        </div>

        {error ? <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div> : null}

          <div className="grid h-9 grid-cols-[36px_72px_minmax(180px,1.2fr)_112px_112px_104px_76px_88px_76px_minmax(240px,1.8fr)] items-center border-b border-border bg-muted/50 px-4 text-xs font-medium text-muted-foreground">
          <div>选择</div>
          <div>缩略图</div>
          <div>文件名</div>
          <div>SKU</div>
          <div>款式</div>
          <div>状态</div>
          <div>封面</div>
          <div>大小</div>
          <div>时长</div>
          <div>相对路径</div>
        </div>

        {filteredVideos.length === 0 ? (
          <div className="flex min-h-80 flex-col items-center justify-center gap-3 px-4 py-10 text-center">
            <Clapperboard className="size-10 text-muted-foreground" />
            <div className="text-sm font-medium">{query ? "没有匹配的视频" : "视频库还没有素材"}</div>
            <p className="max-w-md text-sm leading-6 text-muted-foreground">
              将素材放入 `{workspace.name}/videos/` 后点击重新扫描。路径会按 `videos/SKU/款式/文件` 解析 SKU 和款式。
            </p>
            <Button variant="outline" onClick={onScan} disabled={loading}>
              <RefreshCw className={cn(loading && "animate-spin")} />
              重新扫描
            </Button>
          </div>
        ) : (
          <div ref={parentRef} className="h-[calc(100vh-326px)] min-h-80 overflow-auto">
            <div className="relative" style={{ height: `${rowVirtualizer.getTotalSize()}px` }}>
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const video = filteredVideos[virtualRow.index];
                if (!video) {
                  return null;
                }
                return (
                  <div
                    key={video.id}
                    data-video-row
                    className={cn(
                      "absolute left-0 grid w-full cursor-default grid-cols-[36px_72px_minmax(180px,1.2fr)_112px_112px_104px_76px_88px_76px_minmax(240px,1.8fr)] items-center border-b border-border/70 px-4 text-sm hover:bg-muted/50",
                      selectedVideoId === video.id && "bg-primary/5"
                    )}
                    style={{ height: `${virtualRow.size}px`, transform: `translateY(${virtualRow.start}px)` }}
                    onClick={() => openVideoDetail(video)}
                  >
                    <input
                      aria-label={`选择 ${video.fileName}`}
                      checked={selectedVideoIds.has(video.id)}
                      onChange={() => toggleVideoSelection(video.id)}
                      onClick={(event) => event.stopPropagation()}
                      type="checkbox"
                      data-video-select={video.id}
                    />
                    <ThumbnailCell
                      isPreviewing={hoverPreviewVideoId === video.id}
                      previewUrl={video.previewUrl}
                      src={video.thumbnailUrl}
                      onPreviewEnd={() => setHoverPreviewVideoId((current) => (current === video.id ? null : current))}
                      onPreviewStart={() => setHoverPreviewVideoId(video.id)}
                    />
                    <div className="truncate font-medium">{video.fileName}</div>
                    <div className="truncate text-muted-foreground">{video.sku ?? "-"}</div>
                    <div className="truncate text-muted-foreground">{video.style ?? "-"}</div>
                    <div>
                      <Badge variant={statusVariant[video.status]}>{statusLabel[video.status]}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">{video.hasCover ? "有" : "无"}</div>
                    <div className="text-xs text-muted-foreground">{formatBytes(video.sizeBytes)}</div>
                    <div className="text-xs text-muted-foreground">{formatDuration(video.durationSeconds)}</div>
                    <div className="truncate font-mono text-xs text-muted-foreground" title={video.relativePath}>
                      {video.relativePath}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <aside className="min-h-0 rounded-lg border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">视频详情</h2>
        </div>
        {selectedVideo ? (
          <div className="flex flex-col gap-3 p-4">
            <div>
              <div className="truncate text-sm font-medium">{selectedVideo.fileName}</div>
              <div className="mt-1 truncate font-mono text-xs text-muted-foreground" title={selectedVideo.relativePath}>
                {selectedVideo.relativePath}
              </div>
              <div className="mt-1 truncate font-mono text-xs text-muted-foreground" title={selectedVideo.currentAbsolutePath}>
                {selectedVideo.currentAbsolutePath}
              </div>
            </div>
            <Input label="SKU" value={editSku} onChange={(event) => setEditSku(event.target.value)} />
            <Input label="款式" value={editStyle} onChange={(event) => setEditStyle(event.target.value)} />
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-foreground">备注</span>
              <textarea
                className="min-h-24 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/15"
                value={editNote}
                onChange={(event) => setEditNote(event.target.value)}
              />
            </label>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button variant="outline" onClick={() => setSelectedVideoId(null)}>
                取消
              </Button>
              <Button variant="primary" onClick={onSaveVideo} disabled={loading}>
                保存
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex min-h-80 flex-col items-center justify-center gap-3 p-4 text-center">
            <Clapperboard className="size-9 text-muted-foreground" />
            <div className="text-sm font-medium">选择一条视频</div>
            <p className="text-sm leading-6 text-muted-foreground">可编辑 SKU、款式和备注。重新扫描不会覆盖这些手动字段。</p>
          </div>
        )}
      </aside>
      </div>
    </div>
  );
}

function ThumbnailCell({
  isPreviewing,
  onPreviewEnd,
  onPreviewStart,
  previewUrl,
  src
}: {
  isPreviewing: boolean;
  onPreviewEnd(): void;
  onPreviewStart(): void;
  previewUrl: string | null;
  src: string | null;
}): JSX.Element {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isPreviewing) {
      return;
    }

    video.currentTime = 0;
    void video.play().catch(() => undefined);
    const timer = window.setTimeout(() => {
      video.pause();
      onPreviewEnd();
    }, 3_000);

    return () => {
      window.clearTimeout(timer);
      video.pause();
    };
  }, [isPreviewing, onPreviewEnd]);

  if (!src) {
    return (
      <div
        className="flex h-7 w-11 items-center justify-center rounded border border-dashed border-border bg-muted text-[10px] text-muted-foreground"
        onMouseEnter={previewUrl ? onPreviewStart : undefined}
        onMouseLeave={previewUrl ? onPreviewEnd : undefined}
      >
        无
      </div>
    );
  }

  return (
    <div className="relative h-7 w-11" onMouseEnter={previewUrl ? onPreviewStart : undefined} onMouseLeave={previewUrl ? onPreviewEnd : undefined}>
      <img alt="" className={cn("h-7 w-11 rounded border border-border object-cover", isPreviewing && previewUrl && "invisible")} src={src} />
      {previewUrl && isPreviewing ? (
        <video
          ref={videoRef}
          className="absolute inset-0 h-7 w-11 rounded border border-border object-cover"
          muted
          playsInline
          preload="metadata"
          src={previewUrl}
        />
      ) : null}
    </div>
  );
}

function SelectControl({
  children,
  dataAttr,
  label,
  onChange,
  value
}: {
  children: ReactNode;
  dataAttr: string;
  label: string;
  onChange(value: string): void;
  value: string;
}): JSX.Element {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="font-medium text-muted-foreground">{label}</span>
      <select
        className="h-8 rounded-md border border-input bg-background px-2 text-sm outline-none"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        {...{ [dataAttr]: true }}
      >
        {children}
      </select>
    </label>
  );
}

interface MetricProps {
  label: string;
  value: number;
  icon: typeof Clapperboard;
}

function Metric({ label, value, icon: Icon }: MetricProps): JSX.Element {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Icon className="size-4 text-primary" />
      </div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </div>
  );
}
