import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarClock, Check, RefreshCcw, Save, Sparkles, Square } from "lucide-react";
import type { SkillRecord, TitleWorkspaceColumnResult, TitleWorkspaceModel } from "@roster/shared-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { mergeConfiguredLlmModels } from "@/lib/provider-options";
import { cn } from "@/lib/utils";
import { activeWorkspace, useAppStore } from "@/stores/app-store";

interface ModelOption extends TitleWorkspaceModel {
  enabled: boolean;
}

const defaultModels: ModelOption[] = [
  { provider: "mock", model: "mock-title-fast", enabled: true },
  { provider: "mock", model: "mock-title-balanced", enabled: true },
  { provider: "mock", model: "mock-fail", enabled: false },
  { provider: "openai", model: "gpt-5.4-mini", enabled: false },
  { provider: "anthropic", model: "claude-sonnet-4-5", enabled: false },
  { provider: "google", model: "gemini-2.5-flash", enabled: false }
];

export function TitleWorkspacePage(): JSX.Element {
  const { bootstrap } = useAppStore();
  const workspace = activeWorkspace(bootstrap);
  const [skills, setSkills] = useState<SkillRecord[]>([]);
  const [selectedSkillId, setSelectedSkillId] = useState("");
  const [taskPrompt, setTaskPrompt] = useState("围绕新品卖点生成适合短视频发布的标题");
  const [count, setCount] = useState(12);
  const [models, setModels] = useState<ModelOption[]>(defaultModels);
  const [columns, setColumns] = useState<TitleWorkspaceColumnResult[]>([]);
  const [selectedTitles, setSelectedTitles] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeStreamId, setActiveStreamId] = useState<string | null>(null);
  const activeStreamIdRef = useRef<string | null>(null);

  const activeModels = useMemo(() => models.filter((model) => model.enabled), [models]);
  const allTitles = useMemo(
    () =>
      columns.flatMap((column) =>
        column.titles.map((title) => ({
          columnId: column.columnId,
          title
        }))
      ),
    [columns]
  );

  async function loadSkills(): Promise<void> {
    const enabled = await window.roster.listEnabledSkills("title");
    setSkills(enabled);
    if (enabled.length > 0) {
      setSelectedSkillId((current) => current || enabled[0].id);
    }
  }

  useEffect(() => {
    void loadSkills();
  }, [workspace?.id]);

  useEffect(() => {
    window.roster
      .getSettings()
      .then((loaded) => {
        setModels((current) => mergeConfiguredLlmModels(current, loaded) as ModelOption[]);
      })
      .catch(() => undefined);
  }, []);

  useEffect(
    () =>
      window.roster.onTitleWorkspaceStreamEvent((event) => {
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
                titles: [],
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
                      titles: `${column.text}${event.text}`
                        .split(/\r?\n/)
                        .map((line) => line.replace(/^\s*\d+[.)、-]?\s*/, "").trim())
                        .filter(Boolean)
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
            setMessage(event.canceled ? "已取消生成，保留已输出内容" : "生成完成，失败列可单独重试");
            setActiveStreamId(null);
            return;
        }
      }),
    []
  );

  async function generate(): Promise<void> {
    if (!selectedSkillId || activeModels.length === 0) {
      setMessage("请选择已启用的标题 Skill 和至少一个模型");
      return;
    }
    setLoading(true);
    setMessage("");
    setColumns([]);
    setSelectedTitles(new Set());
    try {
      const result = await window.roster.startTitleWorkspaceStream({
        skillId: selectedSkillId,
        taskPrompt,
        count,
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
    await window.roster.cancelTitleWorkspaceStream({ streamId: activeStreamId });
    setMessage("正在取消生成");
  }

  async function generateSingleColumn(model: Pick<TitleWorkspaceModel, "provider" | "model">, targetColumnId?: string): Promise<void> {
    if (!selectedSkillId) {
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      const result = await window.roster.generateTitleWorkspace({
        skillId: selectedSkillId,
        taskPrompt,
        count,
        models: [{ provider: model.provider, model: model.model }]
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

  async function retryColumn(column: TitleWorkspaceColumnResult): Promise<void> {
    setLoading(true);
    setMessage("");
    try {
      await generateSingleColumn({ provider: column.provider, model: column.model }, column.columnId);
    } finally {
      setLoading(false);
    }
  }

  async function saveSelected(): Promise<void> {
    if (!selectedSkillId || selectedTitles.size === 0) {
      setMessage("请先勾选要入库的标题");
      return;
    }
    const result = await window.roster.saveTitleWorkspaceSelection({
      skillId: selectedSkillId,
      titles: [...selectedTitles],
      score: null
    });
    setMessage(`已入库 ${result.savedCount} 条标题`);
  }

  async function createScheduleEntry(): Promise<void> {
    const saved = await window.roster.saveScheduledJob({
      name: "标题生成定时",
      type: "title_generation",
      status: "enabled",
      scheduleLabel: "每 60 秒",
      nextRunAt: new Date(Date.now() + 60_000).toISOString(),
      missedRunPolicy: "catch_up_last",
      targetPage: "titles"
    });
    setMessage(`已创建定时任务：${saved.name}`);
  }

  function toggleTitle(title: string): void {
    setSelectedTitles((current) => {
      const next = new Set(current);
      if (next.has(title)) {
        next.delete(title);
      } else {
        next.add(title);
      }
      return next;
    });
  }

  function toggleModel(modelName: string): void {
    setModels((current) =>
      current.map((model) => (model.model === modelName ? { ...model, enabled: !model.enabled } : model))
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 p-5" data-title-workspace>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">标题工作区</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            当前工作空间：{workspace?.name ?? "未选择"}，仅显示已启用的标题类 Skill。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={loadSkills}>
            刷新 Skill
          </Button>
          <Button variant="outline" onClick={createScheduleEntry} data-create-title-schedule>
            <CalendarClock />
            定时
          </Button>
          <Button variant="primary" onClick={generate} disabled={loading} data-generate-titles>
            <Sparkles />
            生成
          </Button>
          <Button variant="outline" onClick={cancelGeneration} disabled={!activeStreamId} data-cancel-title-generation>
            <Square />
            取消
          </Button>
        </div>
      </div>

      <section className="grid grid-cols-[280px_minmax(0,1fr)_220px] gap-4 rounded-lg border border-border bg-card p-4">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-foreground">标题 Skill</span>
          <select
            className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none"
            value={selectedSkillId}
            onChange={(event) => setSelectedSkillId(event.target.value)}
            data-title-skill-select
          >
            {skills.length === 0 ? <option value="">当前工作空间未启用标题 Skill</option> : null}
            {skills.map((skill) => (
              <option key={skill.id} value={skill.id}>
                {skill.displayName}
              </option>
            ))}
          </select>
        </label>
        <Input
          label="任务提示词"
          value={taskPrompt}
          onChange={(event) => setTaskPrompt(event.target.value)}
          data-title-task-prompt
        />
        <Input
          label="生成数量"
          type="number"
          min={1}
          max={100}
          value={count}
          onChange={(event) => setCount(Number(event.target.value))}
          data-title-count
        />
      </section>

      <section className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
        <div className="flex items-center gap-2">
          {models.map((model) => (
            <button
              key={model.model}
              className={cn(
                "rounded-md border px-3 py-1.5 text-xs",
                model.enabled ? "border-blue-200 bg-blue-50 text-blue-700" : "border-border text-muted-foreground"
              )}
              onClick={() => toggleModel(model.model)}
              type="button"
              data-title-model={`${model.provider}:${model.model}`}
            >
              {model.provider}/{model.model}
            </button>
          ))}
        </div>
        <Button variant="outline" onClick={saveSelected} data-save-selected-titles>
          <Save />
          入库选中 {selectedTitles.size}
        </Button>
      </section>

      <div className="grid min-h-0 flex-1 gap-4" style={{ gridTemplateColumns: `repeat(${Math.max(columns.length, 1)}, minmax(260px, 1fr))` }}>
        {columns.length === 0 ? (
          <div className="flex min-h-80 items-center justify-center rounded-lg border border-dashed border-border bg-card text-sm text-muted-foreground">
            选择 Skill 和模型后生成标题
          </div>
        ) : (
          columns.map((column) => (
            <section key={column.columnId} className="min-h-0 overflow-hidden rounded-lg border border-border bg-card" data-title-column={column.model}>
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <div>
                  <div className="text-sm font-semibold">{column.model}</div>
                  <Badge variant={column.status === "success" ? "success" : "danger"}>
                    {loading && activeStreamId && column.status === "success" && column.titles.length === 0 ? "生成中" : column.status === "success" ? "完成" : "失败"}
                  </Badge>
                </div>
                {column.status === "failed" ? (
                  <Button variant="outline" size="sm" onClick={() => retryColumn(column)} data-retry-title-column={column.model}>
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
                    {column.titles.length === 0 && column.text ? (
                      <div className="rounded-md border border-border bg-muted/40 p-3 text-sm leading-6 whitespace-pre-wrap" data-title-stream-preview={column.columnId}>
                        {column.text}
                      </div>
                    ) : null}
                    {column.titles.map((title) => {
                      const selected = selectedTitles.has(title);
                      return (
                        <button
                          key={`${column.columnId}-${title}`}
                          className={cn(
                            "flex items-start gap-2 rounded-md border p-3 text-left text-sm leading-6",
                            selected ? "border-emerald-200 bg-emerald-50" : "border-border hover:bg-muted/60"
                          )}
                          data-generated-title={title}
                          onClick={() => toggleTitle(title)}
                          type="button"
                        >
                          <span className={cn("mt-1 flex size-4 items-center justify-center rounded border", selected ? "border-emerald-500 bg-emerald-500 text-white" : "border-border")}>
                            {selected ? <Check className="size-3" /> : null}
                          </span>
                          <span>{title}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>
          ))
        )}
      </div>

      {message ? <div className="rounded-md border border-border bg-card px-4 py-3 text-sm" data-title-workspace-message>{message}</div> : null}
      <div className="hidden" data-generated-title-count={allTitles.length} />
    </div>
  );
}
