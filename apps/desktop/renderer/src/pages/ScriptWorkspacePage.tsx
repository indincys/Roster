import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarClock, Check, Clipboard, RefreshCcw, Save, ScrollText, Sparkles, Square } from "lucide-react";
import type { ScriptWorkspaceColumnResult, ScriptWorkspaceModel, SkillRecord } from "@roster/shared-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { configuredLlmModelsFromApiKeys } from "@/lib/provider-options";
import { cn } from "@/lib/utils";
import { activeWorkspace, useAppStore } from "@/stores/app-store";

interface ModelOption extends ScriptWorkspaceModel {
  enabled: boolean;
}

const defaultModels: ModelOption[] = [
];

export function ScriptWorkspacePage(): JSX.Element {
  const { bootstrap } = useAppStore();
  const workspace = activeWorkspace(bootstrap);
  const [skills, setSkills] = useState<SkillRecord[]>([]);
  const [selectedSkillId, setSelectedSkillId] = useState("");
  const [taskPrompt, setTaskPrompt] = useState("生成一条适合短视频口播的 30 秒带货文案，开头要直接给场景。");
  const [skuCode, setSkuCode] = useState("");
  const [models, setModels] = useState<ModelOption[]>(defaultModels);
  const [columns, setColumns] = useState<ScriptWorkspaceColumnResult[]>([]);
  const [selectedScripts, setSelectedScripts] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeStreamId, setActiveStreamId] = useState<string | null>(null);
  const activeStreamIdRef = useRef<string | null>(null);

  const activeModels = useMemo(() => models.filter((model) => model.enabled), [models]);
  const allScripts = useMemo(
    () =>
      columns.flatMap((column) =>
        column.scripts.map((script) => ({
          columnId: column.columnId,
          script
        }))
      ),
    [columns]
  );

  async function loadSkills(): Promise<void> {
    const enabled = await window.roster.listEnabledSkills("script");
    setSkills(enabled);
    if (enabled.length > 0) {
      setSelectedSkillId((current) => current || enabled[0].id);
    }
  }

  useEffect(() => {
    void loadSkills();
  }, [workspace?.id]);

  useEffect(() => {
    Promise.all([window.roster.getSettings(), window.roster.listApiKeys()])
      .then(([loaded, apiKeys]) => {
        setModels(configuredLlmModelsFromApiKeys(loaded, apiKeys, { enableFirst: true }) as ModelOption[]);
      })
      .catch(() => undefined);
  }, []);

  useEffect(
    () =>
      window.roster.onScriptWorkspaceStreamEvent((event) => {
        if (activeStreamIdRef.current && activeStreamIdRef.current !== event.streamId) {
          return;
        }
        if (!activeStreamIdRef.current && event.type !== "started") {
          return;
        }
        if (event.type === "started") {
            activeStreamIdRef.current = event.streamId;
            setActiveStreamId(event.streamId);
            setColumns(
              event.columns.map((column) => ({
                ...column,
                status: "success",
                text: "",
                scripts: [],
                error: null,
                usage: null
              }))
            );
        }
        if (event.type === "chunk") {
            setColumns((current) =>
              current.map((column) =>
                column.columnId === event.columnId
                  ? {
                      ...column,
                      text: `${column.text}${event.text}`,
                      scripts: [`${column.text}${event.text}`]
                    }
                  : column
              )
            );
        }
        if (event.type === "columnComplete") {
            setColumns((current) => current.map((column) => (column.columnId === event.column.columnId ? event.column : column)));
        }
        if (event.type === "done") {
            activeStreamIdRef.current = null;
            setLoading(false);
            setMessage(event.canceled ? "已取消生成，保留已输出内容" : "生成完成，可复制或入库选中文案");
            setActiveStreamId(null);
            return;
        }
      }),
    []
  );

  async function generate(): Promise<void> {
    if (!selectedSkillId || activeModels.length === 0) {
      setMessage("请选择已启用的文案 Skill 和至少一个模型");
      return;
    }
    setLoading(true);
    setMessage("");
    setColumns([]);
    setSelectedScripts(new Set());
    try {
      const result = await window.roster.startScriptWorkspaceStream({
        skillId: selectedSkillId,
        taskPrompt,
        skuCode: skuCode.trim() || null,
        models: activeModels.map(({ provider, model }) => ({ provider, model }))
      });
      activeStreamIdRef.current = result.streamId;
      setActiveStreamId(result.streamId);
      setMessage("正在流式生成");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
      setLoading(false);
    }
  }

  async function cancelGeneration(): Promise<void> {
    if (!activeStreamId) {
      return;
    }
    await window.roster.cancelScriptWorkspaceStream({ streamId: activeStreamId });
    setMessage("正在取消生成");
  }

  async function generateSingleColumn(column: Pick<ScriptWorkspaceModel, "provider" | "model">, targetColumnId?: string): Promise<void> {
    if (!selectedSkillId) {
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      const result = await window.roster.generateScriptWorkspace({
        skillId: selectedSkillId,
        taskPrompt,
        skuCode: skuCode.trim() || null,
        models: [{ provider: column.provider, model: column.model }]
      });
      setColumns((current) =>
        targetColumnId
          ? current.map((candidate) => (candidate.columnId === targetColumnId ? result.columns[0] : candidate))
          : [...current, ...result.columns]
      );
    } finally {
      setLoading(false);
    }
  }

  async function retryColumn(column: ScriptWorkspaceColumnResult): Promise<void> {
    setLoading(true);
    setMessage("");
    try {
      await generateSingleColumn({ provider: column.provider, model: column.model }, column.columnId);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }

  async function saveSelected(): Promise<void> {
    if (!selectedSkillId || selectedScripts.size === 0) {
      setMessage("请先勾选要入库的文案");
      return;
    }
    const result = await window.roster.saveScriptWorkspaceSelection({
      skillId: selectedSkillId,
      skuCode: skuCode.trim() || null,
      scripts: [...selectedScripts]
    });
    setMessage(`已入库 ${result.savedCount} 条文案`);
  }

  async function copyScript(script: string): Promise<void> {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(script);
      } else {
        throw new Error("Clipboard API unavailable");
      }
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = script;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.append(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
    }
    setMessage("已复制文案");
  }

  async function createScheduleEntry(): Promise<void> {
    const saved = await window.roster.saveScheduledJob({
      name: "文案生成定时",
      type: "script_generation",
      status: "enabled",
      scheduleLabel: "每 60 秒",
      nextRunAt: new Date(Date.now() + 60_000).toISOString(),
      missedRunPolicy: "catch_up_last",
      targetPage: "scripts"
    });
    setMessage(`已创建定时任务：${saved.name}`);
  }

  function toggleScript(script: string): void {
    setSelectedScripts((current) => {
      const next = new Set(current);
      if (next.has(script)) {
        next.delete(script);
      } else {
        next.add(script);
      }
      return next;
    });
  }

  function toggleModel(modelName: string): void {
    setModels((current) =>
      current.map((model) => (`${model.provider}:${model.model}` === modelName ? { ...model, enabled: !model.enabled } : model))
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 p-5" data-script-workspace>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">文案工作区</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            当前工作空间：{workspace?.name ?? "未选择"}，v1 不与任务单强制关联，仅显示已启用的视频文案类 Skill。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={loadSkills}>
            刷新 Skill
          </Button>
          <Button variant="outline" onClick={createScheduleEntry} data-create-script-schedule>
            <CalendarClock />
            定时
          </Button>
          <Button variant="primary" onClick={generate} disabled={loading} data-generate-scripts>
            <Sparkles />
            生成
          </Button>
          <Button variant="outline" onClick={cancelGeneration} disabled={!activeStreamId} data-cancel-script-generation>
            <Square />
            取消
          </Button>
        </div>
      </div>

      <section className="grid grid-cols-[280px_180px_minmax(0,1fr)] gap-4 rounded-lg border border-border bg-card p-4">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-foreground">文案 Skill</span>
          <select
            className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none"
            value={selectedSkillId}
            onChange={(event) => setSelectedSkillId(event.target.value)}
            data-script-skill-select
          >
            {skills.length === 0 ? <option value="">当前工作空间未启用文案 Skill</option> : null}
            {skills.map((skill) => (
              <option key={skill.id} value={skill.id}>
                {skill.displayName}
              </option>
            ))}
          </select>
        </label>
        <Input
          label="关联 SKU（可选）"
          value={skuCode}
          onChange={(event) => setSkuCode(event.target.value)}
          data-script-sku-input
        />
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-foreground">任务提示词</span>
          <textarea
            className="min-h-20 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/15"
            value={taskPrompt}
            onChange={(event) => setTaskPrompt(event.target.value)}
            data-script-task-prompt
          />
        </label>
      </section>

      <section className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          {models.map((model) => (
            <button
              key={`${model.provider}:${model.model}`}
              className={cn(
                "max-w-64 rounded-md border px-3 py-1.5 text-xs",
                model.enabled ? "border-blue-200 bg-blue-50 text-blue-700" : "border-border text-muted-foreground"
              )}
              onClick={() => toggleModel(`${model.provider}:${model.model}`)}
              type="button"
              title={`${model.provider}/${model.model}`}
              data-script-model={`${model.provider}:${model.model}`}
            >
              <span className="block truncate">{model.provider}/{model.model}</span>
            </button>
          ))}
          {models.length === 0 ? (
            <span className="text-sm text-muted-foreground">请先到设置页保存可用的文本模型 API key。</span>
          ) : null}
        </div>
        <Button variant="outline" onClick={saveSelected} data-save-selected-scripts>
          <Save />
          入库选中 {selectedScripts.size}
        </Button>
      </section>

      <div
        className="grid min-h-0 flex-1 gap-4"
        style={{ gridTemplateColumns: `repeat(${Math.max(columns.length, 1)}, minmax(280px, 1fr))` }}
      >
        {columns.length === 0 ? (
          <div className="flex min-h-80 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-card text-sm text-muted-foreground">
            <ScrollText className="size-8" />
            选择 Skill 和模型后生成口播脚本或剪映文字转语音文案
          </div>
        ) : (
          columns.map((column) => (
            <section
              key={column.columnId}
              className="min-h-0 overflow-hidden rounded-lg border border-border bg-card"
              data-script-column={column.model}
            >
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <div>
                  <div className="text-sm font-semibold">{column.model}</div>
                  <Badge variant={column.status === "success" ? "success" : "danger"}>
                    {loading && activeStreamId && column.status === "success" && column.text ? "生成中" : column.status === "success" ? "完成" : "失败"}
                  </Badge>
                </div>
                {column.status === "failed" ? (
                  <Button variant="outline" size="sm" onClick={() => retryColumn(column)} data-retry-script-column={column.model}>
                    <RefreshCcw />
                    重试
                  </Button>
                ) : null}
              </div>
              <div className="h-full min-h-0 overflow-y-auto p-3">
                {column.status === "failed" ? (
                  <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{column.error}</div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {column.scripts.map((script) => {
                      const selected = selectedScripts.has(script);
                      return (
                        <div
                          key={`${column.columnId}-${script}`}
                          className={cn(
                            "rounded-md border p-3 text-sm leading-6",
                            selected ? "border-emerald-200 bg-emerald-50" : "border-border"
                          )}
                          data-generated-script={script}
                        >
                          <button
                            className="flex w-full items-start gap-2 text-left"
                            onClick={() => toggleScript(script)}
                            type="button"
                          >
                            <span
                              className={cn(
                                "mt-1 flex size-4 shrink-0 items-center justify-center rounded border",
                                selected ? "border-emerald-500 bg-emerald-500 text-white" : "border-border"
                              )}
                            >
                              {selected ? <Check className="size-3" /> : null}
                            </span>
                            <span className="whitespace-pre-wrap">{script}</span>
                          </button>
                          <div className="mt-3 flex justify-end">
                            <Button variant="outline" size="sm" onClick={() => copyScript(script)} data-copy-generated-script>
                              <Clipboard />
                              复制
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>
          ))
        )}
      </div>

      {message ? (
        <div className="rounded-md border border-border bg-card px-4 py-3 text-sm" data-script-workspace-message>
          {message}
        </div>
      ) : null}
      <div className="hidden" data-generated-script-count={allScripts.length} />
    </div>
  );
}
