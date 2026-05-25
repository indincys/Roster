/* global Buffer, clearTimeout, console, fetch, process, setTimeout, WebSocket */

// Full real-Electron desktop audit for current M1-M7 critical flows.
// This began as an M1-M3 verification repair, but is now the canonical
// desktop acceptance entry used by `npm run test:e2e:electron`.

import { spawn } from "node:child_process";
import crypto from "node:crypto";
import extractZip from "extract-zip";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { DatabaseSync } from "node:sqlite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const electronBin = resolveElectronBinary();
const appRoot = path.join(repoRoot, "apps", "desktop");
const mainEntry = path.join(appRoot, "out", "main", "index.js");
const rendererEntry = path.join(appRoot, "out", "renderer", "index.html");
const requiredWorkspaceDirs = ["videos", "covers", "images", "tasks", "skills_config", "_backup"];
const auditRoot = await mkdtemp(path.join(tmpdir(), "roster-electron-audit-"));
const userDataDir = path.join(auditRoot, "user-data");
const workspaceRoot = path.join(auditRoot, "workspace");
const marketRepoRoot = path.join(auditRoot, "market-repo");
const marketManifestUrl = pathToFileURL(path.join(marketRepoRoot, "manifest.json")).toString();
const updateManifestPath = path.join(auditRoot, "update-manifest.json");
const updateManifestUrl = pathToFileURL(updateManifestPath).toString();
const devtoolsPort = 9339 + Math.floor(Math.random() * 1000);
const minimumVisibleWindowWidth = process.platform === "win32" ? 1024 : 1120;
const failures = [];
const rendererConsole = [];
let sheetDate = "";

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

function formatMainOutput(lines) {
  const text = lines.join("").trim();
  return text ? `\nElectron output:\n${text.slice(-4_000)}` : "";
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
      const details = message.params.exceptionDetails;
      rendererConsole.push({
        type: "exception",
        text: [
          details.text,
          details.exception?.description ?? details.exception?.value ?? "",
          details.url ? `${details.url}:${details.lineNumber}:${details.columnNumber}` : "",
          details.stackTrace?.callFrames
            ?.slice(0, 5)
            .map((frame) => `${frame.functionName || "<anonymous>"}@${frame.url}:${frame.lineNumber}:${frame.columnNumber}`)
            .join("\n") ?? ""
        ]
          .filter(Boolean)
          .join("\n")
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
    targetId: pageTarget.id,
    send,
    close: () => socket.close()
  };
}

async function evaluate(client, expression, timeoutMs = 20_000) {
  const result = await client.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
    timeout: timeoutMs
  });
  if (result.exceptionDetails) {
    const details = result.exceptionDetails;
    throw new Error(
      [
        details.text,
        details.exception?.description ?? details.exception?.value ?? "",
        details.url ? `${details.url}:${details.lineNumber}:${details.columnNumber}` : ""
      ]
        .filter(Boolean)
        .join("\n")
    );
  }
  return result.result.value;
}

function js(value) {
  return JSON.stringify(value);
}

function sha256(value) {
  return crypto.createHash("sha256").update(Buffer.from(value, "utf8")).digest("hex");
}

function previousDate(value) {
  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() - 1);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function openWorkspaceDb() {
  return new DatabaseSync(path.join(workspaceRoot, "workspace.db"), { readOnly: true });
}

async function seedWorkspaceVideos() {
  for (let index = 0; index < 5; index += 1) {
    const videoDir = path.join(workspaceRoot, "videos", `SKU-${index}`);
    await mkdir(videoDir, { recursive: true });
    await writeFile(path.join(videoDir, `video-${index}.mp4`), `video-${index}`);
  }
}

async function writeStatusFile(row, status, fileName = `${row.runKey}.json`) {
  const statusDir = path.join(workspaceRoot, "tasks", sheetDate, "status");
  await mkdir(statusDir, { recursive: true });
  await writeFile(
    path.join(statusDir, fileName),
    `${JSON.stringify({
      schema_version: 1,
      task_id: row.id,
      attempt_no: row.attemptNo,
      run_key: row.runKey,
      status,
      executed_at: `${sheetDate}T09:05:00.000Z`,
      error_code: status === "failed" ? "RPA_FAILED" : null,
      error_message: status === "failed" ? "模拟失败" : null,
      writer: "electron-e2e"
    })}\n`
  );
}

async function writeMarketSkill(repoRootPath, skillName, version, skillContent, hashOverride = null) {
  const skillRoot = path.join(repoRootPath, "skills", skillName);
  const metaContent = `${JSON.stringify(
    {
      id: skillName,
      displayName: "市场标题 Skill",
      type: "title",
      sourceType: "official",
      version
    },
    null,
    2
  )}\n`;
  await mkdir(skillRoot, { recursive: true });
  await writeFile(path.join(skillRoot, "meta.json"), metaContent, "utf8");
  await writeFile(path.join(skillRoot, "SKILL.md"), skillContent, "utf8");
  await writeFile(
    path.join(repoRootPath, "manifest.json"),
    `${JSON.stringify(
      {
        manifest_version: 1,
        updated_at: new Date().toISOString(),
        skills: [
          {
            name: skillName,
            display_name: "市场标题 Skill",
            type: "title",
            version,
            description: `Electron e2e market skill ${version}`,
            supported_models: ["mock-fast"],
            files: [
              { path: "meta.json", sha256: sha256(metaContent) },
              { path: "SKILL.md", sha256: hashOverride ?? sha256(skillContent) }
            ]
          }
        ]
      },
      null,
      2
    )}\n`,
    "utf8"
  );
}

async function main() {
  assert(existsSync(mainEntry), "Electron main bundle missing; run npm run build first");
  assert(existsSync(rendererEntry), "Electron renderer bundle missing; run npm run build first");
  await mkdir(userDataDir, { recursive: true });
  await mkdir(workspaceRoot, { recursive: true });
  await writeMarketSkill(marketRepoRoot, "market_title_skill", "1.0.0", "# 市场标题 Skill v1\n");
  await writeFile(
    updateManifestPath,
    `${JSON.stringify(
      {
        version: "0.2.2",
        releaseNotes: "Electron e2e update manifest",
        downloadUrl: "https://example.invalid/roster/0.2.2"
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  const electron = spawn(
    electronBin,
    [`--remote-debugging-port=${devtoolsPort}`, appRoot],
    {
      cwd: repoRoot,
      env: {
        ...process.env,
        ROSTER_E2E: "1",
        ROSTER_USER_DATA_DIR: userDataDir,
        ROSTER_SKILL_MARKET_MANIFEST_URL: marketManifestUrl,
        ROSTER_UPDATE_MANIFEST_URL: updateManifestUrl,
        ROSTER_MOCK_LLM_CHUNK_DELAY_MS: "35",
        ELECTRON_ENABLE_LOGGING: "1"
      },
      stdio: ["ignore", "pipe", "pipe"]
    }
  );

  const mainOutput = [];
  electron.stdout.on("data", (chunk) => mainOutput.push(String(chunk)));
  electron.stderr.on("data", (chunk) => mainOutput.push(String(chunk)));

  let client;
  let cleanupFailure = null;
  try {
    client = await waitFor(connectToRenderer, "Electron renderer target", 20_000).catch((error) => {
      throw new Error(`${error instanceof Error ? error.message : String(error)}${formatMainOutput(mainOutput)}`);
    });
    await waitFor(
      () => evaluate(client, "Boolean(window.roster && document.body && document.body.innerText.trim().length > 0)"),
      "Electron app window and preload API",
      20_000
    ).catch(async (error) => {
      const probe = await evaluate(
        client,
        `({
          location: window.location.href,
          title: document.title,
          hasRoster: Boolean(window.roster),
          readyState: document.readyState,
          bodyText: document.body ? document.body.innerText.slice(0, 500) : null
        })`
      ).catch((probeError) => ({ probeError: probeError instanceof Error ? probeError.message : String(probeError) }));
      throw new Error(`${error instanceof Error ? error.message : String(error)}\nProbe: ${JSON.stringify(probe, null, 2)}${formatMainOutput(mainOutput)}`);
    });

    const initialProbe = await evaluate(
      client,
      `({
        hasRoster: Boolean(window.roster),
        hasNodeRequire: typeof window.require !== "undefined",
        hasProcess: typeof window.process !== "undefined",
        bodyText: document.body.innerText.slice(0, 200)
      })`
    );
    assert(initialProbe.hasRoster, "preload contextBridge API missing");
    assert(!initialProbe.hasNodeRequire, "renderer exposes Node require");
    assert(!initialProbe.hasProcess, "renderer exposes process");
    assert(initialProbe.bodyText.length > 0, "renderer body is blank");
    const electronWindowMetrics = await evaluate(
      client,
      `({
        outerWidth: window.outerWidth,
        outerHeight: window.outerHeight,
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        visibilityState: document.visibilityState,
        location: window.location.href
      })`
    );
    assert(electronWindowMetrics.visibilityState === "visible", `Electron window is not visible: ${electronWindowMetrics.visibilityState}`);
    assert(
      electronWindowMetrics.outerWidth >= minimumVisibleWindowWidth,
      `Electron window width invalid: ${electronWindowMetrics.outerWidth}`
    );
    assert(electronWindowMetrics.outerHeight >= 720, `Electron window height invalid: ${electronWindowMetrics.outerHeight}`);

    await evaluate(
      client,
      `window.roster.createWorkspace({
        name: "电商审计品牌",
        rootPath: ${js(workspaceRoot)},
        macRootPath: ${js(workspaceRoot)},
        winRootPath: "D:\\\\RosterAudit"
      })`
    );
    await evaluate(client, "window.__ROSTER_STORE__.getState().loadBootstrap()");
    for (const directory of requiredWorkspaceDirs) {
      assert((await stat(path.join(workspaceRoot, directory))).isDirectory(), `workspace directory missing: ${directory}`);
    }
    assert(existsSync(path.join(workspaceRoot, "workspace.db")), "workspace.db missing");
    assert(existsSync(path.join(workspaceRoot, "skills_config", "activation.json")), "activation.json missing");

    await seedWorkspaceVideos();
    const scanSummary = await evaluate(client, "window.roster.scanVideos()");
    assert(scanSummary.added === 5, `expected 5 scanned videos, got ${JSON.stringify(scanSummary)}`);
    const videos = await evaluate(client, "window.roster.listVideos()");
    assert(videos.length === 5, "video library did not load through preload IPC");
    assert(videos.every((video) => video.currentAbsolutePath.startsWith(workspaceRoot)), "video runtime paths not mapped to current device");

    await evaluate(client, "window.__ROSTER_STORE__.setState({ page: 'lib_videos' })");
    await waitFor(
      () => evaluate(client, `document.querySelector('[data-video-row]') !== null && document.querySelector('[data-video-filter-cover]') !== null`),
      "real video library page",
      10_000
    );
    await evaluate(
      client,
      `(() => {
        const cover = document.querySelector('[data-video-filter-cover]');
        const sort = document.querySelector('[data-video-sort]');
        const selectSetter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set;
        selectSetter.call(cover, "without");
        cover.dispatchEvent(new Event("change", { bubbles: true }));
        selectSetter.call(sort, "used_asc");
        sort.dispatchEvent(new Event("change", { bubbles: true }));
      })()`
    );
    await waitFor(
      () => evaluate(client, `document.querySelectorAll('[data-video-row]').length >= 2`),
      "video library filtered no-cover rows",
      10_000
    );
    const selectedVideoIdsForBatch = videos.slice(0, 2).map((video) => video.id);
    await evaluate(
      client,
      `(() => {
        for (const id of ${js(selectedVideoIdsForBatch)}) {
          document.querySelector('[data-video-select="' + id + '"]')?.click();
        }
        const setInput = (selector, value) => {
          const input = document.querySelector(selector);
          const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
          setter.call(input, value);
          input.dispatchEvent(new Event("input", { bubbles: true }));
        };
        setInput('[data-video-batch-sku]', 'SKU-E2E-BATCH');
        setInput('[data-video-batch-style]', '批量款式');
        document.querySelector('[data-video-batch-apply]').click();
      })()`
    );
    await waitFor(
      () => evaluate(client, `document.body.innerText.includes("SKU-E2E-BATCH") && document.body.innerText.includes("批量款式")`),
      "video library batch sku/style update",
      10_000
    );
    const videosAfterBatchMetadata = await evaluate(client, "window.roster.listVideos()");
    for (const videoId of selectedVideoIdsForBatch) {
      const updated = videosAfterBatchMetadata.find((video) => video.id === videoId);
      assert(updated?.sku === "SKU-E2E-BATCH" && updated.style === "批量款式", "video batch metadata update did not persist through IPC");
    }
    await evaluate(client, `document.querySelector('[data-video-go-covers]').click()`);
    await waitFor(
      () => evaluate(client, `document.querySelector('[data-cover-workspace]') !== null`),
      "video library go to cover workspace action",
      10_000
    );
    await evaluate(client, "window.__ROSTER_STORE__.setState({ page: 'lib_videos' })");
    await waitFor(
      () => evaluate(client, `document.querySelector('[data-video-filter-cover]') !== null`),
      "video library after cover navigation",
      10_000
    );
    await evaluate(
      client,
      `(() => {
        for (const id of ${js(selectedVideoIdsForBatch)}) {
          const checkbox = document.querySelector('[data-video-select="' + id + '"]');
          if (checkbox && !checkbox.checked) checkbox.click();
        }
        document.querySelector('[data-video-batch-archive]').click();
      })()`
    );
    await waitFor(
      () => evaluate(client, `document.body.innerText.includes("已归档")`),
      "video library batch archive status visible",
      10_000
    );
    const videosAfterBatchArchive = await evaluate(client, "window.roster.listVideos()");
    for (const videoId of selectedVideoIdsForBatch) {
      const archived = videosAfterBatchArchive.find((video) => video.id === videoId);
      assert(archived?.status === "archived", "video batch archive did not persist status");
      assert(existsSync(path.join(workspaceRoot, archived.relativePath)), "video batch archive deleted the source file");
    }
    await evaluate(
      client,
      `window.roster.batchUpdateVideos({ videoIds: ${js(selectedVideoIdsForBatch)}, status: "active" })`
    );

    await evaluate(client, "window.__ROSTER_STORE__.setState({ page: 'skills' })");
    await waitFor(
      () => evaluate(client, "document.querySelector('[data-skill-center]') !== null"),
      "real Skill Center page",
      10_000
    );
    await evaluate(
      client,
      `(() => {
        document.querySelector('[data-new-skill]').click();
        const setInput = (selector, value) => {
          const input = document.querySelector(selector);
          const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
          setter.call(input, value);
          input.dispatchEvent(new Event("input", { bubbles: true }));
        };
        setInput('[data-skill-name-input]', 'Electron 标题 Skill');
        const editor = document.querySelector('[data-skill-content-editor]');
        const editorSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
        editorSetter.call(editor, '# 角色\\n你是标题专家。\\n{{include: brand_info.md}}\\n');
        editor.dispatchEvent(new Event("input", { bubbles: true }));
        document.querySelector('[data-save-skill]').click();
      })()`
    );
    await waitFor(
      () => evaluate(client, `document.querySelector('[data-skill-row="title-01"]') !== null`),
      "Skill saved through real Skill Center UI",
      10_000
    );
    await evaluate(client, `document.querySelector('[data-toggle-skill-enabled]').click()`);
    await waitFor(
      () => evaluate(client, `document.querySelector('[data-enabled-skill="title-01"]') !== null`),
      "Skill enabled through real Skill Center UI",
      10_000
    );
    await evaluate(
      client,
      `(() => {
        document.querySelector('[data-new-skill]').click();
        const setInput = (selector, value) => {
          const input = document.querySelector(selector);
          const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
          setter.call(input, value);
          input.dispatchEvent(new Event("input", { bubbles: true }));
        };
        setInput('[data-skill-name-input]', 'Electron 文案 Skill');
        const select = document.querySelector('[data-skill-type-select]');
        const selectSetter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set;
        selectSetter.call(select, 'script');
        select.dispatchEvent(new Event("change", { bubbles: true }));
        const editor = document.querySelector('[data-skill-content-editor]');
        const editorSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
        editorSetter.call(editor, '# 角色\\n你是短视频口播文案策划。\\n要求输出开场、卖点、口播、转化。\\n');
        editor.dispatchEvent(new Event("input", { bubbles: true }));
        document.querySelector('[data-save-skill]').click();
      })()`
    );
    await waitFor(
      () => evaluate(client, `document.querySelector('[data-skill-row="script-01"]') !== null`),
      "script Skill saved through real Skill Center UI",
      10_000
    );
    await evaluate(client, `document.querySelector('[data-skill-row="script-01"]').click()`);
    await waitFor(
      () => evaluate(client, `document.querySelector('[data-toggle-skill-enabled]') !== null && document.body.innerText.includes("Electron 文案 Skill")`),
      "script Skill selected in real Skill Center UI",
      10_000
    );
    await evaluate(client, `document.querySelector('[data-toggle-skill-enabled]').click()`);
    await waitFor(
      () => evaluate(client, `document.querySelector('[data-enabled-skill="script-01"]') !== null`),
      "script Skill enabled through real Skill Center UI",
      10_000
    );
    await evaluate(
      client,
      `(() => {
        document.querySelector('[data-new-skill]').click();
        const setInput = (selector, value) => {
          const input = document.querySelector(selector);
          const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
          setter.call(input, value);
          input.dispatchEvent(new Event("input", { bubbles: true }));
        };
        setInput('[data-skill-name-input]', 'Electron 图片提示词 Skill');
        const select = document.querySelector('[data-skill-type-select]');
        const selectSetter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set;
        selectSetter.call(select, 'image_prompt');
        select.dispatchEvent(new Event("change", { bubbles: true }));
        const editor = document.querySelector('[data-skill-content-editor]');
        const editorSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
        editorSetter.call(editor, '# 图片提示词规则\\n输出适合商品图模型的中文提示词。\\n必须包含“商品主体清晰”和“自然光”。\\n');
        editor.dispatchEvent(new Event("input", { bubbles: true }));
        document.querySelector('[data-save-skill]').click();
      })()`
    );
    await waitFor(
      () => evaluate(client, `document.querySelector('[data-skill-row="image-prompt-01"]') !== null`),
      "image prompt Skill saved through real Skill Center UI",
      10_000
    );
    await evaluate(client, `document.querySelector('[data-skill-row="image-prompt-01"]').click()`);
    await waitFor(
      () => evaluate(client, `document.querySelector('[data-toggle-skill-enabled]') !== null && document.body.innerText.includes("Electron 图片提示词 Skill")`),
      "image prompt Skill selected in real Skill Center UI",
      10_000
    );
    await evaluate(client, `document.querySelector('[data-toggle-skill-enabled]').click()`);
    await waitFor(
      () => evaluate(client, `document.querySelector('[data-enabled-skill="image-prompt-01"]') !== null`),
      "image prompt Skill enabled through real Skill Center UI",
      10_000
    );
    await evaluate(client, `document.querySelector('[data-skill-row="title-01"]').click()`);
    await waitFor(
      () => evaluate(client, `document.body.innerText.includes("Electron 标题 Skill") && document.querySelector('[data-skill-row="title-01"]') !== null`),
      "title Skill reselected after script Skill setup",
      10_000
    );
    const skillRoot = path.join(userDataDir, "skills", "user", "title-01");
    assert(existsSync(path.join(skillRoot, "meta.json")), "Skill meta.json missing after UI save");
    assert(existsSync(path.join(skillRoot, "SKILL.md")), "Skill SKILL.md missing after UI save");
    const activationJson = JSON.parse(await readFile(path.join(workspaceRoot, "skills_config", "activation.json"), "utf8"));
    assert(
      activationJson.enabledSkillIds.includes("title-01"),
      "Skill activation file did not include UI-enabled Skill"
    );

    await evaluate(client, "window.__ROSTER_STORE__.setState({ page: 'settings' })");
    await waitFor(
      () => evaluate(client, `document.querySelector('[data-save-api-key]') !== null`),
      "settings API key form visible before AI workflow audit",
      10_000
    );
    await evaluate(
      client,
      `(() => {
        const setInput = (selector, value) => {
          const input = document.querySelector(selector);
          const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
          setter.call(input, value);
          input.dispatchEvent(new Event("input", { bubbles: true }));
        };
        setInput('[data-model-vendor]', 'Mock 本地测试');
        setInput('[data-model-id]', 'mock-title-fast');
        setInput('[data-provider-config-base-url]', '');
        setInput('[data-api-key-value]', 'mock-provider-key-title');
        document.querySelector('[data-save-api-key]').click();
      })()`
    );
    await waitFor(
      () => evaluate(client, `document.body.innerText.includes("API 已保存，连接测试成功") && document.body.innerText.includes("mock-title-fast")`),
      "mock title API key saved before AI workflow audit",
      10_000
    );
    await evaluate(
      client,
      `(() => {
        const setInput = (selector, value) => {
          const input = document.querySelector(selector);
          const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
          setter.call(input, value);
          input.dispatchEvent(new Event("input", { bubbles: true }));
        };
        setInput('[data-model-vendor]', 'Mock 本地测试');
        setInput('[data-model-id]', 'mock-title-balanced');
        setInput('[data-api-key-value]', 'mock-provider-key-balanced');
        document.querySelector('[data-save-api-key]').click();
      })()`
    );
    await waitFor(
      () => evaluate(client, `document.body.innerText.includes("API 已保存，连接测试成功") && document.body.innerText.includes("mock-title-balanced")`),
      "second mock API key saved before AI workflow audit",
      10_000
    );
    await evaluate(
      client,
      `(() => {
        const setInput = (selector, value) => {
          const input = document.querySelector(selector);
          const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
          setter.call(input, value);
          input.dispatchEvent(new Event("input", { bubbles: true }));
        };
        setInput('[data-model-vendor]', 'Mock 本地测试');
        setInput('[data-model-id]', 'mock-script-fast');
        setInput('[data-api-key-value]', 'mock-provider-key-script-fast');
        document.querySelector('[data-save-api-key]').click();
      })()`
    );
    await waitFor(
      () => evaluate(client, `document.body.innerText.includes("API 已保存，连接测试成功") && document.body.innerText.includes("mock-script-fast")`),
      "mock script API key saved before AI workflow audit",
      10_000
    );
    await evaluate(
      client,
      `(() => {
        const setInput = (selector, value) => {
          const input = document.querySelector(selector);
          const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
          setter.call(input, value);
          input.dispatchEvent(new Event("input", { bubbles: true }));
        };
        setInput('[data-model-vendor]', 'Mock 本地测试');
        setInput('[data-model-id]', 'mock-script-balanced');
        setInput('[data-api-key-value]', 'mock-provider-key-script-balanced');
        document.querySelector('[data-save-api-key]').click();
      })()`
    );
    await waitFor(
      () => evaluate(client, `document.body.innerText.includes("API 已保存，连接测试成功") && document.body.innerText.includes("mock-script-balanced")`),
      "second mock script API key saved before AI workflow audit",
      10_000
    );
    await evaluate(client, "window.__ROSTER_STORE__.setState({ page: 'skills' })");
    await waitFor(
      () => evaluate(client, `document.querySelector('[data-skill-center]') !== null`),
      "Skill Center restored after API key setup",
      10_000
    );

    await evaluate(client, "window.__ROSTER_STORE__.setState({ page: 'market' })");
    await waitFor(
      () => evaluate(client, `document.querySelector('[data-skill-market]') !== null`),
      "real Skill Market page",
      10_000
    );
    await evaluate(
      client,
      `(() => {
        const input = document.querySelector('[data-skill-market-url]');
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
        setter.call(input, ${js(marketManifestUrl)});
        input.dispatchEvent(new Event("input", { bubbles: true }));
        document.querySelector('[data-refresh-skill-market]').click();
      })()`
    );
    await waitFor(
      () => evaluate(client, `document.querySelector('[data-market-skill="market_title_skill"]') !== null`),
      "Skill Market manifest loaded in real UI",
      10_000
    );
    await evaluate(client, `document.querySelector('[data-install-market-skill="market_title_skill"]').click()`);
    await waitFor(
      () => evaluate(client, `document.body.innerText.includes("已安装 市场标题 Skill v1.0.0")`),
      "official Skill installed through real Skill Market UI",
      10_000
    );
    const installedMarketSkillPath = path.join(userDataDir, "skills", "official", "market_title_skill");
    assert(existsSync(path.join(installedMarketSkillPath, "SKILL.md")), "market official Skill file missing after install");
    assert(existsSync(path.join(installedMarketSkillPath, "meta.json")), "market official Skill meta missing after install");

    await evaluate(client, "window.__ROSTER_STORE__.setState({ page: 'skills' })");
    await waitFor(
      () => evaluate(client, `document.querySelector('[data-skill-center]') !== null`),
      "Skill Center after market official install",
      10_000
    );
    await waitFor(
      () => evaluate(client, `document.querySelector('[data-skill-row="market_title_skill"]') !== null`),
      "market-installed official Skill appears in Skill Center before copy",
      10_000
    );
    await evaluate(client, `document.querySelector('[data-skill-row="market_title_skill"]').click()`);
    await waitFor(
      () => evaluate(client, `document.querySelector('[data-create-official-skill-copy]') !== null`),
      "official Skill copy action visible",
      10_000
    );
    await evaluate(client, `document.querySelector('[data-create-official-skill-copy]').click()`);
    await waitFor(
      () => evaluate(client, `document.body.innerText.includes("已创建官方副本") && document.querySelector('[data-skill-row="market_title_skill-copy"]') !== null`),
      "official Skill copy created through real UI",
      10_000
    );
    const marketCopyPath = path.join(userDataDir, "skills", "user", "market_title_skill-copy");
    assert(existsSync(path.join(marketCopyPath, ".origin", "base", "SKILL.md")), "official copy base snapshot missing");
    await evaluate(
      client,
      `(() => {
        const editor = document.querySelector('[data-skill-content-editor]');
        const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
        setter.call(editor, '# 用户改写副本\\n');
        editor.dispatchEvent(new Event("input", { bubbles: true }));
        document.querySelector('[data-save-skill]').click();
      })()`
    );
    await waitFor(
      () => evaluate(client, `document.body.innerText.includes("已保存 Skill")`),
      "official copy user edit saved through real UI",
      10_000
    );

    await evaluate(client, "window.__ROSTER_STORE__.setState({ page: 'market' })");
    await waitFor(
      () => evaluate(client, `document.querySelector('[data-skill-market]') !== null && document.querySelector('[data-refresh-skill-market]') !== null`),
      "Skill Market page remounted before official upgrade",
      10_000
    );
    await writeMarketSkill(marketRepoRoot, "market_title_skill", "1.1.0", "# 市场标题 Skill v2\n");
    await evaluate(
      client,
      `(() => {
        const input = document.querySelector('[data-skill-market-url]');
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
        setter.call(input, ${js(marketManifestUrl)});
        input.dispatchEvent(new Event("input", { bubbles: true }));
      })()`
    );
    await evaluate(client, `document.querySelector('[data-refresh-skill-market]').click()`);
    await waitFor(
      () => evaluate(client, `document.body.innerText.includes("可升级")`),
      "Skill Market shows update available",
      10_000
    );
    await evaluate(client, `document.querySelector('[data-install-market-skill="market_title_skill"]').click()`);
    await waitFor(
      () => evaluate(client, `document.body.innerText.includes("已升级 市场标题 Skill v1.1.0")`),
      "official Skill upgraded through real Skill Market UI",
      10_000
    );
    const upgradedMarketMeta = JSON.parse(await readFile(path.join(installedMarketSkillPath, "meta.json"), "utf8"));
    assert(upgradedMarketMeta.version === "1.1.0", "market official Skill version did not upgrade on disk");
    assert((await readFile(path.join(marketCopyPath, "SKILL.md"), "utf8")).includes("用户改写副本"), "official upgrade unexpectedly changed copy");

    await evaluate(client, "window.__ROSTER_STORE__.setState({ page: 'skills' })");
    await waitFor(
      () => evaluate(client, `document.querySelector('[data-skill-row="market_title_skill-copy"]') !== null`),
      "official copy visible after official upgrade",
      10_000
    );
    await evaluate(client, `document.querySelector('[data-skill-row="market_title_skill-copy"]').click()`);
    await waitFor(
      () => evaluate(client, `document.querySelector('[data-restore-official-skill-copy]') !== null && document.querySelector('[data-upgrade-official-skill-copy]') !== null`),
      "official copy restore and upgrade actions visible",
      10_000
    );
    await evaluate(client, `document.querySelector('[data-restore-official-skill-copy]').click()`);
    await waitFor(
      () =>
        evaluate(
          client,
          `document.body.innerText.includes("已复原到创建副本时的官方版本") && document.querySelector('[data-skill-content-editor]').value.includes("市场标题 Skill v1")`
        ),
      "official copy restored to copied version through real UI",
      10_000
    );
    await evaluate(client, `document.querySelector('[data-upgrade-official-skill-copy]').click()`);
    await waitFor(
      () =>
        evaluate(
          client,
          `document.body.innerText.includes("已升级副本到最新官方版") && document.querySelector('[data-skill-content-editor]').value.includes("市场标题 Skill v2")`
        ),
      "official copy upgraded to latest official version through real UI",
      10_000
    );

    await evaluate(client, "window.__ROSTER_STORE__.setState({ page: 'market' })");
    await waitFor(
      () => evaluate(client, `document.querySelector('[data-skill-market]') !== null && document.querySelector('[data-refresh-skill-market]') !== null`),
      "Skill Market page remounted before bad hash install",
      10_000
    );
    await writeMarketSkill(marketRepoRoot, "bad_hash_skill", "1.0.0", "# bad hash\n", "0".repeat(64));
    await evaluate(
      client,
      `(() => {
        const input = document.querySelector('[data-skill-market-url]');
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
        setter.call(input, ${js(marketManifestUrl)});
        input.dispatchEvent(new Event("input", { bubbles: true }));
      })()`
    );
    await evaluate(
      client,
      `(() => {
        document.querySelector('[data-refresh-skill-market]').click();
      })()`
    );
    await waitFor(
      () => evaluate(client, `document.querySelector('[data-market-skill="bad_hash_skill"]') !== null`),
      "bad hash market Skill listed",
      10_000
    );
    await evaluate(client, `document.querySelector('[data-install-market-skill="bad_hash_skill"]').click()`);
    await waitFor(
      () => evaluate(client, `document.body.innerText.includes("hash 校验失败")`),
      "Skill Market hash failure surfaced in real UI",
      10_000
    );
    assert(!existsSync(path.join(userDataDir, "skills", "official", "bad_hash_skill")), "bad hash Skill left a half-installed folder");

    await evaluate(client, "window.__ROSTER_STORE__.setState({ page: 'skills' })");
    await waitFor(
      () => evaluate(client, `document.querySelector('[data-skill-row="market_title_skill"]') !== null`),
      "market-installed official Skill appears in Skill Center",
      10_000
    );
    await evaluate(client, `document.querySelector('[data-skill-row="title-01"]').click()`);
    await waitFor(
      () => evaluate(client, `document.body.innerText.includes("Electron 标题 Skill") && !document.querySelector('[data-save-skill]').disabled`),
      "editable title Skill selected after market install",
      10_000
    );

    await evaluate(
      client,
      `(() => {
        const editor = document.querySelector('[data-skill-content-editor]');
        const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
        setter.call(editor, editor.value + '\\n# 保存后快照验证\\n');
        editor.dispatchEvent(new Event("input", { bubbles: true }));
        document.querySelector('[data-save-skill]').click();
      })()`
    );
    await waitFor(
      () => evaluate(client, `document.body.innerText.includes("已保存 Skill")`),
      "Skill edit save acknowledgement",
      10_000
    );
    assert(existsSync(path.join(skillRoot, ".snapshots")), "Skill save did not create .snapshots directory");
    await waitFor(
      () => evaluate(client, `document.querySelector('[data-skill-snapshot]') !== null`),
      "Skill snapshot listed in real UI",
      10_000
    );
    await evaluate(client, `document.querySelector('[data-restore-skill-snapshot]').click()`);
    await waitFor(
      () =>
        evaluate(
          client,
          `(() => {
            const editor = document.querySelector('[data-skill-content-editor]');
            return editor && !editor.value.includes("保存后快照验证") && document.body.innerText.includes("已还原到选中快照");
          })()`
        ),
      "Skill snapshot restored through real UI",
      10_000
    );

    await writeFile(path.join(skillRoot, "brand_info.md"), "品牌：Electron 审计品牌\n", "utf8");
    await evaluate(client, "window.__ROSTER_STORE__.setState({ page: 'dashboard' })");
    await evaluate(client, "window.__ROSTER_STORE__.setState({ page: 'skills' })");
    await waitFor(
      () => evaluate(client, `document.querySelector('[data-skill-row="title-01"]') !== null`),
      "title Skill available before include file tree check",
      10_000
    );
    await evaluate(client, `document.querySelector('[data-skill-row="title-01"]').click()`);
    await waitFor(
      () =>
        evaluate(
          client,
          `document.querySelector('[data-skill-file="brand_info.md"]') !== null && document.querySelector('[data-include-jump="brand_info.md"]') !== null`
        ),
      "Skill file tree lists include subfile",
      10_000
    );
    await evaluate(client, `document.querySelector('[data-include-jump="brand_info.md"]').click()`);
    await waitFor(
      () => evaluate(client, `document.body.innerText.includes("当前编辑：brand_info.md")`),
      "include marker jumps to subfile editor",
      10_000
    );
    await evaluate(
      client,
      `(() => {
        const editor = document.querySelector('[data-skill-content-editor]');
        const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
        setter.call(editor, '真实桌面验证\\n品牌：Electron 审计品牌\\n');
        editor.dispatchEvent(new Event("input", { bubbles: true }));
        document.querySelector('[data-save-skill-file]').click();
      })()`
    );
    await waitFor(
      () => evaluate(client, `document.body.innerText.includes("已保存 brand_info.md")`),
      "Skill include subfile saved through real UI",
      10_000
    );
    const brandInfo = await readFile(path.join(skillRoot, "brand_info.md"), "utf8");
    assert(brandInfo.includes("真实桌面验证"), "Skill include subfile edit was not written to disk");
    const titleCountBeforeSkillTest = await evaluate(client, `window.roster.listTitles().then((titles) => titles.length)`);
    await evaluate(
      client,
      `(() => {
        const textarea = document.querySelector('[data-skill-test-prompt]');
        const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
        setter.call(textarea, '围绕新品卖点做一次即时测试');
        textarea.dispatchEvent(new Event("input", { bubbles: true }));
        document.querySelector('[data-run-skill-test]').click();
      })()`
    );
    await waitFor(
      () =>
        evaluate(
          client,
          `document.querySelector('[data-skill-test-result]')?.innerText.includes('成功') === true && document.body.innerText.includes('即时测试完成，结果未写入业务库')`
        ),
      "Skill immediate test completed through real UI",
      10_000
    );
    const skillTestResultText = await evaluate(client, `document.querySelector('[data-skill-test-result]')?.innerText ?? ""`);
    assert(skillTestResultText.includes("brand_info.md"), "Skill immediate test did not report included subfile");
    assert(skillTestResultText.includes("真实桌面验证"), "Skill immediate test did not use expanded include content");
    const titleCountAfterSkillTest = await evaluate(client, `window.roster.listTitles().then((titles) => titles.length)`);
    assert(titleCountAfterSkillTest === titleCountBeforeSkillTest, "Skill immediate test wrote title rows");
    const skillTestAuditDb = openWorkspaceDb();
    try {
      const skillTestLogCount = skillTestAuditDb
        .prepare("SELECT COUNT(*) AS count FROM api_call_log WHERE provider = 'mock' AND workflow = 'skill_test' AND status = 'success'")
        .get().count;
      assert(skillTestLogCount >= 1, "Skill immediate test success was not written to api_call_log");
      const skillTestPromptLeakCount = skillTestAuditDb
        .prepare("SELECT COUNT(*) AS count FROM api_call_log WHERE workflow = 'skill_test' AND error_message LIKE '%围绕新品卖点%'")
        .get().count;
      assert(skillTestPromptLeakCount === 0, "Skill immediate test leaked prompt text into api_call_log error_message");
    } finally {
      skillTestAuditDb.close();
    }
    await evaluate(client, "window.__ROSTER_STORE__.setState({ page: 'titles' })");
    await waitFor(
      () => evaluate(client, `document.querySelector('[data-title-workspace]') !== null`),
      "real title workspace page",
      10_000
    );
    await waitFor(
      () => evaluate(client, `document.body.innerText.includes("Electron 标题 Skill")`),
      "enabled title Skill appears in title workspace",
      10_000
    );
    await evaluate(client, `document.querySelector('[data-create-title-schedule]').click()`);
    await waitFor(
      () => evaluate(client, `document.body.innerText.includes("已创建定时任务：标题生成定时")`),
      "title workspace schedule entry",
      10_000
    );
    await evaluate(
      client,
      `(() => {
        const fast = document.querySelector('button[data-title-model="mock:mock-title-fast"]');
        if (fast && !fast.className.includes("bg-blue-50")) fast.click();
        const balanced = document.querySelector('button[data-title-model="mock:mock-title-balanced"]');
        if (balanced?.className.includes("bg-blue-50")) balanced.click();
      })()`
    );
    await evaluate(client, `document.querySelector('[data-generate-titles]').click()`);
    await waitFor(
      () => evaluate(client, `document.querySelector('[data-title-stream-preview]')?.textContent.trim().length > 0 || document.querySelectorAll('[data-generated-title]').length > 0`),
      "title workspace streamed partial output before completion",
      5_000
    );
    const titleStreamState = await evaluate(
      client,
      `({
        partial: document.querySelector('[data-title-stream-preview]')?.textContent ?? "",
        canCancel: !document.querySelector('[data-cancel-title-generation]')?.disabled,
        generatedCount: document.querySelectorAll('[data-generated-title]').length
      })`
    );
    if (titleStreamState.canCancel && titleStreamState.partial) {
      await evaluate(client, `document.querySelector('[data-cancel-title-generation]').click()`);
      await waitFor(
        () => evaluate(client, `document.body.innerText.includes("已取消生成") && document.body.innerText.includes(${js(titleStreamState.partial.slice(0, 10))})`),
        "title workspace cancel keeps partial output",
        10_000
      );
    } else {
      assert(titleStreamState.generatedCount > 0, "title workspace did not expose streamed or generated content");
      await waitFor(
        () => evaluate(client, `document.querySelector('[data-cancel-title-generation]')?.disabled === true`),
        "title workspace first stream settled before next generation",
        10_000
      );
    }
    await waitFor(
      () => evaluate(client, `document.querySelector('[data-cancel-title-generation]')?.disabled === true`),
      "title workspace ready for second stream",
      10_000
    );
    await evaluate(
      client,
      `(() => {
        const fast = document.querySelector('button[data-title-model="mock:mock-title-fast"]');
        if (fast && !fast.className.includes("bg-blue-50")) fast.click();
        const balanced = document.querySelector('button[data-title-model="mock:mock-title-balanced"]');
        if (balanced && !balanced.className.includes("bg-blue-50")) balanced.click();
      })()`
    );
    await evaluate(client, `document.querySelector('[data-generate-titles]').click()`);
    await waitFor(
      () => evaluate(client, `document.querySelectorAll('[data-title-column]').length >= 2 && document.querySelectorAll('[data-generated-title]').length >= 5`),
      "title workspace multi-model generated columns",
      10_000
    );
    await waitFor(
      () => evaluate(client, `document.querySelector('[data-cancel-title-generation]')?.disabled === true`),
      "title workspace multi-model stream completed",
      10_000
    );
    await evaluate(
      client,
      `(() => {
        const fast = document.querySelector('button[data-title-model="mock:mock-title-fast"]');
        if (fast?.className.includes("bg-blue-50")) fast.click();
        const balanced = document.querySelector('button[data-title-model="mock:mock-title-balanced"]');
        if (balanced?.className.includes("bg-blue-50")) balanced.click();
      })()`
    );
    assert(
      !(await evaluate(client, `Boolean(document.querySelector('button[data-title-model="openai:gpt-5.4-mini"]'))`)),
      "title workspace displayed OpenAI placeholder model without a saved API key"
    );
    await evaluate(
      client,
      `(() => {
        const fast = document.querySelector('button[data-title-model="mock:mock-title-fast"]');
        if (fast && !fast.className.includes("bg-blue-50")) fast.click();
        const balanced = document.querySelector('button[data-title-model="mock:mock-title-balanced"]');
        if (balanced && !balanced.className.includes("bg-blue-50")) balanced.click();
      })()`
    );
    await waitFor(
      () =>
        evaluate(
          client,
          `document.querySelector('button[data-title-model="mock:mock-title-fast"]')?.className.includes("bg-blue-50") === true && document.querySelector('button[data-title-model="mock:mock-title-balanced"]')?.className.includes("bg-blue-50") === true`
        ),
      "title workspace mock models toggled back on",
      10_000
    );
    await evaluate(client, `document.querySelector('[data-generate-titles]').click()`);
    await waitFor(
      () => evaluate(client, `document.querySelectorAll('[data-title-column]').length >= 2 && document.querySelectorAll('[data-generated-title]').length >= 5`),
      "title workspace mock models restored after real provider isolation check",
      10_000
    );
    await waitFor(
      () => evaluate(client, `document.querySelector('[data-cancel-title-generation]')?.disabled === true`),
      "title workspace restored mock stream completed",
      10_000
    );
    const providerAuditDb = openWorkspaceDb();
    try {
      const providerFailureCount = providerAuditDb
        .prepare("SELECT COUNT(*) AS count FROM api_call_log WHERE provider = 'openai' AND workflow = 'title_workspace' AND status = 'failed' AND error_code = 'InvalidAPIKey'")
        .get().count;
      assert(providerFailureCount === 0, "title workspace should not call or log unconfigured OpenAI placeholder models");
      const promptLeakCount = providerAuditDb
        .prepare("SELECT COUNT(*) AS count FROM api_call_log WHERE error_message LIKE '%围绕新品卖点%' OR error_message LIKE '%sk-%'")
        .get().count;
      assert(promptLeakCount === 0, "api_call_log leaked prompt or secret-looking data");
    } finally {
      providerAuditDb.close();
    }
    await evaluate(
      client,
      `Array.from(document.querySelectorAll('[data-generated-title]')).slice(0, 3).forEach((button) => button.click())`
    );
    await evaluate(client, `document.querySelector('[data-save-selected-titles]').click()`);
    await waitFor(
      () => evaluate(client, `document.querySelector('[data-title-score-dialog]') !== null`),
      "title workspace score dialog opens before save",
      10_000
    );
    await evaluate(client, `document.querySelector('[data-confirm-save-selected-titles]').click()`);
    await waitFor(
      () => evaluate(client, `document.body.innerText.includes("已入库 3 条标题")`),
      "title workspace selected titles saved",
      10_000
    );
    const savedGeneratedTitles = await evaluate(client, `window.roster.listTitles()`);
    assert(
      savedGeneratedTitles.filter((title) => title.sourceSkillId === "title-01").length >= 3,
      "title workspace did not persist selected generated titles"
    );

    await evaluate(
      client,
      `window.roster.saveSettings({ imageStudioResultHandling: "manual_review" })`
    );
    const imagePromptIds = await evaluate(
      client,
      `Promise.all([
        window.roster.savePrompt({ text: "Electron 文生图批量主图，白底商品摄影", scene: "主图", status: "active" }),
        window.roster.savePrompt({ text: "Electron 文生图批量详情页，柔和自然光", scene: "详情页", status: "active" }),
        window.roster.savePrompt({ text: "Electron 图生图参考图，保持主体并统一背景", scene: "主图", status: "active" })
      ]).then((prompts) => prompts.map((prompt) => prompt.id))`
    );
    const singleReferencePath = path.join(workspaceRoot, "reference-fixtures", "single-ref.png");
    const mixedReferenceDir = path.join(workspaceRoot, "reference-fixtures", "mixed");
    await mkdir(path.dirname(singleReferencePath), { recursive: true });
    await mkdir(path.join(mixedReferenceDir, "sku-a"), { recursive: true });
    await writeFile(singleReferencePath, Buffer.from("single-reference"));
    await writeFile(path.join(mixedReferenceDir, "root-ref.png"), Buffer.from("root-reference"));
    await writeFile(path.join(mixedReferenceDir, "sku-a", "front.jpg"), Buffer.from("front-reference"));
    await writeFile(path.join(mixedReferenceDir, "sku-a", "side.webp"), Buffer.from("side-reference"));

    await evaluate(client, "window.__ROSTER_STORE__.setState({ page: 'images' })");
    await waitFor(
      () => evaluate(client, `document.querySelector('[data-image-studio]') !== null`),
      "real image studio page",
      10_000
    );
    await evaluate(client, `document.querySelector('[data-create-image-schedule]').click()`);
    await waitFor(
      () => evaluate(client, `document.body.innerText.includes("已创建定时任务：图片生成定时")`),
      "image studio schedule entry",
      10_000
    );
    await waitFor(
      () =>
        evaluate(
          client,
          `document.querySelector('[data-image-primary-mode="text"]') !== null &&
            document.querySelector('[data-image-run-mode="single"]') !== null &&
            document.querySelector('[data-image-primary-mode-btn="text"]')?.innerText.includes("文生图") &&
            document.querySelector('[data-image-primary-mode-btn="image"]')?.innerText.includes("图生图") &&
            document.querySelector('[data-image-run-mode-btn="single"]')?.innerText.includes("单次") &&
            document.querySelector('[data-image-run-mode-btn="batch"]')?.innerText.includes("批量")`
        ),
      "image studio text/image tabs rendered",
      10_000
    );
    const retiredImageEntryVisible = await evaluate(
      client,
      `["批量生产", "模板套图", "快速单图"].some((label) => document.body.innerText.includes(label))`
    );
    assert(!retiredImageEntryVisible, "retired image studio entries are still visible");
    await waitFor(
      () => evaluate(client, `document.body.innerText.includes("Provider 1")`),
      "image studio mock provider selected",
      10_000
    );

    await evaluate(client, `document.querySelector('[data-generate-images]').click()`);
    await waitFor(
      () =>
        evaluate(
          client,
          `window.roster.listImages().then((images) => images.length >= 1 && document.body.innerText.includes("审核生成结果"))`
        ),
      "text-to-image single mock generation completed",
      10_000
    );
    await waitFor(
      () => evaluate(client, `document.querySelector('[data-image-generation-progress]')?.innerText.match(/\\d+\\s*\\/\\s*\\d+/) !== null`),
      "image generation progress persisted in real UI",
      10_000
    );
    const firstImageBatch = await evaluate(client, `window.roster.listImages()`);
    const pendingLibraryCandidate = firstImageBatch.find((image) => image.status === "active" && image.reviewStatus === "pending");
    assert(pendingLibraryCandidate, "manual review image was not saved as pending");
    assert(existsSync(path.join(workspaceRoot, pendingLibraryCandidate.relativePath)), `generated image file missing: ${pendingLibraryCandidate.relativePath}`);
    await evaluate(client, "window.__ROSTER_STORE__.setState({ page: 'lib_images' })");
    await waitFor(
      () => evaluate(client, `document.body.innerText.includes("图片库")`),
      "image library page after pending generation",
      10_000
    );
    const pendingVisibleInLibrary = await evaluate(client, `document.body.innerText.includes(${js(pendingLibraryCandidate.fileName)})`);
    assert(!pendingVisibleInLibrary, "pending manual-review image appeared in the usable image library");

    await evaluate(client, "window.__ROSTER_STORE__.setState({ page: 'images' })");
    await waitFor(
      () => evaluate(client, `document.querySelector('[data-image-studio]') !== null`),
      "image studio returned for text batch",
      10_000
    );
    await waitFor(
      () => evaluate(client, `document.querySelector('[data-image-review-card]') !== null && document.body.innerText.includes("审核生成结果")`),
      "image studio restores completed task review after page switch",
      10_000
    );
    await evaluate(client, `document.querySelector('[data-image-run-mode-btn="batch"]').click()`);
    await waitFor(
      () => evaluate(client, `document.querySelector('[data-image-run-mode="batch"]') !== null && document.body.innerText.includes("从提示词库批量生成图片")`),
      "text-to-image batch mode selected",
      10_000
    );
    await evaluate(client, `document.querySelector('[data-generate-images]').click()`);
    await waitFor(
      () =>
        evaluate(
          client,
          `window.roster.listImages().then((images) => images.length >= ${firstImageBatch.length + imagePromptIds.length} && document.body.innerText.includes("审核生成结果"))`
        ),
      "text-to-image batch mock generation completed",
      10_000
    );
    const imagesAfterTextBatch = await evaluate(client, `window.roster.listImages()`);

    await evaluate(client, `document.querySelector('[data-image-primary-mode-btn="image"]').click()`);
    await evaluate(client, `document.querySelector('[data-image-run-mode-btn="single"]').click()`);
    await waitFor(
      () => evaluate(client, `document.querySelector('[data-image-reference-dropzone]') !== null`),
      "image-to-image single dropzone available",
      10_000
    );
    await evaluate(
      client,
      `(() => {
        const file = new File([new Uint8Array([1, 2, 3])], "single-ref.png", { type: "image/png" });
        Object.defineProperty(file, "path", { value: ${js(singleReferencePath)} });
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        const dropzone = document.querySelector('[data-image-reference-dropzone]');
        dropzone.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer }));
      })()`
    );
    await waitFor(
      () => evaluate(client, `document.body.innerText.includes("single-ref.png")`),
      "image-to-image single reference loaded",
      10_000
    );
    await evaluate(client, `document.querySelector('[data-generate-images]').click()`);
    await waitFor(
      () =>
        evaluate(
          client,
          `window.roster.listImages().then((images) => images.length >= ${imagesAfterTextBatch.length + 1} && document.body.innerText.includes("审核生成结果"))`
        ),
      "image-to-image single mock generation completed",
      10_000
    );

    const mixedInitial = await evaluate(
      client,
      `window.roster.inspectImageReferenceFolder({ folderPath: ${js(mixedReferenceDir)} })`
    );
    assert(mixedInitial.structure === "mixed" && mixedInitial.requiresMixedMode, "mixed folder scan did not require a mixed-mode decision");
    const mixedAll = await evaluate(
      client,
      `window.roster.inspectImageReferenceFolder({ folderPath: ${js(mixedReferenceDir)}, mixedMode: "all" })`
    );
    assert(mixedAll.tasks.length === 2, `expected two mixed image reference tasks, got ${mixedAll.tasks.length}`);
    const editBatchJobs = mixedAll.tasks.map((task, index) => ({
      promptId: imagePromptIds[index % imagePromptIds.length],
      references: task.references
    }));
    const imagesBeforeEditBatch = await evaluate(client, `window.roster.listImages()`);
    const editBatchResult = await evaluate(
      client,
      `window.roster.generateImageEdits({
        scene: "主图",
        jobs: ${js(editBatchJobs)},
        provider: "mock",
        model: "mock-image",
        targets: [{ provider: "mock", model: "mock-image" }],
        generationStrategy: "load_balance",
        aspectRatio: "1:1",
        resolution: "1k",
        quality: "auto",
        outputFormat: "png",
        perPromptCount: 1,
        outputSubdir: "main",
        resultHandling: "manual_review"
      })`
    );
    assert(editBatchResult.savedImages.length === 2, "image-to-image batch mock generation did not save expected images");
    const imagesAfterEditBatch = await evaluate(client, `window.roster.listImages()`);
    assert(imagesAfterEditBatch.length >= imagesBeforeEditBatch.length + 2, "image-to-image batch results were not persisted");

    await evaluate(client, `document.querySelector('[data-enter-image-review]')?.click()`);
    await waitFor(
      () => evaluate(client, `document.querySelector('[data-image-review-card]') !== null`),
      "image review stage exposes generated results",
      10_000
    );
    const imageToSoftDeleteId = await evaluate(
      client,
      `document.querySelector('[data-image-review-card]')?.getAttribute('data-image-review-card')`
    );
    const imageToSoftDelete = await evaluate(
      client,
      `window.roster.listImages().then((images) => images.find((image) => image.id === ${js(imageToSoftDeleteId)}))`
    );
    assert(imageToSoftDelete, "no pending generated image available for review actions");
    await evaluate(client, `document.querySelector('[data-approve-image="${imageToSoftDelete.id}"]').click()`);
    await waitFor(
      () =>
        evaluate(
          client,
          `window.roster.listImages().then((images) => images.find((image) => image.id === "${imageToSoftDelete.id}")?.reviewStatus === "approved")`
        ),
      "image approval completed in real UI",
      10_000
    );
    const approvedImage = await evaluate(
      client,
      `window.roster.listImages().then((images) => images.find((image) => image.id === "${imageToSoftDelete.id}"))`
    );
    await evaluate(client, `document.querySelector('[data-reject-image="${imageToSoftDelete.id}"]').click()`);
    await waitFor(
      () =>
        evaluate(
          client,
          `window.roster.listImages().then((images) => images.find((image) => image.id === "${imageToSoftDelete.id}")?.status === "soft_deleted")`
        ),
      "image reject completed in real UI",
      10_000
    );
    const imagesAfterSoftDelete = await evaluate(client, `window.roster.listImages()`);
    const softDeletedImage = imagesAfterSoftDelete.find((image) => image.id === imageToSoftDelete.id);
    assert(softDeletedImage.status === "soft_deleted", "soft-deleted image status was not persisted");
    assert(softDeletedImage.relativePath.startsWith("_trash/images/"), "soft-deleted image was not moved to _trash");
    assert(!existsSync(path.join(workspaceRoot, approvedImage.relativePath)), "original image file still exists after soft delete");
    assert(existsSync(path.join(workspaceRoot, softDeletedImage.relativePath)), "soft-deleted image file missing in _trash");

    await evaluate(client, "window.__ROSTER_STORE__.setState({ page: 'scripts' })");
    await waitFor(
      () => evaluate(client, `document.querySelector('[data-script-workspace]') !== null && document.body.innerText.includes("Electron 文案 Skill")`),
      "real script workspace page",
      10_000
    );
    await waitFor(
      () =>
        evaluate(
          client,
          `document.querySelector('button[data-script-model="mock:mock-script-fast"]') !== null && document.querySelector('button[data-script-model="mock:mock-script-balanced"]') !== null`
        ),
      "script workspace saved mock models visible",
      10_000
    );
    await evaluate(client, `document.querySelector('[data-create-script-schedule]').click()`);
    await waitFor(
      () => evaluate(client, `document.body.innerText.includes("已创建定时任务：文案生成定时")`),
      "script workspace schedule entry",
      10_000
    );
    await evaluate(
      client,
      `(() => {
        const input = document.querySelector('[data-script-sku-input]');
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
        setter.call(input, 'SKU-2');
        input.dispatchEvent(new Event("input", { bubbles: true }));
        const fast = document.querySelector('button[data-script-model="mock:mock-script-fast"]');
        if (fast && !fast.className.includes("bg-blue-50")) fast.click();
        const balanced = document.querySelector('button[data-script-model="mock:mock-script-balanced"]');
        if (balanced && !balanced.className.includes("bg-blue-50")) balanced.click();
      })()`
    );
    await evaluate(client, `document.querySelector('[data-generate-scripts]').click()`);
    await waitFor(
      () => evaluate(client, `document.querySelector('[data-generated-script]')?.textContent.trim().length > 0`),
      "script workspace streamed partial output",
      5_000
    );
    await waitFor(
      () => evaluate(client, `document.querySelectorAll('[data-script-column]').length >= 2 && document.querySelectorAll('[data-generated-script]').length >= 2`),
      "script workspace generated columns",
      10_000
    );
    await waitFor(
      () => evaluate(client, `document.querySelector('[data-cancel-script-generation]')?.disabled === true`),
      "script workspace stream completed",
      10_000
    );
    await evaluate(client, `document.querySelector('[data-copy-generated-script]').click()`);
    await waitFor(
      () => evaluate(client, `document.body.innerText.includes("已复制文案")`),
      "script workspace copy action",
      10_000
    );
    await evaluate(
      client,
      `Array.from(document.querySelectorAll('[data-generated-script]')).slice(0, 2).forEach((card) => card.querySelector('button').click())`
    );
    await evaluate(client, `document.querySelector('[data-save-selected-scripts]').click()`);
    await waitFor(
      () => evaluate(client, `document.body.innerText.includes("已入库 2 条文案")`),
      "script workspace selected scripts saved",
      10_000
    );
    const savedGeneratedScripts = await evaluate(client, `window.roster.listScripts()`);
    const electronScriptRows = savedGeneratedScripts.filter((script) => script.sourceSkillId === "script-01");
    assert(electronScriptRows.length >= 2, "script workspace did not persist selected generated scripts");
    assert(electronScriptRows.every((script) => script.skuCode === "SKU-2"), "script workspace did not persist optional SKU");
    const scriptDb = openWorkspaceDb();
    try {
      const scriptSkuCount = scriptDb.prepare("SELECT COUNT(*) AS count FROM scripts WHERE source_skill_id = ? AND sku_code = ?").get("script-01", "SKU-2").count;
      assert(scriptSkuCount >= 2, `expected at least two SKU-linked scripts, got ${scriptSkuCount}`);
    } finally {
      scriptDb.close();
    }
    await evaluate(client, "window.__ROSTER_STORE__.setState({ page: 'lib_scripts' })");
    await waitFor(
      () => evaluate(client, `document.querySelectorAll('[data-script-row]').length >= 2 && document.body.innerText.includes("SKU-2")`),
      "real script library rows visible",
      10_000
    );
    await evaluate(client, `document.querySelector('[data-select-script]').click()`);
    await evaluate(client, `document.querySelector('[data-copy-selected-scripts]').click()`);
    await waitFor(
      () => evaluate(client, `document.body.innerText.includes("已复制 1 条文案")`),
      "script library copy selected action",
      10_000
    );
    await evaluate(client, `document.querySelector('[data-export-selected-scripts]').click()`);
    await waitFor(
      () => evaluate(client, `document.body.innerText.includes("已导出 1 条文案到 scripts_export/")`),
      "script library export selected action",
      10_000
    );
    const scriptExport = await evaluate(
      client,
      `(() => {
        const text = document.querySelector('[data-script-library-message]')?.innerText ?? "";
        const match = text.match(/scripts_export\\/\\S+/);
        return match ? match[0] : null;
      })()`
    );
    assert(scriptExport, "script library export directory was not shown in UI");
    const scriptTxtPath = path.join(workspaceRoot, scriptExport, "scripts.txt");
    const scriptCsvPath = path.join(workspaceRoot, scriptExport, "scripts.csv");
    assert(existsSync(scriptTxtPath), "script txt export missing");
    assert(existsSync(scriptCsvPath), "script csv export missing");
    const scriptTxt = await readFile(scriptTxtPath, "utf8");
    const scriptCsv = await readFile(scriptCsvPath, "utf8");
    assert(scriptTxt.includes("SKU: SKU-2"), "script txt export did not include SKU");
    assert(scriptCsv.charCodeAt(0) === 0xfeff, "script csv export is not UTF-8 with BOM");
    assert(scriptCsv.includes("SKU-2"), "script csv export did not include SKU");

    await evaluate(client, "window.__ROSTER_STORE__.setState({ page: 'covers' })");
    await waitFor(
      () =>
        evaluate(
          client,
          `document.querySelector('[data-cover-workspace]') !== null && document.querySelector('[data-cover-video-row]') !== null && document.querySelectorAll('[data-cover-frame]').length === 30`
        ),
      "real cover workspace page",
      10_000
    );
    const initialPreviewFrame = await evaluate(client, `document.querySelector('[data-cover-preview-frame]')?.getAttribute('data-cover-preview-frame')`);
    await evaluate(client, `document.querySelector('[data-cover-frame="5"]').dispatchEvent(new MouseEvent("mouseover", { bubbles: true }))`);
    await waitFor(
      () => evaluate(client, `document.querySelector('[data-cover-preview-frame]')?.getAttribute('data-cover-preview-frame') === "5"`),
      "cover timeline hover switches preview frame",
      10_000
    );
    assert(initialPreviewFrame === "0", `expected initial cover preview frame 0, got ${initialPreviewFrame}`);
    await evaluate(client, `document.querySelector('[data-cover-ratio="3:4"]').click()`);
    await evaluate(
      client,
      `(() => {
        const mask = document.querySelector('[data-cover-mask]');
        const preview = document.querySelector('[data-cover-preview-frame]');
        const rect = preview.getBoundingClientRect();
        const pointerId = 17;
        mask.dispatchEvent(new PointerEvent("pointerdown", {
          bubbles: true,
          cancelable: true,
          pointerId,
          pointerType: "mouse",
          isPrimary: true,
          buttons: 1,
          clientX: rect.left + rect.width * 0.5,
          clientY: rect.top + rect.height * 0.5
        }));
        mask.dispatchEvent(new PointerEvent("pointermove", {
          bubbles: true,
          cancelable: true,
          pointerId,
          pointerType: "mouse",
          isPrimary: true,
          buttons: 1,
          clientX: rect.left + rect.width * 0.72,
          clientY: rect.top + rect.height * 0.34
        }));
        mask.dispatchEvent(new PointerEvent("pointerup", {
          bubbles: true,
          cancelable: true,
          pointerId,
          pointerType: "mouse",
          isPrimary: true,
          clientX: rect.left + rect.width * 0.72,
          clientY: rect.top + rect.height * 0.34
        }));
      })()`
    );
    await waitFor(
      () =>
        evaluate(
          client,
          `(() => {
            const mask = document.querySelector('[data-cover-mask]');
            const x = Number(mask?.getAttribute("data-cover-crop-x"));
            const y = Number(mask?.getAttribute("data-cover-crop-y"));
            return x > 0.65 && x < 0.8 && y > 0.25 && y < 0.45;
          })()`
        ),
      "cover crop mask drag updates position",
      5_000
    );
    const draggedCropPosition = await evaluate(
      client,
      `(() => {
        const mask = document.querySelector('[data-cover-mask]');
        return {
          x: Number(mask.getAttribute("data-cover-crop-x")),
          y: Number(mask.getAttribute("data-cover-crop-y")),
          role: mask.getAttribute("role")
        };
      })()`
    );
    assert(draggedCropPosition.role === "slider", "cover crop mask is not exposed as an interactive control");
    assert(draggedCropPosition.x > 0.65 && draggedCropPosition.x < 0.8, `cover crop x did not move: ${draggedCropPosition.x}`);
    assert(draggedCropPosition.y > 0.25 && draggedCropPosition.y < 0.45, `cover crop y did not move: ${draggedCropPosition.y}`);
    await evaluate(
      client,
      `(() => {
        const button = document.querySelector('[data-apply-cover]');
        button.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true }));
        button.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
        button.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, cancelable: true }));
        button.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
        button.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      })()`
    );
    await waitFor(
      () => evaluate(client, `document.body.innerText.includes("已保存封面")`),
      "cover saved through real UI",
      10_000
    ).catch(async (error) => {
      const probe = await evaluate(
        client,
        `({
          buttonDisabled: Boolean(document.querySelector('[data-apply-cover]')?.disabled),
          message: document.querySelector('[data-cover-message]')?.innerText ?? null,
          previewFrame: document.querySelector('[data-cover-preview-frame]')?.getAttribute('data-cover-preview-frame'),
          bodyText: document.body.innerText.slice(0, 1200)
        })`
      );
      throw new Error(`${error instanceof Error ? error.message : String(error)}\nCover probe: ${JSON.stringify(probe, null, 2)}`);
    });
    const videosAfterCover = await evaluate(client, `window.roster.listVideos()`);
    const coveredVideo = videosAfterCover.find((video) => video.hasCover);
    assert(coveredVideo, "cover workspace did not mark video hasCover");
    assert(coveredVideo.coverRelativePath, "cover workspace did not persist coverRelativePath");
    assert(
      existsSync(path.join(workspaceRoot, coveredVideo.coverRelativePath)),
      `cover file missing: ${coveredVideo.coverRelativePath}`
    );
    const coverBytes = await readFile(path.join(workspaceRoot, coveredVideo.coverRelativePath));
    assert(coverBytes[0] === 0xff && coverBytes[1] === 0xd8, "cover file is not a JPEG");
    assert(coverBytes.at(-2) === 0xff && coverBytes.at(-1) === 0xd9, "cover JPEG is not complete");
    await evaluate(client, `document.querySelector('[data-cover-ratio="custom"]').click()`);
    await waitFor(
      () => evaluate(client, `document.querySelector('[data-custom-cover-width]') !== null && document.querySelector('[data-custom-cover-height]') !== null`),
      "custom cover ratio controls",
      10_000
    );
    await evaluate(
      client,
      `(() => {
        const width = document.querySelector('[data-custom-cover-width]');
        const height = document.querySelector('[data-custom-cover-height]');
        const inputSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
        inputSetter.call(width, "4");
        width.dispatchEvent(new Event("input", { bubbles: true }));
        inputSetter.call(height, "5");
        height.dispatchEvent(new Event("input", { bubbles: true }));
        document.querySelector('[data-apply-cover]').click();
      })()`
    );
    await waitFor(
      () => evaluate(client, `document.body.innerText.includes("__custom-4x5.jpg")`),
      "custom ratio cover saved through real UI",
      10_000
    );
    const videosAfterCustomCover = await evaluate(client, `window.roster.listVideos()`);
    const customCoveredVideo = videosAfterCustomCover.find((video) => video.coverRelativePath?.includes("__custom-4x5.jpg"));
    assert(customCoveredVideo, "custom ratio cover path was not persisted");
    const customCoverBytes = await readFile(path.join(workspaceRoot, customCoveredVideo.coverRelativePath));
    assert(customCoverBytes[0] === 0xff && customCoverBytes[1] === 0xd8, "custom cover file is not a JPEG");
    await evaluate(client, `document.querySelector('[data-batch-apply-first-frame]').click()`);
    await waitFor(
      () => evaluate(client, `document.body.innerText.includes("已批量应用首帧 4 个，跳过 1 个")`),
      "batch first-frame cover application",
      10_000
    );
    const videosAfterBatchCover = await evaluate(client, `window.roster.listVideos()`);
    assert(videosAfterBatchCover.every((video) => video.hasCover && video.coverRelativePath), "batch first-frame did not cover every video");
    for (const video of videosAfterBatchCover) {
      assert(existsSync(path.join(workspaceRoot, video.coverRelativePath)), `batch cover file missing: ${video.coverRelativePath}`);
    }

    await evaluate(client, "window.__ROSTER_STORE__.setState({ page: 'tasks' })");

    for (let index = 0; index < 5; index += 1) {
      await evaluate(client, `window.roster.saveTitle({ text: ${js(`审计标题 ${index}`)}, score: ${90 - index}, status: "active" })`);
      await evaluate(client, `window.roster.saveTag({ skuCode: ${js(`SKU-${index}`)}, tagGroup: "default", tag1: ${js(`#默认${index}`)} })`);
    }
    const accounts = [];
    for (const platform of ["抖音", "视频号", "小红书", "快手"]) {
      accounts.push(
        await evaluate(
          client,
          `window.roster.savePlatformAccount({ platform: ${js(platform)}, accountName: ${js(`${platform} 主账号`)}, enabled: true })`
        )
      );
    }
    sheetDate = await evaluate(
      client,
      `(() => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, "0");
        const day = String(now.getDate()).padStart(2, "0");
        return year + "-" + month + "-" + day;
      })()`
    );

    let sheet = await evaluate(
      client,
      `window.roster.generateTaskSheet({
        sheetDate: ${js(sheetDate)},
        videoCount: 5,
        platformAccountIds: ${js(accounts.map((account) => account.id))},
        videoStrategy: "low_publish",
        titleStrategy: "best_score",
        defaultTagRatio: 100,
        timeAnchors: ["09:00", "12:00", "15:00", "18:00", "21:00"],
        jitterMinutes: 0
      })`
    );
    assert(sheet.rows.length === 20, `expected 20 task rows, got ${sheet.rows.length}`);

    const edited = await evaluate(
      client,
      `window.roster.updateTaskRow({
        taskId: ${js(sheet.rows[0].id)},
        publishAt: ${js(`${sheetDate}T10:30:00`)},
        titleText: "Electron 编辑标题",
        tags: ["#E2E", "#真实桌面"]
      })`
    );
    assert(edited.titleText === "Electron 编辑标题", "task row edit did not persist through IPC");
    const replacedSheet = await evaluate(
      client,
      `window.roster.batchReplaceTaskTitles({ sheetDate: ${js(sheetDate)}, taskIds: [${js(sheet.rows[0].id)}], titleStrategy: "best_score" })`
    );
    assert(replacedSheet.rows.find((row) => row.id === sheet.rows[0].id).titleText !== "Electron 编辑标题", "batch title replacement did not clear override");
    await evaluate(client, "window.__ROSTER_STORE__.setState({ page: 'dashboard' })");
    await evaluate(client, "window.__ROSTER_STORE__.setState({ page: 'tasks' })");
    await waitFor(
      () => evaluate(client, "document.querySelectorAll('[data-task-row]').length > 0"),
      "real task page loaded generated sheet",
      10_000
    );
    await evaluate(client, `document.querySelector('[data-create-task-schedule]').click()`);
    await waitFor(
      () => evaluate(client, `document.body.innerText.includes("已创建定时任务：任务单定时")`),
      "task page schedule entry",
      10_000
    );

    const exportResult = await evaluate(
      client,
      `window.roster.exportTaskSheet({ sheetDate: ${js(sheetDate)}, formats: ["xlsx", "csv", "json"], targetPlatform: "windows" })`,
      30_000
    );
    for (const relativePath of [
      `tasks/${sheetDate}/tasks.xlsx`,
      `tasks/${sheetDate}/tasks.csv`,
      `tasks/${sheetDate}/tasks.json`,
      `tasks/${sheetDate}/preflight.json`
    ]) {
      assert(existsSync(path.join(workspaceRoot, relativePath)), `export artifact missing: ${relativePath}`);
    }
    assert((await stat(path.join(workspaceRoot, "tasks", sheetDate, "status"))).isDirectory(), "status directory missing");
    const csv = await readFile(path.join(workspaceRoot, "tasks", sheetDate, "tasks.csv"), "utf8");
    assert(csv.charCodeAt(0) === 0xfeff, "CSV is not UTF-8 with BOM");
    assert(csv.includes("D:\\RosterAudit\\videos\\"), "export did not use Windows RPA paths");
    assert(exportResult.writtenFiles.length === 4, "export result did not report all written files");

    sheet = await evaluate(client, `window.roster.getTaskSheetByDate(${js(sheetDate)})`);
    await writeFile(path.join(workspaceRoot, "tasks", sheetDate, "status", "ignored.tmp"), "{}");
    await writeStatusFile(sheet.rows[0], "success");
    await waitFor(
      () => evaluate(client, `document.querySelector('[data-task-row][data-task-status="success"]') !== null`),
      "automatic 5-second status scan in real task page",
      7_500
    );
    const firstScan = await evaluate(client, `window.roster.scanTaskStatusFiles({ sheetDate: ${js(sheetDate)} })`);
    assert(firstScan.duplicates === 1 && firstScan.ignoredTmp === 1, `unexpected post-auto status scan: ${JSON.stringify(firstScan)}`);
    const afterStatus = await evaluate(client, `window.roster.getTaskSheetByDate(${js(sheetDate)})`);
    assert(afterStatus.rows[0].status === "success", "status file did not update task row");
    const duplicateScan = await evaluate(client, `window.roster.scanTaskStatusFiles({ sheetDate: ${js(sheetDate)} })`);
    assert(duplicateScan.duplicates === 1, "duplicate status scan was not idempotent");

    const db = openWorkspaceDb();
    try {
      const titleUsage = db.prepare("SELECT SUM(use_count) AS count FROM titles").get().count;
      const videoUsage = db.prepare("SELECT used_count FROM videos WHERE id = ?").get(afterStatus.rows[0].videoId).used_count;
      assert(titleUsage === 1, `expected title use_count sum 1, got ${titleUsage}`);
      assert(videoUsage === 1, `expected video used_count 1, got ${videoUsage}`);
    } finally {
      db.close();
    }

    const failedRow = afterStatus.rows[1];
    await writeStatusFile(failedRow, "failed", `${failedRow.runKey}__failed.json`);
    await evaluate(client, `window.roster.scanTaskStatusFiles({ sheetDate: ${js(sheetDate)} })`);
    const retry = await evaluate(client, `window.roster.retryTaskRow({ taskId: ${js(failedRow.id)} })`);
    assert(retry.attemptNo === failedRow.attemptNo + 1, "retry did not increment attempt number");
    assert(retry.runKey !== failedRow.runKey, "retry did not create a new run key");

    await evaluate(client, `window.roster.exportTaskSheet({ sheetDate: ${js(sheetDate)}, formats: ["json"], targetPlatform: "windows" })`);
    assert(existsSync(path.join(workspaceRoot, "tasks", sheetDate, "tasks.json")), "task re-export artifact missing");

    const historicalDate = previousDate(sheetDate);
    const historicalSheet = await evaluate(
      client,
      `window.roster.generateTaskSheet({
        sheetDate: ${js(historicalDate)},
        videoCount: 2,
        platformAccountIds: ${js(accounts.map((account) => account.id))},
        videoStrategy: "low_publish",
        titleStrategy: "best_score",
        defaultTagRatio: 100,
        timeAnchors: ["09:00", "12:00"],
        jitterMinutes: 0
      })`
    );
    assert(historicalSheet.rows.length > 0, "historical seed sheet did not generate rows");
    await evaluate(client, `window.roster.exportTaskSheet({ sheetDate: ${js(historicalDate)}, formats: ["json"], targetPlatform: "windows" })`);
    await evaluate(
      client,
      `(() => {
        const input = document.querySelector('input[aria-label="任务日期"]');
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
        setter.call(input, ${js(historicalDate)});
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      })()`
    );
    await waitFor(
      () =>
        evaluate(
          client,
          `(() => {
            const button = (name) => Array.from(document.querySelectorAll("button")).find((item) => item.innerText.trim() === name);
            return document.body.innerText.includes("历史任务单只读")
              && document.querySelectorAll('[data-task-row]').length > 0
              && button("导出")
              && !button("导出").disabled;
          })()`
        ),
      "historical task page read-only state",
      10_000
    );
    const historicalUi = await evaluate(
      client,
      `(() => {
        const button = (name) => Array.from(document.querySelectorAll("button")).find((item) => item.innerText.trim() === name);
        return {
          regenerateDisabled: Boolean(button("重新生成")?.disabled),
          scanDisabled: Boolean(button("扫描状态")?.disabled),
          replaceDisabled: Boolean(Array.from(document.querySelectorAll("button")).find((item) => item.innerText.includes("换标题"))?.disabled),
          exportDisabled: Boolean(button("导出")?.disabled),
          rowCheckboxDisabled: Boolean(document.querySelector('[aria-label^="选择任务"]')?.disabled)
        };
      })()`
    );
    assert(historicalUi.regenerateDisabled, "historical regenerate button is not disabled");
    assert(historicalUi.scanDisabled, "historical status scan button is not disabled");
    assert(historicalUi.replaceDisabled, "historical replace-title button is not disabled");
    assert(!historicalUi.exportDisabled, "historical export button should remain enabled");
    assert(historicalUi.rowCheckboxDisabled, "historical row selection should be disabled");
    await evaluate(
      client,
      `Array.from(document.querySelectorAll("button")).find((item) => item.innerText.trim() === "导出").click()`
    );
    await waitFor(
      () => evaluate(client, `document.body.innerText.includes("已导出")`),
      "historical task re-export from real UI",
      10_000
    );
    assert(existsSync(path.join(workspaceRoot, "tasks", historicalDate, "tasks.json")), "historical re-export artifact missing");

    await evaluate(client, "window.__ROSTER_STORE__.setState({ page: 'settings' })");
    await waitFor(
      () => evaluate(client, `document.querySelector('[data-backup-workspace]') !== null`),
      "settings backup action visible",
      10_000
    );
    await waitFor(
      () => evaluate(client, `document.querySelector('[data-setting-scan-frequency]') !== null && document.body.innerText.includes("当前版本")`),
      "settings policy controls visible",
      10_000
    );
    await evaluate(
      client,
      `(() => {
        const setSelect = (selector, value) => {
          const select = document.querySelector(selector);
          const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set;
          setter.call(select, value);
          select.dispatchEvent(new Event("change", { bubbles: true }));
        };
        const setInput = (selector, value) => {
          const input = document.querySelector(selector);
          const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
          setter.call(input, value);
          input.dispatchEvent(new Event("input", { bubbles: true }));
        };
        setSelect('[data-setting-scan-frequency]', 'interval');
        setInput('[data-setting-scan-interval]', '15');
        setSelect('[data-setting-excel-naming]', 'en');
        setInput('[data-setting-provider-retry]', '2');
        setInput('[data-setting-backup-retention]', '3');
      })()`
    );
    await waitFor(
      () => evaluate(client, `document.body.innerText.includes("设置已保存并立即生效")`),
      "settings saved immediate acknowledgement",
      10_000
    );
    const savedSettings = await evaluate(client, `window.roster.getSettings()`);
    assert(savedSettings.scanFrequency === "interval", "scan frequency setting did not persist");
    assert(savedSettings.scanIntervalMinutes === 15, "scan interval setting did not persist");
    assert(savedSettings.excelFieldNaming === "en", "excel field naming setting did not persist");
    assert(savedSettings.providerRetryCount === 2, "provider retry setting did not persist");
    assert(savedSettings.backupRetentionCount === 3, "backup retention setting did not persist");
    await waitFor(
      () => evaluate(client, `document.querySelector('[data-platform-accounts-section]') !== null && document.querySelector('[data-check-cloud-sync]') !== null`),
      "settings workspace maintenance controls visible",
      10_000
    );
    await evaluate(client, `document.querySelector('[data-check-cloud-sync]').click()`);
    await waitFor(
      () => evaluate(client, `document.querySelector('[data-cloud-sync-result]') !== null && document.body.innerText.includes("需确认")`),
      "cloud sync self-check completed from real settings UI",
      10_000
    );
    const cloudSyncCheck = await evaluate(client, `window.roster.checkWorkspaceCloudSync()`);
    assert(cloudSyncCheck.rootPath === workspaceRoot, "cloud sync check returned wrong workspace root");
    assert(cloudSyncCheck.rootExists && cloudSyncCheck.rootWritable, "cloud sync check did not verify local workspace access");
    assert(cloudSyncCheck.likelySynced === false, "temporary audit workspace should not be classified as cloud-synced");
    assert(cloudSyncCheck.warnings.length > 0, "cloud sync check should warn for non-cloud workspace path");
    await evaluate(
      client,
      `(() => {
        const setSelect = (selector, value) => {
          const select = document.querySelector(selector);
          const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set;
          setter.call(select, value);
          select.dispatchEvent(new Event("change", { bubbles: true }));
        };
        const setInput = (selector, value) => {
          const input = document.querySelector(selector);
          const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
          setter.call(input, value);
          input.dispatchEvent(new Event("input", { bubbles: true }));
        };
        setSelect('[data-platform-account-platform]', '小红书');
        setInput('[data-platform-account-name]', '设置页小红书账号');
        document.querySelector('[data-save-platform-account]').click();
      })()`
    );
    await waitFor(
      () => evaluate(client, `document.body.innerText.includes("平台账号已保存") && document.body.innerText.includes("设置页小红书账号")`),
      "platform account saved from real settings UI",
      10_000
    );
    let settingsAccounts = await evaluate(client, `window.roster.listPlatformAccounts()`);
    const settingsAccount = settingsAccounts.find((account) => account.accountName === "设置页小红书账号");
    assert(settingsAccount?.platform === "小红书" && settingsAccount.enabled, "settings platform account did not persist as enabled");
    await evaluate(client, `document.querySelector('[data-toggle-platform-account="${settingsAccount.id}"]').click()`);
    await waitFor(
      () => evaluate(client, `document.body.innerText.includes("平台账号已停用")`),
      "platform account disabled from real settings UI",
      10_000
    );
    settingsAccounts = await evaluate(client, `window.roster.listPlatformAccounts()`);
    assert(settingsAccounts.find((account) => account.id === settingsAccount.id)?.enabled === false, "settings platform account disable did not persist");
    await evaluate(
      client,
      `(() => {
        document.querySelector('[data-edit-platform-account="${settingsAccount.id}"]').click();
        const input = document.querySelector('[data-platform-account-name]');
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
        setter.call(input, '设置页小红书账号-编辑');
        input.dispatchEvent(new Event("input", { bubbles: true }));
        document.querySelector('[data-save-platform-account]').click();
      })()`
    );
    await waitFor(
      () => evaluate(client, `document.body.innerText.includes("设置页小红书账号-编辑")`),
      "platform account edited from real settings UI",
      10_000
    );
    settingsAccounts = await evaluate(client, `window.roster.listPlatformAccounts()`);
    assert(
      settingsAccounts.find((account) => account.id === settingsAccount.id)?.accountName === "设置页小红书账号-编辑",
      "settings platform account edit did not persist"
    );
    const settingsDb = openWorkspaceDb();
    try {
      const row = settingsDb.prepare("SELECT account_name, enabled FROM platform_accounts WHERE id = ?").get(settingsAccount.id);
      assert(row?.account_name === "设置页小红书账号-编辑" && row.enabled === 0, "settings platform account SQLite row mismatch");
    } finally {
      settingsDb.close();
    }
    await evaluate(
      client,
      `(() => {
        const setInput = (selector, value) => {
          const input = document.querySelector(selector);
          const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
          setter.call(input, value);
          input.dispatchEvent(new Event("input", { bubbles: true }));
        };
        setInput('[data-model-vendor]', 'Mock 本地测试');
        setInput('[data-model-id]', 'mock-title-fast');
        setInput('[data-provider-config-base-url]', '');
        setInput('[data-api-key-value]', 'mock-provider-key');
        document.querySelector('[data-save-api-key]').click();
      })()`
    );
    await waitFor(
      () => evaluate(client, `document.body.innerText.includes("API 已保存，连接测试成功") && document.body.innerText.includes("mock-title-fast")`),
      "mock API key saved and tested from real settings UI",
      10_000
    );
    const apiKeysAfterMockSave = await evaluate(client, `window.roster.listApiKeys()`);
    const mockApiKey = apiKeysAfterMockSave.find((key) => key.provider === "mock" && key.model === "mock-title-fast");
    assert(mockApiKey, "mock API key was not saved");
    assert(mockApiKey.label === "Mock 本地测试 / mock-title-fast", "mock API key label should be generated from vendor and model");
    assert(mockApiKey.model === "mock-title-fast", "mock API key model metadata did not persist");
    const mockApiKeyTest = await evaluate(client, `window.roster.testApiKey({ apiKeyId: ${js(mockApiKey.id)} })`);
    assert(mockApiKeyTest.ok && mockApiKeyTest.models.includes("mock-title-fast"), "mock API key list-models result invalid");
    const missingApiKeyTest = await evaluate(client, `window.roster.testApiKey({ apiKeyId: "missing-api-key" })`);
    assert(!missingApiKeyTest.ok && missingApiKeyTest.errorCode === "NotFound", "missing API key test did not return NotFound");
    await evaluate(client, `document.querySelector('[data-check-for-updates]').click()`);
    await waitFor(
      () =>
        evaluate(
          client,
          `document.querySelector('[data-update-check-result]')?.innerText.includes("发现新版本") && document.body.innerText.includes("0.2.2")`
        ),
      "software update check completed from real settings UI",
      10_000
    );
    const updateCheck = await evaluate(client, `window.roster.checkForUpdates({ forceRefresh: true })`);
    assert(updateCheck.updateAvailable && updateCheck.latestVersion === "0.2.2", "update check did not parse local manifest");
    assert(updateCheck.downloadUrl === "https://example.invalid/roster/0.2.2", "update check download URL mismatch");
    await evaluate(client, `document.querySelector('[data-backup-workspace]').click()`);
    await waitFor(
      () => evaluate(client, `document.querySelector('[data-backup-path]') !== null && document.body.innerText.includes("已生成备份")`),
      "workspace backup completed from real settings UI",
      20_000
    ).catch(async (error) => {
      const directBackupProbe = await evaluate(
        client,
        `Promise.race([
          window.roster.backupWorkspace({ scope: "database", retentionCount: 7 })
            .then((result) => ({ ok: true, result }))
            .catch((caught) => ({ ok: false, error: caught instanceof Error ? caught.message : String(caught) })),
          new Promise((resolve) => setTimeout(() => resolve({ ok: false, timedOut: true }), 5000))
        ])`
      ).catch((probeError) => ({ ok: false, probeError: probeError instanceof Error ? probeError.message : String(probeError) }));
      const probe = await evaluate(
        client,
        `({
          buttonDisabled: Boolean(document.querySelector('[data-backup-workspace]')?.disabled),
          backupPath: document.querySelector('[data-backup-path]')?.innerText ?? null,
          savedMessage: Array.from(document.querySelectorAll(".text-emerald-700, .text-red-700")).map((item) => item.innerText).join("\\n"),
          bodyText: document.body.innerText.slice(0, 1600)
        })`
      );
      throw new Error(
        `${error instanceof Error ? error.message : String(error)}\nBackup probe: ${JSON.stringify(
          { ...probe, directBackupProbe, rendererConsole: rendererConsole.slice(-10), mainOutput: mainOutput.join("").slice(-2000) },
          null,
          2
        )}`
      );
    });
    const backupPath = await evaluate(client, `document.querySelector('[data-backup-path]').innerText.trim()`);
    assert(backupPath.startsWith(path.join(workspaceRoot, "_backup")), "backup was not written under workspace _backup");
    assert(backupPath.endsWith(".zip"), "backup file is not a zip");
    assert((await stat(backupPath)).size > 0, "backup zip is empty");
    const titleBeforeRestoreMutation = await evaluate(client, `window.roster.listTitles().then((titles) => titles[0])`);
    assert(titleBeforeRestoreMutation?.id, "no title available for restore verification");
    await evaluate(client, `window.roster.saveTitle({ titleId: ${js(titleBeforeRestoreMutation.id)}, text: "恢复后不应保留的标题", status: "active" })`);
    await evaluate(client, `document.querySelector('[data-restore-workspace]').click()`);
    await waitFor(
      () => evaluate(client, `document.body.innerText.includes("已恢复") && document.body.innerText.includes("恢复前备份已保存")`),
      "workspace restore completed from real settings UI",
      20_000
    );
    const preRestoreBackupPath = await evaluate(client, `document.querySelector('[data-backup-path]').innerText.trim()`);
    assert(preRestoreBackupPath.includes("pre_restore"), "pre-restore backup was not reported");
    assert(existsSync(preRestoreBackupPath), "pre-restore backup file missing");
    const restoredTitles = await evaluate(client, `window.roster.listTitles()`);
    const restoredTitle = restoredTitles.find((title) => title.id === titleBeforeRestoreMutation.id);
    assert(restoredTitle?.text === titleBeforeRestoreMutation.text, "workspace restore did not restore database contents from backup");
    const fakeApiKey = "sk-feedback-secret-1234567890";
    await evaluate(client, `window.roster.saveApiKey({ provider: "mock", label: "反馈包脱敏测试", model: "mock-title-fast", apiKey: ${js(fakeApiKey)} })`);
    await evaluate(
      client,
      `(() => {
        const textarea = document.querySelector('[data-feedback-description]');
        const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
        setter.call(textarea, '反馈描述包含 ${fakeApiKey} 应被脱敏');
        textarea.dispatchEvent(new Event("input", { bubbles: true }));
      })()`
    );
    await evaluate(client, `document.querySelector('[data-create-feedback-package]').click()`);
    await waitFor(
      () => evaluate(client, `document.querySelector('[data-feedback-package-path]') !== null && document.body.innerText.includes("已生成反馈包")`),
      "feedback package generated from real settings UI",
      20_000
    );
    const feedbackPackagePath = await evaluate(client, `document.querySelector('[data-feedback-package-path]').innerText.trim()`);
    assert(existsSync(feedbackPackagePath), "feedback package zip missing");
    const feedbackExtractPath = path.join(auditRoot, "feedback-unzipped");
    await rm(feedbackExtractPath, { recursive: true, force: true });
    await mkdir(feedbackExtractPath, { recursive: true });
    await extractZip(feedbackPackagePath, { dir: feedbackExtractPath });
    const feedbackDescription = await readFile(path.join(feedbackExtractPath, "description.txt"), "utf8");
    const feedbackSystemInfo = JSON.parse(await readFile(path.join(feedbackExtractPath, "system-info.json"), "utf8"));
    assert(feedbackDescription.includes("***"), "feedback description did not redact API key");
    assert(!feedbackDescription.includes(fakeApiKey), "feedback description leaked API key");
    assert(feedbackSystemInfo.platform, "feedback system info missing platform");
    const feedbackLogsDir = path.join(feedbackExtractPath, "logs");
    const feedbackLogFiles = (await readdir(feedbackLogsDir).catch(() => [])).filter((name) => name.endsWith(".log"));
    assert(feedbackLogFiles.length >= 1, "feedback package did not include logs");
    for (const logFileName of feedbackLogFiles) {
      const logText = await readFile(path.join(feedbackLogsDir, logFileName), "utf8");
      assert(!logText.includes(fakeApiKey), `feedback log leaked API key: ${logFileName}`);
    }
    for (let index = 0; index < 8; index += 1) {
      await evaluate(client, `window.roster.backupWorkspace({ scope: "database" })`);
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    const backupZipFiles = (await readdir(path.join(workspaceRoot, "_backup"))).filter((name) => name.endsWith(".zip"));
    assert(backupZipFiles.length === 7, `expected backup retention to keep 7 zip files, got ${backupZipFiles.length}`);

    const cacheTargets = ["video-thumbnails", "cover-timeline", "skill-market"];
    for (const target of cacheTargets) {
      const cachePath = path.join(userDataDir, "cache", target);
      await mkdir(cachePath, { recursive: true });
      await writeFile(path.join(cachePath, "__e2e-cleanup-probe.txt"), "cache cleanup probe\n", "utf8");
      assert(existsSync(cachePath), `cache target missing before cleanup: ${target}`);
      const beforeEntries = await readdir(cachePath);
      assert(beforeEntries.length > 0, `cache target had no files before cleanup: ${target}`);
    }
    await evaluate(client, `document.querySelector('[data-clean-caches]').click()`);
    await waitFor(
      () =>
        evaluate(
          client,
          `document.querySelector('[data-cache-cleanup-summary]') !== null && document.body.innerText.includes("已清理")`
        ),
      "settings cache cleanup completed from real UI",
      10_000
    );
    const cacheCleanupResult = await evaluate(client, `window.roster.cleanCaches({ targets: ["video_thumbnails", "cover_timeline", "skill_market"] })`);
    assert(cacheCleanupResult.removedFiles === 0, "cache cleanup was not idempotent after UI cleanup");
    for (const target of cacheTargets) {
      const cachePath = path.join(userDataDir, "cache", target);
      assert(existsSync(cachePath), `cache target directory was not recreated: ${target}`);
      const afterEntries = await readdir(cachePath);
      assert(afterEntries.length === 0, `cache target still has files after cleanup: ${target}`);
    }

    await evaluate(client, "window.__ROSTER_STORE__.setState({ page: 'schedules' })");
    await waitFor(
      () => evaluate(client, `document.querySelector('[data-schedules-page]') !== null`),
      "schedules overview page visible",
      10_000
    );
    await evaluate(client, `document.querySelector('[data-create-scheduled-job]').click()`);
    await waitFor(
      () => evaluate(client, `document.querySelector('[data-scheduled-job-row]') !== null && document.body.innerText.includes("已创建定时任务")`),
      "scheduled job created from real UI",
      10_000
    );
    const dueJob = await evaluate(
      client,
      `(() => {
        const nextRunAt = new Date(Date.now() - 60_000).toISOString();
        return window.roster.saveScheduledJob({
          name: "Electron 到期任务",
          type: "task_sheet",
          status: "enabled",
          scheduleLabel: "每 60 秒",
          nextRunAt,
          missedRunPolicy: "catch_up_last",
          targetPage: "tasks"
        });
      })()`
    );
    const catchAllJob = await evaluate(
      client,
      `(() => {
        const nextRunAt = new Date(Date.now() - 180_000).toISOString();
        return window.roster.saveScheduledJob({
          name: "Electron 补跑全部任务",
          type: "task_sheet",
          status: "enabled",
          scheduleLabel: "每 60 秒",
          nextRunAt,
          missedRunPolicy: "catch_up_all",
          targetPage: "tasks"
        });
      })()`
    );
    const failingScheduleJob = await evaluate(
      client,
      `(() => {
        const nextRunAt = new Date(Date.now() - 60_000).toISOString();
        return window.roster.saveScheduledJob({
          name: "Electron 错误配置任务",
          type: "task_sheet",
          status: "enabled",
          scheduleLabel: "每 60 秒",
          nextRunAt,
          missedRunPolicy: "catch_up_last",
          targetPage: "titles"
        });
      })()`
    );
    const titleAdapterJob = await evaluate(
      client,
      `window.roster.saveScheduledJob({
        name: "Electron 标题适配器任务",
        type: "title_generation",
        status: "enabled",
        scheduleLabel: "每 60 秒",
        nextRunAt: new Date(Date.now() - 60_000).toISOString(),
        missedRunPolicy: "catch_up_last",
        targetPage: "titles"
      })`
    );
    const imageAdapterJob = await evaluate(
      client,
      `window.roster.saveScheduledJob({
        name: "Electron 图片适配器任务",
        type: "image_generation",
        status: "enabled",
        scheduleLabel: "每 60 秒",
        nextRunAt: new Date(Date.now() - 60_000).toISOString(),
        missedRunPolicy: "catch_up_last",
        targetPage: "images"
      })`
    );
    const scriptAdapterJob = await evaluate(
      client,
      `window.roster.saveScheduledJob({
        name: "Electron 文案适配器任务",
        type: "script_generation",
        status: "enabled",
        scheduleLabel: "每 60 秒",
        nextRunAt: new Date(Date.now() - 60_000).toISOString(),
        missedRunPolicy: "catch_up_last",
        targetPage: "scripts"
      })`
    );
    await evaluate(client, `document.querySelector('[data-run-due-scheduled-jobs]').click()`);
    await waitFor(
      () => evaluate(client, `document.body.innerText.includes("已执行到期任务") && document.querySelector('[data-scheduled-job-last-run="${dueJob.id}"]')?.innerText.includes("成功")`),
      "scheduled due job run visible in real UI",
      10_000
    );
    await waitFor(
      () =>
        evaluate(
          client,
          `document.querySelector('[data-scheduled-job-last-run="${failingScheduleJob.id}"]')?.innerText.includes("失败")`
        ),
      "scheduled failed job visible in real UI",
      10_000
    );
    await evaluate(client, `document.querySelector('[data-load-scheduled-job-history="${failingScheduleJob.id}"]').click()`);
    await waitFor(
      () =>
        evaluate(
          client,
          `document.querySelector('[data-scheduled-job-history="${failingScheduleJob.id}"]') !== null &&
            document.querySelector('[data-scheduled-job-history-status="failed"]') !== null &&
            document.querySelector('[data-scheduled-job-history="${failingScheduleJob.id}"]')?.innerText.includes("配置无效")`
        ),
      "scheduled failure history visible in real UI",
      10_000
    );
    const failedRunHistory = await evaluate(
      client,
      `window.roster.listScheduledJobRuns({ jobId: ${js(failingScheduleJob.id)}, limit: 5 })`
    );
    assert(failedRunHistory[0]?.status === "failed", "failed scheduled run history did not load through preload IPC");
    await waitFor(
      () =>
        evaluate(
          client,
          `Promise.all([
            window.roster.listTitles(),
            window.roster.listImages(),
            window.roster.listScripts()
          ]).then(([titles, images, scripts]) => ({
            hasScheduledTitle: titles.some((title) => title.sourceSkillId === "scheduled:title_generation"),
            scheduledImage: images.find((image) => image.sourceModel === "mock-image" && image.relativePath.startsWith("images/main/")),
            hasScheduledScript: scripts.some((script) => script.sourceSkillId === "scheduled:script_generation")
          }))`
        ).then((result) => result.hasScheduledTitle && result.scheduledImage && result.hasScheduledScript),
      "scheduled workflow adapters persisted local side effects",
      10_000
    );
    const scheduledAdapterSideEffects = await evaluate(
      client,
      `Promise.all([
        window.roster.listTitles(),
        window.roster.listImages(),
        window.roster.listScripts(),
        window.roster.listPrompts(),
        window.roster.listScheduledJobRuns({ jobId: ${js(titleAdapterJob.id)}, limit: 5 }),
        window.roster.listScheduledJobRuns({ jobId: ${js(imageAdapterJob.id)}, limit: 5 }),
        window.roster.listScheduledJobRuns({ jobId: ${js(scriptAdapterJob.id)}, limit: 5 })
      ]).then(([titles, images, scripts, prompts, titleRuns, imageRuns, scriptRuns]) => ({
        titleCount: titles.filter((title) => title.sourceSkillId === "scheduled:title_generation").length,
        image: images.find((image) => image.sourceModel === "mock-image" && image.relativePath.startsWith("images/main/")),
        scriptCount: scripts.filter((script) => script.sourceSkillId === "scheduled:script_generation").length,
        generatedPrompt: prompts.find((prompt) => prompt.notes === "由主进程定时任务自动生成"),
        titleRunStatus: titleRuns[0]?.status,
        imageRunStatus: imageRuns[0]?.status,
        scriptRunStatus: scriptRuns[0]?.status
      }))`
    );
    assert(scheduledAdapterSideEffects.titleCount >= 1, "scheduled title adapter did not write title rows");
    assert(scheduledAdapterSideEffects.scriptCount >= 1, "scheduled script adapter did not write script rows");
    assert(scheduledAdapterSideEffects.image, "scheduled image adapter did not write image row");
    assert(scheduledAdapterSideEffects.generatedPrompt?.generatedCount >= 1, "scheduled image adapter did not update prompt generated count");
    assert(
      existsSync(path.join(workspaceRoot, scheduledAdapterSideEffects.image.relativePath)),
      `scheduled image file missing: ${scheduledAdapterSideEffects.image.relativePath}`
    );
    assert(
      scheduledAdapterSideEffects.titleRunStatus === "success" &&
        scheduledAdapterSideEffects.imageRunStatus === "success" &&
        scheduledAdapterSideEffects.scriptRunStatus === "success",
      "scheduled workflow adapter run histories were not successful"
    );
    const recoveredScheduleJob = await evaluate(
      client,
      `window.roster.saveScheduledJob({
        jobId: ${js(failingScheduleJob.id)},
        name: "Electron 修复后任务",
        type: "task_sheet",
        status: "enabled",
        scheduleLabel: "每 60 秒",
        nextRunAt: new Date(Date.now() - 60_000).toISOString(),
        missedRunPolicy: "catch_up_last",
        targetPage: "tasks"
      })`
    );
    assert(recoveredScheduleJob.id === failingScheduleJob.id, "scheduled job recovery changed the job id");
    await evaluate(client, `document.querySelector('[data-run-due-scheduled-jobs]').click()`);
    await waitFor(
      () =>
        evaluate(
          client,
          `document.querySelector('[data-scheduled-job-last-run="${failingScheduleJob.id}"]')?.innerText.includes("成功")`
        ),
      "scheduled failure recovery visible in real UI",
      10_000
    );
    await evaluate(client, `document.querySelector('[data-load-scheduled-job-history="${failingScheduleJob.id}"]').click()`);
    await waitFor(
      () =>
        evaluate(
          client,
          `document.querySelector('[data-scheduled-job-history="${failingScheduleJob.id}"]') !== null &&
            document.querySelector('[data-scheduled-job-history-status="success"]') !== null &&
            document.querySelector('[data-scheduled-job-history-status="failed"]') !== null`
        ),
      "scheduled recovery keeps failed history in real UI",
      10_000
    );
    const scheduleDb = openWorkspaceDb();
    try {
      const runCount = scheduleDb.prepare("SELECT COUNT(*) AS count FROM scheduled_job_runs WHERE job_id = ?").get(dueJob.id).count;
      assert(runCount >= 1, `expected at least one scheduled run history row, got ${runCount}`);
      const catchAllRunCount = scheduleDb.prepare("SELECT COUNT(*) AS count FROM scheduled_job_runs WHERE job_id = ?").get(catchAllJob.id).count;
      assert(catchAllRunCount > 1, `expected catch-up-all to create multiple run history rows, got ${catchAllRunCount}`);
      const failedThenRecovered = scheduleDb
        .prepare("SELECT status FROM scheduled_job_runs WHERE job_id = ? ORDER BY started_at ASC")
        .all(failingScheduleJob.id)
        .map((row) => row.status);
      assert(
        failedThenRecovered.includes("failed") && failedThenRecovered.includes("success"),
        `expected failed and success scheduled history rows, got ${failedThenRecovered.join(",")}`
      );
      for (const adapterJob of [titleAdapterJob, imageAdapterJob, scriptAdapterJob]) {
        const adapterRun = scheduleDb.prepare("SELECT status, artifact_summary FROM scheduled_job_runs WHERE job_id = ? ORDER BY started_at DESC LIMIT 1").get(adapterJob.id);
        assert(adapterRun?.status === "success" && adapterRun.artifact_summary, `scheduled adapter history missing for ${adapterJob.name}`);
      }
    } finally {
      scheduleDb.close();
    }
    await waitFor(
      () => evaluate(client, `document.querySelector('[data-scheduled-job-policy="${catchAllJob.id}"]')?.innerText.includes("补跑全部")`),
      "scheduled missed-run policy visible in real UI",
      10_000
    );
    await evaluate(client, `document.querySelector('[data-toggle-scheduled-job]').click()`);
    await waitFor(
      () => evaluate(client, `document.body.innerText.includes("暂停") || document.body.innerText.includes("启用")`),
      "scheduled job toggle visible",
      10_000
    );
    const scheduledJobs = await evaluate(client, `window.roster.listScheduledJobs()`);
    assert(scheduledJobs.length >= 7, "scheduled jobs were not persisted");
    for (const type of ["task_sheet", "title_generation", "image_generation", "script_generation"]) {
      assert(scheduledJobs.some((job) => job.type === type), `missing scheduled workflow entry for ${type}`);
    }
    assert(scheduledJobs.some((job) => job.missedRunPolicy === "catch_up_all"), "scheduled missed-run policy was not persisted");
    assert(scheduledJobs.some((job) => job.status === "paused"), "scheduled job toggle did not pause a job");

    const fatalConsole = rendererConsole.filter((entry) => entry.type === "error" || entry.type === "exception");
    assert(fatalConsole.length === 0, `renderer emitted fatal console errors: ${JSON.stringify(fatalConsole)}`);

    console.log(
      JSON.stringify(
        {
          ok: true,
          auditRoot,
          workspaceRoot,
          userDataDir,
          rendererUrl: rendererEntry,
          checks: {
            electronWindow: true,
            electronWindowMetrics,
            contextBridge: true,
            rendererNodeAccessBlocked: true,
            workspaceDirectories: requiredWorkspaceDirs,
            videosLoaded: videos.length,
            taskRows: sheet.rows.length,
            exportFiles: exportResult.writtenFiles,
            automaticStatusScan: true,
            duplicateScanDuplicates: duplicateScan.duplicates,
            historicalReadOnlyUi: true,
            historicalReExport: true,
            skillCenterUi: true,
            skillActivationFile: true,
            skillSaveSnapshot: true,
            skillSnapshotRestore: true,
            skillFileTreeIncludeJump: true,
            skillSubfileSave: true,
            skillImmediateTest: true,
            skillMarketUi: true,
            skillMarketInstall: true,
            skillMarketUpgrade: true,
            skillMarketHashRollback: true,
            officialSkillCopyRestore: true,
            officialSkillCopyUpgrade: true,
            imagePromptSkillGeneration: true,
            imagePromptNoImageApi: true,
            titleWorkspaceUi: true,
            titleWorkspaceStreaming: true,
            titleWorkspaceCancel: true,
            titleWorkspaceProviderFailureIsolation: true,
            titleWorkspaceSavedTitles: true,
            imageStudioUi: true,
            imageScenePresetCreate: true,
            imageScenePresetOutputSubdir: true,
            imageStudioSavedFiles: true,
            imageStudioSoftDeleteTrash: true,
            imageStudioProgressPersistence: true,
            imageStudioRegenerate: true,
            imageStudioReviewBatchReject: true,
            imageStudioPromptKeptRate: true,
            scriptWorkspaceUi: true,
            scriptWorkspaceStreaming: true,
            scriptWorkspaceCopy: true,
            scriptWorkspaceSavedScripts: true,
            scriptWorkspaceSkuLink: true,
            scriptLibraryCopy: true,
            scriptLibraryExportTxtCsv: true,
            coverWorkspaceUi: true,
            coverTimelineFrames: 30,
            coverTimelineHoverPreview: true,
            coverCropMaskDrag: true,
            coverWorkspaceSavedFile: true,
            coverWorkspaceSavedJpeg: true,
            coverCustomRatio: true,
            coverBatchFirstFrame: true,
            settingsBackupZip: true,
            settingsRestorePreBackup: true,
            settingsRestoreDatabase: true,
            settingsPolicyPersistence: true,
            settingsPlatformAccounts: true,
            settingsCloudSyncSelfCheck: true,
            settingsApiKeyConnectionTest: true,
            settingsSoftwareUpdateCheck: true,
            feedbackPackageZip: true,
            feedbackPackageRedaction: true,
            settingsBackupRetention: true,
            settingsCacheCleanup: true,
            schedulesOverviewUi: true,
            workflowScheduleEntries: true,
            scheduledJobRunHistory: true,
            scheduledWorkflowAdapters: true,
            scheduledWorkflowAdapterFiles: true,
            scheduledFailureHistory: true,
            scheduledFailureRecovery: true,
            scheduledMissedRunPolicy: true,
            scheduledCatchUpAllHistory: true,
            scheduledJobToggle: true
          }
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
    if (mainOutput.some((line) => /App bootstrap failed|Unhandled|uncaught/i.test(line))) {
      cleanupFailure = `main process output contains fatal text: ${mainOutput.join("").slice(0, 1000)}`;
    }
  }
  if (cleanupFailure) {
    failures.push(cleanupFailure);
  }
  if (failures.length > 0) {
    throw new Error(failures.join("\n"));
  }
}

main().catch(async (error) => {
  await rm(auditRoot, { recursive: true, force: true });
  console.error(error);
  process.exit(1);
});
