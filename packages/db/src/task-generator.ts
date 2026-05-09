import crypto from "node:crypto";
import type {
  AssignedPublishTime,
  PlatformAccountRecord,
  TagRecord,
  TaskGenerateInput,
  TaskRowRecord,
  TaskTitleStrategy,
  TitleRecord,
  VideoRecord
} from "@roster/shared-types";

export type RandomSource = () => number;

export interface TaskGenerationSources {
  videos: VideoRecord[];
  platformAccounts: PlatformAccountRecord[];
  titles: TitleRecord[];
  tags: TagRecord[];
  successfulPairs: Set<string>;
}

export interface TaskGenerationResult {
  rows: Array<Omit<TaskRowRecord, "sheetId" | "createdAt" | "updatedAt">>;
}

function pairKey(videoId: string, platformAccountId: string): string {
  return `${videoId}::${platformAccountId}`;
}

function clampMinuteOfDay(value: number): number {
  return Math.max(0, Math.min(23 * 60 + 59, value));
}

function parseAnchor(anchor: string): number {
  const [hour, minute] = anchor.split(":").map((part) => Number.parseInt(part, 10));
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    throw new Error(`发布时间锚点无效：${anchor}`);
  }
  return hour * 60 + minute;
}

function formatMinuteOfDay(totalMinutes: number): string {
  const hour = Math.floor(totalMinutes / 60)
    .toString()
    .padStart(2, "0");
  const minute = (totalMinutes % 60).toString().padStart(2, "0");
  return `${hour}:${minute}:00`;
}

export function assignPublishTimes(
  anchors: string[],
  jitterMinutes: number,
  count: number,
  random: RandomSource = Math.random
): AssignedPublishTime[] {
  if (count <= 0) {
    return [];
  }
  if (anchors.length === 0) {
    throw new Error("发布时间锚点不能为空");
  }

  const times: AssignedPublishTime[] = [];
  const base = Math.floor(count / anchors.length);
  const remainder = count % anchors.length;

  anchors.forEach((anchor, index) => {
    const quota = base + (index < remainder ? 1 : 0);
    const anchorMinutes = parseAnchor(anchor);
    for (let offset = 0; offset < quota; offset += 1) {
      const jitterRange = jitterMinutes * 2 + 1;
      const jitter = jitterMinutes === 0 ? 0 : Math.floor(random() * jitterRange) - jitterMinutes;
      times.push({
        anchor,
        time: formatMinuteOfDay(clampMinuteOfDay(anchorMinutes + jitter))
      });
    }
  });

  return times.sort((left, right) => left.time.localeCompare(right.time));
}

function chooseTitle(titles: TitleRecord[], strategy: TaskTitleStrategy, index: number, random: RandomSource): TitleRecord | null {
  const activeTitles = titles.filter((title) => title.status === "active");
  if (activeTitles.length === 0) {
    return null;
  }

  if (strategy === "best_score") {
    return [...activeTitles].sort((left, right) => (right.score ?? 0) - (left.score ?? 0) || left.useCount - right.useCount)[
      index % activeTitles.length
    ] ?? null;
  }
  if (strategy === "new_test") {
    return [...activeTitles].sort((left, right) => left.useCount - right.useCount || (right.score ?? 0) - (left.score ?? 0))[
      index % activeTitles.length
    ] ?? null;
  }

  return activeTitles[Math.floor(random() * activeTitles.length)] ?? null;
}

function chooseTagGroup(defaultTagRatio: number, index: number, total: number): "default" | "test" {
  const defaultCount = Math.round((total * defaultTagRatio) / 100);
  return index < defaultCount ? "default" : "test";
}

function tagsForVideo(tags: TagRecord[], video: VideoRecord, tagGroup: "default" | "test"): string[] {
  const sku = video.sku ?? "";
  const style = video.style ?? "";
  const exact = tags.find((tag) => tag.skuCode === sku && (tag.skuStyle ?? "") === style && tag.tagGroup === tagGroup);
  const skuFallback = tags.find((tag) => tag.skuCode === sku && tag.tagGroup === tagGroup);
  const selected = exact ?? skuFallback;
  return selected ? [selected.tag1, selected.tag2, selected.tag3, selected.tag4, selected.tag5].filter((tag): tag is string => Boolean(tag)) : [];
}

function sortCandidateVideos(videos: VideoRecord[], strategy: TaskGenerateInput["videoStrategy"]): VideoRecord[] {
  const activeVideos = videos.filter((video) => video.status !== "archived" && video.status !== "placeholder");
  if (strategy === "popular_sku") {
    return [...activeVideos].sort((left, right) => right.usedCount - left.usedCount || right.createdAt.localeCompare(left.createdAt));
  }
  if (strategy === "recent_hot") {
    return [...activeVideos].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }
  return [...activeVideos].sort((left, right) => left.usedCount - right.usedCount || right.createdAt.localeCompare(left.createdAt));
}

export function generateTaskRows(
  input: TaskGenerateInput,
  sources: TaskGenerationSources,
  random: RandomSource = Math.random
): TaskGenerationResult {
  const platformAccounts = sources.platformAccounts.filter((account) => input.platformAccountIds.includes(account.id) && account.enabled);
  if (platformAccounts.length === 0) {
    throw new Error("没有可用的平台账号");
  }

  const candidateVideos = sortCandidateVideos(sources.videos, input.videoStrategy);
  if (candidateVideos.length < input.videoCount) {
    throw new Error("视频库可用素材不足，无法生成任务单");
  }

  const selectedVideos = candidateVideos.slice(0, input.videoCount);
  const plannedPairs = selectedVideos.flatMap((video) =>
    platformAccounts
      .filter((account) => !sources.successfulPairs.has(pairKey(video.id, account.id)))
      .map((account) => ({ video, account }))
  );
  if (plannedPairs.length === 0) {
    throw new Error("所选视频与平台账号均已有成功历史，无可生成任务");
  }

  const publishTimes = assignPublishTimes(input.timeAnchors, input.jitterMinutes, plannedPairs.length, random);
  const rows = plannedPairs.map(({ video, account }, index) => {
    const title = chooseTitle(sources.titles, input.titleStrategy, index, random);
    const tagGroup = chooseTagGroup(input.defaultTagRatio, index, plannedPairs.length);
    const attemptNo = 1;
    const rowId = crypto.randomUUID();
    const runKey = `${rowId}__attempt-${attemptNo}`;
    const publishAt = `${input.sheetDate}T${publishTimes[index]?.time ?? "00:00:00"}`;
    return {
      id: rowId,
      runKey,
      attemptNo,
      sheetDate: input.sheetDate,
      publishAt,
      status: "pending" as const,
      videoId: video.id,
      videoRelativePath: video.relativePath,
      videoFileName: video.fileName,
      sku: video.sku,
      style: video.style,
      platformAccountId: account.id,
      platform: account.platform,
      accountName: account.accountName,
      titleId: title?.id ?? null,
      titleText: title?.text ?? null,
      tagGroup,
      tags: tagsForVideo(sources.tags, video, tagGroup),
      coverRelativePath: null,
      errorCode: null,
      errorMessage: null
    };
  });

  return { rows };
}
