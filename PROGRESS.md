# PROGRESS.md

## Current State

本文件记录当前项目状态。AI 执行任务时以本节为当前进度。

当前本地仓库实现已完成。`PLAN.md` 中可由工程代理完成的外部发布任务也已完成；当前唯一剩余发布门禁是用户录入真实 API key 后的 live paid-provider success 验收。

## Completed Local And External Release Scope

- v1 Electron 桌面应用本地实现已完成。
- macOS 和 Windows 真实 Electron 桌面验收已完成。
- main/preload/renderer 进程链路、`contextBridge` typed IPC、renderer Node API 禁用已验证。
- 工作空间、SQLite、本地文件系统、任务单导出、RPA 状态扫描、Skill、Provider、标题、图片、封面、文案、设置、备份、反馈、定时任务已纳入真实 Electron 桌面审计。
- 本地质量门已完成。
- `README.md`、`FINAL_REVIEW.md`、`COMPLETION_AUDIT.md`、`RELEASE_AUDIT.md` 已记录当前审计结论。
- `RELEASE_POLICY.md` 已更新为当前打包与自动更新策略；旧 Apple Developer ID / notarization 方案已废弃。
- 打包配置已迁移到仓库根 `electron-builder.yml`，`apps/desktop/package.json` 不再内嵌 build 配置。
- 自动更新已接入 `electron-updater`，typed IPC 会同步更新状态，右上角更新提醒入口可触发检查、下载和 `quitAndInstall(true, true)` 安装。
- GitHub Actions draft release workflow 已添加到 `.github/workflows/release.yml`，用于 macOS arm64 与 Windows x64 产物构建上传。
- GitHub Releases 仓库已创建并配置为公开仓库 `indincys/Roster`，本地 `origin` 已指向 `https://github.com/indincys/Roster.git`。
- macOS 自签名 codesigning identity `YourApp Self-Signed` 已创建并导入本机钥匙串。
- 加密 `.p12` 备份已保存在仓库外 `~/.roster/release/YourApp-Self-Signed.p12`；密码保存在本机钥匙串条目 `Roster YourApp Self-Signed p12 password`。
- GitHub Actions secrets `CSC_LINK` 和 `CSC_KEY_PASSWORD` 已写入 `indincys/Roster`。
- macOS signed Apple Silicon artifacts 已生成：`Roster-0.1.0-arm64.dmg`、`Roster-0.1.0-arm64.zip`、blockmaps、`latest-mac.yml`。
- Windows unsigned x64 NSIS artifacts 已在真实 Windows 机器生成并回拷：`Roster-Setup-0.1.0-x64.exe`、blockmap、`latest.yml`。
- macOS 和 Windows release artifact filenames 均为 ASCII 稳定文件名，避免 GitHub update metadata 指向 scoped package fallback 名称。
- Bundled ffmpeg/ffprobe 已完成 license review 并随包：`tools/ffmpeg/darwin/*`、`tools/ffmpeg/win32/*` 及 Windows shared DLLs。
- 统一 `latest.json` 已生成，包含 macOS DMG/ZIP 和 Windows NSIS artifact 的 size、SHA-256、SHA-512、URL 和 blockmap URL。

## Current Verification Evidence

当前已记录通过的验证命令：

- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run test:integration`
- `npm run build`
- `npm run test:e2e:electron`
- `npm run test:performance:electron`
- Windows: `npm.cmd run typecheck`
- Windows: `npm.cmd run build`
- Windows: `npm.cmd --workspace @roster/desktop run dist`
- Windows: `npm.cmd run test:e2e:electron`
- `npm --workspace @roster/desktop run dist -- --mac --arm64 --publish never`
- `hdiutil verify apps/desktop/release/Roster-0.1.0-arm64.dmg`
- `unzip -tq apps/desktop/release/Roster-0.1.0-arm64.zip`
- `codesign --verify --deep --strict --verbose=2 apps/desktop/release/mac-arm64/短视频运营工作台.app`
- `DOWNLOAD_URL_PREFIX=https://github.com/indincys/Roster/releases/download/v0.1.0 RELEASE_NOTES='Roster 0.1.0 release candidate.' npm run release:manifest`
- `npm run release:verify`

发布门禁：

- `npm run release:verify` 已通过。
- `npm run release:verify:strict` 当前只因 `live paid-provider success verification` 失败；除此之外 macOS signing、Windows x64 artifacts、ffmpeg resources、update metadata、GitHub public release asset access 均已通过。

## Remaining User-Only Release Task

1. Custom Provider live paid-provider success verification
   - 设置页已支持自定义文本 LLM Provider 配置，覆盖 API key、`baseURL`、模型 ID、模型厂商显示名和启用状态。
   - 已内置 OpenAI、Anthropic、Gemini、DeepSeek、Kimi、Doubao、Qwen、GLM，并支持 OpenAI-compatible 用户自定义厂商。
   - 标题工作区、文案工作区、Skill 即时测试和图片提示词生成入口会读取已启用 Provider 的默认模型。
   - 需要用户在应用 UI 中输入真实 API key 后，在网络可用环境中验证 OpenAI-compatible、Anthropic、Gemini、OpenAI Image 等成功调用。
   - 需要验证标题、文案、图片工作流产出。
   - 需要确认 `api_call_log` 和反馈包不包含明文 key 或敏感提示词泄露。

## Current Stop Rule

当前本地功能开发任务为无。当前 macOS/Windows 本地 Electron 验收任务为无。

AI 执行 `/goal` 时只处理 `Remaining User-Only Release Task`。缺少真实 API key 或网络验收条件时，停止并报告该用户侧阻塞项。
