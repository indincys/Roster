import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarClock, Clock3, Pause, Play, Plus, StepForward } from "lucide-react";
import type { ScheduledJobRecord, ScheduledJobRunRecord, ScheduledJobRunStatus, ScheduledJobType } from "@roster/shared-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusStrip, WorkbenchHeader } from "@/components/workbench";
import { activeWorkspace, useAppStore, type AppPage } from "@/stores/app-store";

const typeLabels: Record<ScheduledJobType, string> = {
  task_sheet: "任务单生成",
  title_generation: "标题生成",
  image_generation: "图片生成",
  script_generation: "文案生成"
};

const targetPages: Record<ScheduledJobType, AppPage> = {
  task_sheet: "tasks",
  title_generation: "titles",
  image_generation: "images",
  script_generation: "scripts"
};

const missedRunPolicyLabels = {
  catch_up_last: "补跑最近一次",
  catch_up_all: "补跑全部",
  skip: "跳过"
} as const;

const runStatusLabels: Record<ScheduledJobRunStatus, string> = {
  success: "成功",
  failed: "失败",
  skipped: "跳过"
};

const runStatusVariants: Record<ScheduledJobRunStatus, "success" | "danger" | "neutral"> = {
  success: "success",
  failed: "danger",
  skipped: "neutral"
};

export function SchedulesPage(): JSX.Element {
  const { bootstrap, setPage } = useAppStore();
  const workspace = activeWorkspace(bootstrap);
  const [jobs, setJobs] = useState<ScheduledJobRecord[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [runHistory, setRunHistory] = useState<ScheduledJobRunRecord[]>([]);
  const [message, setMessage] = useState("");

  const stats = useMemo(
    () => ({
      enabled: jobs.filter((job) => job.status === "enabled").length,
      paused: jobs.filter((job) => job.status === "paused").length,
      failed: jobs.filter((job) => job.lastRunStatus === "failed").length
    }),
    [jobs]
  );

  const loadJobs = useCallback(async (): Promise<void> => {
    if (!workspace) {
      setJobs([]);
      setSelectedJobId(null);
      setRunHistory([]);
      return;
    }
    const nextJobs = await window.roster.listScheduledJobs();
    setJobs(nextJobs);
    setSelectedJobId((current) => (current && nextJobs.some((job) => job.id === current) ? current : nextJobs[0]?.id ?? null));
  }, [workspace]);

  const loadRunHistory = useCallback(async (jobId: string | null): Promise<void> => {
    if (!workspace || !jobId) {
      setRunHistory([]);
      return;
    }
    setRunHistory(await window.roster.listScheduledJobRuns({ jobId, limit: 20 }));
  }, [workspace]);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  useEffect(() => {
    void loadRunHistory(selectedJobId);
  }, [loadRunHistory, selectedJobId]);

  const selectedJob = useMemo(
    () => jobs.find((job) => job.id === selectedJobId) ?? null,
    [jobs, selectedJobId]
  );

  async function createDemoJob(type: ScheduledJobType): Promise<void> {
    const nextHour = new Date();
    nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
    await window.roster.saveScheduledJob({
      name: typeLabels[type],
      type,
      status: "enabled",
      scheduleLabel: "每天 09:00",
      nextRunAt: nextHour.toISOString(),
      missedRunPolicy: "catch_up_last",
      targetPage: targetPages[type]
    });
    await loadJobs();
    setMessage("已创建定时任务；配置编辑请进入对应工作区。");
  }

  async function toggleJob(job: ScheduledJobRecord): Promise<void> {
    const updated = await window.roster.toggleScheduledJob({
      jobId: job.id,
      enabled: job.status !== "enabled"
    });
    setJobs((current) => current.map((candidate) => (candidate.id === updated.id ? updated : candidate)));
  }

  async function runDueJobs(): Promise<void> {
    const runs = await window.roster.runDueScheduledJobs();
    await loadJobs();
    await loadRunHistory(selectedJobId);
    setMessage(`已执行到期任务 ${runs.length} 个`);
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 p-5" data-schedules-page>
      <WorkbenchHeader
        eyebrow="自动化队列"
        title="定时任务总览"
        description="查看哪些任务会运行、下一次何时运行，以及失败原因。主进程运行期间执行。"
        actions={
          <>
          <Button
            variant="outline"
            onClick={runDueJobs}
            data-run-due-scheduled-jobs
          >
            运行到期
          </Button>
          <Button variant="outline" onClick={() => createDemoJob("task_sheet")} data-create-scheduled-job>
            <Plus />
            新建任务单定时
          </Button>
          <Button variant="outline" onClick={loadJobs}>
            刷新
          </Button>
          </>
        }
      />

      <StatusStrip
        items={[
          { label: "当前启用", value: stats.enabled, hint: `${jobs.length} 个定时任务`, tone: stats.enabled > 0 ? "success" : "neutral" },
          { label: "暂停中", value: stats.paused, hint: "不会自动运行", tone: stats.paused > 0 ? "warning" : "neutral" },
          { label: "最近失败", value: stats.failed, hint: "查看历史定位原因", tone: stats.failed > 0 ? "danger" : "neutral" },
          { label: "当前对象", value: selectedJob ? 1 : 0, hint: selectedJob?.name ?? "未选择", tone: selectedJob ? "info" : "neutral" }
        ]}
      />

      <section className="min-h-0 flex-1 overflow-hidden rounded-lg border border-border bg-card">
        <div className="grid h-10 grid-cols-[76px_minmax(170px,1fr)_94px_118px_96px_145px_90px_230px] items-center border-b border-border bg-muted/50 px-4 text-xs font-medium text-muted-foreground">
          <div>状态</div>
          <div>名称</div>
          <div>类型</div>
          <div>计划</div>
          <div>错过策略</div>
          <div>下次执行</div>
          <div>最近结果</div>
          <div>操作</div>
        </div>
        {jobs.length === 0 ? (
          <div className="flex min-h-80 flex-col items-center justify-center gap-3">
            <CalendarClock className="size-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">还没有定时任务。配置入口位于各工作区。</p>
          </div>
        ) : (
          <div className="h-full min-h-0 overflow-y-auto">
            {jobs.map((job) => (
              <div
                key={job.id}
                className={`grid h-12 grid-cols-[76px_minmax(170px,1fr)_94px_118px_96px_145px_90px_230px] items-center border-b border-border px-4 text-sm ${
                  selectedJobId === job.id ? "bg-amber-50/70" : ""
                }`}
                data-scheduled-job-row={job.id}
              >
                <div>
                  <Badge variant={job.status === "enabled" ? "success" : "warning"}>
                    {job.status === "enabled" ? "启用" : "暂停"}
                  </Badge>
                </div>
                <div className="truncate font-medium">{job.name}</div>
                <div>{typeLabels[job.type]}</div>
                <div className="truncate text-muted-foreground">{job.scheduleLabel}</div>
                <div className="truncate text-xs text-muted-foreground" data-scheduled-job-policy={job.id}>
                  {missedRunPolicyLabels[job.missedRunPolicy]}
                </div>
                <div className="truncate text-xs text-muted-foreground">{job.nextRunAt ?? "暂停中"}</div>
                <div className="truncate text-xs" data-scheduled-job-last-run={job.id}>
                  {job.lastRunStatus ? (
                    <Badge variant={runStatusVariants[job.lastRunStatus]}>
                      {runStatusLabels[job.lastRunStatus]}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedJobId(job.id)}
                    data-load-scheduled-job-history={job.id}
                  >
                    <Clock3 />
                    历史
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => toggleJob(job)} data-toggle-scheduled-job={job.id}>
                    {job.status === "enabled" ? <Pause /> : <Play />}
                    {job.status === "enabled" ? "暂停" : "启用"}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setPage(job.targetPage as AppPage)}>
                    <StepForward />
                    进入
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {selectedJob ? (
        <section className="rounded-lg border border-border bg-card" data-scheduled-job-history={selectedJob.id}>
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold">运行历史</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {selectedJob.name} · 最近 20 次运行记录
              </p>
            </div>
            {selectedJob.lastError ? (
              <div className="max-w-[420px] truncate text-xs text-red-700" data-scheduled-job-last-error={selectedJob.id}>
                最近失败：{selectedJob.lastError}
              </div>
            ) : null}
          </div>
          {runHistory.length === 0 ? (
            <div className="px-4 py-6 text-sm text-muted-foreground">暂无运行记录。</div>
          ) : (
            <div className="max-h-56 overflow-y-auto">
              {runHistory.map((run) => (
                <div
                  key={run.id}
                  className="grid grid-cols-[92px_170px_90px_minmax(180px,1fr)_minmax(180px,1fr)] items-center gap-3 border-b border-border px-4 py-2 text-sm last:border-b-0"
                  data-scheduled-job-history-row={run.id}
                  data-scheduled-job-history-status={run.status}
                >
                  <div>
                    <Badge variant={runStatusVariants[run.status]}>{runStatusLabels[run.status]}</Badge>
                  </div>
                  <div className="truncate text-xs text-muted-foreground">{run.startedAt}</div>
                  <div className="text-xs text-muted-foreground">{run.durationMs ?? 0} ms</div>
                  <div className="truncate text-xs text-muted-foreground" data-scheduled-job-artifact={run.id}>
                    {run.artifactSummary ?? "-"}
                  </div>
                  <div className="truncate text-xs text-red-700" data-scheduled-job-error={run.id}>
                    {run.errorMessage ?? "-"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {message ? <div className="rounded-md border border-border bg-card px-4 py-3 text-sm" data-schedule-message>{message}</div> : null}
    </div>
  );
}
