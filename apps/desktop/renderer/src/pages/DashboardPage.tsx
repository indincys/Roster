import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, CalendarClock, Clapperboard, FileText, Images, LayoutList, Plus, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusStrip, WorkbenchHeader } from "@/components/workbench";
import { activeWorkspace, useAppStore } from "@/stores/app-store";

interface DashboardSnapshot {
  taskRows: number;
  pendingTasks: number;
  failedTasks: number;
  videos: number;
  videoWarnings: number;
  missingCovers: number;
  titles: number;
  images: number;
  pendingImages: number;
  scheduledJobs: number;
  failedJobs: number;
}

function todayLocalDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function DashboardPage(): JSX.Element {
  const { bootstrap, setPage } = useAppStore();
  const workspace = activeWorkspace(bootstrap);
  const [snapshot, setSnapshot] = useState<DashboardSnapshot>({
    taskRows: 0,
    pendingTasks: 0,
    failedTasks: 0,
    videos: 0,
    videoWarnings: 0,
    missingCovers: 0,
    titles: 0,
    images: 0,
    pendingImages: 0,
    scheduledJobs: 0,
    failedJobs: 0
  });

  useEffect(() => {
    if (!workspace) {
      return;
    }
    let active = true;
    const loadSnapshot = async (): Promise<void> => {
      const [taskSheet, videos, titles, images, jobs] = await Promise.all([
        window.roster.getTaskSheetByDate(todayLocalDate()),
        window.roster.listVideos(),
        window.roster.listTitles(),
        window.roster.listImages(),
        window.roster.listScheduledJobs()
      ]);
      if (!active) {
        return;
      }
      const rows = taskSheet?.rows ?? [];
      setSnapshot({
        taskRows: rows.length,
        pendingTasks: rows.filter((row) => row.status === "pending" || row.status === "running").length,
        failedTasks: rows.filter((row) => row.status === "failed").length,
        videos: videos.length,
        videoWarnings: videos.filter((video) => video.status === "metadata_error" || video.status === "placeholder").length,
        missingCovers: videos.filter((video) => !video.hasCover && video.status !== "archived").length,
        titles: titles.length,
        images: images.length,
        pendingImages: images.filter((image) => image.status === "active" && image.reviewStatus === "pending").length,
        scheduledJobs: jobs.filter((job) => job.status === "enabled").length,
        failedJobs: jobs.filter((job) => job.lastRunStatus === "failed").length
      });
    };
    void loadSnapshot().catch(() => undefined);
    return () => {
      active = false;
    };
  }, [workspace]);

  const workflowActions = useMemo(
    () => [
      { label: "生成任务单", hint: `${snapshot.videos} 个视频，${snapshot.titles} 条标题可用`, icon: LayoutList, page: "tasks" as const },
      { label: "验收图片", hint: `${snapshot.pendingImages} 张待审`, icon: Images, page: "images" as const },
      { label: "处理封面", hint: `${snapshot.missingCovers} 个素材缺封面`, icon: Clapperboard, page: "covers" as const },
      { label: "编辑 Skill", hint: "调整生成规则和测试提示词", icon: FileText, page: "skills" as const }
    ],
    [snapshot.missingCovers, snapshot.pendingImages, snapshot.titles, snapshot.videos]
  );

  if (!workspace) {
    return (
      <div className="flex min-h-full items-center justify-center p-8">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle>创建第一个品牌工作空间</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm leading-6 text-muted-foreground">
              工作空间等同于品牌。创建后会在磁盘生成 `videos`、`covers`、`images`、`tasks`、
              `skills_config` 和 `_backup` 等目录，并初始化独立的 `workspace.db`。
            </p>
            <div>
              <Button variant="primary" onClick={() => setPage("settings")}>
                <Plus />
                去设置中创建
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-5" data-dashboard-page>
      <WorkbenchHeader
        eyebrow="今日运营面板"
        title={workspace.name}
        description={`上次打开：${workspace.lastOpenedAt ?? "刚刚创建"}。先处理阻塞项，再进入生成和验收。`}
        actions={
          <>
          <Button variant="outline" onClick={() => setPage("titles")}>
            <Sparkles />
            生成新标题
          </Button>
          <Button variant="primary" onClick={() => setPage("tasks")}>
            <LayoutList />
            生成今日任务单
          </Button>
          </>
        }
      />

      <StatusStrip
        items={[
          {
            label: "今日待处理",
            value: snapshot.pendingTasks,
            hint: snapshot.taskRows > 0 ? `${snapshot.taskRows} 行任务单` : "还未生成任务单",
            tone: snapshot.pendingTasks > 0 ? "info" : "neutral",
            onClick: () => setPage("tasks")
          },
          {
            label: "阻塞告警",
            value: snapshot.failedTasks + snapshot.videoWarnings + snapshot.failedJobs,
            hint: `${snapshot.videoWarnings} 个素材异常，${snapshot.failedJobs} 个定时失败`,
            tone: snapshot.failedTasks + snapshot.videoWarnings + snapshot.failedJobs > 0 ? "danger" : "success",
            onClick: () => setPage(snapshot.videoWarnings > 0 ? "lib_videos" : "schedules")
          },
          {
            label: "待验收图片",
            value: snapshot.pendingImages,
            hint: `${snapshot.images} 张图片记录`,
            tone: snapshot.pendingImages > 0 ? "warning" : "neutral",
            onClick: () => setPage("images")
          },
          {
            label: "启用定时",
            value: snapshot.scheduledJobs,
            hint: "查看下一次运行和历史",
            tone: "neutral",
            onClick: () => setPage("schedules")
          }
        ]}
      />

      <div className="grid grid-cols-[1.4fr_1fr] gap-4">
        <Card>
          <CardHeader>
            <CardTitle>今天先处理什么</CardTitle>
            <Badge variant={snapshot.failedTasks + snapshot.videoWarnings + snapshot.failedJobs > 0 ? "danger" : "neutral"}>
              {snapshot.failedTasks + snapshot.videoWarnings + snapshot.failedJobs > 0 ? "有阻塞" : "可开始"}
            </Badge>
          </CardHeader>
          <CardContent className="grid gap-2">
            <WorkflowRow
              icon={snapshot.failedTasks + snapshot.videoWarnings + snapshot.failedJobs > 0 ? AlertTriangle : LayoutList}
              label={snapshot.failedTasks + snapshot.videoWarnings + snapshot.failedJobs > 0 ? "先清理阻塞" : "生成或检查今日任务单"}
              value={
                snapshot.failedTasks + snapshot.videoWarnings + snapshot.failedJobs > 0
                  ? `${snapshot.failedTasks + snapshot.videoWarnings + snapshot.failedJobs} 个问题`
                  : `${snapshot.taskRows} 行`
              }
              onClick={() => setPage(snapshot.videoWarnings > 0 ? "lib_videos" : "tasks")}
            />
            <WorkflowRow
              icon={Images}
              label="验收图片结果"
              value={`${snapshot.pendingImages} 张待审`}
              onClick={() => setPage("images")}
            />
            <WorkflowRow
              icon={CalendarClock}
              label="查看定时任务"
              value={`${snapshot.scheduledJobs} 个启用`}
              onClick={() => setPage("schedules")}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>最近产物</CardTitle>
            <Badge variant="info">可进入工作流</Badge>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-2">
            <ProductTile label="视频素材" value={snapshot.videos} hint={`${snapshot.missingCovers} 缺封面`} onClick={() => setPage("lib_videos")} />
            <ProductTile label="标题库" value={snapshot.titles} hint="可写入任务单" onClick={() => setPage("lib_titles")} />
            <ProductTile label="图片素材" value={snapshot.images} hint={`${snapshot.pendingImages} 待验收`} onClick={() => setPage("lib_images")} />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-[1.2fr_0.8fr] gap-4">
        <Card>
          <CardHeader>
            <CardTitle>工作流启动器</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-4 gap-3">
            {workflowActions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.label}
                  type="button"
                  className="flex min-h-24 flex-col items-start justify-between rounded-md border border-border bg-background p-3 text-left transition-[background-color,border-color,transform] hover:-translate-y-px hover:border-primary/40 hover:bg-muted/40"
                  onClick={() => setPage(action.page)}
                >
                  <span className="flex size-8 items-center justify-center rounded-md bg-muted text-primary">
                    <Icon className="size-4" />
                  </span>
                  <span>
                    <span className="block text-sm font-medium">{action.label}</span>
                    <span className="mt-1 block text-xs leading-5 text-muted-foreground">{action.hint}</span>
                  </span>
                </button>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>路径映射</CardTitle>
            <Button variant="outline" size="sm" onClick={() => setPage("settings")}>
              设置
            </Button>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <PathRow label="当前设备路径" value={workspace.macRootPath} />
            <PathRow label="RPA 执行路径" value={workspace.winRootPath || "未配置"} />
            <p className="text-xs leading-5 text-muted-foreground">路径配置是基础设施信息，仅在缺失或导出前需要关注。</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function WorkflowRow({
  icon: Icon,
  label,
  onClick,
  value
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  value: string;
}): JSX.Element {
  return (
    <button
      type="button"
      className="flex items-center gap-3 rounded-md border border-border bg-background px-3 py-2 text-left transition hover:border-primary/40 hover:bg-muted/40"
      onClick={onClick}
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-primary">
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{label}</span>
        <span className="block text-xs text-muted-foreground">{value}</span>
      </span>
      <ArrowRight className="size-4 text-muted-foreground" />
    </button>
  );
}

function ProductTile({ hint, label, onClick, value }: { hint: string; label: string; onClick: () => void; value: number }): JSX.Element {
  return (
    <button type="button" className="rounded-md border border-border bg-background p-3 text-left hover:bg-muted/40" onClick={onClick}>
      <div className="font-mono text-xl font-semibold tabular-nums">{value}</div>
      <div className="mt-1 text-xs font-medium">{label}</div>
      <div className="mt-1 truncate text-[11px] text-muted-foreground">{hint}</div>
    </button>
  );
}

function PathRow({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="flex flex-col gap-1 rounded-md border border-border bg-background p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="truncate font-mono text-xs">{value}</div>
    </div>
  );
}
