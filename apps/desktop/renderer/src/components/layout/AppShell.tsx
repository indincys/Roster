import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Bell, ChevronDown, Clock3, Download, RefreshCw, Search, Settings } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { activeWorkspace, type AppPage, useAppStore } from "@/stores/app-store";
import { navigationGroups, pinnedItems } from "./navigation";

const pageTitles: Record<AppPage, string> = {
  dashboard: "首页",
  tasks: "任务单",
  titles: "标题工作区",
  images: "图片工作室",
  covers: "封面工作区",
  scripts: "文案工作区",
  lib_videos: "视频库",
  lib_tags: "标签库",
  lib_titles: "标题库",
  lib_scripts: "文案库",
  lib_prompts: "提示词库",
  lib_images: "图片库",
  skills: "Skill 中心",
  market: "Skill 市场",
  schedules: "定时任务总览",
  settings: "设置",
  feedback: "反馈日志"
};

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps): JSX.Element {
  const { bootstrap, page, updateState, setPage, switchWorkspace, checkForUpdates, downloadUpdate, installUpdate } = useAppStore();
  const workspace = activeWorkspace(bootstrap);
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const breadcrumb = useMemo(() => {
    const brand = workspace?.name ?? "未选择工作空间";
    return `${brand} / ${pageTitles[page]}`;
  }, [page, workspace?.name]);

  const showUpdateAction = updateState ? updateState.state !== "idle" : false;
  const updateAction = async (): Promise<void> => {
    if (!updateState || updateState.state === "not_available" || updateState.state === "error") {
      await checkForUpdates();
      return;
    }
    if (updateState.state === "available") {
      await downloadUpdate();
      return;
    }
    if (updateState.state === "downloaded") {
      await installUpdate();
    }
  };
  const updateLabel = updateState ? updateStatusLabel(updateState) : "检查更新";
  const UpdateIcon = updateState?.state === "available" ? Download : updateState?.state === "checking" || updateState?.state === "downloading" ? RefreshCw : Bell;

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-card">
        <div className="flex h-14 items-center border-b border-border px-4">
          <button
            className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted"
            onClick={() => setWorkspaceMenuOpen((open) => !open)}
          >
            <span
              className="flex size-8 shrink-0 items-center justify-center rounded-md text-xs font-semibold text-white"
              style={{ backgroundColor: workspace?.color ?? "#52525b" }}
            >
              {(workspace?.name ?? "无").slice(0, 1)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{workspace?.name ?? "创建工作空间"}</span>
              <span className="block truncate text-xs text-muted-foreground">本地优先 · 多品牌隔离</span>
            </span>
            <ChevronDown className="size-4 text-muted-foreground" />
          </button>
        </div>

        {workspaceMenuOpen ? (
          <div className="border-b border-border p-2">
            {bootstrap?.workspace.workspaces.length ? (
              <div className="flex flex-col gap-1">
                {bootstrap.workspace.workspaces.map((item) => (
                  <button
                    key={item.id}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-muted",
                      item.id === workspace?.id && "bg-muted font-medium"
                    )}
                    onClick={() => {
                      void switchWorkspace(item.id);
                      setWorkspaceMenuOpen(false);
                    }}
                  >
                    <span className="size-2 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="min-w-0 flex-1 truncate">{item.name}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="px-2 py-3 text-xs text-muted-foreground">还没有工作空间，请到设置中创建。</p>
            )}
          </div>
        ) : null}

        <nav className="flex flex-1 flex-col gap-4 overflow-y-auto px-3 py-4">
          <div className="flex flex-col gap-1">
            <div className="px-2 text-xs font-medium text-muted-foreground">置顶</div>
            {pinnedItems.map((item) => (
              <SidebarItem key={item.id} item={item} active={page === item.id} onClick={() => setPage(item.id)} />
            ))}
          </div>
          {navigationGroups.map((group) => {
            const GroupIcon = group.icon;
            return (
              <div key={group.id} className="flex flex-col gap-1">
                <div className="flex items-center gap-2 px-2 text-xs font-medium text-muted-foreground">
                  <GroupIcon className="size-3.5" />
                  <span>{group.label}</span>
                </div>
                {group.items.map((item) => (
                  <SidebarItem key={item.id} item={item} active={page === item.id} onClick={() => setPage(item.id)} />
                ))}
              </div>
            );
          })}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card px-4">
          <div className="min-w-52 text-sm font-medium">{breadcrumb}</div>
          <button className="flex h-8 min-w-96 max-w-xl flex-1 items-center gap-2 rounded-md border border-input bg-background px-3 text-left text-sm text-muted-foreground">
            <Search className="size-4" />
            <span className="flex-1 truncate">搜索视频、标题、标签、Skill</span>
            <kbd className="rounded border border-border px-1.5 py-0.5 text-[11px]">⌘K</kbd>
          </button>
          <Badge variant="info" className="gap-1">
            <Clock3 className="size-3" />
            3 个待执行
          </Badge>
          {showUpdateAction ? (
            <Button
              variant="outline"
              size="sm"
              aria-label={updateLabel}
              title={updateLabel}
              onClick={() => void updateAction()}
              data-top-update-action
              disabled={updateState?.state === "checking" || updateState?.state === "downloading"}
            >
              <UpdateIcon className={cn((updateState?.state === "checking" || updateState?.state === "downloading") && "animate-spin")} />
              {updateLabel}
            </Button>
          ) : null}
          <Button variant="ghost" size="icon" aria-label="设置" onClick={() => setPage("settings")}>
            <Settings />
          </Button>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto bg-background">{children}</main>
      </div>
    </div>
  );
}

function updateStatusLabel(updateState: NonNullable<ReturnType<typeof useAppStore.getState>["updateState"]>): string {
  if (updateState.state === "checking") {
    return "检查更新";
  }
  if (updateState.state === "available") {
    return updateState.latestVersion ? `下载 ${updateState.latestVersion}` : "下载更新";
  }
  if (updateState.state === "downloading") {
    return updateState.progressPercent === null ? "下载中" : `下载 ${Math.round(updateState.progressPercent)}%`;
  }
  if (updateState.state === "downloaded") {
    return "重启安装";
  }
  if (updateState.state === "error") {
    return "更新失败";
  }
  return "已是最新";
}

interface SidebarItemProps {
  item: (typeof pinnedItems)[number];
  active: boolean;
  onClick(): void;
}

function SidebarItem({ item, active, onClick }: SidebarItemProps): JSX.Element {
  const Icon = item.icon;
  return (
    <button
      className={cn(
        "flex h-8 items-center gap-2 rounded-md px-2 text-left text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground",
        active && "bg-primary/10 font-medium text-primary"
      )}
      onClick={onClick}
    >
      <Icon className="size-4" />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {item.badge ? <span className="rounded bg-muted px-1.5 text-[11px] text-muted-foreground">{item.badge}</span> : null}
    </button>
  );
}
