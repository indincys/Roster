import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  Bell,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clock3,
  Download,
  RefreshCw
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { activeWorkspace, useAppStore } from "@/stores/app-store";
import { CommandPalette } from "./CommandPalette";
import { type NavigationItem, navigationGroups, pageTitleMap } from "./navigation";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps): JSX.Element {
  const { bootstrap, page, updateState, setPage, switchWorkspace, checkForUpdates, downloadUpdate, installUpdate } = useAppStore();
  const workspace = activeWorkspace(bootstrap);
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const breadcrumbCurrent = pageTitleMap[page];
  const workspaceName = workspace?.name ?? "未选择工作空间";

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
  const updateLabel = useMemo(() => (updateState ? updateStatusLabel(updateState) : "检查更新"), [updateState]);
  const UpdateIcon = updateState?.state === "available" ? Download : updateState?.state === "checking" || updateState?.state === "downloading" ? RefreshCw : Bell;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      {/* ───────── Top bar ───────── */}
      <header className="sticky top-0 z-20 flex h-[var(--topbar-h)] shrink-0 items-center gap-3.5 border-b border-border bg-card px-4">
        <div
          className={cn(
            "flex shrink-0 items-center gap-2",
            sidebarCollapsed ? "min-w-[var(--sidebar-w-collapsed)]" : "min-w-[var(--sidebar-w)]"
          )}
        >
          <div className="flex size-[26px] items-center justify-center rounded-md bg-foreground text-[14px] font-bold text-background">
            P
          </div>
          {!sidebarCollapsed && (
            <>
              <div className="text-[15px] font-bold tracking-tight">pillar</div>
              <span className="ml-1.5 text-[11px] text-muted-foreground">内容生产工作台</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
          <span>{workspaceName}</span>
          <ChevronRight className="size-3" />
          <span>{breadcrumbCurrent}</span>
        </div>

        <button
          type="button"
          className="ml-1 flex h-[30px] max-w-[480px] flex-1 items-center gap-2 rounded-md border border-border bg-[hsl(var(--bg-soft))] px-2.5 text-[12px] text-muted-foreground hover:bg-muted/60"
          onClick={() => setCommandOpen(true)}
        >
          <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <span className="flex-1 truncate text-left">跳转、搜索、运行 Skill...</span>
          <span className="kbd">⌘ K</span>
        </button>

        <div className="ml-auto flex items-center gap-1">
          <Badge variant="info" className="gap-1">
            <Clock3 className="size-3" />3 个待执行
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
              <UpdateIcon
                className={cn((updateState?.state === "checking" || updateState?.state === "downloading") && "animate-spin")}
              />
              {updateLabel}
            </Button>
          ) : null}
          <Button variant="ghost" size="icon" aria-label="通知">
            <Bell />
          </Button>
          <Button variant="ghost" size="icon" aria-label="帮助">
            <CircleHelp />
          </Button>
          <span
            className="ml-1 flex size-7 items-center justify-center rounded-full bg-primary text-[12px] font-semibold text-primary-foreground"
            title={workspaceName}
          >
            {workspaceName.slice(0, 1)}
          </span>
        </div>
      </header>

      {/* ───────── Body (sidebar + main) ───────── */}
      <div className="flex min-h-0 flex-1">
        <aside
          className={cn(
            "pillar-sidebar sticky top-[var(--topbar-h)] flex h-[calc(100vh-var(--topbar-h))] shrink-0 flex-col overflow-y-auto border-r border-border bg-card",
            sidebarCollapsed ? "w-[var(--sidebar-w-collapsed)]" : "w-[var(--sidebar-w)]"
          )}
        >
          {/* Workspace switcher */}
          <div className="border-b border-border p-2.5">
            <button
              type="button"
              className="flex w-full items-center gap-2.5 rounded-md border border-border bg-[hsl(var(--bg-soft))] p-2 text-left transition hover:bg-muted/60"
              onClick={() => setWorkspaceMenuOpen((open) => !open)}
            >
              <span
                className="flex size-6 shrink-0 items-center justify-center rounded-[5px] text-[12px] font-semibold text-white"
                style={{ backgroundColor: workspace?.color ?? "hsl(var(--primary))" }}
              >
                {(workspace?.name ?? "无").slice(0, 1)}
              </span>
              {!sidebarCollapsed && (
                <>
                  <div className="min-w-0 flex-1 overflow-hidden">
                    <div className="truncate text-[13px] font-semibold">{workspace?.name ?? "创建工作空间"}</div>
                    <div className="truncate text-[11px] text-muted-foreground">本地优先 · 多品牌隔离</div>
                  </div>
                  <ChevronDown className="size-3 text-muted-foreground" />
                </>
              )}
            </button>

            {workspaceMenuOpen && !sidebarCollapsed ? (
              <div className="mt-2 flex flex-col gap-1">
                {bootstrap?.workspace.workspaces.length ? (
                  bootstrap.workspace.workspaces.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={cn(
                        "flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-muted/60",
                        item.id === workspace?.id && "bg-muted/80 font-medium"
                      )}
                      onClick={() => {
                        void switchWorkspace(item.id);
                        setWorkspaceMenuOpen(false);
                      }}
                    >
                      <span className="size-2 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="min-w-0 flex-1 truncate">{item.name}</span>
                    </button>
                  ))
                ) : (
                  <p className="px-2 py-2 text-[11px] text-muted-foreground">还没有工作空间，请到设置中创建。</p>
                )}
              </div>
            ) : null}
          </div>

          {/* Nav groups */}
          <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto pt-3">
            {navigationGroups.map((group) => (
              <div key={group.id} className="px-2 pb-1 pt-3">
                {!sidebarCollapsed && (
                  <div className="px-2 pb-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground-2))]">
                    {group.label}
                  </div>
                )}
                {group.items.map((item) => (
                  <SidebarItem
                    key={item.id}
                    item={item}
                    active={page === item.id}
                    collapsed={sidebarCollapsed}
                    onClick={() => setPage(item.id)}
                  />
                ))}
              </div>
            ))}
          </nav>

          {/* Collapse toggle */}
          <div className="mt-auto border-t border-border p-2.5">
            <button
              type="button"
              className="flex h-7 w-full items-center justify-center gap-1.5 rounded-md text-[11.5px] text-muted-foreground hover:bg-muted/60"
              onClick={() => setSidebarCollapsed((value) => !value)}
              aria-label={sidebarCollapsed ? "展开侧栏" : "收起侧栏"}
            >
              {sidebarCollapsed ? (
                <ChevronRight className="size-3" />
              ) : (
                <>
                  <ChevronLeft className="size-3" />
                  收起
                </>
              )}
            </button>
          </div>
        </aside>

        <main className="min-w-0 flex-1 overflow-y-auto bg-background">{children}</main>
      </div>

      <CommandPalette
        open={commandOpen}
        onClose={() => setCommandOpen(false)}
        onNavigate={(target) => setPage(target)}
      />
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
  item: NavigationItem;
  active: boolean;
  collapsed: boolean;
  onClick(): void;
}

function SidebarItem({ item, active, collapsed, onClick }: SidebarItemProps): JSX.Element {
  const Icon = item.icon;
  const badge = item.badge;
  const isHot = badge === "hot";
  return (
    <button
      type="button"
      onClick={onClick}
      title={collapsed ? item.label : undefined}
      className={cn(
        "flex h-[30px] w-full items-center gap-2.5 rounded-[5px] px-2.5 text-left text-[13px] text-[hsl(var(--foreground-soft))] transition hover:bg-[hsl(var(--bg-soft))]",
        collapsed && "justify-center px-1.5",
        active && "bg-primary/10 font-semibold text-[hsl(var(--primary-strong))]"
      )}
    >
      <Icon className="size-3.5 shrink-0" />
      {!collapsed && (
        <>
          <span className="flex-1 truncate">{item.label}</span>
          {badge != null && (
            <span
              className={cn(
                "ml-auto rounded-full px-1.5 py-px text-[10px] font-mono",
                isHot ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              )}
            >
              {badge}
            </span>
          )}
        </>
      )}
    </button>
  );
}
