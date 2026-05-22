# [AGENTS.md](http://AGENTS.md)

本文件是「短视频运营工作台」项目的仓库级长期指令。Codex、Claude Code 或其他工程代理在本仓库工作时必须先阅读本文件，再阅读当前任务相关文档。

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
- Windows 验收结果必须记录实际 Windows 用户、主机名、局域网 IP、命令和产物路径。

## Release Gates

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

## Implementation Discipline

- 保持变更聚焦。
- 使用仓库现有模式、框架和 helper API。
- 新增或修改跨模块契约时同步共享类型或 schema。
- 新增模块时同步测试和必要文档。
- 不把原型代码生搬硬套为生产代码。
- 不使用硬编码绝对路径保存业务数据。
- 不在客户端内置私有 GitHub token。
- 不删除或覆盖用户本地素材、任务单、状态文件、Skill 或备份，除非任务明确要求且用户确认。

