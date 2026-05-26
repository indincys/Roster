import type { HTMLAttributes, ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

type StatusTone = "neutral" | "info" | "success" | "warning" | "danger";

const toneClasses: Record<StatusTone, string> = {
  neutral: "border-border bg-card text-foreground",
  info: "border-blue-200 bg-blue-50 text-blue-800",
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  danger: "border-red-200 bg-red-50 text-red-800"
};

export interface WorkbenchStatusItem {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: StatusTone;
  onClick?: () => void;
}

export interface WorkbenchHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  meta?: ReactNode;
  className?: string;
}

export function WorkbenchHeader({ actions, className, description, eyebrow, meta, title }: WorkbenchHeaderProps): JSX.Element {
  return (
    <div className={cn("flex items-start justify-between gap-4", className)} data-workbench-header>
      <div className="min-w-0">
        {eyebrow ? <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{eyebrow}</div> : null}
        <h1 className="truncate text-xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p> : null}
        {meta ? <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">{meta}</div> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function StatusStrip({ className, items }: { className?: string; items: WorkbenchStatusItem[] }): JSX.Element {
  return (
    <div className={cn("grid gap-2 md:grid-cols-2 xl:grid-cols-4", className)} data-workbench-status-strip>
      {items.map((item) => {
        const content = (
          <>
            <span className="text-[11px] font-medium text-current/70">{item.label}</span>
            <span className="mt-1 flex items-baseline gap-1 font-mono text-lg font-semibold tabular-nums">{item.value}</span>
            {item.hint ? <span className="mt-0.5 truncate text-[11px] text-current/65">{item.hint}</span> : null}
          </>
        );
        const classes = cn(
          "min-w-0 rounded-md border px-3 py-2 text-left shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
          toneClasses[item.tone ?? "neutral"],
          item.onClick && "transition hover:-translate-y-px hover:shadow-sm"
        );
        return item.onClick ? (
          <button key={item.label} type="button" className={classes} onClick={item.onClick}>
            {content}
          </button>
        ) : (
          <div key={item.label} className={classes}>
            {content}
          </div>
        );
      })}
    </div>
  );
}

export function InspectorPanel({
  actions,
  children,
  className,
  description,
  title,
  ...props
}: HTMLAttributes<HTMLElement> & { title: ReactNode; description?: ReactNode; actions?: ReactNode; children: ReactNode }): JSX.Element {
  return (
    <aside className={cn("min-h-0 overflow-hidden rounded-lg border border-border bg-card", className)} data-workbench-inspector {...props}>
      <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold">{title}</h2>
          {description ? <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </aside>
  );
}

export function StickyBatchBar({
  children,
  className,
  visible,
  ...props
}: {
  children: ReactNode;
  className?: string;
  visible: boolean;
} & HTMLAttributes<HTMLDivElement>): JSX.Element | null {
  if (!visible) {
    return null;
  }
  return (
    <div
      className={cn(
        "sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b border-border bg-card/95 px-4 py-2 shadow-sm",
        className
      )}
      data-workbench-batch-bar
      {...props}
    >
      {children}
    </div>
  );
}

export function MediaPreviewFrame({
  children,
  className,
  empty,
  ...props
}: HTMLAttributes<HTMLDivElement> & { children?: ReactNode; empty?: ReactNode }): JSX.Element {
  return (
    <div
      className={cn(
        "flex min-h-0 items-center justify-center overflow-hidden rounded-md border border-border bg-[hsl(var(--bg-soft))]",
        className
      )}
      {...props}
    >
      {children ?? (
        <div className="flex flex-col items-center gap-2 p-6 text-center text-sm text-muted-foreground">
          {empty}
          <ArrowRight className="size-4 opacity-40" />
        </div>
      )}
    </div>
  );
}
