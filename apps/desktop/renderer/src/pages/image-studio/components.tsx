import { type ReactNode, useState } from "react";
import {
  Camera,
  Check,
  ChevronLeft,
  Columns2,
  Eye,
  FileText,
  Image as ImageIcon,
  Images,
  Layers,
  LayoutGrid,
  LayoutTemplate,
  Loader2,
  RotateCcw,
  Star,
  Wand2,
  X,
  Zap
} from "lucide-react";
import type { ImageLibraryItem } from "@roster/shared-types";
import type { ImageModelOption } from "@/lib/provider-options";
import { cn } from "@/lib/utils";
import {
  aspectClass,
  formatClock,
  imageCacheUrl,
  paletteFor,
  providerColor,
  providerShort,
  type ReviewVerdict,
  type StudioMode
} from "./studio-data";

export function imageOptionKey(option: Pick<ImageModelOption, "provider" | "model" | "apiKeyId">): string {
  return `${option.provider}:${option.model}:${option.apiKeyId ?? "default"}`;
}

export function imageOptionToTarget(
  option: ImageModelOption
): { provider: string; model: string; apiKeyId?: string | null } {
  return { provider: option.provider, model: option.model, apiKeyId: option.apiKeyId };
}

export function ModeIcon({ mode, size = 14 }: { mode: StudioMode; size?: number }): JSX.Element {
  if (mode === "batch") {
    return <Zap size={size} />;
  }
  if (mode === "quick") {
    return <Wand2 size={size} />;
  }
  if (mode === "i2i") {
    return <Images size={size} />;
  }
  return <LayoutTemplate size={size} />;
}

const SCENE_ICON_SET = [ImageIcon, Camera, Layers, FileText, LayoutGrid, Star];

export function SceneIcon({ index, size = 14 }: { index: number; size?: number }): JSX.Element {
  const Icon = SCENE_ICON_SET[index % SCENE_ICON_SET.length];
  return <Icon size={size} className="ico" />;
}

/* ---- gradient placeholder + real image renderer ---- */
export function Photo({
  image,
  paletteKey,
  className
}: {
  image: ImageLibraryItem | null;
  paletteKey: string;
  className?: string;
}): JSX.Element {
  const [failed, setFailed] = useState(false);
  const [a, b] = paletteFor(paletteKey);
  return (
    <div
      className={cn("img", className)}
      style={{ background: `linear-gradient(140deg, ${a} 0%, ${b} 100%)` }}
    >
      {image && !failed ? (
        <img src={imageCacheUrl(image.relativePath)} alt="" onError={() => setFailed(true)} />
      ) : null}
    </div>
  );
}

/* ---- image tile ---- */
interface TileProps {
  image: ImageLibraryItem | null;
  paletteKey: string;
  cornerLabel?: string;
  ratio?: string | null;
  verdict?: ReviewVerdict;
  selected?: boolean;
  isNew?: boolean;
  hasVariants?: boolean;
  reviewMode?: boolean;
  placeholder?: "queued" | "generating" | null;
  onSelectToggle?: () => void;
  onDetail?: () => void;
  onRegen?: () => void;
  onCompare?: () => void;
}

export function Tile({
  image,
  paletteKey,
  cornerLabel,
  ratio,
  verdict,
  selected,
  isNew,
  hasVariants,
  reviewMode,
  placeholder,
  onSelectToggle,
  onDetail,
  onRegen,
  onCompare
}: TileProps): JSX.Element {
  return (
    <div className={cn("tile", selected && "selected")}>
      <div
        className={cn("ar", aspectClass(ratio))}
        onClick={reviewMode && onSelectToggle ? onSelectToggle : undefined}
        style={reviewMode ? { cursor: "pointer" } : undefined}
      >
        {placeholder ? (
          <div className="img" style={{ background: "var(--bg-2)", color: "var(--ink-3)" }}>
            {placeholder === "generating" ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                <Loader2 size={18} className="animate-spin" />
                <span className="mono" style={{ fontSize: 11 }}>
                  生成中…
                </span>
              </div>
            ) : (
              <span className="mono" style={{ fontSize: 11 }}>
                排队中
              </span>
            )}
          </div>
        ) : (
          <Photo image={image} paletteKey={paletteKey} />
        )}

        {cornerLabel ? <div className="corner">{cornerLabel}</div> : null}
        {isNew ? (
          <div className="badge-tl">
            <span className="status new">新</span>
          </div>
        ) : null}
        {reviewMode ? (
          <div className="badge-tl" style={isNew ? { top: 30 } : undefined}>
            <button
              type="button"
              className={cn("checkbox", selected && "checked")}
              onClick={(event) => {
                event.stopPropagation();
                onSelectToggle?.();
              }}
            />
          </div>
        ) : null}

        {(onDetail || onRegen || onCompare) && !placeholder ? (
          <div className="hover-actions">
            {onDetail ? (
              <button
                type="button"
                className="ha-btn"
                onClick={(event) => {
                  event.stopPropagation();
                  onDetail();
                }}
              >
                <Eye size={12} /> 详情
              </button>
            ) : null}
            {onRegen ? (
              <button
                type="button"
                className="ha-btn"
                onClick={(event) => {
                  event.stopPropagation();
                  onRegen();
                }}
              >
                <RotateCcw size={12} /> 重生
              </button>
            ) : null}
            {onCompare && hasVariants ? (
              <button
                type="button"
                className="ha-btn"
                onClick={(event) => {
                  event.stopPropagation();
                  onCompare();
                }}
              >
                <Columns2 size={12} /> 对比
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="meta">
        <div className="row1">
          <span className="mono">
            {(ratio ?? "—") + " · " + formatClock(image?.generatedAt ?? image?.createdAt ?? null)}
          </span>
          {verdict === "pending" ? <span className="status pending">待审</span> : null}
          {verdict === "approved" ? <span className="status approved">通过</span> : null}
          {verdict === "rejected" ? <span className="status rejected">拒绝</span> : null}
        </div>
      </div>
    </div>
  );
}

/* ---- provider multi-select ---- */
export function ProviderGrid({
  options,
  selectedKeys,
  onToggle,
  strategy,
  onStrategy
}: {
  options: ImageModelOption[];
  selectedKeys: Set<string>;
  onToggle: (option: ImageModelOption) => void;
  strategy: "load_balance" | "all_providers";
  onStrategy: (value: "load_balance" | "all_providers") => void;
}): JSX.Element {
  return (
    <div style={{ padding: "14px 22px 18px", borderTop: "1px solid var(--line-faint)" }}>
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 10 }}>
        <div className="label">
          图片 Provider / 模型
          <span style={{ color: "var(--ink-4)", fontWeight: 500, textTransform: "none", letterSpacing: 0 }}>
            · 已选 {selectedKeys.size}
          </span>
        </div>
        <span className="small mute">多选时按右侧策略分发到各 Provider</span>
      </div>
      {options.length === 0 ? (
        <div className="info-box">
          尚未配置图片 Provider。请到「设置」保存图片生成 API Key，或启用 Mock 图片 Provider 后再回来。
        </div>
      ) : (
        <div className="provider-grid">
          {options.map((option) => {
            const key = imageOptionKey(option);
            const on = selectedKeys.has(key);
            return (
              <button
                key={key}
                type="button"
                className={cn("provider-card", on && "active")}
                onClick={() => onToggle(option)}
                data-image-model-option={key}
              >
                <div className={cn("checkbox", on && "checked")} />
                <div className="provider-logo" style={{ background: providerColor(option.provider) }}>
                  {providerShort(option.provider)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600 }} className="truncate">
                    {option.keyLabel ?? option.provider}
                  </div>
                  <div className="mono small mute truncate" style={{ fontSize: 10.5 }}>
                    {option.model}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
      {options.length > 0 ? (
        <div className="row" style={{ marginTop: 12, gap: 12, fontSize: 11.5, color: "var(--ink-3)" }}>
          <span>调度策略</span>
          <div className="btn-group">
            <button
              type="button"
              className={cn(strategy === "load_balance" && "active")}
              onClick={() => onStrategy("load_balance")}
            >
              负载均衡
            </button>
            <button
              type="button"
              className={cn(strategy === "all_providers" && "active")}
              onClick={() => onStrategy("all_providers")}
            >
              全部并发
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ---- pipeline progress ---- */
export function PipelineBar({
  stages,
  current,
  onJump
}: {
  stages: string[];
  current: number;
  onJump: (index: number) => void;
}): JSX.Element {
  return (
    <div className="pipeline">
      <div className="pipe-steps">
        {stages.map((stage, index) => {
          const state = index < current ? "done" : index === current ? "current" : "";
          return (
            <div key={stage} style={{ display: "contents" }}>
              <button
                type="button"
                className={cn("pipe-step", state, index > current && "disabled")}
                onClick={() => index < current && onJump(index)}
              >
                <div className="pipe-num">{index < current ? <Check size={12} /> : index + 1}</div>
                <div className="pipe-label">{stage}</div>
              </button>
              {index < stages.length - 1 ? (
                <div
                  className={cn(
                    "pipe-conn",
                    index < current - 1 && "done",
                    index === current - 1 && "active"
                  )}
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---- drawer shell ---- */
export function Drawer({
  title,
  sub,
  wide,
  onClose,
  children,
  footer
}: {
  title: string;
  sub?: string;
  wide?: boolean;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}): JSX.Element {
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className={cn("drawer", wide && "wide")} role="dialog">
        <div className="drawer-head">
          <div>
            <h3>{title}</h3>
            {sub ? <div className="sub">{sub}</div> : null}
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="关闭">
            <X size={16} />
          </button>
        </div>
        <div className="drawer-body">{children}</div>
        {footer ? <div className="drawer-foot">{footer}</div> : null}
      </aside>
    </>
  );
}

/* ---- small toggle ---- */
export function Toggle({ on, onChange }: { on: boolean; onChange: (value: boolean) => void }): JSX.Element {
  return <button type="button" className={cn("toggle-sw", on && "on")} onClick={() => onChange(!on)} />;
}

/* ---- stage back button ---- */
export function BackButton({ onClick, label = "返回上一步" }: { onClick: () => void; label?: string }): JSX.Element {
  return (
    <button type="button" className="btn ghost" onClick={onClick}>
      <ChevronLeft size={13} />
      {label}
    </button>
  );
}
