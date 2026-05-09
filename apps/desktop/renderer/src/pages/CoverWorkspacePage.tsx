import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent } from "react";
import { CheckCircle2, Clapperboard, ImageIcon, Keyboard, Layers, Save } from "lucide-react";
import type { CoverTimelineFrame, CoverTimelineResult, VideoLibraryItem } from "@roster/shared-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type CoverRatio = "3:4" | "9:16" | "1:1" | "custom";

export function CoverWorkspacePage(): JSX.Element {
  const [videos, setVideos] = useState<VideoLibraryItem[]>([]);
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [ratio, setRatio] = useState<CoverRatio>("3:4");
  const [customWidth, setCustomWidth] = useState(4);
  const [customHeight, setCustomHeight] = useState(5);
  const [message, setMessage] = useState("");
  const [timeline, setTimeline] = useState<CoverTimelineResult | null>(null);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [selectedFrameIndex, setSelectedFrameIndex] = useState(0);
  const [cropPosition, setCropPosition] = useState({ x: 0.5, y: 0.5 });
  const [draggingMask, setDraggingMask] = useState(false);
  const draggingMaskRef = useRef(false);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const selectedVideo = useMemo(
    () => videos.find((video) => video.id === selectedVideoId) ?? videos[0] ?? null,
    [selectedVideoId, videos]
  );

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
      setSelectedFrameIndex(0);
      try {
        const result = await window.roster.getCoverTimeline({
          videoId: selectedVideoId,
          frameCount: 30
        });
        if (!canceled) {
          setTimeline(result);
          if (result.error) {
            setMessage(`时间轴使用占位帧：${result.error}`);
          }
        }
      } catch (error) {
        if (!canceled) {
          setTimeline(null);
          setMessage(error instanceof Error ? error.message : String(error));
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
  }, [selectedVideoId]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (!selectedVideo || videos.length === 0) {
        return;
      }
      const index = videos.findIndex((video) => video.id === selectedVideo.id);
      if (event.key.toLowerCase() === "j") {
        setSelectedVideoId(videos[Math.max(0, index - 1)]?.id ?? selectedVideo.id);
      }
      if (event.key.toLowerCase() === "k") {
        setSelectedVideoId(videos[Math.min(videos.length - 1, index + 1)]?.id ?? selectedVideo.id);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedVideo, videos]);

  function updateCropPositionFromPointer(clientX: number, clientY: number): void {
    const preview = previewRef.current;
    if (!preview) {
      return;
    }
    const rect = preview.getBoundingClientRect();
    const nextX = (clientX - rect.left) / rect.width;
    const nextY = (clientY - rect.top) / rect.height;
    setCropPosition({
      x: Math.max(0, Math.min(1, nextX)),
      y: Math.max(0, Math.min(1, nextY))
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

  async function applyCover(): Promise<void> {
    if (!selectedVideo) {
      return;
    }
    try {
      const result = await window.roster.applyCover({
        videoId: selectedVideo.id,
        aspectRatio: ratio,
        customRatio: ratio === "custom" ? { width: customWidth, height: customHeight } : undefined,
        cropPosition,
        frameIndex: selectedFrameIndex
      });
      setVideos((current) => current.map((video) => (video.id === result.video.id ? result.video : video)));
      setMessage(`已保存封面：${result.coverRelativePath}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

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
      setMessage(`已批量应用首帧 ${result.applied} 个，跳过 ${result.skipped} 个`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  const selectedFrame: CoverTimelineFrame | null = timeline?.frames[selectedFrameIndex] ?? timeline?.frames[0] ?? null;

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 p-5" data-cover-workspace>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">封面工作区</h1>
          <p className="mt-1 text-sm text-muted-foreground">为视频选择比例并保存封面到工作空间 covers 目录。</p>
        </div>
        <Button variant="outline" onClick={loadVideos}>
          刷新视频
        </Button>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[320px_minmax(0,1fr)] gap-4">
        <aside className="min-h-0 overflow-hidden rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Clapperboard className="size-4 text-primary" />
              待处理视频
            </div>
            <Badge>{videos.length}</Badge>
          </div>
          <div className="h-full min-h-0 overflow-y-auto p-3">
            {videos.map((video) => (
              <button
                key={video.id}
                className={cn(
                  "mb-2 flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-sm",
                  selectedVideo?.id === video.id ? "border-primary bg-blue-50 text-blue-800" : "border-border hover:bg-muted"
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
        </aside>

        <main className="min-h-0 overflow-hidden rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <div className="text-sm font-semibold">{selectedVideo?.fileName ?? "未选择视频"}</div>
              <div className="mt-1 text-xs text-muted-foreground">{selectedVideo?.relativePath ?? ""}</div>
            </div>
            <div className="flex items-center gap-2">
              {(["3:4", "9:16", "1:1", "custom"] as CoverRatio[]).map((item) => (
                <Button key={item} variant={ratio === item ? "primary" : "outline"} size="sm" onClick={() => setRatio(item)} data-cover-ratio={item}>
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
              <Button variant="outline" onClick={batchApplyFirstFrame} disabled={videos.length === 0} data-batch-apply-first-frame>
                <Layers />
                批量首帧
              </Button>
              <Button variant="primary" onClick={applyCover} disabled={!selectedVideo} data-apply-cover>
                <Save />
                应用此封面
              </Button>
            </div>
          </div>

          <div className="grid h-full min-h-0 grid-rows-[minmax(0,1fr)_120px] gap-4 p-4">
            <div
              ref={previewRef}
              className="relative flex min-h-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/40"
              data-cover-preview-frame={selectedFrame?.index ?? -1}
            >
              {selectedFrame ? (
                <img
                  alt={`封面预览 ${selectedFrame.index + 1}`}
                  className="h-full w-full object-contain"
                  src={selectedFrame.url}
                  data-cover-preview-image
                />
              ) : (
                <div className="flex flex-col items-center gap-3 text-muted-foreground">
                  <ImageIcon className="size-12" />
                  <div className="text-sm">{timelineLoading ? "正在生成时间轴" : "预览区"}</div>
                </div>
              )}
              <div
                className={cn(
                  "absolute cursor-move touch-none border-2 border-primary bg-primary/10 shadow-[0_0_0_9999px_rgba(15,23,42,0.24)]",
                  draggingMask ? "bg-primary/20" : ""
                )}
                style={{
                  width: ratio === "9:16" ? "28%" : ratio === "1:1" ? "42%" : "36%",
                  aspectRatio: ratio === "custom" ? `${customWidth} / ${customHeight}` : ratio.replace(":", " / "),
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
            </div>

            <div className="rounded-lg border border-border p-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Keyboard className="size-4 text-primary" />
                  时间轴缩略图序列
                  <Badge>{timeline?.frames.length ?? 0} 帧</Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  {selectedFrame ? `${selectedFrame.second.toFixed(1)}s` : timelineLoading ? "生成中" : "-"}
                </div>
              </div>
              <div className="grid grid-cols-10 gap-2">
                {timeline?.frames.map((frame) => (
                  <button
                    key={frame.cacheRelativePath}
                    className={cn(
                      "overflow-hidden rounded border bg-muted",
                      selectedFrame?.index === frame.index ? "border-primary ring-2 ring-primary/20" : "border-border"
                    )}
                    onMouseEnter={() => setSelectedFrameIndex(frame.index)}
                    onMouseOver={() => setSelectedFrameIndex(frame.index)}
                    onFocus={() => setSelectedFrameIndex(frame.index)}
                    onClick={() => setSelectedFrameIndex(frame.index)}
                    type="button"
                    data-cover-frame={frame.index}
                  >
                    <img alt={`帧 ${frame.index + 1}`} className="aspect-video w-full object-cover" src={frame.url} />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>

      {message ? <div className="rounded-md border border-border bg-card px-4 py-3 text-sm" data-cover-message>{message}</div> : null}
    </div>
  );
}
