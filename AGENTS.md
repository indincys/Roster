# AGENTS.md

本文件是「短视频运营工作台」项目的仓库级长期指令。Codex、Claude Code 或其他工程代理在本仓库工作时必须先阅读本文件，再阅读当前任务相关文档。

## Current State

本地 v1 产品实现和发布链路已完成。仓库不再保留临时执行计划文档；长期规则以本文件为准。

AI 恢复长线程或判断当前任务时，按以下顺序读取长期上下文：

1. `AGENTS.md`
2. `RELEASE_POLICY.md`
3. `README.md`
4. `package.json`
5. 当前任务涉及的产品源文档、源码和测试

## Source Of Truth

产品规则和工程约束优先级：

1. `需求整理.md`
2. `产品功能技术开发文档.md`
3. `技术方向决定备忘录.md`
4. `UIUX需求文档.md`
5. `design/`

开始实现产品行为前先用 `rg --files` 和 `rg -n "^#{1,4} "` 找到相关文件和章节。

## Product Definition

本产品是 macOS + Windows 跨平台 Electron 桌面应用，不是 Web App。

核心定位：

- 本地优先。
- 多品牌工作空间隔离。
- SQLite 工作空间数据库。
- typed IPC。
- 短视频运营任务单、AI 内容生产、数据库管理、封面处理、RPA 状态回写聚合到一个本地桌面工作台。

v1 范围：

- 工作空间。
- 视频库。
- 标签库、标题库、提示词库、图片库、文案库。
- 任务单生成、编辑、导出、状态回写、重试、历史查看。
- Skill 系统、Skill 市场、include 静态展开。
- 标题工作区、图片工作室、文案工作区。
- 封面工作区。
- Provider 抽象层。
- 设置、备份、反馈、日志、软件维护。
- 定时任务总览和调度。
- macOS/Windows 打包和发布门禁。

v1 不做：

- 暗色模式。
- 移动端。
- 多人协作和共享工作空间。
- AI 推荐封面、封面创作、关键帧评分。
- 让 LLM 自己读 Skill 子文件。
- AI 自动总结反面库并优化 Skill。
- 后台守护进程。

## Architecture Rules

技术栈：

- Electron
- React + TypeScript
- Tailwind CSS + shadcn/ui
- Zustand
- SQLite + `better-sqlite3`
- `chokidar`
- `ffmpeg` binary + `fluent-ffmpeg`
- `exceljs`
- 官方 SDK + 自建 LLM provider 抽象层
- 自建图片 provider 抽象层
- Octokit
- electron-builder
- electron-updater

进程边界：

- Main process：窗口管理、菜单/托盘、文件系统、SQLite、ffmpeg/子进程、HTTP/API 调用、调度器。
- Preload：通过 `contextBridge` 暴露受限 typed API。
- Renderer：React UI、交互和 Zustand 状态。
- Worker/child process：视频拉帧、批量文件操作、批量导入导出等 CPU/IO 密集任务。

安全规则：

- `nodeIntegration` 关闭。
- `contextIsolation` 启用。
- Renderer 不直接访问文件系统、数据库、进程 API 或 Node API。
- IPC 使用 TypeScript 类型和共享 schema。
- 禁止无类型的 `ipcRenderer.send(..., anyData)`。
- Skill include 展开 fail closed。
- API key 不明文落库、不写日志、不进入反馈包、不提交仓库。

性能规则：

- 超过 100 行的列表/网格使用虚拟列表。
- 视频预览不做实时高频 scrubbing。
- 封面时间轴使用 ffmpeg 预渲染 30-60 帧缩略图序列。
- 批量数据库写入使用事务。
- 状态文件扫描默认 5 秒一次。
- 大文件处理和 ffmpeg 操作不阻塞主进程。

## Data And Files

工作空间目录：

```text
品牌A/
├── workspace.db
├── workspace.json
├── workspace.lock
├── videos/
├── covers/
├── images/
├── tasks/
├── skills_config/
└── _backup/
```

数据规则：

- 所有业务路径字段存相对路径。
- 相对路径统一使用 `/`。
- 绝对路径只在运行时根据当前 OS 或目标执行平台拼接。
- 任务单导出到 `<workspace>/tasks/<date>/`。
- 任务单导出生成 `tasks.xlsx`、`tasks.csv`、`tasks.json`、`preflight.json`。
- 任务单导出创建 `status/` 目录。
- RPA 状态写入 `<workspace>/tasks/<date>/status/<task_id>__attempt-<n>.json`。
- 状态文件先写 `.tmp` 再原子重命名为 `.json`。
- 应用只读取 `.json` 状态文件。
- RPA 状态文件读后保留。
- 重试创建新的 `attempt_no` 和 `run_key`。
- 同一工作空间同一时间只允许一个 App 实例写入 `workspace.db`。

## UI And UX

UI 以 `UIUX需求文档.md` 为准，参考 `design/` 原型的布局、交互密度和 mock 数据。

视觉规则：

- 桌面应用范式：顶部条 + 左侧栏 + 主内容区。
- 专业、克制、信息密集。
- 避免营销式页面和大面积装饰。
- 不做紫色渐变、星空、霓虹、毛玻璃或夸张 AI 风。
- v1 浅色模式。
- 组件圆角控制在 6-8px。
- 使用 Lucide 图标。
- 数据表行高 32-36px。
- 正文主层约 14px。
- 次层约 12px。
- 空状态必须有明确下一步 CTA。
- 大型列表、图片网格、任务表尺寸稳定。
- 不照搬 `design/shell.jsx` 中的 macOS 交通灯式视觉。

## Testing And Verification

默认质量门：

```bash
npm run typecheck
npm run lint
npm test
npm run test:integration
npm run build
```

真实 Electron 桌面验收：

```bash
npm run test:e2e:electron
```

性能验收：

```bash
npm run test:performance:electron
```

发布验证命令和公开发布门禁见 `Release Gates`。

测试规则：

- UI、IPC、本地文件、SQLite、导出、状态扫描、工作空间、设置、Provider、Skill、图片、封面、定时任务验收使用真实 Electron 桌面应用。
- Electron 验收经过 main/preload/renderer 链路。
- Electron 验收验证 `contextBridge` typed IPC。
- Electron 验收验证本地磁盘和 SQLite 副作用。
- 浏览器、Vite preview、静态 HTML、`http://127.0.0.1:*` 只作为 renderer smoke。
- renderer smoke 不作为桌面端验收。
- `tests/e2e/electron-desktop-audit.mjs` 是当前真实 Electron 桌面审计入口。
- `tests/e2e/electron-m7-performance.mjs` 是当前真实 Electron 性能验收入口。

Windows 真实桌面验收：

- 局域网内 Windows 10/11 x64 机器作为长期 Windows runner。
- Windows 机器应启用 OpenSSH Server，`sshd` 设为 Automatic，并通过 Windows 防火墙放行 TCP 22。
- 当前已验证 Windows runner：用户 `indin`，主机 `INDINCYSWINDOWS` / `indincysWindows`，局域网 IP `192.168.31.46`。
- Mac 端已建立全局 Windows 开发通道，优先使用通用 SSH alias `windows` / `win` / `windows-dev` 登录 Windows；`roster-windows` 仅作为兼容别名保留。
- Mac 端专用 SSH key 为 `~/.ssh/windows_dev_ed25519`，旧 key `~/.ssh/roster_windows_ed25519` 仅作兼容备份；不在聊天中传递 Windows 密码。
- 推荐连接命令：`ssh windows "cmd /c \"whoami && hostname && echo %CD%\""`。
- Mac 端通用辅助命令：`win` 打开/执行 SSH 命令，`wincmd` 执行 `cmd.exe /c` 命令，`winps` 执行 PowerShell 命令，`wincp` 上传文件到 Windows，`winaddr` 查询当前局域网 IP。
- Windows 用户的 `authorized_keys` 中应包含 Mac 端公钥 `roster-windows-ssh`。
- Windows 通用开发目录为 `C:\Users\indin\Dev`；后续 Windows 构建、打包、命令行测试和日志收集优先通过 Mac -> Windows SSH 执行。
- 已验证 Windows 工具链：Git、GitHub CLI、ripgrep、npm。Windows 发布构建优先使用 `C:\Users\indin\Dev\Tools\node-v22.22.3-win-x64` 并将其加入当前命令的 `PATH`，保持与 CI Node 22 一致；系统 WinGet Node 可能是 v24，不适合本仓库的 `better-sqlite3` 原生依赖安装。
- UU 远程虚拟地址 `198.18.0.1` 可作为屏幕控制通道参考，但当前 Mac -> Windows SSH 已验证使用局域网地址 `192.168.31.46`。
- 真实桌面窗口、安装器交互、SmartScreen 提示、Electron UI 验收可通过用户已授权的 UU 远程控制窗口操作。
- 通过 UU 远程修改远程访问、防火墙、账号或安全策略前，必须有用户明确授权；当前用户已授权启用持久化 SSH 并配置防火墙，用于本项目 Windows 测试和 debug。
- Windows 验收结果必须记录实际 Windows 用户、主机名、局域网 IP、命令和产物路径。

必须覆盖的测试领域：

- 任务单生成算法。
- 时间分配算法。
- 路径转换和路径校验。
- Skill include 解析器。
- RPA 状态文件幂等处理。
- 数据库迁移和事务写入。
- Provider 错误处理、取消、重试和多模型 `allSettled` 容错。
- API key 加密存储和脱敏。
- 大列表虚拟化。

Provider live smoke 可在用户明确提供真实 API key 和网络条件时执行，用于排查具体厂商兼容性；它不是发版门禁。发版不要求验收 OpenAI-compatible、Anthropic、Gemini、OpenAI Image 等真实付费端点。

## Release Gates

发布、签名、打包和自动更新约束以 `RELEASE_POLICY.md` 为准。历史 Apple Developer ID、notarization、Windows 签名或跨架构发布方案均已废弃。

发布仓库固定为 `indincys/Roster` / `https://github.com/indincys/Roster.git`。应用内更新必须走 `electron-updater` + published GitHub Release，不跳转 GitHub 让用户手动下载。

用户说“发版”时，默认含义是完整执行应用内自动更新发布链路，而不是只构建本地产物：

1. 根据变更选择下一个正式 semver 版本号，更新根 `package.json`、`apps/desktop/package.json` 和 `package-lock.json`。
2. 运行适用质量门和发布门禁，至少包括 `npm run typecheck`、`npm run lint`、`npm test`、`npm run test:integration`、`npm run build`、`npm run release:verify` 和 `npm run release:verify:strict`。
3. 构建 macOS arm64 DMG + ZIP 和 Windows x64 NSIS 安装包，确认 `latest-mac.yml` 指向 ZIP，`latest.yml` 指向 Windows `.exe`，并随 release 上传对应 blockmap。
4. 提交版本变更，创建并推送 `v{version}` tag 到 `origin`。
5. 在 GitHub Releases 上创建或更新 `v{version}` Release，上传 macOS、Windows 和更新元数据资产，并发布为 published release。Draft release、GitHub Actions artifact 或本地 `apps/desktop/release/` 产物都不等于客户端可检测更新。
6. 发布后验证 `gh release view v{version} --repo indincys/Roster` 可见，Release 资产无需客户端 token 可访问，旧版 macOS 和 Windows 已安装应用能检测、下载、校验、安装并重启到新版本。

应用内更新链路排查优先检查：

- 远端是否存在 published GitHub Release；`gh release list --repo indincys/Roster` 为空时，客户端不会发现更新。
- 远端是否存在对应 `v{version}` tag，且新版本号严格大于本地已安装版本。
- Release 是否不是 draft、不是 prerelease。
- Release 资产是否包含 macOS `.dmg`、`.zip`、`latest-mac.yml`、Windows `.exe`、`.exe.blockmap`、`latest.yml`。
- `latest-mac.yml` / `latest.yml` 中的 `path`、`files[].url`、`sha512`、`size` 是否与上传资产一致。
- 打包产物内是否包含 `app-update.yml`，且 owner/repo 指向 `indincys/Roster`。
- macOS 端是否仍使用同一个 `YourApp Self-Signed` identity，Windows 端是否仍是 per-user NSIS (`perMachine: false`)。

发布验证：

```bash
npm run release:verify
npm run release:verify:strict
```

当前已完成的发布外部项：

- `indincys/Roster` 为 public GitHub 仓库，Release 资产可无需客户端 token 访问。
- macOS codesigning identity `YourApp Self-Signed` 已在本机钥匙串中可用。
- 加密 `.p12` 备份位于仓库外 `~/.roster/release/YourApp-Self-Signed.p12`，密码保存在本机钥匙串条目 `Roster YourApp Self-Signed p12 password`。
- GitHub Actions secrets `CSC_LINK` 和 `CSC_KEY_PASSWORD` 已配置。
- ffmpeg/ffprobe redistributable binaries 已按平台随包，来源和 license review 见 `tools/ffmpeg/README.md`。

2026-05-20 更新链路排查结论：即使本地或 CI 已生成 artifacts，只要 GitHub 上没有 published Release 和对应更新元数据，macOS / Windows 已安装客户端都无法通过 `electron-updater` 检测到远端更新。后续每次发版都必须重新检查远端 tag、published Release 和更新资产。

当前没有需要用户真实 API key 或付费网络调用才能解除的发布阻塞项。

## Implementation Discipline

- 保持变更聚焦。
- 使用仓库现有模式、框架和 helper API。
- 新增或修改跨模块契约时同步共享类型或 schema。
- 新增模块时同步测试和必要文档。
- 不把原型代码生搬硬套为生产代码。
- 不使用硬编码绝对路径保存业务数据。
- 不在客户端内置私有 GitHub token。
- 不删除或覆盖用户本地素材、任务单、状态文件、Skill 或备份，除非任务明确要求且用户确认。

## Stop Conditions

遇到以下条件时停止并报告阻塞项：

- 需要用户决定未定义产品策略。
- 文档冲突且无法按 source-of-truth 优先级解决。
- 当前改动可能删除用户数据或破坏已有工作空间。
