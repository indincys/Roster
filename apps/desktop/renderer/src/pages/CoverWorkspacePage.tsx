import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent, SyntheticEvent } from "react";
import { CheckCircle2, Clapperboard, ImageIcon, Keyboard, Layers, Loader2, Save } from "lucide-react";
import type { CoverTimelineFrame, CoverTimelineResult, VideoLibraryItem } from "@roster/shared-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type CoverRatio = "3:4" | "9:16" | "1:1" | "custom";
type ToastKind = "success" | "error" | "info";

interface ToastState {
  kind: ToastKind;
  text: string;
  key: number;
}

const FRAME_COUNT = 30;
const MASK_SCALE = 0.85;
const PRECISE_FRAME_DEBOUNCE_MS = 280;

function clamp(value: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, value));
}

function clampCenter(value: number, half: number): number {
  if (half >= 0.5) {
    return 0.5;
  }
  return clamp(value, half, 1 - half);
}

function parseAspect(ratio: CoverRatio, customWidth: number, customHeight: number): number {
  if (ratio === "custom") {
    const w = Math.max(1, customWidth);
    const h = Math.max(1, customHeight);
    return w / h;
  }
  const [w, h] = ratio.split(":").map((value) => Number.parseInt(value, 10));
  return w / h;
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "0:00";
  }
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function findNearestFrame(frames: CoverTimelineFrame[], second: number): CoverTimelineFrame | null {
  if (frames.length === 0) {
    return null;
  }
  let nearest = frames[0];
  for (const frame of frames) {
    if (Math.abs(frame.second - second) < Math.abs(nearest.second - second)) {
      nearest = frame;
    }
  }
  return nearest;
}

export function CoverWorkspacePage(): JSX.Element {
  const [videos, setVideos] = useState<VideoLibraryItem[]>([]);
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [ratio, setRatio] = useState<CoverRatio>("3:4");
  const [customWidth, setCustomWidth] = useState(4);
  const [customHeight, setCustomHeight] = useState(5);
  const [message, setMessage] = useState("");
  const [toast, setToast] = useState<ToastState | null>(null);
  const [timeline, setTimeline] = useState<CoverTimelineResult | null>(null);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [selectedFrameIndex, setSelectedFrameIndex] = useState(0);
  const [currentSecond, setCurrentSecond] = useState(0);
  const [cropPosition, setCropPosition] = useState({ x: 0.5, y: 0.5 });
  const [draggingMask, setDraggingMask] = useState(false);
  const [saving, setSaving] = useState(false);
  const [imageNaturalSize, setImageNaturalSize] = useState<{ width: number; height: number } | null>(null);
  const [precisePreview, setPrecisePreview] = useState<{ url: string; second: number; videoId: string } | null>(
    null
  );
  const [preciseLoading, setPreciseLoading] = useState(false);
  const [preciseError, setPreciseError] = useState<string | null>(null);
  const [imageLoadError, setImageLoadError] = useState<string | null>(null);

  const [outerHeight, setOuterHeight] = useState(0);
  const draggingMaskRef = useRef(false);
  const outerRef = useRef<HTMLDivElement | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const lastFrameRef = useRef(-1);
  const toastTimerRef = useRef<number | null>(null);
  const preciseRequestRef = useRef<{ token: number; timer: number | null }>({ token: 0, timer: null });

  useEffect(() => {
    const el = outerRef.current;
    if (!el) {
      return;
    }
    const apply = (): void => {
      setOuterHeight(el.clientHeight);
    };
    apply();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", apply);
      return () => window.removeEventListener("resize", apply);
    }
    const observer = new ResizeObserver(apply);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const selectedVideo = useMemo(
    () => videos.find((video) => video.id === selectedVideoId) ?? videos[0] ?? null,
    [selectedVideoId, videos]
  );

  const targetAspect = useMemo(
    () => parseAspect(ratio, customWidth, customHeight),
    [ratio, customWidth, customHeight]
  );

  const videoNaturalSize = useMemo<{ width: number; height: number } | null>(() => {
    if (selectedVideo?.width && selectedVideo?.height) {
      return { width: selectedVideo.width, height: selectedVideo.height };
    }
    return imageNaturalSize;
  }, [selectedVideo, imageNaturalSize]);

  const previewAspectStyle = videoNaturalSize
    ? `${videoNaturalSize.width} / ${videoNaturalSize.height}`
    : "16 / 9";

  const contentAspect = videoNaturalSize
    ? videoNaturalSize.width / videoNaturalSize.height
    : 16 / 9;

  const maskRatios = useMemo(() => {
    // Cover frame defaults to the full width of the video (so users
    // immediately see exactly which slice the cover will capture). For
    // portrait videos with a portrait/square target this means the mask
    // spans the entire width and can be dragged vertically. For landscape
    // videos with a portrait target, full width would overflow the video
    // height; in that case we fall back to MASK_SCALE so the user keeps
    // some horizontal dragging margin.
    let widthRatio: number;
    let heightRatio: number;
    if (contentAspect > targetAspect) {
      // Landscape video, target is narrower than the video: shrink mask
      // height to MASK_SCALE so the user can drag horizontally.
      heightRatio = MASK_SCALE;
      widthRatio = (heightRatio * targetAspect) / contentAspect;
    } else {
      // Portrait/square video, target is wider than (or equal to) the video:
      // fill the full width.
      widthRatio = 1;
      heightRatio = (widthRatio * contentAspect) / targetAspect;
      if (heightRatio > 1) {
        heightRatio = 1;
        widthRatio = (heightRatio * targetAspect) / contentAspect;
      }
    }
    return { widthRatio, heightRatio };
  }, [contentAspect, targetAspect]);

  const halfX = maskRatios.widthRatio / 2;
  const halfY = maskRatios.heightRatio / 2;

  const showToast = useCallback((kind: ToastKind, text: string) => {
    setToast({ kind, text, key: Date.now() });
  }, []);

  useEffect(() => {
    if (!toast) {
      return;
    }
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 2600);
    return () => {
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
        toastTimerRef.current = null;
      }
    };
  }, [toast]);

  async function loadVideos(): Promise<void> {
    const nextVideos = await window.roster.listVideos();
    setVideos(nextVideos);
    setSelectedVideoId((current) => current ?? nextVideos[0]?.id ?? null);
  }

  useEffect(() => {
    void loadVideos();
  }, []);

  useEffect(() => {
    let canceled = false;
    async function loadTimeline(): Promise<void> {
      if (!selectedVideoId) {
        setTimeline(null);
        return;
      }
      setTimelineLoading(true);
      lastFrameRef.current = -1;
      setSelectedFrameIndex(0);
      setCurrentSecond(0);
      setCropPosition({ x: 0.5, y: 0.5 });
      setPrecisePreview(null);
      setPreciseLoading(false);
      setPreciseError(null);
      setImageLoadError(null);
      setImageNaturalSize(null);
      try {
        const result = await window.roster.getCoverTimeline({
          videoId: selectedVideoId,
          frameCount: FRAME_COUNT
        });
        if (!canceled) {
          setTimeline(result);
        }
      } catch (error) {
        if (!canceled) {
          setTimeline({
            videoId: selectedVideoId,
            durationSeconds: 0,
            frames: [],
            generated: false,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      } finally {
        if (!canceled) {
          setTimelineLoading(false);
        }
      }
    }
    void loadTimeline();
    return () => {
      canceled = true;
    };
  }, [selectedVideoId, selectedVideo]);

  const durationSeconds = useMemo(() => {
    const fromVideo = selectedVideo?.durationSeconds ?? 0;
    if (fromVideo > 0) return fromVideo;
    const fromTimeline = timeline?.durationSeconds ?? 0;
    if (fromTimeline > 0) return fromTimeline;
    return 0;
  }, [selectedVideo, timeline]);

  const scrubberMax = durationSeconds > 0 ? durationSeconds : 0.01;

  useEffect(() => {
    if (!selectedVideoId) {
      return;
    }
    const req = preciseRequestRef.current;
    if (req.timer !== null) {
      window.clearTimeout(req.timer);
      req.timer = null;
    }
    req.token += 1;
    const myToken = req.token;
    const targetSecond = currentSecond;
    setPreciseLoading(true);
    req.timer = window.setTimeout(() => {
      void (async () => {
        try {
          const result = await window.roster.getCoverPreviewFrame({
            videoId: selectedVideoId,
            second: targetSecond
          });
          if (myToken === preciseRequestRef.current.token) {
            setPrecisePreview({ url: result.url, second: result.second, videoId: result.videoId });
            setPreciseLoading(false);
            setPreciseError(null);
          }
        } catch (error) {
          if (myToken === preciseRequestRef.current.token) {
            setPreciseLoading(false);
            const text = error instanceof Error ? error.message : String(error);
            console.warn("[cover] preview frame fetch failed", text);
            setPreciseError(text);
          }
        }
      })();
    }, PRECISE_FRAME_DEBOUNCE_MS);
    return () => {
      if (req.timer !== null) {
        window.clearTimeout(req.timer);
        req.timer = null;
      }
    };
  }, [currentSecond, selectedVideoId]);

  const setSecond = useCallback(
    (second: number) => {
      const safe = Math.max(0, Number.isFinite(second) ? second : 0);
      setCurrentSecond(safe);
      if (timeline && timeline.frames.length > 0) {
        const nearest = findNearestFrame(timeline.frames, safe);
        if (nearest && nearest.index !== lastFrameRef.current) {
          lastFrameRef.current = nearest.index;
          setSelectedFrameIndex(nearest.index);
        }
      }
    },
    [timeline]
  );

  const setActiveFrame = useCallback(
    (index: number): void => {
      if (lastFrameRef.current === index) {
        return;
      }
      lastFrameRef.current = index;
      setSelectedFrameIndex(index);
      const second = timeline?.frames[index]?.second;
      if (typeof second === "number") {
        setCurrentSecond(second);
      }
    },
    [timeline]
  );

  function handlePreviewImageLoad(event: SyntheticEvent<HTMLImageElement>): void {
    setImageLoadError(null);
    const img = event.currentTarget;
    // eslint-disable-next-line no-console
    console.log("[cover] preview image loaded:", {
      src: img.src,
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight
    });
    if (img.naturalWidth > 0 && img.naturalHeight > 0) {
      setImageNaturalSize((current) => {
        if (current && current.width === img.naturalWidth && current.height === img.naturalHeight) {
          return current;
        }
        return { width: img.naturalWidth, height: img.naturalHeight };
      });
    }
  }

  function handlePreviewImageError(event: SyntheticEvent<HTMLImageElement>): void {
    const img = event.currentTarget;
    const message = `图片加载失败: ${img.src}`;
    // eslint-disable-next-line no-console
    console.error("[cover] preview image load failed:", img.src);
    setImageLoadError(message);
  }

  function updateCropPositionFromPointer(clientX: number, clientY: number): void {
    const preview = previewRef.current;
    if (!preview) {
      return;
    }
    const rect = preview.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      return;
    }
    const rawX = (clientX - rect.left) / rect.width;
    const rawY = (clientY - rect.top) / rect.height;
    setCropPosition({
      x: clampCenter(rawX, halfX),
      y: clampCenter(rawY, halfY)
    });
  }

  function startMaskDrag(event: PointerEvent<HTMLDivElement>): void {
    event.preventDefault();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Programmatic Electron e2e events do not always create an active pointer capture target.
    }
    draggingMaskRef.current = true;
    setDraggingMask(true);
    updateCropPositionFromPointer(event.clientX, event.clientY);
  }

  function moveMaskDrag(event: PointerEvent<HTMLDivElement>): void {
    if (!draggingMaskRef.current) {
      return;
    }
    updateCropPositionFromPointer(event.clientX, event.clientY);
  }

  function endMaskDrag(event: PointerEvent<HTMLDivElement>): void {
    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    } catch {
      // See the matching setPointerCapture guard above.
    }
    draggingMaskRef.current = false;
    setDraggingMask(false);
  }

  const pendingVideos = useMemo(() => videos.filter((video) => !video.hasCover), [videos]);

  const nextPendingVideoId = useMemo(() => {
    if (!selectedVideo) {
      return pendingVideos[0]?.id ?? null;
    }
    const idx = pendingVideos.findIndex((video) => video.id === selectedVideo.id);
    if (idx === -1) {
      return pendingVideos[0]?.id ?? null;
    }
    return pendingVideos[idx + 1]?.id ?? null;
  }, [pendingVideos, selectedVideo]);

  function toBackendCropPosition(): { x: number; y: number } {
    const rangeX = 1 - 2 * halfX;
    const rangeY = 1 - 2 * halfY;
    return {
      x: rangeX > 0 ? clamp((cropPosition.x - halfX) / rangeX, 0, 1) : 0.5,
      y: rangeY > 0 ? clamp((cropPosition.y - halfY) / rangeY, 0, 1) : 0.5
    };
  }

  const applyCover = useCallback(
    async (options: { advance?: boolean } = {}): Promise<void> => {
      if (!selectedVideo || saving) {
        return;
      }
      setSaving(true);
      try {
        const cropForBackend = toBackendCropPosition();
        const frameSecond = durationSeconds > 0
          ? clamp(currentSecond, 0, durationSeconds)
          : timeline?.frames[selectedFrameIndex]?.second;
        const result = await window.roster.applyCover({
          videoId: selectedVideo.id,
          aspectRatio: ratio,
          customRatio: ratio === "custom" ? { width: customWidth, height: customHeight } : undefined,
          cropPosition: cropForBackend,
          frameIndex: selectedFrameIndex,
          frameSecond: typeof frameSecond === "number" ? frameSecond : undefined
        });
        setVideos((current) => current.map((video) => (video.id === result.video.id ? result.video : video)));
        const savedPath = result.coverRelativePath;
        setMessage(`已保存封面：${savedPath}`);
        showToast("success", `已保存封面 · ${savedPath}`);
        if (options.advance) {
          const advanceId = nextPendingVideoId;
          if (advanceId && advanceId !== selectedVideo.id) {
            setSelectedVideoId(advanceId);
          }
        }
      } catch (error) {
        const text = error instanceof Error ? error.message : String(error);
        setMessage(text);
        showToast("error", text);
      } finally {
        setSaving(false);
      }
    },
    [
      selectedVideo,
      saving,
      ratio,
      customWidth,
      customHeight,
      selectedFrameIndex,
      currentSecond,
      durationSeconds,
      timeline,
      halfX,
      halfY,
      cropPosition,
      nextPendingVideoId,
      showToast
    ]
  );

  async function batchApplyFirstFrame(): Promise<void> {
    try {
      const result = await window.roster.batchApplyFirstFrameCovers({
        aspectRatio: ratio,
        customRatio: ratio === "custom" ? { width: customWidth, height: customHeight } : undefined
      });
      if (result.videos.length > 0) {
        setVideos((current) =>
          current.map((video) => result.videos.find((updated) => updated.id === video.id) ?? video)
        );
      }
      const text = `已批量应用首帧 ${result.applied} 个，跳过 ${result.skipped} 个`;
      setMessage(text);
      showToast("success", text);
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      setMessage(text);
      showToast("error", text);
    }
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (videos.length === 0) {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }
      const index = selectedVideo ? videos.findIndex((video) => video.id === selectedVideo.id) : -1;
      const key = event.key.toLowerCase();
      if (key === "j" && index >= 0) {
        event.preventDefault();
        setSelectedVideoId(videos[Math.max(0, index - 1)]?.id ?? selectedVideo?.id ?? null);
      } else if (key === "k" && index >= 0) {
        event.preventDefault();
        setSelectedVideoId(videos[Math.min(videos.length - 1, index + 1)]?.id ?? selectedVideo?.id ?? null);
      } else if (event.key === "Enter" && !event.shiftKey && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        void applyCover({ advance: true });
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [videos, selectedVideo, applyCover]);

  const selectedFrame: CoverTimelineFrame | null =
    timeline?.frames[selectedFrameIndex] ?? timeline?.frames[0] ?? null;

  const previewImageSrc = useMemo(() => {
    if (precisePreview && precisePreview.videoId === selectedVideoId) {
      return precisePreview.url;
    }
    // Timeline mock placeholder SVGs (when ffmpeg fails) look ugly; rather show a
    // loading state until the precise ffmpeg frame arrives.
    if (timeline?.error) {
      return null;
    }
    return selectedFrame?.url ?? null;
  }, [precisePreview, selectedVideoId, selectedFrame, timeline]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 p-5" data-cover-workspace>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">封面工作区</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            拖动时间轴或缩略图定帧、在视频画面内移动裁剪框，按 Enter 保存并跳到下一个视频。
          </p>
        </div>
        <Button variant="outline" onClick={loadVideos}>
          刷新视频
        </Button>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[320px_minmax(0,1fr)] gap-4">
        <aside className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Clapperboard className="size-4 text-primary" />
              待处理视频
            </div>
            <Badge>{videos.length}</Badge>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {videos.map((video) => (
              <button
                key={video.id}
                className={cn(
                  "mb-2 flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-sm",
                  selectedVideo?.id === video.id
                    ? "border-primary bg-blue-50 text-blue-800"
                    : "border-border hover:bg-muted"
                )}
                onClick={() => setSelectedVideoId(video.id)}
                type="button"
                data-cover-video-row={video.id}
              >
                <span className="min-w-0 flex-1 truncate">{video.fileName}</span>
                {video.hasCover ? <CheckCircle2 className="size-4 text-emerald-600" /> : null}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
            <Keyboard className="size-3.5" />
            <span>
              <kbd className="rounded border border-border bg-muted px-1.5 py-0.5">J</kbd>
              <span className="mx-1">/</span>
              <kbd className="rounded border border-border bg-muted px-1.5 py-0.5">K</kbd>
              切换视频，
              <kbd className="rounded border border-border bg-muted px-1.5 py-0.5">Enter</kbd>
              应用并下一个
            </span>
          </div>
        </aside>

        <main className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{selectedVideo?.fileName ?? "未选择视频"}</div>
              <div className="mt-1 truncate text-xs text-muted-foreground">{selectedVideo?.relativePath ?? ""}</div>
            </div>
            <div className="flex items-center gap-2">
              {(["3:4", "9:16", "1:1", "custom"] as CoverRatio[]).map((item) => (
                <Button
                  key={item}
                  variant={ratio === item ? "primary" : "outline"}
                  size="sm"
                  onClick={() => setRatio(item)}
                  data-cover-ratio={item}
                >
                  {item === "custom" ? "自定义" : item}
                </Button>
              ))}
              {ratio === "custom" ? (
                <div className="flex h-8 items-center gap-1 rounded-md border border-border bg-background px-2 text-xs">
                  <input
                    className="h-6 w-10 rounded border border-input bg-background px-1"
                    min={1}
                    max={100}
                    type="number"
                    value={customWidth}
                    onChange={(event) => setCustomWidth(Math.max(1, Number.parseInt(event.target.value, 10) || 1))}
                    data-custom-cover-width
                  />
                  <span>:</span>
                  <input
                    className="h-6 w-10 rounded border border-input bg-background px-1"
                    min={1}
                    max={100}
                    type="number"
                    value={customHeight}
                    onChange={(event) => setCustomHeight(Math.max(1, Number.parseInt(event.target.value, 10) || 1))}
                    data-custom-cover-height
                  />
                </div>
              ) : null}
              <Button
                variant="outline"
                onClick={batchApplyFirstFrame}
                disabled={videos.length === 0}
                data-batch-apply-first-frame
              >
                <Layers />
                批量首帧
              </Button>
              <Button
                variant="primary"
                onClick={() => void applyCover()}
                disabled={!selectedVideo || saving}
                data-apply-cover
              >
                {saving ? <Loader2 className="animate-spin" /> : <Save />}
                {saving ? "保存中" : "应用此封面"}
              </Button>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
            <div
              ref={outerRef}
              className="flex min-h-0 flex-1 items-center justify-center overflow-hidden"
            >
              <div
                ref={previewRef}
                style={{
                  aspectRatio: previewAspectStyle,
                  maxWidth: "100%",
                  maxHeight: outerHeight > 50 ? `${outerHeight}px` : "calc(100vh - 360px)",
                  height: outerHeight > 50 ? `${outerHeight}px` : "calc(100vh - 360px)"
                }}
                className="relative overflow-hidden rounded-lg border border-border bg-black"
                data-cover-preview-frame={selectedFrame?.index ?? -1}
                data-video-w={videoNaturalSize?.width ?? "null"}
                data-video-h={videoNaturalSize?.height ?? "null"}
              >
                {previewImageSrc ? (
                  <img
                    key={`${selectedVideoId ?? "no-video"}-${previewImageSrc}`}
                    alt={`封面预览 ${selectedFrame ? selectedFrame.index + 1 : ""}`}
                    className="absolute inset-0 block h-full w-full object-contain"
                    src={previewImageSrc}
                    onLoad={handlePreviewImageLoad}
                    onError={handlePreviewImageError}
                    data-cover-preview-image
                  />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground">
                    <ImageIcon className="size-12" />
                    <div className="text-sm">{timelineLoading ? "正在生成时间轴" : "预览区"}</div>
                  </div>
                )}
                {imageLoadError ? (
                  <div className="absolute inset-x-2 bottom-2 break-words rounded-md bg-red-500/90 px-3 py-2 text-[11px] text-white">
                    {imageLoadError}
                  </div>
                ) : null}
                <div className="pointer-events-none absolute left-2 top-2 rounded-md bg-black/60 px-2 py-1 font-mono text-[10px] text-white">
                  aspect {previewAspectStyle} · video {videoNaturalSize ? `${videoNaturalSize.width}×${videoNaturalSize.height}` : "?"} · src {previewImageSrc ? "yes" : "null"}
                </div>
                {preciseLoading ? (
                  <div className="pointer-events-none absolute right-2 top-2 flex items-center gap-1 rounded-md bg-black/60 px-2 py-1 text-[10px] text-white">
                    <Loader2 className="size-3 animate-spin" />
                    取帧中
                  </div>
                ) : preciseError ? (
                  <div
                    className="absolute right-2 top-2 max-w-[60%] truncate rounded-md bg-amber-500/90 px-2 py-1 text-[10px] text-white"
                    title={preciseError}
                  >
                    取帧失败 · 显示最近缩略图
                  </div>
                ) : null}
                {selectedVideo ? (
                  <div
                    className={cn(
                      "absolute cursor-move touch-none border-2 border-primary bg-primary/10 shadow-[0_0_0_9999px_rgba(15,23,42,0.45)]",
                      draggingMask ? "bg-primary/20" : ""
                    )}
                    style={{
                      width: `${maskRatios.widthRatio * 100}%`,
                      height: `${maskRatios.heightRatio * 100}%`,
                      left: `${cropPosition.x * 100}%`,
                      top: `${cropPosition.y * 100}%`,
                      transform: "translate(-50%, -50%)"
                    }}
                    role="slider"
                    aria-label="封面裁剪位置"
                    aria-valuetext={`${Math.round(cropPosition.x * 100)}%, ${Math.round(cropPosition.y * 100)}%`}
                    onPointerDown={startMaskDrag}
                    onPointerMove={moveMaskDrag}
                    onPointerUp={endMaskDrag}
                    onPointerCancel={endMaskDrag}
                    data-cover-mask
                    data-cover-crop-x={cropPosition.x.toFixed(3)}
                    data-cover-crop-y={cropPosition.y.toFixed(3)}
                  />
                ) : (
                  <div
                    style={{ display: "none" }}
                    role="slider"
                    data-cover-mask
                    data-cover-crop-x={cropPosition.x.toFixed(3)}
                    data-cover-crop-y={cropPosition.y.toFixed(3)}
                  />
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2">
              <input
                type="range"
                min={0}
                max={scrubberMax}
                step={Math.max(0.01, scrubberMax / 1000)}
                value={Math.min(currentSecond, scrubberMax)}
                onChange={(event) => setSecond(Number(event.currentTarget.value))}
                className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-muted accent-primary"
                disabled={scrubberMax <= 0.01}
                data-cover-scrubber
              />
              <div className="min-w-[88px] text-right font-mono text-xs text-muted-foreground" data-cover-time>
                {formatTime(currentSecond)} / {formatTime(scrubberMax)}
              </div>
            </div>

            <div className="rounded-lg border border-border bg-background p-2">
              <div className="mb-1.5 flex items-center justify-between gap-3 px-1 text-[11px] text-muted-foreground">
                <div className="flex items-center gap-2 font-medium text-foreground/80">
                  <Keyboard className="size-3.5 text-primary" />
                  时间轴缩略图序列
                  <Badge>{timeline?.frames.length ?? 0} 帧</Badge>
                  {timeline?.error ? (
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-normal text-amber-800">
                      占位帧
                    </span>
                  ) : null}
                </div>
                <span>
                  {selectedFrame
                    ? `第 ${selectedFrame.index + 1} 帧 · ${selectedFrame.second.toFixed(1)}s`
                    : timelineLoading
                      ? "生成中"
                      : "-"}
                </span>
              </div>
              <div className="flex h-20 items-center gap-1.5 overflow-x-auto pb-1">
                {timeline?.frames.map((frame) => (
                  <button
                    key={frame.cacheRelativePath}
                    style={{
                      aspectRatio: videoNaturalSize
                        ? `${videoNaturalSize.width} / ${videoNaturalSize.height}`
                        : "16 / 9"
                    }}
                    className={cn(
                      "h-full shrink-0 overflow-hidden rounded border bg-muted",
                      selectedFrame?.index === frame.index
                        ? "border-primary ring-2 ring-primary/30"
                        : "border-border hover:border-primary/50"
                    )}
                    onMouseOver={() => setActiveFrame(frame.index)}
                    onFocus={() => setActiveFrame(frame.index)}
                    onClick={() => setActiveFrame(frame.index)}
                    type="button"
                    data-cover-frame={frame.index}
                  >
                    <img alt={`帧 ${frame.index + 1}`} className="block h-full w-full object-cover" src={frame.url} />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>

      {message ? (
        <div
          className="rounded-md border border-border bg-card px-4 py-2 text-xs text-muted-foreground"
          data-cover-message
        >
          {message}
        </div>
      ) : null}

      {toast ? (
        <div
          key={toast.key}
          className={cn(
            "pointer-events-none fixed bottom-6 right-6 z-50 max-w-sm rounded-md border px-4 py-2 text-sm shadow-lg",
            toast.kind === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : toast.kind === "error"
                ? "border-red-200 bg-red-50 text-red-900"
                : "border-border bg-card text-foreground"
          )}
          role="status"
          data-cover-toast={toast.kind}
        >
          {toast.text}
        </div>
      ) : null}
    </div>
  );
}
