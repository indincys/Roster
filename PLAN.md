# PLAN.md

本文件是当前执行计划。AI 执行 `/goal` 时只按本文件列出的当前目标、剩余任务、验证门禁和停止规则执行。

## Current Objective

完成已经实现的「短视频运营工作台」v1 Electron 桌面应用的公开发布就绪工作。

当前本地仓库实现、macOS/Windows 真实 Electron 桌面验收、本地质量门、macOS signed DMG/ZIP、Windows unsigned x64 NSIS、ffmpeg/ffprobe 随包、release manifest、release verifier、GitHub Releases 公开仓库、CI signing secrets、README、最终审计文档已完成。

当前剩余范围只包含真实 API key + 网络环境下的 live paid-provider success 验收。

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

## Completed Scope

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
- macOS 和 Windows 真实 Electron 桌面审计。
- Electron 性能审计。
- macOS signed Apple Silicon app、DMG、ZIP、blockmaps、`latest-mac.yml`。
- Windows unsigned x64 NSIS installer、blockmap、`latest.yml`。
- GitHub Releases 公开仓库 `indincys/Roster`。
- macOS 自签名证书 `YourApp Self-Signed`、仓库外 `.p12` 备份、GitHub Actions `CSC_LINK` / `CSC_KEY_PASSWORD` secrets。
- Bundled ffmpeg/ffprobe license review、macOS binaries、Windows LGPL shared binaries 和 DLLs。
- `latest.json` release manifest。
- Release verifier 普通模式。
- README、final review、completion audit、release audit。

## Remaining Release Task

### 1. Custom Provider Configuration And Live Success Verification

交付项：

- 设置页支持自定义 Provider 配置。已完成。
- 支持输入并加密保存 API key。已完成。
- 支持输入 `baseURL`。已完成。
- 支持输入模型 ID。已完成。
- 支持输入模型厂商显示名。已完成。
- 支持固定厂商和用户自定义厂商。已完成。
- 固定厂商至少包含 OpenAI、Anthropic、Gemini、DeepSeek、Kimi、Doubao、Qwen、GLM。已完成。
- 支持 OpenAI-compatible 文本接口，用于 DeepSeek、Kimi、Doubao、Qwen、GLM 及用户自定义厂商。已完成。
- 用户在应用 UI 中输入真实 API key 后，OpenAI-compatible、Anthropic、Gemini 和 OpenAI Image 等真实调用成功。未完成，必须由用户提供真实 key 和网络条件。

验收范围：

- 设置页保存自定义 Provider。已通过 typecheck 和单元测试覆盖。
- 设置页保存 key、`baseURL`、模型 ID 和厂商显示名。已通过 typecheck 和单元测试覆盖。
- 连接测试成功。待真实 key 验收。
- 标题工作区生成成功。待真实 key 验收。
- 文案工作区生成成功。待真实 key 验收。
- 图片工作室生成成功。待真实 key 验收。
- `api_call_log` 不记录明文 key。已由本地测试覆盖，仍需 live 验收后复核。
- 反馈包不包含明文 key。已由本地测试覆盖，仍需 live 验收后复核。
- `npm run release:verify:strict` 不再报告 live paid-provider success 未验证。待真实 key 验收完成后解除。

## Release Verification Gates

本地结构检查：

```bash
npm run release:verify
```

公开发布门禁：

```bash
npm run release:verify:strict
```

当前 `npm run release:verify` 已通过。

当前 `npm run release:verify:strict` 只因 `live paid-provider success verification` 失败；其余发布检查已通过。

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

- 只执行 `Remaining Release Task` 中的当前任务。
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

- 缺少真实 API key 或网络验收条件。
- 任务要求删除用户真实素材、任务单、状态文件、Skill、备份或工作空间数据。
- 产品规则存在无法按 source-of-truth 优先级解决的冲突。
