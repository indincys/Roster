# 短视频运营工作台

本仓库实现跨平台 Electron 桌面应用「短视频运营工作台」。v1 采用本地优先、多品牌工作空间隔离、SQLite 数据库和类型化 IPC。

## 开发命令

```bash
npm install
npm run dev
npm run typecheck
npm run lint
npm test
npm run test:integration
npm run test:e2e:electron
npm run test:performance:electron
npm run build
npm run package
npm run release:manifest
npm run release:verify
npm run release:verify:strict
```

`npm run dev` 会先为当前 Electron 版本重建 `better-sqlite3`，再启动 `electron-vite dev`。

## 验证规则

本项目是 macOS + Windows 本地 Electron 桌面应用，不是 Web App。涉及 UI、IPC、文件系统、SQLite、导出、状态扫描、工作空间、设置、Provider、Skill、图片、封面或定时任务的验收，必须优先运行真实 Electron 应用：

```bash
npm run test:e2e:electron
```

该命令运行 `tests/e2e/electron-desktop-audit.mjs`。这是当前全量 Electron 桌面审计入口，覆盖 M1-M7 关键流程；旧的 `tests/e2e/electron-m1-m3-audit.mjs` / `.mj` 名称已废弃，不要按旧文件名理解为只测 M1-M3。

浏览器、Vite preview、`http://127.0.0.1:*` 只能作为 renderer smoke test，不能写成桌面端验收。

性能验收同样使用真实 Electron 应用：

```bash
npm run build
npm run test:performance:electron
```

该脚本会启动 built Electron app，创建临时工作空间，种入 1 万条视频、500 张图片和任务单依赖数据，并通过 preload IPC 与真实 UI 验证列表虚拟化、滚动帧间隔和 100 行任务单生成耗时。

## 用户手册

### 1. 创建工作空间

在设置页选择或新建品牌目录。应用会在目录内生成：

```text
workspace.db
workspace.json
workspace.lock
videos/
covers/
images/
tasks/
skills_config/
_backup/
```

同一品牌的数据、Skill 启用配置和平台账号都保存在该工作空间内。建议把工作空间放在 OneDrive、Dropbox、坚果云等同步盘目录，但同一时间只让一个设备写入同一个 `workspace.db`。

### 2. 准备素材和数据库

把视频放入 `videos/` 后进入视频库点击重新扫描。应用只记录相对路径，不复制原视频。标签库、标题库、提示词库、图片库和文案库可在数据库分区维护，后续任务单、AI 工作区和封面工作区都会复用这些数据。

### 3. 生成并导出任务单

在任务单页选择平台账号、视频数量、标题策略、标签比例和发布时间锚点后生成任务单。导出会写入：

```text
tasks/<date>/tasks.xlsx
tasks/<date>/tasks.csv
tasks/<date>/tasks.json
tasks/<date>/preflight.json
tasks/<date>/status/
```

Excel/CSV/JSON 面向 Windows RPA 执行路径；UI 中仍展示当前设备路径。RPA 状态文件应写入 `status/`，应用会保留原文件并按 `run_key` 幂等回写状态。

### 4. 使用 AI 工作区

Skill 中心用于安装、编辑、快照和复原 Skill；标题工作区和文案工作区通过 typed preload IPC 流式生成并支持取消。图片工作室第一步通过已启用的 `image_prompt` Skill 和文本 LLM 生成提示词，图片生成步骤再调用图片 Provider。设置页可配置自定义文本 LLM Provider、`baseURL`、模型 ID、模型厂商和 API key。真实 Provider live smoke 可在需要排查厂商兼容性时手动执行，但不是发布门禁。

### 5. 封面、备份和维护

封面工作区会基于视频时间轴保存 JPG 到 `covers/`。设置页提供工作空间备份、恢复、反馈包生成、缓存清理、平台账号维护、云同步自检和软件更新检查。反馈包会对 API key 等敏感内容脱敏。

## 打包

打包、签名、发布和自动更新以 `RELEASE_POLICY.md` 为准。当前发布策略为 GitHub Releases 直发、macOS 自签名、Windows 不签名、应用内自动更新。

本地目录包：

```bash
npm run package
```

该命令会生成 `apps/desktop/release/mac-arm64/短视频运营工作台.app`，用于本机 bundle 结构和生产包启动验证。

完整分发包在 desktop workspace 下执行：

```bash
npm --workspace @roster/desktop run dist
```

目标 electron-builder 配置包含：

- macOS：仅 Apple Silicon (`arm64`)，DMG + ZIP。ZIP 是 `electron-updater` 必需产物。
- macOS 签名：自签名证书 `YourApp Self-Signed`，不使用 Apple Developer ID，不做 notarization，`hardenedRuntime` 必须为 `false`。
- Windows：仅 Windows 10/11 `x64`，NSIS installer。Windows 不签名。
- ASAR：开启。
- native 模块：`better-sqlite3` 由 electron-builder rebuild 并放入 `app.asar.unpacked`。
- 图标：`apps/desktop/build/icon.icns`，可用 `swift scripts/generate_app_icon.swift` 后再运行 `iconutil -c icns apps/desktop/build/icon.iconset -o apps/desktop/build/icon.icns` 重新生成。
- ffmpeg：已按平台随包，来源和许可记录见 `tools/ffmpeg/README.md`。macOS 使用 `tools/ffmpeg/darwin/ffmpeg`、`tools/ffmpeg/darwin/ffprobe`；Windows 使用 `tools/ffmpeg/win32/ffmpeg.exe`、`tools/ffmpeg/win32/ffprobe.exe` 和 LGPL shared DLLs。

macOS 首次安装可能触发 Gatekeeper 提示，Windows 首次安装可能触发 SmartScreen 提示；这是当前免费直发策略的预期行为。后续更新通过应用内右上角提醒图标下载并安装，不跳转 GitHub 手动下载。

### 自动更新约定

- 更新使用 `electron-updater` + GitHub Releases。
- `autoUpdater.autoDownload = false`，用户点击右上角更新提醒图标后才下载。
- `autoUpdater.autoInstallOnAppQuit = true`。
- 重启安装必须调用 `autoUpdater.quitAndInstall(true, true)`。
- 启动 5 秒后检查一次更新，之后每 4 小时检查一次。
- 更新事件通过 typed IPC 同步到 renderer，由 Zustand store 管理 UI 状态。
- 右上角提醒图标只在更新状态不是 `idle` 时显示。
- `electron-builder.yml` 中的 `publish.owner` 和 `publish.repo` 已配置为 `indincys/Roster`；该 GitHub 仓库当前为 public，Release 资产可无需客户端 token 访问。

### 发布前检查

1. 运行 `npm run typecheck`、`npm run lint`、`npm test`、`npm run test:integration`、`npm run build`。
2. 运行 `npm run test:e2e:electron`，确认真实 Electron main/preload/renderer 链路、SQLite、文件系统、导出和状态扫描通过。
3. 运行 `npm run test:performance:electron`，确认大列表和 100 行任务单性能未退化。
4. 运行 `npm run package` 并启动 `apps/desktop/release/mac-arm64/短视频运营工作台.app` 做本地包 smoke。
5. 确认 macOS 自签名证书 `YourApp Self-Signed` 存在；当前 `.p12` 备份位于仓库外 `~/.roster/release/YourApp-Self-Signed.p12`，CI 已通过 `CSC_LINK` 和 `CSC_KEY_PASSWORD` 注入。
6. 在 GitHub Actions macOS + Windows 双 runner 上构建发布包，或使用当前已验证的本机/Windows runner 产物，确认包含：
   - macOS: `.dmg`、`.zip`、`latest-mac.yml`
   - Windows: `.exe`、`.exe.blockmap`、`latest.yml`
7. 运行 `npm run release:verify`，确认 app bundle、ASAR、native 模块、图标、DMG/ZIP、NSIS installer、update metadata、blockmap、ffmpeg/ffprobe resources 和 artifact integrity 存在且一致。该 verifier 按 `RELEASE_POLICY.md` 检查当前发布策略，不再把 Apple Developer ID、notarization、stapling、Windows 签名或 Windows portable 作为门禁。
   - 普通模式用于本机结构检查，允许 warnings 存在。
   - 公开发布前必须运行 `npm run release:verify:strict`；严格模式会把本地发布产物和更新链路的 warning 视为失败，避免把缺 Windows/ffmpeg 或更新链路破损的包误判为可发布。也可以直接使用 `node scripts/verify_release_artifacts.mjs --strict` 或 `ROSTER_RELEASE_STRICT=1 npm run release:verify`。
8. 在 Windows 环境生成并验证 NSIS 包，覆盖同一套工作空间、导出和状态回写流程；当前已在 `INDINCYSWINDOWS` 真实 Windows runner 上通过。
9. 验证应用内更新：旧版本启动 5 秒后可发现 GitHub Release 新版本，右上角提醒图标出现，用户点击后可下载、校验、安装并重启。
10. 可选：如果本次改动涉及 Provider 兼容性，可在用户提供真实 API key 和网络条件时手动做 live smoke，确认标题/文案/图片输出和脱敏日志。此项不是发版门禁。

当前已验证的 macOS/Windows artifacts 位于 `apps/desktop/release/`。历史 Apple Developer ID / notarization 方案已废弃，不作为当前发布门禁。

## 当前状态

- Monorepo：`apps/desktop` 与 `packages/*`。
- Electron 进程边界：main 负责窗口、SQLite、文件系统和 IPC；preload 只暴露 `window.roster`；renderer 不直接访问 Node 文件系统或数据库。
- 工作空间：创建时生成 `workspace.db`、`workspace.json`、`workspace.lock`、`videos/`、`covers/`、`images/`、`tasks/`、`skills_config/`、`_backup/`。
- 凭证：API key 使用本机 vault 密钥进行 AES-256-GCM 加密，数据库只保存密文、IV、auth tag 和指纹。
- UI：顶部条、左侧栏、Dashboard、任务单、视频库、数据库、Skill、标题/图片/文案/封面工作区、设置和定时任务总览。
- 发布链路：macOS signing、Windows x64 NSIS、ffmpeg/ffprobe 随包、GitHub public Release 资产访问和 release verifier 已配置完成。
