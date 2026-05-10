/* global clearTimeout, console, fetch, process, setTimeout, WebSocket */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const electronBin = resolveElectronBinary();
const appRoot = path.join(repoRoot, "apps", "desktop");
const mainEntry = path.join(appRoot, "out", "main", "index.js");
const rendererEntry = path.join(appRoot, "out", "renderer", "index.html");
const auditRoot = await mkdtemp(path.join(tmpdir(), "roster-electron-performance-"));
const userDataDir = path.join(auditRoot, "user-data");
const workspaceRoot = path.join(auditRoot, "workspace");
const devtoolsPort = 9550 + Math.floor(Math.random() * 1000);
const thresholds = {
  listVideosMs: 1_000,
  listImagesMs: 500,
  taskGenerate100RowsMs: 3_000,
  scrollFrameAvgMs: 18,
  visibleRowsMax: 120
};
const rendererConsole = [];

function resolveElectronBinary() {
  if (process.platform === "win32") {
    const executablePath = path.join(repoRoot, "node_modules", "electron", "dist", "electron.exe");
    if (existsSync(executablePath)) {
      return executablePath;
    }
  }
  return path.join(repoRoot, "node_modules", ".bin", "electron");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function js(value) {
  return JSON.stringify(value);
}

async function waitFor(condition, label, timeoutMs = 15_000) {
  const startedAt = Date.now();
  let lastError;
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const result = await condition();
      if (result) {
        return result;
      }
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`${label} timed out${lastError instanceof Error ? `: ${lastError.message}` : ""}`);
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}`);
  }
  return response.json();
}

async function connectToRenderer() {
  const targets = await fetchJson(`http://127.0.0.1:${devtoolsPort}/json/list`);
  const pageTarget = targets.find((target) => target.type === "page" && target.webSocketDebuggerUrl);
  if (!pageTarget) {
    return null;
  }
  const socket = new WebSocket(pageTarget.webSocketDebuggerUrl);
  const pending = new Map();
  let nextId = 1;

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("DevTools websocket connection timed out")), 5_000);
    socket.addEventListener("open", () => {
      clearTimeout(timeout);
      resolve();
    });
    socket.addEventListener("error", () => {
      clearTimeout(timeout);
      reject(new Error("DevTools websocket connection failed"));
    });
  });

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data));
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) {
        reject(new Error(message.error.message));
      } else {
        resolve(message.result);
      }
      return;
    }
    if (message.method === "Runtime.consoleAPICalled") {
      rendererConsole.push({
        type: message.params.type,
        text: message.params.args.map((arg) => arg.value ?? arg.description ?? "").join(" ")
      });
    }
    if (message.method === "Runtime.exceptionThrown") {
      rendererConsole.push({
        type: "exception",
        text: message.params.exceptionDetails.text
      });
    }
  });

  function send(method, params = {}) {
    const id = nextId;
    nextId += 1;
    const promise = new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
    });
    socket.send(JSON.stringify({ id, method, params }));
    return promise;
  }

  await send("Runtime.enable");
  await send("Page.enable");
  return {
    send,
    close: () => socket.close()
  };
}

async function evaluate(client, expression, timeoutMs = 30_000) {
  const result = await client.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
    timeout: timeoutMs
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text);
  }
  return result.result.value;
}

function seedWorkspaceDatabase() {
  const db = new DatabaseSync(path.join(workspaceRoot, "workspace.db"));
  const timestamp = new Date().toISOString();
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("BEGIN IMMEDIATE;");
  try {
    const videoInsert = db.prepare(
      `INSERT INTO videos (
        id, relative_path, file_name, sku, style, duration_seconds, width, height,
        size_bytes, status, has_cover, used_count, metadata_error, last_scanned_at,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 0, 0, NULL, ?, ?, ?)`
    );
    for (let index = 0; index < 10_000; index += 1) {
      videoInsert.run(
        `perf-video-${index}`,
        `videos/SKU-${String(index).padStart(5, "0")}/style-${index % 20}/video-${index}.mp4`,
        `video-${index}.mp4`,
        `SKU-${String(index).padStart(5, "0")}`,
        `style-${index % 20}`,
        15,
        1080,
        1920,
        1024 * 1024,
        timestamp,
        timestamp,
        timestamp
      );
    }

    const titleInsert = db.prepare(
      "INSERT INTO titles (id, text, source_skill_id, score, use_count, status, notes, last_used_at, created_at, updated_at) VALUES (?, ?, NULL, ?, 0, 'active', NULL, NULL, ?, ?)"
    );
    for (let index = 0; index < 120; index += 1) {
      titleInsert.run(`perf-title-${index}`, `性能标题 ${index}`, 100 - (index % 30), timestamp, timestamp);
    }

    const tagInsert = db.prepare(
      "INSERT INTO tags (id, sku_code, sku_style, tag1, tag2, tag3, tag4, tag5, tag_group, use_count, notes, created_at, updated_at) VALUES (?, ?, '', ?, ?, ?, ?, ?, 'default', 0, NULL, ?, ?)"
    );
    for (let index = 0; index < 100; index += 1) {
      tagInsert.run(
        `perf-tag-${index}`,
        `SKU-${String(index).padStart(5, "0")}`,
        `#性能${index}`,
        "#本地",
        "#Electron",
        "#任务单",
        "#验证",
        timestamp,
        timestamp
      );
    }

    const accountInsert = db.prepare(
      "INSERT INTO platform_accounts (id, platform, account_name, enabled, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)"
    );
    for (let index = 0; index < 4; index += 1) {
      accountInsert.run(
        `perf-account-${index}`,
        ["抖音", "视频号", "小红书", "快手"][index],
        `性能账号 ${index + 1}`,
        timestamp,
        timestamp
      );
    }

    const imageInsert = db.prepare(
      `INSERT INTO images (
        id, prompt_id, relative_path, file_name, scene, width, height, aspect_ratio,
        source_model, status, tags, notes, generated_at, created_at, updated_at
      ) VALUES (?, NULL, ?, ?, '主图', 1024, 1365, '3:4', 'mock-image', 'active', NULL, NULL, ?, ?, ?)`
    );
    for (let index = 0; index < 500; index += 1) {
      imageInsert.run(
        `perf-image-${index}`,
        `images/main/perf-${index}.jpg`,
        `perf-${index}.jpg`,
        timestamp,
        timestamp,
        timestamp
      );
    }

    db.exec("COMMIT;");
  } catch (error) {
    db.exec("ROLLBACK;");
    throw error;
  } finally {
    db.close();
  }
}

async function main() {
  assert(existsSync(mainEntry), "Electron main bundle missing; run npm run build first");
  assert(existsSync(rendererEntry), "Electron renderer bundle missing; run npm run build first");
  await mkdir(userDataDir, { recursive: true });
  await mkdir(workspaceRoot, { recursive: true });

  const electron = spawn(electronBin, [`--remote-debugging-port=${devtoolsPort}`, appRoot], {
    cwd: repoRoot,
    env: {
      ...process.env,
      ROSTER_E2E: "1",
      ROSTER_USER_DATA_DIR: userDataDir,
      ELECTRON_ENABLE_LOGGING: "1"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  const mainOutput = [];
  electron.stdout.on("data", (chunk) => mainOutput.push(String(chunk)));
  electron.stderr.on("data", (chunk) => mainOutput.push(String(chunk)));

  let client;
  try {
    client = await waitFor(connectToRenderer, "Electron renderer target", 20_000).catch((error) => {
      throw new Error(`${error instanceof Error ? error.message : String(error)}\nElectron output:\n${mainOutput.join("").slice(-4_000)}`);
    });
    await waitFor(
      () => evaluate(client, "Boolean(window.roster && window.__ROSTER_STORE__ && document.body.innerText.trim().length > 0)"),
      "Electron app window and preload API",
      20_000
    );

    const probe = await evaluate(
      client,
      `({
        hasRoster: Boolean(window.roster),
        hasNodeRequire: typeof window.require !== "undefined",
        hasProcess: typeof window.process !== "undefined",
        bodyText: document.body.innerText.slice(0, 100)
      })`
    );
    assert(probe.hasRoster, "preload contextBridge API missing");
    assert(!probe.hasNodeRequire, "renderer exposes Node require");
    assert(!probe.hasProcess, "renderer exposes process");
    assert(probe.bodyText.length > 0, "renderer body is blank");

    await evaluate(
      client,
      `window.roster.createWorkspace({
        name: "性能验证品牌",
        rootPath: ${js(workspaceRoot)},
        macRootPath: ${js(workspaceRoot)},
        winRootPath: "D:\\\\RosterPerformance"
      })`
    );
    seedWorkspaceDatabase();
    await evaluate(client, "window.__ROSTER_STORE__.getState().loadBootstrap()");

    const metrics = {};
    metrics.listVideosMs = await evaluate(
      client,
      `performance.mark("listVideos-start");
       window.roster.listVideos().then((videos) => {
         performance.mark("listVideos-end");
         performance.measure("listVideos", "listVideos-start", "listVideos-end");
         if (videos.length !== 10000) throw new Error("expected 10000 videos, got " + videos.length);
         return performance.getEntriesByName("listVideos").at(-1).duration;
       })`
    );
    assert(metrics.listVideosMs <= thresholds.listVideosMs, `listVideos exceeded threshold: ${metrics.listVideosMs}ms`);

    await evaluate(client, "window.__ROSTER_STORE__.setState({ page: 'lib_videos' })");
    await waitFor(() => evaluate(client, "document.querySelectorAll('[data-video-row]').length > 0"), "video library rows", 20_000);
    metrics.videoVisibleRows = await evaluate(client, "document.querySelectorAll('[data-video-row]').length");
    assert(metrics.videoVisibleRows <= thresholds.visibleRowsMax, `video visible rows not bounded: ${metrics.videoVisibleRows}`);
    metrics.videoScrollFrameAvgMs = await evaluate(
      client,
      `new Promise((resolve) => {
        const scroller = document.querySelector('[data-video-row]')?.parentElement?.parentElement;
        if (!scroller) throw new Error("video scroller missing");
        const deltas = [];
        let previous = performance.now();
        let step = 0;
        const tick = () => {
          const now = performance.now();
          if (step > 0) deltas.push(now - previous);
          previous = now;
          scroller.scrollTop = step * 720;
          step += 1;
          if (step <= 30) {
            requestAnimationFrame(tick);
          } else {
            resolve(deltas.reduce((sum, value) => sum + value, 0) / deltas.length);
          }
        };
        requestAnimationFrame(tick);
      })`
    );
    assert(metrics.videoScrollFrameAvgMs <= thresholds.scrollFrameAvgMs, `video scroll frame average too high: ${metrics.videoScrollFrameAvgMs}ms`);

    metrics.listImagesMs = await evaluate(
      client,
      `performance.mark("listImages-start");
       window.roster.listImages().then((images) => {
         performance.mark("listImages-end");
         performance.measure("listImages", "listImages-start", "listImages-end");
         if (images.length !== 500) throw new Error("expected 500 images, got " + images.length);
         return performance.getEntriesByName("listImages").at(-1).duration;
       })`
    );
    assert(metrics.listImagesMs <= thresholds.listImagesMs, `listImages exceeded threshold: ${metrics.listImagesMs}ms`);

    await evaluate(client, "window.__ROSTER_STORE__.setState({ page: 'lib_images' })");
    await waitFor(() => evaluate(client, "document.querySelectorAll('[data-image-row]').length > 0"), "image library rows", 20_000);
    metrics.imageVisibleRows = await evaluate(client, "document.querySelectorAll('[data-image-row]').length");
    assert(metrics.imageVisibleRows <= thresholds.visibleRowsMax, `image visible rows not bounded: ${metrics.imageVisibleRows}`);
    metrics.imageScrollFrameAvgMs = await evaluate(
      client,
      `new Promise((resolve) => {
        const scroller = document.querySelector('[data-image-row]')?.parentElement?.parentElement;
        if (!scroller) throw new Error("image scroller missing");
        const deltas = [];
        let previous = performance.now();
        let step = 0;
        const tick = () => {
          const now = performance.now();
          if (step > 0) deltas.push(now - previous);
          previous = now;
          scroller.scrollTop = step * 360;
          step += 1;
          if (step <= 30) {
            requestAnimationFrame(tick);
          } else {
            resolve(deltas.reduce((sum, value) => sum + value, 0) / deltas.length);
          }
        };
        requestAnimationFrame(tick);
      })`
    );
    assert(metrics.imageScrollFrameAvgMs <= thresholds.scrollFrameAvgMs, `image scroll frame average too high: ${metrics.imageScrollFrameAvgMs}ms`);

    await evaluate(client, "window.__ROSTER_STORE__.setState({ page: 'tasks' })");
    await waitFor(() => evaluate(client, "document.body.innerText.includes('性能账号 1')"), "task page seeded accounts", 20_000);
    const taskSheetDate = await evaluate(client, `document.querySelector('input[aria-label="任务日期"]')?.value`);
    assert(/^\d{4}-\d{2}-\d{2}$/.test(taskSheetDate), `task sheet date input invalid: ${taskSheetDate}`);
    metrics.taskGenerate100RowsMs = await evaluate(
      client,
      `performance.mark("generateTaskSheet-start");
       window.roster.generateTaskSheet({
         sheetDate: ${js(taskSheetDate)},
         videoCount: 25,
         platformAccountIds: ["perf-account-0", "perf-account-1", "perf-account-2", "perf-account-3"],
         videoStrategy: "low_publish",
         titleStrategy: "best_score",
         defaultTagRatio: 80,
         timeAnchors: ["09:00", "12:00", "15:00"],
         jitterMinutes: 0
       }).then((sheet) => {
         performance.mark("generateTaskSheet-end");
         performance.measure("generateTaskSheet100", "generateTaskSheet-start", "generateTaskSheet-end");
         if (sheet.rows.length !== 100) throw new Error("expected 100 task rows, got " + sheet.rows.length);
         return performance.getEntriesByName("generateTaskSheet100").at(-1).duration;
       })`,
      30_000
    );
    assert(
      metrics.taskGenerate100RowsMs <= thresholds.taskGenerate100RowsMs,
      `100-row task generation exceeded threshold: ${metrics.taskGenerate100RowsMs}ms`
    );
    await evaluate(client, "window.__ROSTER_STORE__.setState({ page: 'dashboard' })");
    await evaluate(client, "window.__ROSTER_STORE__.setState({ page: 'tasks' })");
    await evaluate(
      client,
      `Array.from(document.querySelectorAll("button")).find((button) => button.innerText.includes("刷新"))?.click()`
    );
    await waitFor(() => evaluate(client, "document.querySelectorAll('[data-task-row]').length > 0"), "task rows after generation", 20_000);
    metrics.taskVisibleRows = await evaluate(client, "document.querySelectorAll('[data-task-row]').length");
    assert(metrics.taskVisibleRows <= thresholds.visibleRowsMax, `task visible rows not bounded: ${metrics.taskVisibleRows}`);

    const fatalConsole = rendererConsole.filter((entry) => entry.type === "error" || entry.type === "exception");
    assert(fatalConsole.length === 0, `renderer emitted fatal console errors: ${JSON.stringify(fatalConsole)}`);
    assert(!mainOutput.some((line) => /App bootstrap failed|Unhandled|uncaught/i.test(line)), "main process emitted fatal output");

    console.log(
      JSON.stringify(
        {
          ok: true,
          auditRoot,
          workspaceRoot,
          thresholds,
          metrics
        },
        null,
        2
      )
    );
  } finally {
    client?.close();
    electron.kill("SIGTERM");
    await new Promise((resolve) => {
      const timeout = setTimeout(resolve, 2_000);
      electron.once("exit", () => {
        clearTimeout(timeout);
        resolve();
      });
    });
    if (process.env.ROSTER_KEEP_E2E_ARTIFACTS !== "1") {
      await rm(auditRoot, { recursive: true, force: true });
    }
  }
}

main().catch(async (error) => {
  await rm(auditRoot, { recursive: true, force: true });
  console.error(error);
  process.exit(1);
});
