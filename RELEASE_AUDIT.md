# RELEASE_AUDIT.md

This audit maps the active delivery objective to concrete repository artifacts and verification evidence.

## Objective Restatement

Deliver the v1 "短视频运营工作台" as a macOS + Windows local Electron desktop app, following `PLAN.md`, `PROGRESS.md`, `RELEASE_POLICY.md`, `UIUX需求文档.md`, `需求整理.md`, `技术方向决定备忘录.md`, and `产品功能技术开发文档.md`.

Success criteria:

- Real Electron desktop app, not Web App acceptance.
- Main/preload/renderer process boundaries and typed IPC.
- Local-first workspaces with isolated SQLite data and relative business paths.
- Video library, database libraries, task sheet generation/export/status ingestion, Skill system, title/image/script/cover workspaces, settings, backup/logs, scheduler.
- Required unit/integration/Electron/performance checks pass.
- M7 packaging: macOS Apple Silicon DMG/ZIP, Windows x64 NSIS config, ASAR, native module unpacking, app icon, GitHub Releases auto-update metadata, release verifier, README/user manual.
- Any unachievable release requirements must be explicitly marked blocked with concrete missing credentials, binaries, or platform.

## Evidence Checklist

| Requirement | Evidence | Status |
| --- | --- | --- |
| Source-of-truth docs read and implemented against repository plan | `AGENTS.md`, `PLAN.md`, `PROGRESS.md` | Done |
| Desktop app, not Web App, for UI/end-to-end acceptance | `AGENTS.md` Desktop App Testing Policy; `README.md` 验证规则; `npm run test:e2e:electron` | Done |
| Real Electron app launch with native window, main/preload/renderer, contextBridge | `tests/e2e/electron-desktop-audit.mjs`; latest `PROGRESS.md` Electron desktop repair entry; latest `npm run test:e2e:electron` passed | Done |
| Renderer has no direct Node fs/db/process API | `tests/unit/renderer-boundary.test.ts`; e2e `rendererNodeAccessBlocked: true` | Done |
| Workspace creation and directory structure | e2e verifies `workspace.db`, `workspace.json`, `workspace.lock`, `videos/`, `covers/`, `images/`, `tasks/`, `skills_config/`, `_backup/` | Done |
| Relative business paths and runtime current-device paths | `packages/db/src/path-utils.ts`, task/export tests, e2e task/video assertions | Done |
| Video library scan and preload IPC loading | `WorkspaceDatabase.scanVideos`, `window.roster.listVideos`, e2e `videosLoaded: 5` | Done |
| Database libraries for tags/titles/prompts/images/scripts | `apps/desktop/renderer/src/pages/LibraryPage.tsx`, `packages/db/src/workspace-db.ts`, unit tests | Done |
| Task sheet generation algorithm and non-divisible anchor allocation | `packages/db/src/task-generator.ts`; `tests/unit/task-generation.test.ts` | Done |
| Core integration test command | `tests/integration/workspace-task-flow.test.ts`; `npm run test:integration` covers workspace creation, video scan, task generation/export, status JSON ingestion, idempotency, and SQLite side effects | Done |
| Task export writes Excel/CSV/JSON/preflight/status | `packages/db/src/task-exporter.ts`; e2e export file checks | Done |
| RPA status ingestion idempotency and side effects | `scanTaskStatusFiles`; unit tests; e2e automatic scan, duplicate scan, title/video counters | Done |
| Historical task sheet read-only but exportable | e2e `historicalReadOnlyUi`, `historicalReExport` | Done |
| Skill include fail-closed parser | `packages/skill-engine/src/index.ts`; `tests/unit/skill-engine.test.ts`; e2e Skill Center include file flow | Done |
| Skill storage, snapshots, official copy, market install/upgrade/hash rollback, immediate test | `packages/db/src/config-db.ts`; Skill Center/Market pages; e2e checks, including `skillImmediateTest: true` with no title-library writes and `api_call_log.workflow='skill_test'` | Done |
| Provider abstraction with retry/cancel/error/allSettled | `packages/llm-providers`, `packages/image-providers`; unit tests; e2e title/image/script mock provider flows; real Electron title/script streaming and cancel checks; Image Studio prompt generation uses enabled `image_prompt` Skill plus text LLM before image Provider calls | Done |
| Real provider adapter implementations | `OpenAILLMProvider`, `AnthropicLLMProvider`, `GoogleLLMProvider`, `OpenAIImageProvider`; unit tests with injected fetch; Electron e2e missing-key isolation and `api_call_log` check | Done |
| API call log without prompt/key leakage | `api_call_log` workspace migration and `WorkspaceDatabase.saveApiCallLog`; Electron e2e verifies provider failure row, Skill immediate-test success row, and no prompt/secret-looking text in error log | Done |
| Title/Image/Script workspaces persist generated outputs | e2e title/image/script workspace checks and SQLite/file assertions; title/script workspaces stream through typed preload IPC in the real Electron app; Image Studio prompt tab verifies `imagePromptSkillGeneration: true` and `imagePromptNoImageApi: true` | Done |
| Image scene presets and output directories | workspace `image_scene_presets`; Image Studio typed IPC; e2e `imageScenePresetCreate: true`, `imageScenePresetOutputSubdir: true`, and generated files under preset output subdir | Done |
| Image soft delete, prompt kept-rate, regeneration/progress | `ImageStudioPage.tsx`; e2e image progress/regenerate/batch soft delete checks | Done |
| Cover timeline, hover preview, draggable crop mask, JPG output, custom ratio, batch first-frame | `CoverWorkspacePage.tsx`; `packages/ffmpeg-utils`; e2e cover checks including `coverCropMaskDrag: true` | Done |
| Settings, encrypted API keys, connection test, cloud sync check, cache cleanup, update check | `SettingsPage.tsx`; `ConfigDatabase`; e2e settings checks | Done |
| Backup/restore and feedback package redaction | maintenance IPC handlers; e2e backup/restore/feedback redaction checks | Done |
| Scheduler overview, history, missed-run policy, workflow adapters | `SchedulesPage.tsx`; DB scheduler methods; e2e scheduler checks | Done |
| Large list virtualization and performance | `tests/unit/virtual-list-rendering.test.tsx`; `tests/e2e/electron-m7-performance.mjs` | Done |
| 10k video list / 500 image list / 100-row task performance | `npm run test:performance:electron`: 413ms listVideos, 16.7ms listImages, 60.5ms 100-row task generation | Done |
| README/user manual | `README.md` user manual and release checklist | Done |
| electron-builder config for ASAR, mac DMG/ZIP, Windows NSIS | Repository-root `electron-builder.yml`; `apps/desktop/package.json` scripts pass `--config ../../electron-builder.yml`; verifier checks policy-critical fields | Done |
| Current release/signing/update policy | `RELEASE_POLICY.md`; macOS self-signed Apple Silicon only, Windows unsigned x64, GitHub Releases, `electron-updater` | Done |
| Native `better-sqlite3` packaged outside ASAR | `npm run release:verify` checks `app.asar.unpacked/.../better_sqlite3.node` | Done |
| Custom app icon packaged | `scripts/generate_app_icon.swift`, `apps/desktop/build/icon.icns`, `npm run release:verify` | Done |
| macOS local app package launches from ASAR | packaged app DevTools target `file:///.../Contents/Resources/app.asar/out/renderer/index.html?e2e=1` | Done |
| macOS DMG/ZIP artifacts, checksum, integrity, and blockmaps | `apps/desktop/release/*.dmg`, `*.zip`, `*.blockmap`; `npm run release:verify` now runs `hdiutil verify` and `unzip -tq` | Done |
| Update manifest publishing primitive | `scripts/generate_update_manifest.mjs`, `apps/desktop/release/latest.json`, `npm run release:manifest` | Done |
| Release artifact verifier | `scripts/verify_release_artifacts.mjs`, `npm run release:verify`; verifier now checks `electron-builder.yml`, GitHub release workflow presence, policy-critical macOS/Windows builder fields, `asarUnpack` for native modules and ffmpeg resources, app bundle, ASAR, native module, icon, bundle metadata, DMG/ZIP/blockmaps, manifest hashes/URLs, ffmpeg resources, self-signed codesign state, Windows NSIS candidate, and live paid-provider warning. It no longer gates Apple Developer ID, notarization, stapler, Windows signing, or portable artifacts. | Done |
| Direct GitHub release workflow scaffold | `.github/workflows/release.yml` builds quality gates, macOS arm64 artifacts, Windows x64 artifacts, uploads update metadata, and creates a draft GitHub Release | Done; blocked at runtime until macOS signing secrets are supplied and release assets are publicly reachable |
| App updater contract | `apps/desktop/main/src/index.ts`, `packages/shared-types/src/maintenance.ts`, `packages/shared-types/src/ipc.ts`, `apps/desktop/preload/src/index.ts`, `apps/desktop/renderer/src/stores/app-store.ts`, `AppShell.tsx`; uses `autoUpdater.autoDownload = false`, `autoInstallOnAppQuit = true`, `quitAndInstall(true, true)`, 5-second initial check and 4-hour interval; right-top update action triggers check/download/install through typed IPC | Done |
| Final review / equivalent code audit | `FINAL_REVIEW.md` findings, blockers, and verification evidence | Done |

## Latest Verification Commands

Commands passed in this checkpoint sequence:

- `npm run typecheck`
- `npm run lint`
- `npm test` (85 tests)
- `npm run test:integration`
- `npm run build`
- `npm run package`
- `npm run test:e2e:electron` (real Electron desktop app; required outside sandbox for reliable GUI launch)
- `npm run test:performance:electron` (real Electron desktop app; required outside sandbox for reliable GUI launch)
- `npm run package` (directory package completed; electron-builder skipped signing because `YourApp Self-Signed` is not available in the local keychain)
- `hdiutil verify apps/desktop/release/短视频运营工作台-0.1.0-arm64.dmg`
- `DOWNLOAD_URL_PREFIX=https://example.com/releases/v0.1.0 RELEASE_NOTES='0.1.0 local release' npm run release:manifest`
- `npm run release:verify` (including `electron-builder.yml` policy checks, GitHub release workflow presence, bundle metadata, manifest version, DMG checksum, ZIP integrity, manifest artifact size, SHA-256, SHA-512, absolute URL, blockmap checks, explicit per-platform ffmpeg/ffprobe absence warning, explicit self-signed signing warning, explicit NSIS absence warning, and explicit live paid-provider success warning)

Strict public-release readiness gate:

- `npm run release:verify:strict` now enforces `RELEASE_POLICY.md` and is expected to fail until macOS self-signed identity/secrets, Windows artifacts, bundled ffmpeg binaries, live paid-provider acceptance, and public release-asset access exist. Historical Developer ID / notarization / stapler / Windows signing / portable warnings are no longer release blockers.

## Release Blockers

These are not completed and must not be reported as finished:

| Blocker | Evidence | Needed |
| --- | --- | --- |
| Direct GitHub release external inputs | `electron-builder.yml`, `electron-updater` IPC/UI wiring, release verifier, and `.github/workflows/release.yml` are in place; `publish.owner`/`publish.repo` are configured as `indincys/Roster`; verifier still warns that local keychain lacks `YourApp Self-Signed` | macOS `YourApp Self-Signed` identity, encrypted `.p12`, CI `CSC_LINK` / `CSC_KEY_PASSWORD` secrets, and public accessibility for release assets |
| Windows NSIS artifact generation and full Windows desktop verification | `electron-builder.yml` has an unsigned Windows NSIS x64 target; `npm run release:verify:strict` reports missing Windows `.exe` artifact and that full Windows desktop verification must run on Windows | Windows build/verification environment and unsigned Windows x64 NSIS artifact per `RELEASE_POLICY.md` |
| Bundled redistributable ffmpeg binaries | `release:verify` now warns `tools/ffmpeg` and packaged `Contents/Resources/ffmpeg` both have `files=0`, `ffmpeg=missing`, `ffprobe=missing`, and `missingPlatformTools=darwin/ffmpeg,darwin/ffprobe,win32/ffmpeg.exe,win32/ffprobe.exe`; Homebrew ffmpeg is dynamically linked and not a suitable committed redistributable binary | Approved per-platform ffmpeg/ffprobe binaries plus license review |
| Live provider verification | Custom text LLM Provider configuration is implemented for API key, `baseURL`, model ID, vendor label, fixed vendors, and OpenAI-compatible user-defined vendors. Provider adapters are locally unit-tested with mocked HTTP; `release:verify` explicitly warns live paid-provider success is not checked locally. | Run user-entered real API keys and network-enabled provider acceptance tests |

## Conclusion

The repository is locally complete for implemented v1 desktop workflows, real Electron desktop verification, policy-aligned packaging configuration, auto-update IPC/UI wiring, GitHub release workflow scaffolding, macOS directory packaging, performance checks, README/user manual, app icon, update manifest, and release artifact structure.

The overall objective is not fully complete because public release still needs macOS self-signed certificate material, Windows environment access/artifacts, approved redistributable ffmpeg binaries, live paid-provider credentials/network acceptance, and public accessibility for GitHub Release assets.
