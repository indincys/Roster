import type { ImageWorkspaceMode } from "@roster/shared-types";

export type StudioMode = ImageWorkspaceMode;
export type DataSource = "text" | "folder";
export type ReviewVerdict = "pending" | "approved" | "rejected";

export interface ModeDef {
  id: StudioMode;
  name: string;
  desc: string;
}

export const STUDIO_MODES: ModeDef[] = [
  {
    id: "batch",
    name: "批量生产",
    desc: "种子描述 → AI 生成多条提示词 → 批量出图 → 验收溯源。一次产出整组运营素材的首选。"
  },
  {
    id: "quick",
    name: "快速单图",
    desc: "手写提示词，直出 1–4 张。无需 AI 提示词生成、流程最短，适合临场补图。"
  },
  {
    id: "i2i",
    name: "图生图",
    desc: "上传参考图，可选辅助生成提示词，再出图。用于风格迁移、场景换装。"
  },
  {
    id: "template",
    name: "模板套图",
    desc: "选模板 + 上传素材，渲染合成。SKU、详情页等结构化素材必选。"
  }
];

export function stagesFor(mode: StudioMode, dataSource: DataSource): string[] {
  if (mode === "batch") {
    return dataSource === "folder"
      ? ["SKU 装载", "图片生成", "验收溯源"]
      : ["种子描述", "提示词确认", "图片生成", "验收溯源"];
  }
  if (mode === "quick") {
    return ["提示词", "出图", "验收"];
  }
  if (mode === "i2i") {
    return ["上传参考", "辅助提示词", "出图", "验收溯源"];
  }
  return ["选模板 / 素材", "渲染合成", "验收溯源"];
}

/* ---- placeholder gradient art ---- */
export const PALETTES: Array<[string, string]> = [
  ["#339CFF", "#155A92"],
  ["#7DA7C7", "#35566F"],
  ["#8DB7A6", "#335B50"],
  ["#A7B3C2", "#4D5B6B"],
  ["#6C7A89", "#2F3945"],
  ["#B7C5D6", "#5B6E82"],
  ["#6BA9D8", "#24658F"],
  ["#9CB8A5", "#426551"],
  ["#B9C8CC", "#5B7176"],
  ["#7F8BA3", "#363F52"],
  ["#C3B9A7", "#655D50"],
  ["#98A5C4", "#49546E"]
];

export function paletteFor(key: string): [string, string] {
  let hash = 0;
  for (let index = 0; index < key.length; index += 1) {
    hash = (hash * 31 + key.charCodeAt(index)) >>> 0;
  }
  return PALETTES[hash % PALETTES.length];
}

/* ---- SKU folder sample (batch · folder data source stub) ---- */
export interface SkuFolder {
  id: string;
  code: string;
  name: string;
  refCount: number;
  selected: boolean;
}

export const SAMPLE_SKU_FOLDERS: SkuFolder[] = [
  { id: "sku-WP-201", code: "WP-201", name: "黑曜灰 · 双层款 500ml", refCount: 3, selected: true },
  { id: "sku-WP-202", code: "WP-202", name: "樱花粉 · 双层款 380ml", refCount: 2, selected: true },
  { id: "sku-WP-203", code: "WP-203", name: "墨绿 · 森林系列 500ml", refCount: 3, selected: true },
  { id: "sku-WP-204", code: "WP-204", name: "暖橙 · 暮色系列 380ml", refCount: 2, selected: true },
  { id: "sku-WP-205", code: "WP-205", name: "雾蓝 · 极地系列 500ml", refCount: 3, selected: false }
];

/* ---- template sample (template mode stub) ---- */
export interface TemplateDef {
  id: string;
  name: string;
  desc: string;
  slots: number;
}

export const SAMPLE_TEMPLATES: TemplateDef[] = [
  { id: "tpl-cover-a", name: "横向叙事封面 A", desc: "左图右文，标题 + 副标 + 价签", slots: 3 },
  { id: "tpl-sku-3x3", name: "SKU 九宫格", desc: "九张 SKU 主图自动排版", slots: 9 },
  { id: "tpl-detail-story", name: "详情页故事板", desc: "上中下三段式 · 高 1600", slots: 6 },
  { id: "tpl-promo-burst", name: "促销视觉爆款", desc: "主图 + 大字标 + 倒计时位", slots: 2 }
];

export const SCENE_KEYWORD_FALLBACK = ["冬季", "生活方式", "高级感"];

/* ---- seed examples ---- */
export const QUICK_RECENT_PROMPTS = [
  "保温杯特写，杯身倒入热水的瞬间，蒸汽腾起被侧逆光勾出金边",
  "一双戴着米色羊毛手套的手稳稳握住保温杯，背景雾蓝色雪山",
  "俯拍角度，保温杯 + 干花 + 枫叶在白色亚麻布上的小红书冬日笔记封面"
];

/* ---- workspace-image protocol url ---- */
export function imageCacheUrl(relativePath: string): string {
  const clean = relativePath
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `roster-cache://workspace-image/${clean}`;
}

export function aspectClass(ratio: string | null | undefined): string {
  if (ratio === "1:1") {
    return "sq";
  }
  if (ratio === "16:9") {
    return "wide";
  }
  if (ratio === "9:16") {
    return "tall";
  }
  return "";
}

export function formatClock(iso: string | null | undefined): string {
  if (!iso) {
    return "--:--:--";
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "--:--:--";
  }
  return [date.getHours(), date.getMinutes(), date.getSeconds()]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}

export function providerShort(provider: string): string {
  const cleaned = provider.replace(/[^A-Za-z一-龥]/g, "");
  if (/[一-龥]/.test(cleaned)) {
    return cleaned.slice(0, 2);
  }
  return cleaned.slice(0, 2).toUpperCase() || "PV";
}

export function providerColor(provider: string): string {
  return paletteFor(`provider-${provider}`)[1];
}

/* ---- review verdict persistence ---- */
const APPROVED_STORAGE_KEY = "roster:image-studio:approved:v1";

export function readApprovedIds(): Set<string> {
  try {
    const raw = window.localStorage.getItem(APPROVED_STORAGE_KEY);
    if (!raw) {
      return new Set();
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return new Set();
    }
    return new Set(parsed.filter((item): item is string => typeof item === "string"));
  } catch {
    return new Set();
  }
}

export function writeApprovedIds(ids: Set<string>): void {
  try {
    window.localStorage.setItem(APPROVED_STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    /* ignore quota / serialization errors */
  }
}
