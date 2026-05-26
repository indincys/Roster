import { useEffect, useMemo, useState } from "react";
import type { SkillMarketEntry, SkillMarketState } from "@roster/shared-types";
import { Download, RefreshCw, ShoppingBag, WifiOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatusStrip, WorkbenchHeader } from "@/components/workbench";

const typeLabels: Record<SkillMarketEntry["type"], string> = {
  title: "标题",
  image_prompt: "图片提示词",
  image: "图片",
  script: "文案",
  cover: "封面"
};

const statusLabels: Record<SkillMarketEntry["status"], string> = {
  not_installed: "未安装",
  installed: "已安装",
  update_available: "可升级"
};

export function SkillMarketPage(): JSX.Element {
  const [manifestUrl, setManifestUrl] = useState("");
  const [market, setMarket] = useState<SkillMarketState | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");

  const filteredSkills = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return market?.skills ?? [];
    }
    return (market?.skills ?? []).filter(
      (skill) =>
        skill.displayName.toLowerCase().includes(normalized) ||
        skill.name.toLowerCase().includes(normalized) ||
        skill.description.toLowerCase().includes(normalized)
    );
  }, [market?.skills, query]);

  async function loadMarket(forceRefresh = false): Promise<void> {
    setLoading(true);
    setMessage(null);
    try {
      const state = await window.roster.listSkillMarket({
        manifestUrl: manifestUrl.trim() || undefined,
        forceRefresh
      });
      setMarket(state);
      setManifestUrl((current) => current || state.manifestUrl);
      if (state.offline) {
        setMessage(state.error ? `暂时无法连接，使用缓存数据：${state.error}` : "暂时无法连接，使用缓存数据。");
      } else {
        setMessage(forceRefresh ? "已刷新 Skill 市场。" : null);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }

  async function installSkill(skill: SkillMarketEntry): Promise<void> {
    setLoading(true);
    setMessage(null);
    try {
      const result = await window.roster.installSkillFromMarket({
        name: skill.name,
        manifestUrl: manifestUrl.trim() || market?.manifestUrl
      });
      const refreshed = await window.roster.listSkillMarket({
        manifestUrl: manifestUrl.trim() || market?.manifestUrl,
        forceRefresh: true
      });
      setMarket(refreshed);
      setMessage(`${skill.status === "update_available" ? "已升级" : "已安装"} ${skill.displayName} v${result.version}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadMarket(false);
    // Initial load should use the cached/default market without depending on input changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 p-5" data-skill-market>
      <WorkbenchHeader
        eyebrow="官方 Skill"
        title="Skill 市场"
        description="从公开仓库安装官方 Skill。这里负责发现和安装，编辑与启用回到 Skill 中心。"
        actions={
          <>
          {market?.offline ? (
            <Badge variant="warning">
              <WifiOff className="size-3" />
              离线缓存
            </Badge>
          ) : (
            <Badge variant="success">在线</Badge>
          )}
          <Button variant="outline" onClick={() => void loadMarket(true)} disabled={loading} data-refresh-skill-market>
            <RefreshCw />
            刷新
          </Button>
          </>
        }
      />

      <StatusStrip
        items={[
          { label: "市场状态", value: market?.offline ? "离线" : "在线", hint: market?.manifestUrl ?? "默认 manifest", tone: market?.offline ? "warning" : "success" },
          { label: "可显示 Skill", value: filteredSkills.length, hint: `${market?.skills.length ?? 0} 个总数`, tone: "neutral" },
          { label: "待升级数", value: filteredSkills.filter((skill) => skill.status === "update_available").length, hint: "检测到新版后处理", tone: filteredSkills.some((skill) => skill.status === "update_available") ? "warning" : "neutral" },
          { label: "已安装", value: filteredSkills.filter((skill) => skill.status === "installed").length, hint: "本地可用", tone: "info" }
        ]}
      />

      {message ? <div className="rounded-md border border-border bg-card px-3 py-2 text-sm text-muted-foreground" data-skill-market-message>{message}</div> : null}

      <Card>
        <CardHeader>
          <CardTitle>公开 manifest</CardTitle>
          <ShoppingBag className="size-4 text-primary" />
        </CardHeader>
        <CardContent className="grid grid-cols-[1fr_240px] gap-3">
          <Input
            label="manifest URL"
            value={manifestUrl}
            onChange={(event) => setManifestUrl(event.target.value)}
            placeholder="https://raw.githubusercontent.com/owner/repo/main/manifest.json"
            data-skill-market-url
          />
          <Input label="搜索" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="标题 / 图片 / 文案" />
        </CardContent>
      </Card>

      <div className="grid min-h-0 flex-1 grid-cols-2 gap-3 overflow-auto">
        {filteredSkills.length === 0 ? (
          <div className="col-span-2 rounded-md border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
            暂无可显示的官方 Skill。刷新 manifest 或检查公开仓库地址。
          </div>
        ) : (
          filteredSkills.map((skill) => (
            <article key={skill.name} className="flex min-h-48 flex-col rounded-md border border-border bg-card" data-market-skill={skill.name}>
              <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{skill.displayName}</div>
                  <div className="mt-1 font-mono text-xs text-muted-foreground">{skill.name}</div>
                </div>
                <Badge variant={skill.status === "update_available" ? "warning" : skill.status === "installed" ? "success" : "neutral"}>
                  {statusLabels[skill.status]}
                </Badge>
              </div>
              <div className="flex flex-1 flex-col gap-3 px-4 py-3">
                <p className="min-h-16 text-sm leading-6 text-muted-foreground">{skill.description || "官方 Skill 包"}</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <Info label="类型" value={typeLabels[skill.type]} />
                  <Info label="仓库版本" value={skill.version} />
                  <Info label="本地版本" value={skill.installedVersion ?? "-"} />
                  <Info label="文件数" value={String(skill.files.length)} />
                </div>
                {skill.supportedModels.length ? (
                  <div className="flex flex-wrap gap-1">
                    {skill.supportedModels.slice(0, 4).map((model) => (
                      <Badge key={model} variant="neutral">
                        {model}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="flex justify-end border-t border-border px-4 py-3">
                <Button
                  variant={skill.status === "installed" ? "outline" : "primary"}
                  disabled={loading || skill.status === "installed"}
                  onClick={() => void installSkill(skill)}
                  data-install-market-skill={skill.name}
                >
                  <Download />
                  {skill.status === "update_available" ? "升级" : skill.status === "installed" ? "已安装" : "安装"}
                </Button>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="rounded-md border border-border bg-background p-2">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="mt-1 truncate font-mono text-xs">{value}</div>
    </div>
  );
}
