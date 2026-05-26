import type { ComponentType, SVGProps } from "react";
import {
  BadgeCheck,
  CalendarClock,
  Clapperboard,
  FileText,
  Globe,
  Image,
  Images,
  KeyRound,
  LayoutDashboard,
  LayoutList,
  MessageSquareWarning,
  PanelLeft,
  ScrollText,
  Settings,
  Tags,
  Type,
  Video,
  WandSparkles
} from "lucide-react";
import type { AppPage } from "@/stores/app-store";

export type NavigationBadge = number | "hot" | string;

export interface NavigationItem {
  id: AppPage;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  badge?: NavigationBadge;
}

export interface NavigationGroup {
  id: string;
  label: string;
  items: NavigationItem[];
}

export const navigationGroups: NavigationGroup[] = [
  {
    id: "workbench",
    label: "工作台",
    items: [
      { id: "dashboard", label: "概览", icon: LayoutDashboard },
      { id: "tasks", label: "任务单", icon: LayoutList }
    ]
  },
  {
    id: "generation",
    label: "生成工作区",
    items: [
      { id: "titles", label: "标题", icon: Type },
      { id: "images", label: "图片工作室", icon: WandSparkles },
      { id: "covers", label: "封面", icon: Clapperboard },
      { id: "scripts", label: "文案", icon: ScrollText }
    ]
  },
  {
    id: "database",
    label: "数据库",
    items: [
      { id: "lib_videos", label: "视频库", icon: Video },
      { id: "lib_tags", label: "标签库", icon: Tags },
      { id: "lib_titles", label: "标题库", icon: Type },
      { id: "lib_prompts", label: "提示词库", icon: WandSparkles },
      { id: "lib_scripts", label: "文案库", icon: FileText },
      { id: "lib_images", label: "图片库", icon: Image }
    ]
  },
  {
    id: "system",
    label: "系统",
    items: [
      { id: "skills", label: "Skill 中心", icon: BadgeCheck },
      { id: "market", label: "Skill 市场", icon: Globe },
      { id: "schedules", label: "定时任务", icon: CalendarClock },
      { id: "settings", label: "设置", icon: KeyRound },
      { id: "feedback", label: "反馈日志", icon: MessageSquareWarning }
    ]
  }
];

export const pageTitleMap: Record<AppPage, string> = {
  dashboard: "概览",
  tasks: "任务单",
  titles: "标题",
  images: "图片工作室",
  covers: "封面",
  scripts: "文案",
  lib_videos: "视频库",
  lib_tags: "标签库",
  lib_titles: "标题库",
  lib_scripts: "文案库",
  lib_prompts: "提示词库",
  lib_images: "图片库",
  skills: "Skill 中心",
  market: "Skill 市场",
  schedules: "定时任务",
  settings: "设置",
  feedback: "反馈日志"
};

export { Images, Settings, PanelLeft };
