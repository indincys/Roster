import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { CalendarClock, CalendarDays, Clock3, Database, LayoutList, Plus, RefreshCw, Send, Settings2, Tags, Type, Users } from "lucide-react";
import type {
  PlatformAccountRecord,
  TaskRowRecord,
  TaskRowStatus,
  TaskExportResult,
  TaskSheetRecord,
  TaskTitleStrategy,
  TaskVideoStrategy
} from "@roster/shared-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { activeWorkspace, useAppStore } from "@/stores/app-store";

const videoStrategyOptions: Array<{ value: TaskVideoStrategy; label: string }> = [
  { value: "low_publish", label: "低发倾向" },
  { value: "popular_sku", label: "热门 SKU 倾向" },
  { value: "recent_hot", label: "近期热点" },
  { value: "custom", label: "自定义" }
];

const titleStrategyOptions: Array<{ value: TaskTitleStrategy; label: string }> = [
  { value: "best_score", label: "爆款倾向" },
  { value: "new_test", label: "新标题测试" },
  { value: "random", label: "随机自定义" }
];

const taskStatusLabel: Record<TaskRowStatus, string> = {
  pending: "待执行",
  running: "执行中",
  success: "成功",
  failed: "失败",
  skipped: "跳过"
};

const taskStatusVariant: Record<TaskRowStatus, "neutral" | "success" | "warning" | "danger" | "info"> = {
  pending: "neutral",
  running: "info",
  success: "success",
  failed: "danger",
  skipped: "warning"
};

const selectClass =
  "h-9 rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/15";
const emptyTaskRows: TaskRowRecord[] = [];

function todayLocalDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseTimeAnchors(value: string): string[] {
  return value
    .split(/[,\s，、]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatPublishTime(value: string): string {
  return value.slice(11, 16) || value;
}

function shortTaskId(value: string): string {
  return `T-${value.slice(0, 8)}`;
}

export function TasksPage(): JSX.Element {
  const { bootstrap, setPage } = useAppStore();
  const workspace = activeWorkspace(bootstrap);
  const workspaceId = workspace?.id;
  const [sheetDate, setSheetDate] = useState(todayLocalDate);
  const [accounts, setAccounts] = useState<PlatformAccountRecord[]>([]);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [sheet, setSheet] = useState<TaskSheetRecord | null>(null);
  const [videoCount, setVideoCount] = useState(5);
  const [videoStrategy, setVideoStrategy] = useState<TaskVideoStrategy>("low_publish");
  const [titleStrategy, setTitleStrategy] = useState<TaskTitleStrategy>("best_score");
  const [defaultTagRatio, setDefaultTagRatio] = useState(80);
  const [timeAnchorsText, setTimeAnchorsText] = useState("09:00 12:00 15:00 18:00 21:00");
  const [jitterMinutes, setJitterMinutes] = useState(15);
  const [newAccountPlatform, setNewAccountPlatform] = useState("抖音");
  const [newAccountName, setNewAccountName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportResult, setExportResult] = useState<TaskExportResult | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [highlightedTaskIds, setHighlightedTaskIds] = useState<Set<string>>(() => new Set());
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(() => new Set());
  const [editPublishTime, setEditPublishTime] = useState("");
  const [editTitleText, setEditTitleText] = useState("");
  const [editTagsText, setEditTagsText] = useState("");
  const parentRef = useRef<HTMLDivElement>(null);

  const todayDate = useMemo(() => todayLocalDate(), []);
  const enabledAccounts = useMemo(() => accounts.filter((account) => account.enabled), [accounts]);
  const selectedAccounts = useMemo(
    () => enabledAccounts.filter((account) => selectedAccountIds.includes(account.id)),
    [enabledAccounts, selectedAccountIds]
  );
  const taskRows = sheet?.rows ?? emptyTaskRows;
  const estimatedRows = videoCount * selectedAccountIds.length;
  const isHistoricalDate = sheetDate < todayDate;
  const selectedTaskCount = selectedTaskIds.size;

  const rowVirtualizer = useVirtualizer({
    count: taskRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 36,
    initialRect: { width: 960, height: 420 },
    overscan: 16
  });

  useEffect(() => {
    rowVirtualizer.measure();
  }, [rowVirtualizer, taskRows.length]);

  useEffect(() => {
    setSelectedTaskIds((current) => {
      const rowIds = new Set(taskRows.map((row) => row.id));
      const next = new Set([...current].filter((id) => rowIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [taskRows]);

  useEffect(() => {
    if (isHistoricalDate) {
      setEditingTaskId(null);
      setSelectedTaskIds(new Set());
    }
  }, [isHistoricalDate]);

  const loadTaskContext = useCallback(async (): Promise<void> => {
    if (!workspaceId) {
      setAccounts([]);
      setSheet(null);
      setSelectedAccountIds([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [nextAccounts, nextSheet] = await Promise.all([window.roster.listPlatformAccounts(), window.roster.getTaskSheetByDate(sheetDate)]);
      setAccounts(nextAccounts);
      setSheet(nextSheet);
      setSelectedAccountIds((current) => {
        const existingIds = new Set(nextAccounts.map((account) => account.id));
        const kept = current.filter((id) => existingIds.has(id));
        return kept.length > 0 ? kept : nextAccounts.filter((account) => account.enabled).map((account) => account.id);
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setLoading(false);
    }
  }, [sheetDate, workspaceId]);

  useEffect(() => {
    void loadTaskContext();
  }, [loadTaskContext]);

  const stats = useMemo(
    () => ({
      all: taskRows.length,
      pending: taskRows.filter((row) => row.status === "pending").length,
      success: taskRows.filter((row) => row.status === "success").length,
      failed: taskRows.filter((row) => row.status === "failed").length
    }),
    [taskRows]
  );

  const toggleAccount = (accountId: string): void => {
    setSelectedAccountIds((current) =>
      current.includes(accountId) ? current.filter((id) => id !== accountId) : [...current, accountId]
    );
  };

  const saveAccount = async (): Promise<void> => {
    const accountName = newAccountName.trim();
    if (!accountName) {
      setError("账号名称不能为空");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const saved = await window.roster.savePlatformAccount({
        platform: newAccountPlatform,
        accountName,
        enabled: true
      });
      setAccounts((current) => [...current.filter((account) => account.id !== saved.id), saved]);
      setSelectedAccountIds((current) => (current.includes(saved.id) ? current : [...current, saved.id]));
      setNewAccountName("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setLoading(false);
    }
  };

  const generateSheet = async (): Promise<void> => {
    if (isHistoricalDate) {
      setError("历史任务单只读，不能重新生成");
      return;
    }
    const anchors = parseTimeAnchors(timeAnchorsText);
    if (selectedAccountIds.length === 0) {
      setError("至少选择一个平台账号");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const generated = await window.roster.generateTaskSheet({
        sheetDate,
        videoCount,
        platformAccountIds: selectedAccountIds,
        videoStrategy,
        titleStrategy,
        defaultTagRatio,
        timeAnchors: anchors,
        jitterMinutes
      });
      setSheet(generated);
      setExportResult(null);
      setStatusMessage(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setLoading(false);
    }
  };

  const exportSheet = async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const exported = await window.roster.exportTaskSheet({
        sheetDate,
        formats: ["xlsx", "csv", "json"],
        targetPlatform: "windows"
      });
      setExportResult(exported);
      setStatusMessage(null);
      setSheet(await window.roster.getTaskSheetByDate(sheetDate));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setLoading(false);
    }
  };

  const mergeScannedSheet = useCallback((nextSheet: TaskSheetRecord | null): void => {
    setSheet((current) => {
      if (!nextSheet) {
        return nextSheet;
      }
      if (!current) {
        return nextSheet;
      }
      const currentRows = new Map(current.rows.map((row) => [row.id, row]));
      const changedIds = nextSheet.rows
        .filter((row) => {
          const previous = currentRows.get(row.id);
          return previous && (previous.status !== row.status || previous.runKey !== row.runKey || previous.errorMessage !== row.errorMessage);
        })
        .map((row) => row.id);
      if (changedIds.length > 0) {
        setHighlightedTaskIds((previous) => new Set([...previous, ...changedIds]));
        window.setTimeout(() => {
          setHighlightedTaskIds((previous) => {
            const next = new Set(previous);
            changedIds.forEach((id) => next.delete(id));
            return next;
          });
        }, 1_000);
      }
      return nextSheet;
    });
  }, []);

  const refreshStatusFiles = useCallback(async (options: { manual: boolean }): Promise<void> => {
    const scanResult = await window.roster.scanTaskStatusFiles({ sheetDate });
    const nextSheet = await window.roster.getTaskSheetByDate(sheetDate);
    mergeScannedSheet(nextSheet);
    if (options.manual || scanResult.processed > 0 || scanResult.duplicates > 0 || scanResult.errors.length > 0) {
      setStatusMessage(
        `状态扫描：读取 ${scanResult.scanned} 个 JSON，处理 ${scanResult.processed} 个，重复 ${scanResult.duplicates} 个，忽略 tmp ${scanResult.ignoredTmp} 个`
      );
    }
    if (scanResult.errors.length > 0) {
      setError(scanResult.errors.join("；"));
    }
  }, [mergeScannedSheet, sheetDate]);

  const scanStatusFiles = async (): Promise<void> => {
    if (isHistoricalDate) {
      setError("历史任务单只读，不能扫描状态文件");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await refreshStatusFiles({ manual: true });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!workspaceId || !sheet || isHistoricalDate) {
      return;
    }
    const timer = window.setInterval(() => {
      void refreshStatusFiles({ manual: false }).catch((caught: unknown) => {
        setError(caught instanceof Error ? caught.message : String(caught));
      });
    }, 5_000);
    return () => window.clearInterval(timer);
  }, [isHistoricalDate, refreshStatusFiles, sheet, workspaceId]);

  const retryTaskRow = async (taskId: string): Promise<void> => {
    if (isHistoricalDate) {
      setError("历史任务单只读，不能重试任务");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const retried = await window.roster.retryTaskRow({ taskId });
      setSheet((current) =>
        current
          ? {
              ...current,
              status: "exported",
              rows: current.rows.map((row) => (row.id === retried.id ? retried : row))
            }
          : current
      );
      setStatusMessage(`已重试 ${shortTaskId(taskId)}，新 Run Key：${retried.runKey}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setLoading(false);
    }
  };

  const markTaskStatus = async (taskId: string, status: "success" | "failed"): Promise<void> => {
    if (isHistoricalDate) {
      setError("历史任务单只读，不能手动标记状态");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const marked = await window.roster.markTaskRowStatus({
        taskId,
        status,
        errorCode: status === "failed" ? "MANUAL_FAILED" : null,
        errorMessage: status === "failed" ? "手动标记失败" : null
      });
      mergeScannedSheet(
        sheet
          ? {
              ...sheet,
              rows: sheet.rows.map((row) => (row.id === marked.id ? marked : row))
            }
          : null
      );
      setStatusMessage(`已手动标记 ${shortTaskId(taskId)} 为${taskStatusLabel[status]}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setLoading(false);
    }
  };

  const openRowEditor = (row: TaskRowRecord): void => {
    if (isHistoricalDate) {
      return;
    }
    setEditingTaskId(row.id);
    setEditPublishTime(formatPublishTime(row.publishAt));
    setEditTitleText(row.titleText ?? "");
    setEditTagsText(row.tags.join(" "));
  };

  const saveRowEdit = async (): Promise<void> => {
    if (!editingTaskId || isHistoricalDate) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const updated = await window.roster.updateTaskRow({
        taskId: editingTaskId,
        publishAt: `${sheetDate}T${editPublishTime.length === 5 ? `${editPublishTime}:00` : editPublishTime}`,
        titleText: editTitleText.trim() || null,
        tags: editTagsText
          .split(/[\s,，、/]+/)
          .map((tag) => tag.trim())
          .filter(Boolean)
          .slice(0, 5)
      });
      setSheet((current) =>
        current
          ? {
              ...current,
              rows: current.rows.map((row) => (row.id === updated.id ? updated : row))
            }
          : current
      );
      setEditingTaskId(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setLoading(false);
    }
  };

  const deleteRow = async (): Promise<void> => {
    if (!editingTaskId || isHistoricalDate) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setSheet(await window.roster.deleteTaskRow({ taskId: editingTaskId }));
      setEditingTaskId(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setLoading(false);
    }
  };

  const addRow = async (): Promise<void> => {
    if (isHistoricalDate) {
      setError("历史任务单只读，不能添加任务行");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const added = await window.roster.addTaskRow({ sheetDate, sourceTaskId: editingTaskId ?? undefined });
      setSheet((current) =>
        current
          ? {
              ...current,
              rows: [...current.rows, added].sort((left, right) => left.publishAt.localeCompare(right.publishAt))
            }
          : current
      );
      openRowEditor(added);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setLoading(false);
    }
  };

  const batchReplaceTitles = async (): Promise<void> => {
    if (isHistoricalDate) {
      setError("历史任务单只读，不能更换标题");
      return;
    }
    const targetTaskIds = selectedTaskIds.size > 0 ? [...selectedTaskIds] : undefined;
    setLoading(true);
    setError(null);
    try {
      setSheet(
        await window.roster.batchReplaceTaskTitles({
          sheetDate,
          taskIds: targetTaskIds,
          titleStrategy
        })
      );
      setStatusMessage(targetTaskIds ? `已更换 ${targetTaskIds.length} 行标题` : "已批量更换当前任务单标题");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setLoading(false);
    }
  };

  const createScheduleEntry = async (): Promise<void> => {
    const nextRunAt = new Date(Date.now() + 60_000).toISOString();
    const saved = await window.roster.saveScheduledJob({
      name: `任务单定时 ${sheetDate}`,
      type: "task_sheet",
      status: "enabled",
      scheduleLabel: "每 60 秒",
      nextRunAt,
      missedRunPolicy: "catch_up_last",
      targetPage: "tasks"
    });
    setStatusMessage(`已创建定时任务：${saved.name}`);
  };

  const toggleTaskSelection = (taskId: string): void => {
    if (isHistoricalDate) {
      return;
    }
    setSelectedTaskIds((current) => {
      const next = new Set(current);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  const toggleAllTaskRows = (): void => {
    if (isHistoricalDate) {
      return;
    }
    setSelectedTaskIds((current) => (current.size === taskRows.length ? new Set() : new Set(taskRows.map((row) => row.id))));
  };

  if (!workspace) {
    return (
      <div className="flex min-h-full items-center justify-center p-8">
        <div className="flex w-full max-w-xl flex-col items-center gap-3 rounded-lg border border-border bg-card p-8 text-center">
          <Database className="size-10 text-muted-foreground" />
          <h1 className="text-base font-semibold">先创建品牌工作空间</h1>
          <p className="text-sm leading-6 text-muted-foreground">任务单按当前工作空间的视频、标签、标题和平台账号生成。</p>
          <Button variant="primary" onClick={() => setPage("settings")}>
            去设置中创建
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col gap-4 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">任务单</h1>
          <p className="mt-1 text-sm text-muted-foreground">按视频 × 平台账号展开发布计划，生成后写入当前工作空间数据库。</p>
        </div>
        <div className="flex items-center gap-2">
          <Input aria-label="任务日期" className="h-8 w-40" type="date" value={sheetDate} onChange={(event) => setSheetDate(event.target.value)} />
          <Button variant="outline" size="sm" onClick={loadTaskContext} disabled={loading}>
            <RefreshCw className={cn(loading && "animate-spin")} />
            刷新
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <Metric label="任务行" value={stats.all} icon={LayoutList} />
        <Metric label="待执行" value={stats.pending} icon={Clock3} />
        <Metric label="成功" value={stats.success} icon={Send} />
        <Metric label="失败" value={stats.failed} icon={Settings2} />
      </div>

      <section className="rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <Settings2 className="size-4 text-primary" />
            <h2 className="text-sm font-semibold">生成配置</h2>
            <Badge variant="neutral">{videoCount} 视频 × {selectedAccountIds.length} 平台 = {estimatedRows} 行</Badge>
            {isHistoricalDate ? <Badge variant="warning">历史只读</Badge> : null}
          </div>
          <Button variant="primary" onClick={generateSheet} disabled={loading || isHistoricalDate}>
            <LayoutList />
            一键生成任务单
          </Button>
        </div>

        {error ? <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div> : null}

        <div className="grid grid-cols-[1.05fr_1.25fr_1fr_1.1fr] gap-4 p-4">
          <ConfigBlock icon={LayoutList} title="视频筛选">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-foreground">筛选模式</span>
              <select className={selectClass} value={videoStrategy} onChange={(event) => setVideoStrategy(event.target.value as TaskVideoStrategy)}>
                {videoStrategyOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <Input
              label="每日视频数"
              min={1}
              type="number"
              value={videoCount}
              onChange={(event) => setVideoCount(Math.max(1, Number.parseInt(event.target.value, 10) || 1))}
            />
          </ConfigBlock>

          <ConfigBlock icon={Users} title="平台账号">
            <div className="grid grid-cols-2 gap-2">
              {enabledAccounts.length > 0 ? (
                enabledAccounts.map((account) => (
                  <label
                    key={account.id}
                    className={cn(
                      "flex h-9 cursor-pointer items-center gap-2 rounded-md border border-border px-2 text-sm hover:bg-muted/60",
                      selectedAccountIds.includes(account.id) && "border-primary bg-primary/5 text-primary"
                    )}
                  >
                    <input
                      checked={selectedAccountIds.includes(account.id)}
                      className="size-3.5"
                      type="checkbox"
                      onChange={() => toggleAccount(account.id)}
                    />
                    <span className="min-w-0 flex-1 truncate">{account.platform}</span>
                    <span className="max-w-24 truncate text-xs text-muted-foreground">{account.accountName}</span>
                  </label>
                ))
              ) : (
                <div className="col-span-2 rounded-md border border-dashed border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                  还没有平台账号
                </div>
              )}
            </div>
            <div className="grid grid-cols-[96px_minmax(0,1fr)_auto] gap-2">
              <select
                aria-label="新增账号平台"
                className={cn(selectClass, "px-2")}
                value={newAccountPlatform}
                onChange={(event) => setNewAccountPlatform(event.target.value)}
              >
                {["抖音", "视频号", "小红书", "快手"].map((platform) => (
                  <option key={platform} value={platform}>
                    {platform}
                  </option>
                ))}
              </select>
              <Input
                aria-label="新增账号名称"
                className="h-9"
                placeholder="账号名称"
                value={newAccountName}
                onChange={(event) => setNewAccountName(event.target.value)}
              />
              <Button variant="outline" onClick={saveAccount} disabled={loading}>
                <Plus />
                新增
              </Button>
            </div>
          </ConfigBlock>

          <ConfigBlock icon={Type} title="标题与标签">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-foreground">标题策略</span>
              <select className={selectClass} value={titleStrategy} onChange={(event) => setTitleStrategy(event.target.value as TaskTitleStrategy)}>
                {titleStrategyOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-2 text-sm">
              <span className="font-medium text-foreground">默认标签 {defaultTagRatio}% / 测试标签 {100 - defaultTagRatio}%</span>
              <input
                aria-label="默认标签比例"
                className="h-9"
                max={100}
                min={0}
                type="range"
                value={defaultTagRatio}
                onChange={(event) => setDefaultTagRatio(Number.parseInt(event.target.value, 10))}
              />
            </label>
          </ConfigBlock>

          <ConfigBlock icon={CalendarDays} title="时间安排">
            <Input
              label="发布时间锚点"
              value={timeAnchorsText}
              onChange={(event) => setTimeAnchorsText(event.target.value)}
            />
            <label className="flex flex-col gap-2 text-sm">
              <span className="font-medium text-foreground">随机抖动 ±{jitterMinutes} 分钟</span>
              <input
                aria-label="随机抖动分钟"
                className="h-9"
                max={180}
                min={0}
                type="range"
                value={jitterMinutes}
                onChange={(event) => setJitterMinutes(Number.parseInt(event.target.value, 10))}
              />
            </label>
          </ConfigBlock>
        </div>
      </section>

      <section className="min-w-0 rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="flex items-center gap-3">
            <LayoutList className="size-4 text-primary" />
            <h2 className="text-sm font-semibold">当前任务单：{sheetDate}</h2>
            <Badge variant="neutral">{taskRows.length} 行</Badge>
            {selectedTaskCount > 0 ? <Badge variant="info">已选 {selectedTaskCount} 行</Badge> : null}
            {isHistoricalDate ? <Badge variant="warning">历史只读</Badge> : null}
            {sheet ? <span className="text-xs text-muted-foreground">{sheet.name} · {sheet.status === "draft" ? "草稿" : sheet.status}</span> : null}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={generateSheet} disabled={loading || selectedAccounts.length === 0 || isHistoricalDate}>
              <RefreshCw />
              重新生成
            </Button>
            <Button variant="outline" size="sm" onClick={exportSheet} disabled={loading || taskRows.length === 0}>
              导出
            </Button>
            <Button variant="outline" size="sm" onClick={scanStatusFiles} disabled={loading || isHistoricalDate}>
              扫描状态
            </Button>
            <Button variant="outline" size="sm" onClick={createScheduleEntry} disabled={loading} data-create-task-schedule>
              <CalendarClock />
              定时
            </Button>
          </div>
        </div>

        {isHistoricalDate ? (
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">
            历史任务单只读，可重新导出；不能重新生成、编辑、换标题、添加删除或手动改状态。
          </div>
        ) : null}

        {statusMessage ? <div className="border-b border-blue-200 bg-blue-50 px-4 py-2 text-xs text-blue-800">{statusMessage}</div> : null}

        {exportResult ? (
          <div className="border-b border-emerald-200 bg-emerald-50 px-4 py-2 text-xs text-emerald-800">
            已导出 {exportResult.writtenFiles.length} 个文件到
            <span className="mx-1 font-mono">{exportResult.exportAbsoluteDir}</span>
            ，RPA 状态目录：
            <span className="ml-1 font-mono">{exportResult.statusAbsoluteDir}</span>
            {exportResult.warnings.length ? `；${exportResult.warnings.length} 个路径需要在 Windows 端预检` : ""}
          </div>
        ) : null}

        <div className="grid h-9 grid-cols-[36px_88px_72px_92px_132px_100px_minmax(220px,1.4fr)_minmax(200px,1.2fr)_88px_minmax(180px,1fr)] items-center border-b border-border bg-muted/50 px-4 text-xs font-medium text-muted-foreground">
          <div>
            <input
              aria-label="选择全部任务行"
              checked={taskRows.length > 0 && selectedTaskIds.size === taskRows.length}
              className="size-3.5"
              disabled={isHistoricalDate || taskRows.length === 0}
              type="checkbox"
              onChange={toggleAllTaskRows}
            />
          </div>
          <div>任务 ID</div>
          <div>时间</div>
          <div>平台</div>
          <div>账号</div>
          <div>SKU</div>
          <div>标题</div>
          <div>标签</div>
          <div>状态</div>
          <div>Run Key</div>
        </div>

        {taskRows.length === 0 ? (
          <div className="flex min-h-80 flex-col items-center justify-center gap-3 px-4 py-10 text-center">
            <LayoutList className="size-10 text-muted-foreground" />
            <div className="text-sm font-medium">{sheet ? "这张任务单没有任务行" : `${sheetDate} 还没有任务单`}</div>
            <p className="max-w-md text-sm leading-6 text-muted-foreground">
              先确认视频库、标题库、标签库和平台账号都有可用数据，再生成当天发布计划。
            </p>
            {isHistoricalDate ? null : (
              <Button variant="primary" onClick={generateSheet} disabled={loading}>
                <LayoutList />
                点这里生成
              </Button>
            )}
          </div>
        ) : (
          <div ref={parentRef} className="h-[calc(100vh-514px)] min-h-80 overflow-auto">
            <div className="relative" style={{ height: `${rowVirtualizer.getTotalSize()}px` }}>
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const row = taskRows[virtualRow.index];
                if (!row) {
                  return null;
                }
                return (
                  <TaskRow
                    key={row.id}
                    highlighted={highlightedTaskIds.has(row.id)}
                    readOnly={isHistoricalDate}
                    row={row}
                    selected={selectedTaskIds.has(row.id)}
                    size={virtualRow.size}
                    start={virtualRow.start}
                    onMarkStatus={markTaskStatus}
                    onOpenEdit={openRowEditor}
                    onRetry={retryTaskRow}
                    onToggleSelected={toggleTaskSelection}
                  />
                );
              })}
            </div>
          </div>
        )}

        <div className="flex h-10 items-center gap-2 border-t border-border px-4 text-xs text-muted-foreground">
          <span>{editingTaskId ? `正在编辑 ${shortTaskId(editingTaskId)}` : selectedTaskCount > 0 ? `已选 ${selectedTaskCount} 行` : "勾选行可批量换标题，双击行可编辑"}</span>
          <Button variant="outline" size="sm" onClick={saveRowEdit} disabled={!editingTaskId || loading || isHistoricalDate}>
            编辑
          </Button>
          <Button variant="outline" size="sm" onClick={batchReplaceTitles} disabled={taskRows.length === 0 || loading || isHistoricalDate}>
            {selectedTaskCount > 0 ? `换标题 (${selectedTaskCount})` : "换标题"}
          </Button>
          <Button variant="outline" size="sm" onClick={deleteRow} disabled={!editingTaskId || loading || isHistoricalDate}>
            删除
          </Button>
          <Button variant="outline" size="sm" onClick={addRow} disabled={taskRows.length === 0 || loading || isHistoricalDate}>
            添加
          </Button>
        </div>
        {editingTaskId && !isHistoricalDate ? (
          <div className="grid grid-cols-[120px_minmax(220px,1fr)_minmax(220px,1fr)_auto] gap-2 border-t border-border p-3">
            <Input
              aria-label="编辑发布时间"
              className="h-8"
              value={editPublishTime}
              onChange={(event) => setEditPublishTime(event.target.value)}
            />
            <Input
              aria-label="编辑标题"
              className="h-8"
              value={editTitleText}
              onChange={(event) => setEditTitleText(event.target.value)}
            />
            <Input
              aria-label="编辑标签"
              className="h-8"
              value={editTagsText}
              onChange={(event) => setEditTagsText(event.target.value)}
            />
            <Button variant="primary" size="sm" onClick={saveRowEdit} disabled={loading}>
              保存行
            </Button>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function TaskRow({
  onRetry,
  highlighted,
  onMarkStatus,
  onOpenEdit,
  onToggleSelected,
  readOnly,
  row,
  selected,
  size,
  start
}: {
  onRetry(taskId: string): void;
  highlighted: boolean;
  onMarkStatus(taskId: string, status: "success" | "failed"): void;
  onOpenEdit(row: TaskRowRecord): void;
  onToggleSelected(taskId: string): void;
  readOnly: boolean;
  row: TaskRowRecord;
  selected: boolean;
  size: number;
  start: number;
}): JSX.Element {
  return (
    <div
      data-task-row
      data-task-status={row.status}
      className={cn(
        "absolute left-0 grid w-full cursor-default grid-cols-[36px_88px_72px_92px_132px_100px_minmax(220px,1.4fr)_minmax(200px,1.2fr)_88px_minmax(180px,1fr)] items-center border-b border-border/70 px-4 text-sm transition-colors hover:bg-muted/50",
        highlighted && "bg-amber-50"
      )}
      style={{ height: `${size}px`, transform: `translateY(${start}px)` }}
      onDoubleClick={() => onOpenEdit(row)}
    >
      <div>
        <input
          aria-label={`选择任务 ${shortTaskId(row.id)}`}
          checked={selected}
          className="size-3.5"
          disabled={readOnly}
          type="checkbox"
          onChange={() => onToggleSelected(row.id)}
          onDoubleClick={(event) => event.stopPropagation()}
        />
      </div>
      <div className="truncate font-mono text-xs" title={row.id}>
        {shortTaskId(row.id)}
      </div>
      <div className="text-xs text-muted-foreground">{formatPublishTime(row.publishAt)}</div>
      <div className="truncate font-medium">{row.platform}</div>
      <div className="truncate text-muted-foreground">{row.accountName}</div>
      <div className="truncate text-muted-foreground">{row.sku ?? "-"}</div>
      <div className="truncate" title={row.titleText ?? ""}>
        {row.titleText ?? "未分配标题"}
      </div>
      <div className="flex min-w-0 items-center gap-1">
        <Tags className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate text-xs text-muted-foreground" title={row.tags.join(" ")}>
          {row.tags.length ? row.tags.join(" / ") : row.tagGroup === "test" ? "测试标签未匹配" : "默认标签未匹配"}
        </span>
      </div>
      <div>
        <div className="flex items-center gap-1">
          <Badge variant={taskStatusVariant[row.status]}>{taskStatusLabel[row.status]}</Badge>
          {row.status === "failed" ? (
            <button className="rounded px-1.5 text-xs text-primary hover:bg-primary/10 disabled:pointer-events-none disabled:opacity-50" disabled={readOnly} onClick={() => onRetry(row.id)}>
              重试
            </button>
          ) : null}
          {row.status !== "success" ? (
            <button className="rounded px-1.5 text-xs text-emerald-700 hover:bg-emerald-50 disabled:pointer-events-none disabled:opacity-50" disabled={readOnly} onClick={() => onMarkStatus(row.id, "success")}>
              成功
            </button>
          ) : null}
          {row.status !== "failed" ? (
            <button className="rounded px-1.5 text-xs text-red-700 hover:bg-red-50 disabled:pointer-events-none disabled:opacity-50" disabled={readOnly} onClick={() => onMarkStatus(row.id, "failed")}>
              失败
            </button>
          ) : null}
        </div>
      </div>
      <div className="truncate font-mono text-xs text-muted-foreground" title={row.runKey}>
        {row.runKey}
      </div>
    </div>
  );
}

function ConfigBlock({ children, icon: Icon, title }: { children: ReactNode; icon: typeof LayoutList; title: string }): JSX.Element {
  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-md border border-border bg-background p-3">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Icon className="size-4 text-primary" />
        {title}
      </div>
      {children}
    </div>
  );
}

function Metric({ label, value, icon: Icon }: { label: string; value: number; icon: typeof LayoutList }): JSX.Element {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Icon className="size-4 text-primary" />
      </div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </div>
  );
}
