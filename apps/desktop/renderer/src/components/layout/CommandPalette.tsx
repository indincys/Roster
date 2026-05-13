import { useEffect, useMemo, useRef, useState } from "react";
import type { ComponentType, SVGProps } from "react";
import { LayoutDashboard, LayoutList, Plus, Search, Type, Video, WandSparkles, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AppPage } from "@/stores/app-store";

type IconComp = ComponentType<SVGProps<SVGSVGElement>>;

interface CommandItem {
  kind: "导航" | "动作" | "工作区";
  label: string;
  to: AppPage;
  icon: IconComp;
}

const ITEMS: CommandItem[] = [
  { kind: "导航", label: "概览", to: "dashboard", icon: LayoutDashboard },
  { kind: "导航", label: "任务单", to: "tasks", icon: LayoutList },
  { kind: "导航", label: "标题工作区", to: "titles", icon: Type },
  { kind: "导航", label: "图片工作室", to: "images", icon: WandSparkles },
  { kind: "导航", label: "封面工作区", to: "covers", icon: Type },
  { kind: "导航", label: "视频库", to: "lib_videos", icon: Video },
  { kind: "导航", label: "Skill 中心", to: "skills", icon: WandSparkles },
  { kind: "动作", label: "新建任务单", to: "tasks", icon: Plus },
  { kind: "动作", label: "生成 20 条标题", to: "titles", icon: Zap },
  { kind: "动作", label: "为所有视频补封面", to: "covers", icon: Zap }
];

interface CommandPaletteProps {
  open: boolean;
  onClose(): void;
  onNavigate(page: AppPage): void;
}

export function CommandPalette({ open, onClose, onNavigate }: CommandPaletteProps): JSX.Element | null {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      const handle = window.setTimeout(() => inputRef.current?.focus(), 30);
      return () => window.clearTimeout(handle);
    }
    return undefined;
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return ITEMS;
    }
    return ITEMS.filter((item) => item.label.toLowerCase().includes(q) || item.kind.toLowerCase().includes(q));
  }, [query]);

  useEffect(() => {
    setActive(0);
  }, [filtered]);

  if (!open) {
    return null;
  }

  const commit = (index: number): void => {
    const item = filtered[index];
    if (!item) {
      return;
    }
    onNavigate(item.to);
    onClose();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === "Escape") {
      onClose();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((prev) => Math.min(filtered.length - 1, prev + 1));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((prev) => Math.max(0, prev - 1));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      commit(active);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-black/30 pt-24 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[64vh] w-[560px] max-w-[92vw] flex-col overflow-hidden rounded-[10px] border border-border bg-card shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
          <Search className="size-3.5 text-muted-foreground" />
          <input
            ref={inputRef}
            className="h-7 flex-1 border-0 bg-transparent text-[14px] text-foreground outline-none placeholder:text-muted-foreground"
            placeholder="跳转、搜索、运行 Skill..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleKeyDown}
          />
          <span className="kbd">esc</span>
        </div>

        <div className="flex-1 overflow-y-auto p-1.5">
          {filtered.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-muted-foreground">没有匹配项</div>
          ) : (
            filtered.map((item, index) => {
              const Icon = item.icon;
              const isActive = index === active;
              return (
                <button
                  key={`${item.kind}-${item.label}`}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-[13px] text-foreground/80",
                    isActive ? "bg-primary/10 text-[hsl(var(--primary-strong))]" : "hover:bg-muted/60"
                  )}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => commit(index)}
                >
                  <Icon className="size-3.5" />
                  <span className="flex-1 truncate">{item.label}</span>
                  <span className="text-[11px] text-muted-foreground">{item.kind}</span>
                </button>
              );
            })
          )}
        </div>

        <div className="flex gap-3.5 border-t border-border px-4 py-2.5 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="kbd">↑</span>
            <span className="kbd">↓</span> 选择
          </span>
          <span className="flex items-center gap-1">
            <span className="kbd">↵</span> 进入
          </span>
          <span className="flex items-center gap-1">
            <span className="kbd">⌘</span>
            <span className="kbd">K</span> 唤起
          </span>
        </div>
      </div>
    </div>
  );
}
