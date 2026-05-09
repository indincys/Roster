# PROGRESS.md

## Current State

本文件记录当前项目状态。AI 执行任务时以本节为当前进度。

当前本地仓库实现已完成。当前执行目标是完成 `PLAN.md` 中列出的外部发布任务。

## Completed Local Scope

- v1 Electron 桌面应用本地实现已完成。
- macOS 本地 Electron 桌面验收已完成。
- main/preload/renderer 进程链路、`contextBridge` typed IPC、renderer Node API 禁用已验证。
- 工作空间、SQLite、本地文件系统、任务单导出、RPA 状态扫描、Skill、Provider、标题、图片、封面、文案、设置、备份、反馈、定时任务已纳入真实 Electron 桌面审计。
- 本地质量门已完成。
- macOS 本地未签名 app、DMG、ZIP、blockmap、`latest.json`、release verifier 已完成。
- `README.md`、`FINAL_REVIEW.md`、`COMPLETION_AUDIT.md`、`RELEASE_AUDIT.md` 已记录当前审计结论。
- `RELEASE_POLICY.md` 已更新为当前打包与自动更新策略；旧 Apple Developer ID / notarization 方案已废弃。
- 打包配置已迁移到仓库根 `electron-builder.yml`，`apps/desktop/package.json` 不再内嵌 build 配置。
- 自动更新已接入 `electron-updater`，typed IPC 会同步更新状态，右上角更新提醒入口可触发检查、下载和 `quitAndInstall(true, true)` 安装。
- GitHub Actions draft release workflow 已添加到 `.github/workflows/release.yml`，用于 macOS arm64 与 Windows x64 产物构建上传。
- GitHub Releases 仓库已创建并配置为 `indincys/Roster`，本地 `origin` 已指向 `https://github.com/indincys/Roster.git`。

## Current Verification Evidence

当前已记录通过的本地验证命令：

- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run test:integration`
- `npm run build`
- `npm run test:e2e:electron`
- `npm run test:performance:electron`
- `npm run package`
- `npm run release:verify`
- `hdiutil verify apps/desktop/release/短视频运营工作台-0.1.0-arm64.dmg`

发布门禁：

- `npm run release:verify` 是本地结构检查。
- `npm run release:verify:strict` 是公开发布就绪门禁。
- 当前 `npm run release:verify:strict` 未通过，剩余项列在下一节。

## Remaining External Release Tasks

1. Direct GitHub Release external release inputs
   - 当前 `electron-builder.yml` 已配置 `publish.owner=indincys`、`publish.repo=Roster`。
   - 仓库当前为 private；正式面向普通用户自动更新前，需要将发布仓库或 Release 资产调整为无需客户端 token 即可访问。
   - 提供 macOS 自签名证书 `YourApp Self-Signed`、加密 `.p12` 备份，以及 CI 所需 `CSC_LINK` / `CSC_KEY_PASSWORD` secrets。
   - 用真实 tag/release runner 生成当前策略下的 macOS `.dmg`、`.zip`、`latest-mac.yml`。

2. Windows release artifacts and desktop verification
   - 在 Windows 环境生成 NSIS installer。
   - Windows 不签名。
   - 在真实 Windows Electron 桌面应用中完成工作空间、SQLite、文件系统、导出、状态扫描和 RPA 路径验收。
   - 生成并上传 Windows `.exe`、`.exe.blockmap`、`latest.yml`。

3. Bundled ffmpeg/ffprobe binaries
   - 添加已通过许可审查的 `tools/ffmpeg/darwin/ffmpeg`。
   - 添加已通过许可审查的 `tools/ffmpeg/darwin/ffprobe`。
   - 添加已通过许可审查的 `tools/ffmpeg/win32/ffmpeg.exe`。
   - 添加已通过许可审查的 `tools/ffmpeg/win32/ffprobe.exe`。
   - 重新打包并确认 packaged resources 中包含对应二进制。

4. Live paid-provider success verification
   - 使用用户提供的真实 API key。
   - 在网络可用环境中验证 OpenAI、Anthropic、Gemini、OpenAI Image 的成功调用。
   - 验证标题、文案、图片工作流产出。
   - 验证 `api_call_log` 和反馈包不包含明文 key 或敏感提示词泄露。

## Current Stop Rule

当前本地功能开发任务为无。当前 macOS 本地 Electron 验收任务为无。

AI 执行 `/goal` 时只处理 `Remaining External Release Tasks`。打包、签名、发布和自动更新以 `RELEASE_POLICY.md` 为准。缺少 macOS 自签名证书、Windows 环境、许可审查后的 ffmpeg/ffprobe 二进制、真实 API key 或网络验收条件时，停止并报告外部阻塞项。
