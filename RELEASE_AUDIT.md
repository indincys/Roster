# RELEASE_AUDIT.md

This audit maps the active delivery objective to concrete repository artifacts and verification evidence.

## Objective Restatement

Deliver the v1 "短视频运营工作台" as a macOS + Windows local Electron desktop app, following `PLAN.md`, `PROGRESS.md`, `RELEASE_POLICY.md`, `UIUX需求文档.md`, `需求整理.md`, `技术方向决定备忘录.md`, and `产品功能技术开发文档.md`.

Current release-readiness state: all repository-local and externally automatable release work is complete. The only remaining strict release gate is live paid-provider success verification with user-provided API keys and network access.

## Evidence Checklist

| Requirement | Evidence | Status |
| --- | --- | --- |
| Source-of-truth docs read and implemented against repository plan | `AGENTS.md`, `PLAN.md`, `PROGRESS.md` | Done |
| Desktop app, not Web App, for UI/end-to-end acceptance | `AGENTS.md` Desktop App Testing Policy; `README.md` 验证规则; `npm run test:e2e:electron`; Windows `npm.cmd run test:e2e:electron` | Done |
| Real Electron app launch with native window, main/preload/renderer, contextBridge | `tests/e2e/electron-desktop-audit.mjs`; macOS and Windows e2e output | Done |
| Renderer has no direct Node fs/db/process API | `tests/unit/renderer-boundary.test.ts`; e2e `rendererNodeAccessBlocked: true` | Done |
| Workspace, SQLite, local files, task export, RPA status ingestion | Integration tests plus real Electron e2e on macOS and Windows | Done |
| Skill system, market, snapshots, include parser, immediate test | `packages/skill-engine`, `packages/db/src/config-db.ts`, Skill Center/Market pages, e2e checks | Done |
| Provider abstraction and safe logs | `packages/llm-providers`, `packages/image-providers`, unit tests, e2e missing-key isolation and `api_call_log` checks | Done |
| Custom Provider configuration | Settings UI and shared schemas support API key, `baseURL`, model ID, vendor display name, fixed vendors, and OpenAI-compatible custom vendors | Done |
| Title/Image/Script/Cover workspaces | Real Electron e2e persistence, streaming/cancel, image prompt generation, image files, cover timeline/crop/JPG/batch checks | Done |
| Settings, backup, restore, feedback redaction, update UI | Settings page, maintenance IPC, e2e settings checks | Done |
| Scheduler overview and workflow adapters | Scheduler page, DB scheduler methods, e2e scheduler checks | Done |
| Large list virtualization and performance | `tests/e2e/electron-m7-performance.mjs`; performance gate | Done |
| README/user manual | `README.md` | Done |
| electron-builder config for ASAR, mac DMG/ZIP, Windows NSIS | Repository-root `electron-builder.yml`; desktop scripts pass `--config ../../electron-builder.yml`; verifier checks policy-critical fields | Done |
| Current release/signing/update policy | `RELEASE_POLICY.md`; macOS self-signed Apple Silicon only, Windows unsigned x64, GitHub Releases, `electron-updater` | Done |
| Native `better-sqlite3` packaged outside ASAR | `npm run release:verify` checks `app.asar.unpacked/.../better_sqlite3.node` | Done |
| Bundled ffmpeg/ffprobe | `tools/ffmpeg/README.md`; `tools/ffmpeg/darwin/*`; `tools/ffmpeg/win32/*`; verifier checks packaged resources and Windows shared DLLs | Done |
| macOS self-signed identity and CI secrets | Keychain identity `YourApp Self-Signed`; `.p12` backup outside repo at `~/.roster/release/YourApp-Self-Signed.p12`; GitHub secrets `CSC_LINK` and `CSC_KEY_PASSWORD` | Done |
| macOS signed artifacts | `Roster-0.1.0-arm64.dmg`, `Roster-0.1.0-arm64.zip`, blockmaps, `latest-mac.yml`; `codesign --verify`, `hdiutil verify`, `unzip -tq` | Done |
| Windows unsigned x64 artifacts | Real Windows runner `INDINCYSWINDOWS`; `Roster-Setup-0.1.0-x64.exe`, blockmap, `latest.yml`; Windows e2e passed | Done |
| Release manifest | `scripts/generate_update_manifest.mjs`, `apps/desktop/release/latest.json`; includes macOS DMG/ZIP and Windows NSIS with sizes/hashes/URLs | Done |
| Release artifact verifier | `scripts/verify_release_artifacts.mjs`; checks builder policy, app bundle, DMG/ZIP/NSIS, update yml files, manifest hashes, ffmpeg resources, codesign, GitHub public repo, and live-provider warning | Done |
| Direct GitHub release workflow scaffold | `.github/workflows/release.yml`; builds quality gates, macOS arm64 artifacts, Windows x64 artifacts, uploads metadata, creates draft release | Done |
| GitHub Release asset public access | `indincys/Roster` is public; strict verifier checks GitHub repo visibility | Done |
| App updater contract | `autoDownload=false`, `autoInstallOnAppQuit=true`, `quitAndInstall(true, true)`, 5-second initial check and 4-hour interval; typed IPC and right-top update action | Done |

## Latest Verification Commands

Commands passed in this checkpoint sequence:

- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run test:integration`
- `npm run build`
- `npm run test:e2e:electron`
- `npm run test:performance:electron`
- Windows `npm.cmd run typecheck`
- Windows `npm.cmd run build`
- Windows `npm.cmd --workspace @roster/desktop run dist`
- Windows `npm.cmd run test:e2e:electron`
- `npm --workspace @roster/desktop run dist -- --mac --arm64 --publish never`
- `codesign --verify --deep --strict --verbose=2 apps/desktop/release/mac-arm64/短视频运营工作台.app`
- `hdiutil verify apps/desktop/release/Roster-0.1.0-arm64.dmg`
- `unzip -tq apps/desktop/release/Roster-0.1.0-arm64.zip`
- `DOWNLOAD_URL_PREFIX=https://github.com/indincys/Roster/releases/download/v0.1.0 RELEASE_NOTES='Roster 0.1.0 release candidate.' npm run release:manifest`
- `npm run release:verify`

Strict public-release readiness gate:

- `npm run release:verify:strict` currently fails only on `live paid-provider success verification`.
- All other strict checks pass, including GitHub public visibility, macOS signing, Windows x64 NSIS artifacts, ffmpeg resources, and update metadata consistency.

## Release Blocker

| Blocker | Evidence | Needed |
| --- | --- | --- |
| Live provider verification | Custom text LLM Provider configuration is implemented for API key, `baseURL`, model ID, vendor label, fixed vendors, and OpenAI-compatible user-defined vendors. Provider adapters are locally unit-tested with mocked HTTP; `release:verify:strict` fails only because live paid-provider success is not checked locally. | User enters real provider API keys in the app UI, then runs network-enabled OpenAI-compatible/Anthropic/Gemini/OpenAI Image acceptance and confirms outputs plus redacted logs/feedback package. |

## Conclusion

The repository is complete for implemented v1 desktop workflows, macOS/Windows real Electron desktop verification, policy-aligned packaging/update wiring, GitHub release workflow scaffolding, public release asset access, macOS self-signed signing, Windows unsigned x64 installer generation, ffmpeg/ffprobe bundled resources, release manifest generation, release verification, performance checks, README, final review, and completion audit.

The overall objective is not globally complete only because live paid-provider success requires user-owned API keys and network-enabled acceptance.
