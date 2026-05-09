import { useEffect } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { CoverWorkspacePage } from "@/pages/CoverWorkspacePage";
import { DashboardPage } from "@/pages/DashboardPage";
import { ImageStudioPage } from "@/pages/ImageStudioPage";
import { isLibraryPage, LibraryPage } from "@/pages/LibraryPage";
import { PlaceholderPage } from "@/pages/PlaceholderPage";
import { SchedulesPage } from "@/pages/SchedulesPage";
import { ScriptWorkspacePage } from "@/pages/ScriptWorkspacePage";
import { SettingsPage } from "@/pages/SettingsPage";
import { SkillCenterPage } from "@/pages/SkillCenterPage";
import { SkillMarketPage } from "@/pages/SkillMarketPage";
import { TasksPage } from "@/pages/TasksPage";
import { TitleWorkspacePage } from "@/pages/TitleWorkspacePage";
import { VideoLibraryPage } from "@/pages/VideoLibraryPage";
import { useAppStore, type AppPage } from "@/stores/app-store";

const titles: Record<AppPage, string> = {
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

export function App(): JSX.Element {
  const { page, loadBootstrap, loadUpdateState, setUpdateState, loading, error } = useAppStore();

  useEffect(() => {
    void loadBootstrap();
    void loadUpdateState();
    return window.roster.onSoftwareUpdateEvent((event) => {
      setUpdateState(event);
    });
  }, [loadBootstrap, loadUpdateState, setUpdateState]);

  let pageElement: JSX.Element;
  if (page === "dashboard") {
    pageElement = <DashboardPage />;
  } else if (page === "titles") {
    pageElement = <TitleWorkspacePage />;
  } else if (page === "images") {
    pageElement = <ImageStudioPage />;
  } else if (page === "covers") {
    pageElement = <CoverWorkspacePage />;
  } else if (page === "scripts") {
    pageElement = <ScriptWorkspacePage />;
  } else if (page === "schedules") {
    pageElement = <SchedulesPage />;
  } else if (page === "tasks") {
    pageElement = <TasksPage />;
  } else if (page === "settings") {
    pageElement = <SettingsPage />;
  } else if (page === "lib_videos") {
    pageElement = <VideoLibraryPage />;
  } else if (isLibraryPage(page)) {
    pageElement = <LibraryPage page={page} />;
  } else if (page === "skills") {
    pageElement = <SkillCenterPage />;
  } else if (page === "market") {
    pageElement = <SkillMarketPage />;
  } else {
    pageElement = <PlaceholderPage title={titles[page]} page={page} />;
  }

  return (
    <AppShell>
      {loading ? <div className="fixed right-4 top-16 rounded-md border border-border bg-card px-3 py-2 text-xs text-muted-foreground shadow-sm">处理中...</div> : null}
      {error ? <div className="fixed right-4 top-16 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 shadow-sm">{error}</div> : null}
      {pageElement}
    </AppShell>
  );
}
