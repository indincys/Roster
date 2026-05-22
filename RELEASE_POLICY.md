# RELEASE_POLICY.md

本文件定义「短视频运营工作台」的应用打包、签名、发布和自动更新约定。

修改本文件涉及的配置前必须确认影响范围，因为错误配置会导致老用户更新链路损坏。

## Platform Support

- macOS: 仅 Apple Silicon (`arm64`)。
- Windows: 仅 Windows 10/11 `x64`。
- 不支持其他架构，包括 macOS Intel、Windows ARM、Windows x86。

## Signing Strategy

### macOS

- 使用自签名证书 `YourApp Self-Signed`。
- 证书在开发者本机钥匙串中创建，有效期 10 年。
- 私钥 `.p12` 仅存在于开发者本机和加密备份，严禁提交仓库。
- 所有版本必须使用同一个证书。
- 更换证书会让老用户重新触发 Gatekeeper 警告，因此默认禁止更换。
- CI 中通过 `CSC_LINK`（base64 编码 `.p12`）和 `CSC_KEY_PASSWORD` 环境变量注入。
- 不使用 Apple Developer ID。
- 不做 Apple notarization。

### Windows

- Windows 不签名。
- 暂不考虑付费签名方案。
- 自签名对外部用户无收益，不作为发布方案。
- 用户首次安装可能触发 SmartScreen 警告，文档必须引导用户点击 "更多信息 -> 仍要运行"。

## Toolchain

- 打包: `electron-builder`。
- 打包配置: 双端共用一份 `electron-builder.yml`。
- 更新: `electron-updater`。
- 发布: GitHub Releases，`provider: github`。

## Electron Builder Configuration

以下关键配置不可随意修改：

```yaml
mac:
  identity: "YourApp Self-Signed"
  hardenedRuntime: false
  gatekeeperAssess: false
  target:
    - target: dmg
      arch: [arm64]
    - target: zip
      arch: [arm64]

win:
  target:
    - target: nsis
      arch: [x64]

nsis:
  oneClick: false
  perMachine: false
  allowToChangeInstallationDirectory: true
  differentialPackage: true

publish:
  provider: github
  owner: indincys
  repo: Roster
  releaseType: release
```

约束说明：

- `mac.identity` 必须与钥匙串证书名完全一致。
- `mac.hardenedRuntime` 必须为 `false`；无 Apple Developer ID 时不要启用。
- macOS target 不允许省略 `zip`，否则 auto-update 会失败。
- Windows 不配置 `certificateFile` 或 `certificatePassword`。
- `nsis.perMachine` 必须为 `false`，安装到 `%LOCALAPPDATA%`，后续更新不需要 UAC。
- 不在配置中 hardcode 绝对路径，避免跨平台 CI 失效。

## Electron Updater Contract

`electron-updater` 调用约定：

```typescript
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

autoUpdater.quitAndInstall(true, true);
```

约束说明：

- `autoDownload` 必须为 `false`，用户点击右上角更新提醒图标后才下载。
- 重启安装必须使用 `autoUpdater.quitAndInstall(true, true)`。
- 第二个参数 `isForceRunAfter` 用于让 Squirrel.Mac 使用应用内部机制重启，避免 macOS 端更新后重新触发 Gatekeeper 复检；这是 macOS 端必需约束。
- 不允许直接使用无参 `autoUpdater.quitAndInstall()`。
- 启动 5 秒后检查一次更新，之后每 4 小时检查一次。
- 更新事件通过 typed IPC 同步到 renderer。
- Renderer 由 Zustand store 管理更新 UI 状态。
- 右上角铃铛提醒图标只在 `state !== "idle"` 时显示。

## Versioning

- 根 `package.json` 和 desktop workspace 的版本号必须严格遵循 semver。
- 每次发版必须递增版本号，否则 `electron-updater` 无法识别新版本。
- 预发版本（`-beta`、`-rc`）不允许走正式发布流程。

## Release Flow

1. 更新 `package.json` 和 desktop workspace 版本号。
2. 提交并打 git tag `v{version}`。
3. 触发 GitHub Actions release workflow，使用 macOS + Windows 双 runner。
4. CI 自动产出并上传：
   - macOS: `.dmg`、`.zip`、`latest-mac.yml`
   - Windows: `.exe`、`.exe.blockmap`、`latest.yml`
5. 在 GitHub 页面审核 draft release，确认 release notes 后点击 publish。
6. 运行中的旧版本会在 4 小时内检测到更新。

发版不要求真实 API key 或付费模型端点 live 验收。OpenAI-compatible、Anthropic、Gemini、OpenAI Image 等真实网络调用只作为需要时的手动兼容性 smoke，不是 tag、build、Release publish 或 auto-update 的阻塞条件。

## Native Modules And Resources

涉及的原生依赖必须在对应平台的 CI runner 上构建，不允许跨平台构建：

- `better-sqlite3`: 平台特定 `.node` 二进制。
- `fluent-ffmpeg` 使用的 ffmpeg/ffprobe 二进制: 通过 `extraResources` 按平台分别打包。

必须配置：

```yaml
asarUnpack:
  - "**/*.node"
  - "resources/ffmpeg/**"
```

`ffmpeg` / `ffprobe` 随包资源仍需先完成来源确认和 license review。

## Forbidden Changes

- 不要在 Windows 端启用代码签名。
- 不要更换 macOS 签名证书。
- 不要在 macOS 启用 `hardenedRuntime`。
- 不要在 NSIS 配 `perMachine: true`。
- 不要用无参的 `autoUpdater.quitAndInstall()`。
- 不要在仓库中提交 `.p12`、`.pfx` 或证书密码。
- 不要在 `electron-builder.yml` 中 hardcode 绝对路径。
- 不要在 macOS target 中省略 `zip`。

