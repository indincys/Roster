import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { WorkspaceDatabase } from "@roster/db";

const tempRoots: string[] = [];

async function makeTempWorkspace(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "roster-schedule-workspace-"));
  tempRoots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("scheduled jobs", () => {
  it("saves and toggles scheduled jobs in workspace.db", async () => {
    const root = await makeTempWorkspace();
    const db = await WorkspaceDatabase.open(root);

    const saved = db.saveScheduledJob({
      name: "生成今日任务单",
      type: "task_sheet",
      status: "enabled",
      scheduleLabel: "每天 09:00",
      nextRunAt: "2026-05-10T01:00:00.000Z",
      missedRunPolicy: "catch_up_last",
      targetPage: "tasks"
    });
    expect(saved.status).toBe("enabled");
    expect(db.listScheduledJobs()).toHaveLength(1);

    const paused = db.toggleScheduledJob({ jobId: saved.id, enabled: false });
    expect(paused.status).toBe("paused");
    expect(db.listScheduledJobs()[0]?.status).toBe("paused");
    db.close();
  });

  it("runs due enabled jobs, records history, and recalculates next run", async () => {
    const root = await makeTempWorkspace();
    const db = await WorkspaceDatabase.open(root);
    const now = "2026-05-09T08:00:00.000Z";
    const due = db.saveScheduledJob({
      name: "到期任务单",
      type: "task_sheet",
      status: "enabled",
      scheduleLabel: "每 60 秒",
      nextRunAt: "2026-05-09T07:59:59.000Z",
      missedRunPolicy: "catch_up_last",
      targetPage: "tasks"
    });
    const paused = db.saveScheduledJob({
      name: "暂停任务",
      type: "task_sheet",
      status: "paused",
      scheduleLabel: "每 60 秒",
      nextRunAt: "2026-05-09T07:59:59.000Z",
      missedRunPolicy: "catch_up_last",
      targetPage: "tasks"
    });

    const runs = db.runDueScheduledJobs(now);

    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({
      jobId: due.id,
      status: "success"
    });
    expect(db.listScheduledJobRuns(due.id)).toHaveLength(1);
    expect(db.listScheduledJobRuns(paused.id)).toHaveLength(0);
    const updatedDue = db.listScheduledJobs().find((job) => job.id === due.id);
    expect(updatedDue?.nextRunAt).toBe("2026-05-09T08:00:59.000Z");
    expect(updatedDue?.lastRunStatus).toBe("success");
    db.close();
  });

  it("applies missed-run policies for skipped, last-only, and all catch-up runs", async () => {
    const root = await makeTempWorkspace();
    const db = await WorkspaceDatabase.open(root);
    const now = "2026-05-09T08:03:00.000Z";
    const skip = db.saveScheduledJob({
      name: "跳过错过任务",
      type: "task_sheet",
      status: "enabled",
      scheduleLabel: "每 60 秒",
      nextRunAt: "2026-05-09T08:00:00.000Z",
      missedRunPolicy: "skip",
      targetPage: "tasks"
    });
    const catchLast = db.saveScheduledJob({
      name: "补最近任务",
      type: "task_sheet",
      status: "enabled",
      scheduleLabel: "每 60 秒",
      nextRunAt: "2026-05-09T08:00:00.000Z",
      missedRunPolicy: "catch_up_last",
      targetPage: "tasks"
    });
    const catchAll = db.saveScheduledJob({
      name: "补全部任务",
      type: "task_sheet",
      status: "enabled",
      scheduleLabel: "每 60 秒",
      nextRunAt: "2026-05-09T08:00:00.000Z",
      missedRunPolicy: "catch_up_all",
      targetPage: "tasks"
    });

    const runs = db.runDueScheduledJobs(now);

    expect(runs.filter((run) => run.jobId === skip.id && run.status === "skipped")).toHaveLength(4);
    expect(runs.filter((run) => run.jobId === catchLast.id && run.status === "skipped")).toHaveLength(3);
    expect(runs.filter((run) => run.jobId === catchLast.id && run.status === "success")).toHaveLength(1);
    expect(runs.filter((run) => run.jobId === catchAll.id && run.status === "success")).toHaveLength(4);
    for (const job of db.listScheduledJobs()) {
      expect(job.nextRunAt).toBe("2026-05-09T08:04:00.000Z");
    }
    db.close();
  });

  it("records failed runs without stopping the next scheduled execution", async () => {
    const root = await makeTempWorkspace();
    const db = await WorkspaceDatabase.open(root);
    const failed = db.saveScheduledJob({
      name: "配置错误任务",
      type: "task_sheet",
      status: "enabled",
      scheduleLabel: "每 60 秒",
      nextRunAt: "2026-05-09T08:00:00.000Z",
      missedRunPolicy: "catch_up_last",
      targetPage: "titles"
    });

    const failedRuns = db.runDueScheduledJobs("2026-05-09T08:00:01.000Z");

    expect(failedRuns).toHaveLength(1);
    expect(failedRuns[0]).toMatchObject({
      jobId: failed.id,
      status: "failed"
    });
    expect(failedRuns[0]?.errorMessage).toContain("配置无效");
    let updated = db.listScheduledJobs().find((job) => job.id === failed.id);
    expect(updated?.lastRunStatus).toBe("failed");
    expect(updated?.lastError).toContain("配置无效");
    expect(updated?.nextRunAt).toBe("2026-05-09T08:01:00.000Z");

    db.saveScheduledJob({
      jobId: failed.id,
      name: failed.name,
      type: failed.type,
      status: "enabled",
      scheduleLabel: "每 60 秒",
      nextRunAt: updated?.nextRunAt ?? "2026-05-09T08:01:00.000Z",
      missedRunPolicy: failed.missedRunPolicy,
      targetPage: "tasks"
    });
    const recoveredRuns = db.runDueScheduledJobs("2026-05-09T08:01:01.000Z");

    expect(recoveredRuns).toHaveLength(1);
    expect(recoveredRuns[0]).toMatchObject({
      jobId: failed.id,
      status: "success"
    });
    updated = db.listScheduledJobs().find((job) => job.id === failed.id);
    expect(updated?.lastRunStatus).toBe("success");
    expect(updated?.lastError).toBeNull();
    const history = db.listScheduledJobRuns(failed.id);
    expect(history.map((run) => run.status)).toEqual(["success", "failed"]);
    db.close();
  });

  it("runs due jobs through an injected executor for main-process workflow adapters", async () => {
    const root = await makeTempWorkspace();
    const db = await WorkspaceDatabase.open(root);
    const due = db.saveScheduledJob({
      name: "标题工作流",
      type: "title_generation",
      status: "enabled",
      scheduleLabel: "每 60 秒",
      nextRunAt: "2026-05-09T08:00:00.000Z",
      missedRunPolicy: "catch_up_last",
      targetPage: "titles"
    });

    const runs = db.runDueScheduledJobs("2026-05-09T08:00:01.000Z", ({ job, scheduledAt }) => ({
      status: "success",
      artifactSummary: `adapter:${job.type}:${scheduledAt}`,
      errorMessage: null
    }));

    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({
      jobId: due.id,
      status: "success",
      artifactSummary: "adapter:title_generation:2026-05-09T08:00:00.000Z"
    });
    expect(db.listScheduledJobs().find((job) => job.id === due.id)?.lastRunStatus).toBe("success");
    db.close();
  });
});
