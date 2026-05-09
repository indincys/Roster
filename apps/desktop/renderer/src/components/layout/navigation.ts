import type { ComponentType, SVGProps } from "react";
import {
  Archive,
  BadgeCheck,
  CalendarClock,
  Clapperboard,
  Database,
  FileText,
  Home,
  Image,
  Images,
  KeyRound,
  LayoutList,
  MessageSquareWarning,
  PanelLeft,
  ScrollText,
  Settings,
  ShoppingBag,
  Sparkles,
  Tags,
  Type,
  WandSparkles
} from "lucide-react";
import type { AppPage } from "@/stores/app-store";

export interface NavigationItem {
  id: AppPage;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  badge?: string;
}

export interface NavigationGroup {
  id: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  items: NavigationItem[];
}

export const pinnedItems: NavigationItem[] = [
  { id: "dashboard", label: "首页", icon: Home },
  { id: "tasks", label: "任务单", icon: LayoutList, badge: "0" }
];

export const navigationGroups: NavigationGroup[] = [
  {
    id: "flow",
    label: "工作流",
    icon: Sparkles,
    items: [
      { id: "tasks", label: "任务单", icon: LayoutList },
      { id: "titles", label: "标题工作区", icon: Type },
      { id: "images", label: "图片工作室", icon: Images },
      { id: "covers", label: "封面工作区", icon: Clapperboard },
      { id: "scripts", label: "文案工作区", icon: ScrollText }
    ]
  },
  {
    id: "database",
    label: "数据库",
    icon: Database,
    items: [
      { id: "lib_videos", label: "视频库", icon: Clapperboard },
      { id: "lib_tags", label: "标签库", icon: Tags },
      { id: "lib_titles", label: "标题库", icon: Type },
      { id: "lib_scripts", label: "文案库", icon: FileText },
      { id: "lib_prompts", label: "提示词库", icon: WandSparkles },
      { id: "lib_images", label: "图片库", icon: Image }
    ]
  },
  {
    id: "system",
    label: "系统",
    icon: Settings,
    items: [
      { id: "skills", label: "Skill 中心", icon: BadgeCheck },
      { id: "market", label: "Skill 市场", icon: ShoppingBag },
      { id: "schedules", label: "定时任务总览", icon: CalendarClock },
      { id: "settings", label: "设置", icon: KeyRound },
      { id: "feedback", label: "反馈日志", icon: MessageSquareWarning }
    ]
  }
];

export const sidebarFooterItems: NavigationItem[] = [{ id: "settings", label: "工作空间维护", icon: Archive }];

export { PanelLeft };
