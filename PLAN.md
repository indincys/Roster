# PLAN.md

本文件是当前执行计划。AI 执行 `/goal` 时只按本文件列出的当前目标、剩余任务、验证门禁和停止规则执行。

## Current Objective

完成已经实现的「短视频运营工作台」v1 Electron 桌面应用的公开发布就绪工作。

当前本地仓库实现、macOS 本地 Electron 桌面验收、本地质量门、macOS 本地未签名打包、release manifest、release verifier、README、最终审计文档已完成。

当前剩余范围只包含外部发布任务。

## Source Documents

产品规则和工程约束按以下优先级执行：

1. `需求整理.md`
2. `产品功能技术开发文档.md`
3. `技术方向决定备忘录.md`
4. `UIUX需求文档.md`
5. `design/`

当前进度和发布阻塞按以下文件执行：

1. `PROGRESS.md`
2. `RELEASE_POLICY.md`
3. `RELEASE_AUDIT.md`
4. `FINAL_REVIEW.md`
5. `COMPLETION_AUDIT.md`
6. `README.md`
7. `package.json`

## Completed Local Scope

- Electron + React + TypeScript 桌面应用实现。
- main/preload/renderer 进程边界和 typed IPC。
- 本地优先工作空间、SQLite、相对路径存储和运行时路径展示。
- 视频库、标签库、标题库、提示词库、图片库、文案库。
- 任务单生成、编辑、导出、`preflight.json`、`status/`、RPA 状态扫描、重试、历史任务单。
- Skill include 解析、Skill 中心、Skill 市场、快照、复原、官方副本、即时测试。
- LLM Provider 和图片 Provider 抽象层。
- 标题工作区、图片工作室、文案工作区。
- 封面时间轴、hover 预览、裁剪、JPG 保存、批量首帧。
- 设置、备份、恢复、反馈包、日志脱敏、缓存清理、软件更新检查。
- 定时任务总览、执行历史、错过补跑策略、工作流调度入口。
- macOS 本地 Electron 桌面审计。
- Electron 性能审计。
- macOS 本地未签名 app、DMG、ZIP、blockmap、update manifest。
- Release verifier 普通模式。
- README、final review、completion audit、release audit。

## Remaining Release Tasks

### 1. Direct GitHub Release Packaging And Auto-Update Policy

交付项：

- 新增并执行 `RELEASE_POLICY.md` 中定义的 direct GitHub release 策略。
- macOS 仅 Apple Silicon (`arm64`)。
- Windows 仅 Windows 10/11 `x64`。
- macOS 使用自签名证书 `YourApp Self-Signed`，不使用 Apple Developer ID，不做 notarization。
- Windows 不签名。
- 打包配置迁移为双端共用 `electron-builder.yml`。
- 自动更新使用 `electron-updater` 和 GitHub Releases。
- 应用内右上角更新提醒图标触发下载和安装，不跳转 GitHub 手动下载。
- 更新链路按 `autoUpdater.autoDownload = false`、`autoUpdater.autoInstallOnAppQuit = true`、`autoUpdater.quitAndInstall(true, true)` 实现。
- 启动 5 秒后检查一次更新，之后每 4 小时检查一次。

验收命令：

```bash
npm run release:verify
npm run release:verify:strict
hdiutil verify <dmg>
```

历史要求中的 Apple Developer ID、notarization、stapling 和 Windows 代码签名不再作为当前发布目标。

### 2. Windows NSIS/Portable Build And Desktop Verification

交付项：

- Windows NSIS installer。
- 如 `RELEASE_POLICY.md` 后续明确保留 portable，再生成 Windows portable `.exe`；当前主发布目标是 NSIS x64。
- Windows 不签名。
- 真实 Windows Electron 桌面应用验收。

验收范围：

- 应用启动和窗口出现。
- main/preload/renderer 链路。
- typed `contextBridge` IPC。
- renderer Node API 禁用。
- 工作空间创建和切换。
- SQLite 写入。
- 文件系统副作用。
- 任务单导出。
- Windows RPA 执行路径。
- `status/*.json` 扫描和幂等回写。
- Windows artifacts 被 `npm run release:verify:strict` 接受。

### 3. Bundled Ffmpeg/Ffprobe Binaries

交付项：

```text
tools/ffmpeg/darwin/ffmpeg
tools/ffmpeg/darwin/ffprobe
tools/ffmpeg/win32/ffmpeg.exe
tools/ffmpeg/win32/ffprobe.exe
```

验收范围：

- 二进制来源和 license review 完成。
- POSIX 二进制具备可执行权限。
- 打包后资源目录包含对应文件。
- 视频元数据、缩略图、封面时间轴、封面保存流程通过真实 Electron 桌面验证。
- `npm run release:verify:strict` 不再报告 ffmpeg/ffprobe 缺失。

### 4. Custom Provider Configuration And Live Success Verification

交付项：

- 设置页支持自定义 Provider 配置。已完成。
- 支持输入并加密保存 API key。已完成。
- 支持输入 `baseURL`。已完成。
- 支持输入模型 ID。已完成。
- 支持输入模型厂商显示名。已完成。
- 支持固定厂商和用户自定义厂商。已完成。
- 固定厂商至少包含 OpenAI、Anthropic、Gemini、DeepSeek、Kimi、Doubao、Qwen、GLM。已完成。
- 支持 OpenAI-compatible 文本接口，用于 DeepSeek、Kimi、Doubao、Qwen、GLM 及用户自定义厂商。已完成。
- 用户在应用 UI 中输入真实 API key 后，OpenAI-compatible、Anthropic、Gemini 和 OpenAI Image 等真实调用成功。

验收范围：

- 设置页保存自定义 Provider。已通过 typecheck 和单元测试覆盖。
- 设置页保存 key、`baseURL`、模型 ID 和厂商显示名。已通过 typecheck 和单元测试覆盖。
- 连接测试成功。
- 标题工作区生成成功。
- 文案工作区生成成功。
- 图片工作室生成成功。
- `api_call_log` 不记录明文 key。
- 反馈包不包含明文 key。
- `npm run release:verify:strict` 不再报告 live paid-provider success 未验证。

## Release Verification Gates

本地结构检查：

```bash
npm run release:verify
```

公开发布门禁：

```bash
npm run release:verify:strict
```

公开发布门禁必须无 warning、无 error。

## Standard Local Quality Gates

涉及代码、构建配置、打包配置或测试变更时运行：

```bash
npm run typecheck
npm run lint
npm test
npm run test:integration
npm run build
```

涉及 UI、IPC、本地文件、SQLite、导出、状态扫描、工作空间、设置、Provider、Skill、图片、封面或定时任务时运行：

```bash
npm run test:e2e:electron
```

涉及性能、大列表、图片网格或任务单生成性能时运行：

```bash
npm run test:performance:electron
```

涉及发布包、manifest、签名、自动更新、Windows artifacts、ffmpeg resources 或 live provider release gate 时运行：

```bash
npm run package
npm run release:manifest
npm run release:verify
npm run release:verify:strict
```

## Execution Rules

- 只执行 `Remaining Release Tasks` 中的当前任务。
- 所有 UI 和端到端验收使用真实 Electron 桌面应用。
- 浏览器、Vite preview、静态 HTML、`http://127.0.0.1:*` 只作为 renderer smoke。
- renderer smoke 不作为桌面端验收。
- renderer 不直接访问 Node 文件系统、数据库或进程 API。
- 业务路径字段只存相对路径，统一使用 `/`。
- API key 不明文落库、不写日志、不进入反馈包。
- Release 普通验证通过不代表公开发布就绪。
- Strict release gate 通过才代表公开发布检查完成。
- 打包、签名、发布和自动更新以 `RELEASE_POLICY.md` 为准。
- 与 `RELEASE_POLICY.md` 冲突的 Apple Developer ID、notarization、Windows 签名或跨架构发布要求一律废弃。

## Stop Conditions

遇到以下任一条件时停止并报告当前阻塞项：

- 缺少 macOS 自签名证书 `YourApp Self-Signed`、`.p12` 加密备份或 CI 注入变量。
- 缺少 Windows 构建或真实桌面验收环境。
- 缺少已完成 license review 的 ffmpeg/ffprobe redistributable binaries。
- 缺少真实 API key 或网络验收条件。
- 任务要求删除用户真实素材、任务单、状态文件、Skill、备份或工作空间数据。
- 产品规则存在无法按 source-of-truth 优先级解决的冲突。
