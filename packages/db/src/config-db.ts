import { access, cp, mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { constants, existsSync, type Dirent } from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import {
  ApiKeySaveInputSchema,
  AppSettingsSaveInputSchema,
  AppSettingsSchema,
  ImageSubdirectories,
  sanitizeLlmProviderConfigs,
  SkillActivationConfigSchema,
  SkillActivationUpdateInputSchema,
  SkillContentRequestSchema,
  SkillCreateOfficialCopyInputSchema,
  SkillFileSaveInputSchema,
  SkillMarketInstallInputSchema,
  SkillMarketListInputSchema,
  SkillMarketManifestSchema,
  SkillMetaSchema,
  SkillOfficialCopyInputSchema,
  SkillSaveInputSchema,
  SkillSnapshotRestoreInputSchema,
  WORKSPACE_DIRECTORIES,
  WorkspaceCreateInputSchema,
  type ApiKeyPublicRecord,
  type ApiKeySaveInput,
  type AppSettings,
  type AppSettingsSaveInput,
  type SkillActivationConfig,
  type SkillActivationUpdateInput,
  type SkillContent,
  type SkillCreateOfficialCopyInput,
  type SkillFile,
  type SkillFileSaveInput,
  type SkillMarketInstallInput,
  type SkillMarketInstallResult,
  type SkillMarketListInput,
  type SkillMarketManifest,
  type SkillMarketSkill,
  type SkillMarketState,
  type SkillRecord,
  type SkillSaveInput,
  type SkillSourceType,
  type SkillOfficialCopyInput,
  type SkillSnapshot,
  type SkillSnapshotRestoreInput,
  type SkillWorkflowType,
  type WorkspaceCreateInput,
  type WorkspaceRecord,
  type WorkspaceRuntimeState
} from "@roster/shared-types";
import { writeJsonAtomic } from "./atomic";
import { CONFIG_MIGRATIONS, WORKSPACE_MIGRATIONS } from "./schema";
import { decryptSecret, encryptSecret } from "./secrets";
import { normalizeWinRootPath } from "./path-utils";
import { applySqlMigrations, openSqliteDatabase, type SqliteDatabase } from "./sqlite";

const LOCK_STALE_AFTER_MS = 30_000;
const DEFAULT_SKILL_SNAPSHOT_RETENTION = 50;
const DEFAULT_SKILL_MARKET_MANIFEST_URL =
  process.env.ROSTER_SKILL_MARKET_MANIFEST_URL ??
  "https://raw.githubusercontent.com/example/roster-official-skills/main/manifest.json";
const SKILL_MARKET_MANIFEST_TTL_MS = 24 * 60 * 60 * 1000;

interface WorkspaceRow {
  id: string;
  name: string;
  root_path: string;
  mac_root_path: string;
  win_root_path: string;
  color: string;
  is_default: number;
  is_read_only: number;
  last_opened_at: string | null;
  created_at: string;
  updated_at: string;
}

interface ApiKeyRow {
  id: string;
  provider: string;
  label: string;
  model: string | null;
  is_default: number;
  created_at: string;
  updated_at: string;
}

interface ApiKeySecretRow extends ApiKeyRow {
  ciphertext: string;
  iv: string;
  auth_tag: string;
  fingerprint: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

function rowString(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  if (typeof value !== "string") {
    throw new Error(`Invalid SQLite row: ${key} is not a string`);
  }
  return value;
}

function rowOptionalString(row: Record<string, unknown>, key: string): string | null {
  const value = row[key];
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== "string") {
    throw new Error(`Invalid SQLite row: ${key} is not a nullable string`);
  }
  return value;
}

function rowNumber(row: Record<string, unknown>, key: string): number {
  const value = row[key];
  if (typeof value !== "number") {
    throw new Error(`Invalid SQLite row: ${key} is not a number`);
  }
  return value;
}

function mapWorkspaceRow(row: WorkspaceRow): WorkspaceRecord {
  return {
    id: row.id,
    name: row.name,
    rootPath: row.root_path,
    macRootPath: row.mac_root_path,
    winRootPath: row.win_root_path,
    color: row.color,
    isDefault: row.is_default === 1,
    isReadOnly: row.is_read_only === 1,
    lastOpenedAt: row.last_opened_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function coerceWorkspaceRow(row: Record<string, unknown>): WorkspaceRow {
  return {
    id: rowString(row, "id"),
    name: rowString(row, "name"),
    root_path: rowString(row, "root_path"),
    mac_root_path: rowString(row, "mac_root_path"),
    win_root_path: rowString(row, "win_root_path"),
    color: rowString(row, "color"),
    is_default: rowNumber(row, "is_default"),
    is_read_only: rowNumber(row, "is_read_only"),
    last_opened_at: rowOptionalString(row, "last_opened_at"),
    created_at: rowString(row, "created_at"),
    updated_at: rowString(row, "updated_at")
  };
}

function mapApiKeyRow(row: ApiKeyRow): ApiKeyPublicRecord {
  return {
    id: row.id,
    provider: ApiKeySaveInputSchema.shape.provider.parse(row.provider),
    label: row.label,
    model: row.model,
    isDefault: row.is_default === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function toSafeSkillDirectoryName(skillId: string): string {
  return skillId
    .trim()
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function uniqueValues(values: string[]): string[] {
  return [...new Set(values)];
}

function normalizeSkillMarketManifest(raw: unknown): SkillMarketManifest {
  const manifestObject = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const skills = Array.isArray(manifestObject.skills) ? manifestObject.skills : [];
  return SkillMarketManifestSchema.parse({
    manifestVersion: manifestObject.manifestVersion ?? manifestObject.manifest_version,
    updatedAt: manifestObject.updatedAt ?? manifestObject.updated_at,
    skills: skills.map((skill) => {
      const skillObject = skill && typeof skill === "object" ? (skill as Record<string, unknown>) : {};
      return {
        name: skillObject.name,
        displayName: skillObject.displayName ?? skillObject.display_name,
        type: skillObject.type,
        version: skillObject.version,
        description: skillObject.description,
        defaultModel: skillObject.defaultModel ?? skillObject.default_model,
        supportedModels: skillObject.supportedModels ?? skillObject.supported_models,
        files: skillObject.files
      };
    })
  });
}

function normalizeSkillFilePath(relativePath: string): string {
  const normalized = relativePath.trim().replaceAll("\\", "/");
  if (
    !normalized ||
    normalized.startsWith("/") ||
    path.isAbsolute(normalized) ||
    normalized.split("/").some((part) => !part || part === ".." || part.startsWith(".")) ||
    path.posix.extname(normalized) !== ".md"
  ) {
    throw new Error("Skill 文件路径非法");
  }
  return normalized;
}

function normalizeMarketSkillFilePath(relativePath: string): string {
  const normalized = relativePath.trim().replaceAll("\\", "/");
  if (
    !normalized ||
    normalized.startsWith("/") ||
    path.isAbsolute(normalized) ||
    normalized.split("/").some((part) => !part || part === ".." || part.startsWith(".")) ||
    (normalized !== "meta.json" && path.posix.extname(normalized) !== ".md")
  ) {
    throw new Error("Skill 市场文件路径非法");
  }
  return normalized;
}

function compareVersions(left: string | null, right: string): number {
  if (!left) {
    return -1;
  }
  const leftParts = left.split(/[.-]/).map((part) => Number.parseInt(part, 10));
  const rightParts = right.split(/[.-]/).map((part) => Number.parseInt(part, 10));
  const maxLength = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < maxLength; index += 1) {
    const leftValue = Number.isFinite(leftParts[index]) ? leftParts[index] : 0;
    const rightValue = Number.isFinite(rightParts[index]) ? rightParts[index] : 0;
    if (leftValue !== rightValue) {
      return leftValue > rightValue ? 1 : -1;
    }
  }
  return left.localeCompare(right);
}

function resolveSkillMarketFileUrl(manifestUrl: string, skillName: string, relativePath: string): string {
  const baseUrl = new URL(manifestUrl);
  const baseDirectory = baseUrl.pathname.endsWith("/")
    ? baseUrl.pathname
    : baseUrl.pathname.slice(0, baseUrl.pathname.lastIndexOf("/") + 1);
  baseUrl.pathname = `${baseDirectory}skills/${encodeURIComponent(skillName)}/${relativePath
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/")}`;
  baseUrl.search = "";
  baseUrl.hash = "";
  return baseUrl.toString();
}

function coerceApiKeyRow(row: Record<string, unknown>): ApiKeyRow {
  return {
    id: rowString(row, "id"),
    provider: rowString(row, "provider"),
    label: rowString(row, "label"),
    model: rowOptionalString(row, "model"),
    is_default: rowNumber(row, "is_default"),
    created_at: rowString(row, "created_at"),
    updated_at: rowString(row, "updated_at")
  };
}

function coerceApiKeySecretRow(row: Record<string, unknown>): ApiKeySecretRow {
  return {
    ...coerceApiKeyRow(row),
    ciphertext: rowString(row, "ciphertext"),
    iv: rowString(row, "iv"),
    auth_tag: rowString(row, "auth_tag"),
    fingerprint: rowString(row, "fingerprint")
  };
}

function pickWorkspaceColor(name: string): string {
  const palette = ["#2563eb", "#0f766e", "#b45309", "#9333ea", "#be123c", "#4d7c0f"];
  const sum = Array.from(name).reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return palette[sum % palette.length] ?? palette[0];
}

export class ConfigDatabase {
  private readonly db: SqliteDatabase;
  private readonly userDataPath: string;
  private readonly appInstanceId = crypto.randomUUID();
  private skillMarketFetcher: (url: string) => Promise<Buffer>;

  private constructor(
    userDataPath: string,
    db: SqliteDatabase,
    private readonly skillSnapshotRetention = DEFAULT_SKILL_SNAPSHOT_RETENTION,
    skillMarketFetcher?: (url: string) => Promise<Buffer>
  ) {
    this.userDataPath = userDataPath;
    this.db = db;
    this.skillMarketFetcher =
      skillMarketFetcher ??
      (async () => {
        throw new Error("Skill 市场网络下载器未配置");
      });
    applySqlMigrations(this.db, CONFIG_MIGRATIONS);
  }

  static async open(
    userDataPath: string,
    options: { skillSnapshotRetention?: number; skillMarketFetcher?: (url: string) => Promise<Buffer> } = {}
  ): Promise<ConfigDatabase> {
    await mkdir(userDataPath, { recursive: true });
    await mkdir(path.join(userDataPath, "skills", "official"), { recursive: true });
    await mkdir(path.join(userDataPath, "skills", "user"), { recursive: true });
    await mkdir(path.join(userDataPath, "vault"), { recursive: true, mode: 0o700 });
    await mkdir(path.join(userDataPath, "cache"), { recursive: true });
    await mkdir(path.join(userDataPath, "cache", "skill-market"), { recursive: true });
    await mkdir(path.join(userDataPath, "logs"), { recursive: true });
    return new ConfigDatabase(
      userDataPath,
      await openSqliteDatabase(path.join(userDataPath, "config.db")),
      options.skillSnapshotRetention ?? DEFAULT_SKILL_SNAPSHOT_RETENTION,
      options.skillMarketFetcher
    );
  }

  close(): void {
    this.db.close();
  }

  getRuntimeState(): WorkspaceRuntimeState {
    const activeWorkspaceId = this.getPreference("activeWorkspaceId");
    return {
      activeWorkspaceId,
      workspaces: this.listWorkspaces()
    };
  }

  listWorkspaces(): WorkspaceRecord[] {
    const rows = this.db.prepare("SELECT * FROM workspaces ORDER BY COALESCE(last_opened_at, created_at) DESC").all();
    return rows.map((row) => mapWorkspaceRow(coerceWorkspaceRow(row)));
  }

  async createWorkspace(input: WorkspaceCreateInput): Promise<WorkspaceRuntimeState> {
    const parsed = WorkspaceCreateInputSchema.parse(input);
    const id = crypto.randomUUID();
    const timestamp = nowIso();
    const rootPath = path.resolve(parsed.rootPath);
    const macRootPath = path.resolve(parsed.macRootPath);
    const winRootPath = normalizeWinRootPath(parsed.winRootPath);

    await this.ensureWritableDirectory(rootPath);
    await this.createWorkspaceFiles({
      id,
      name: parsed.name,
      rootPath,
      macRootPath,
      winRootPath,
      createdAt: timestamp
    });

    const isDefault = this.listWorkspaces().length === 0 ? 1 : 0;
    this.db
      .prepare(
        `INSERT INTO workspaces (
          id, name, root_path, mac_root_path, win_root_path, color, is_default,
          is_read_only, last_opened_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`
      )
      .run(
        id,
        parsed.name,
        rootPath,
        macRootPath,
        winRootPath,
        pickWorkspaceColor(parsed.name),
        isDefault,
        timestamp,
        timestamp,
        timestamp
      );

    this.setPreference("activeWorkspaceId", id);
    return this.getRuntimeState();
  }

  switchWorkspace(workspaceId: string): WorkspaceRuntimeState {
    const workspace = this.getWorkspace(workspaceId);
    if (!workspace) {
      throw new Error("工作空间不存在");
    }

    const timestamp = nowIso();
    this.db
      .prepare("UPDATE workspaces SET last_opened_at = ?, updated_at = ? WHERE id = ?")
      .run(timestamp, timestamp, workspaceId);
    this.setPreference("activeWorkspaceId", workspaceId);
    return this.getRuntimeState();
  }

  getWorkspace(workspaceId: string): WorkspaceRecord | null {
    const row = this.db.prepare("SELECT * FROM workspaces WHERE id = ?").get(workspaceId);
    return row ? mapWorkspaceRow(coerceWorkspaceRow(row)) : null;
  }

  listApiKeys(): ApiKeyPublicRecord[] {
    const rows = this.db
      .prepare("SELECT id, provider, label, model, is_default, created_at, updated_at FROM api_keys ORDER BY updated_at DESC")
      .all();
    return rows.map((row) => mapApiKeyRow(coerceApiKeyRow(row)));
  }

  async getApiKeySecret(apiKeyId: string): Promise<{ record: ApiKeyPublicRecord; apiKey: string }> {
    const row = this.db.prepare("SELECT * FROM api_keys WHERE id = ?").get(apiKeyId);
    if (!row) {
      throw new Error("API key 不存在");
    }
    const secretRow = coerceApiKeySecretRow(row);
    return {
      record: mapApiKeyRow(secretRow),
      apiKey: await decryptSecret(path.join(this.userDataPath, "vault"), {
        ciphertext: secretRow.ciphertext,
        iv: secretRow.iv,
        authTag: secretRow.auth_tag,
        fingerprint: secretRow.fingerprint
      })
    };
  }

  async saveApiKey(input: ApiKeySaveInput): Promise<ApiKeyPublicRecord> {
    const parsed = ApiKeySaveInputSchema.parse(input);
    const timestamp = nowIso();
    const id = crypto.randomUUID();
    const encrypted = await encryptSecret(path.join(this.userDataPath, "vault"), parsed.apiKey);
    const model = parsed.model?.trim() || null;
    const existingForProvider = this.listApiKeys().filter((key) => key.provider === parsed.provider);
    const shouldSetDefault = parsed.isDefault || existingForProvider.length === 0;

    if (shouldSetDefault) {
      this.db.prepare("UPDATE api_keys SET is_default = 0, updated_at = ? WHERE provider = ?").run(timestamp, parsed.provider);
    }

    this.db
      .prepare(
        `INSERT INTO api_keys (
          id, provider, label, model, is_default, ciphertext, iv, auth_tag, fingerprint, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        parsed.provider,
        parsed.label,
        model,
        shouldSetDefault ? 1 : 0,
        encrypted.ciphertext,
        encrypted.iv,
        encrypted.authTag,
        encrypted.fingerprint,
        timestamp,
        timestamp
      );

    return {
      id,
      provider: parsed.provider,
      label: parsed.label,
      model,
      isDefault: shouldSetDefault,
      createdAt: timestamp,
      updatedAt: timestamp
    };
  }

  async auditApiKeyStorage(): Promise<{ plaintextFound: boolean; checkedFiles: string[] }> {
    const checkedFiles = [path.join(this.userDataPath, "config.db")];
    const databaseBytes = await readFile(checkedFiles[0]);
    const databaseText = databaseBytes.toString("latin1");
    const plaintextFound = /sk-[A-Za-z0-9_-]{12,}|AIza[A-Za-z0-9_-]{12,}|anthropic[A-Za-z0-9_-]{8,}/.test(
      databaseText
    );
    return { plaintextFound, checkedFiles };
  }

  getSettings(): AppSettings {
    const raw = this.getPreference("appSettings");
    if (!raw) {
      const defaults = AppSettingsSchema.parse({});
      return {
        ...defaults,
        llmProviderConfigs: sanitizeLlmProviderConfigs(defaults.llmProviderConfigs)
      };
    }
    try {
      const parsed = AppSettingsSchema.parse(JSON.parse(raw));
      return {
        ...parsed,
        llmProviderConfigs: sanitizeLlmProviderConfigs(parsed.llmProviderConfigs)
      };
    } catch {
      const defaults = AppSettingsSchema.parse({});
      return {
        ...defaults,
        llmProviderConfigs: sanitizeLlmProviderConfigs(defaults.llmProviderConfigs)
      };
    }
  }

  saveSettings(input: AppSettingsSaveInput): AppSettings {
    const parsed = AppSettingsSaveInputSchema.parse(input);
    const next = AppSettingsSchema.parse({
      ...this.getSettings(),
      ...parsed
    });
    const sanitized = {
      ...next,
      llmProviderConfigs: sanitizeLlmProviderConfigs(next.llmProviderConfigs)
    };
    this.setPreference("appSettings", JSON.stringify(sanitized));
    return sanitized;
  }

  async listSkills(): Promise<SkillRecord[]> {
    const skillRoots = [
      { sourceType: "official" as const, rootPath: path.join(this.userDataPath, "skills", "official") },
      { sourceType: "user" as const, rootPath: path.join(this.userDataPath, "skills", "user") }
    ];
    const byId = new Map<string, SkillRecord>();

    for (const root of skillRoots) {
      for (const skill of await this.listSkillsFromDirectory(root.rootPath, root.sourceType)) {
        byId.set(skill.id, skill);
      }
    }

    return [...byId.values()].sort((a, b) => a.displayName.localeCompare(b.displayName, "zh-Hans-CN"));
  }

  async saveSkill(input: SkillSaveInput): Promise<SkillRecord> {
    const parsed = SkillSaveInputSchema.parse(input);
    const id = parsed.skillId ?? crypto.randomUUID();
    const safeName = toSafeSkillDirectoryName(id);
    if (!safeName) {
      throw new Error("Skill ID 不能作为目录名");
    }
    const sourceType: SkillSourceType = parsed.sourceType;
    const rootPath = path.join(this.userDataPath, "skills", "user", safeName);
    const timestamp = nowIso();
    await this.createSkillSnapshotIfNeeded(rootPath, timestamp);
    await mkdir(rootPath, { recursive: true });
    await writeJsonAtomic(path.join(rootPath, "meta.json"), {
      id,
      displayName: parsed.displayName,
      type: parsed.type,
      sourceType,
      version: parsed.version,
      description: parsed.description,
      defaultModel: parsed.defaultModel ?? null,
      supportedModels: parsed.supportedModels,
      origin: parsed.origin ?? null,
      updatedAt: timestamp
    });
    await writeFile(path.join(rootPath, "SKILL.md"), parsed.content, "utf8");
    return {
      id,
      displayName: parsed.displayName,
      type: parsed.type,
      sourceType,
      version: parsed.version,
      description: parsed.description,
      defaultModel: parsed.defaultModel ?? null,
      supportedModels: parsed.supportedModels,
      origin: parsed.origin ?? null,
      rootPath,
      isEditable: true,
      isRestorable: sourceType === "copy",
      isMissing: false,
      updatedAt: timestamp
    };
  }

  async listSkillMarket(input?: SkillMarketListInput): Promise<SkillMarketState> {
    const parsed = SkillMarketListInputSchema.parse(input);
    const manifestUrl = parsed.manifestUrl ?? DEFAULT_SKILL_MARKET_MANIFEST_URL;
    const cachePath = this.getSkillMarketCachePath();
    const cached = await this.readSkillMarketCache(cachePath);
    const shouldUseCache =
      !parsed.forceRefresh &&
      cached?.manifestUrl === manifestUrl &&
      (await this.isFreshSkillMarketCache(cachePath));
    let manifest: SkillMarketManifest | null = null;
    let fetchedAt: string | null = null;
    let offline = false;
    let error: string | null = null;

    if (!shouldUseCache) {
      try {
        manifest = normalizeSkillMarketManifest(JSON.parse((await this.skillMarketFetcher(manifestUrl)).toString("utf8")));
        fetchedAt = nowIso();
        await writeJsonAtomic(cachePath, {
          manifestUrl,
          fetchedAt,
          manifest
        });
      } catch (fetchError) {
        offline = true;
        error = fetchError instanceof Error ? fetchError.message : String(fetchError);
      }
    }

    if (!manifest) {
      if (cached) {
        manifest = cached.manifest;
        fetchedAt = cached.fetchedAt;
        if (cached.manifestUrl !== manifestUrl) {
          offline = true;
          error = error ?? "当前仓库暂时无法连接，使用上次缓存数据";
        }
      }
    }

    if (!manifest) {
      return {
        manifestUrl,
        fetchedAt,
        updatedAt: null,
        offline,
        error,
        skills: []
      };
    }

    const installed = new Map(
      (await this.listSkills())
        .filter((skill) => skill.sourceType === "official")
        .map((skill) => [skill.id, skill.version])
    );
    return {
      manifestUrl,
      fetchedAt,
      updatedAt: manifest.updatedAt,
      offline,
      error,
      skills: manifest.skills.map((skill) => {
        const installedVersion = installed.get(skill.name) ?? null;
        const updateAvailable = compareVersions(installedVersion, skill.version) < 0;
        return {
          ...skill,
          installedVersion,
          updateAvailable,
          status: !installedVersion ? "not_installed" : updateAvailable ? "update_available" : "installed"
        };
      })
    };
  }

  async installSkillFromMarket(input: SkillMarketInstallInput = { name: "" }): Promise<SkillMarketInstallResult> {
    const parsed = SkillMarketInstallInputSchema.parse(input);
    const market = await this.listSkillMarket({ manifestUrl: parsed.manifestUrl, forceRefresh: false });
    const skill = market.skills.find((candidate) => candidate.name === parsed.name);
    if (!skill) {
      throw new Error("Skill 市场缓存中没有该 Skill，请先刷新市场");
    }
    const manifestUrl = parsed.manifestUrl ?? market.manifestUrl;
    const safeName = toSafeSkillDirectoryName(skill.name);
    if (!safeName || safeName !== skill.name) {
      throw new Error("官方 Skill 名称只能包含字母、数字、下划线和短横线");
    }

    const officialRootPath = path.join(this.userDataPath, "skills", "official");
    const targetPath = path.join(officialRootPath, safeName);
    const stagingPath = path.join(officialRootPath, `.install-${safeName}-${process.pid}-${Date.now()}`);
    const backupPath = path.join(officialRootPath, `.backup-${safeName}-${process.pid}-${Date.now()}`);
    await rm(stagingPath, { recursive: true, force: true });
    await mkdir(stagingPath, { recursive: true });
    const installedFiles: string[] = [];

    try {
      for (const file of skill.files) {
        const relativePath = normalizeMarketSkillFilePath(file.path);
        const bytes = await this.skillMarketFetcher(resolveSkillMarketFileUrl(manifestUrl, skill.name, relativePath));
        const digest = crypto.createHash("sha256").update(bytes).digest("hex");
        if (digest.toLowerCase() !== file.sha256.toLowerCase()) {
          throw new Error(`Skill 文件 hash 校验失败：${relativePath}`);
        }
        const filePath = path.join(stagingPath, relativePath);
        await mkdir(path.dirname(filePath), { recursive: true });
        await writeFile(filePath, bytes);
        installedFiles.push(relativePath);
      }

      await this.writeOfficialSkillMeta(stagingPath, skill);
      await stat(path.join(stagingPath, "SKILL.md"));
      if (existsSync(targetPath)) {
        await rename(targetPath, backupPath);
      }
      await rename(stagingPath, targetPath);
      await rm(backupPath, { recursive: true, force: true });
      return {
        skillId: skill.name,
        name: skill.name,
        version: skill.version,
        rootPath: targetPath,
        installedFiles: installedFiles.sort()
      };
    } catch (error) {
      await rm(stagingPath, { recursive: true, force: true });
      if (existsSync(backupPath) && !existsSync(targetPath)) {
        await rename(backupPath, targetPath);
      } else {
        await rm(backupPath, { recursive: true, force: true });
      }
      throw error;
    }
  }

  async readSkillContent(input: { skillId: string; relativePath?: string }): Promise<SkillContent> {
    const parsed = SkillContentRequestSchema.parse(input);
    const skill = (await this.listSkills()).find((candidate) => candidate.id === parsed.skillId);
    if (!skill) {
      throw new Error("Skill 不存在");
    }
    const relativePath = normalizeSkillFilePath(parsed.relativePath);
    return {
      skillId: skill.id,
      relativePath,
      content: await readFile(await this.resolveSkillMarkdownPath(skill.rootPath, relativePath), "utf8"),
      rootPath: skill.rootPath
    };
  }

  async listSkillFiles(input: { skillId: string }): Promise<SkillFile[]> {
    const parsed = SkillContentRequestSchema.parse(input);
    const skill = await this.getSkillById(parsed.skillId);
    const files: SkillFile[] = [];
    await this.collectSkillMarkdownFiles(skill.rootPath, skill.rootPath, files);
    return files.sort((left, right) => {
      if (left.isEntry) {
        return -1;
      }
      if (right.isEntry) {
        return 1;
      }
      return left.relativePath.localeCompare(right.relativePath, "zh-Hans-CN");
    });
  }

  async saveSkillFile(input: SkillFileSaveInput): Promise<SkillContent> {
    const parsed = SkillFileSaveInputSchema.parse(input);
    const skill = await this.getSkillById(parsed.skillId);
    if (!skill.isEditable) {
      throw new Error("官方原版 Skill 不可编辑");
    }
    const relativePath = normalizeSkillFilePath(parsed.relativePath);
    if (relativePath === "SKILL.md") {
      throw new Error("SKILL.md 请使用 Skill 保存按钮更新");
    }
    const timestamp = nowIso();
    await this.createSkillSnapshotIfNeeded(skill.rootPath, timestamp);
    const filePath = await this.resolveSkillMarkdownPath(skill.rootPath, relativePath, true);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, parsed.content, "utf8");
    return {
      skillId: skill.id,
      relativePath,
      content: parsed.content,
      rootPath: skill.rootPath
    };
  }

  async listSkillSnapshots(input: { skillId: string }): Promise<SkillSnapshot[]> {
    const parsed = SkillContentRequestSchema.parse(input);
    const skill = await this.getSkillById(parsed.skillId);
    const snapshotRootPath = path.join(skill.rootPath, ".snapshots");
    let entries: Dirent[];
    try {
      entries = await readdir(snapshotRootPath, { withFileTypes: true });
    } catch {
      return [];
    }

    const snapshots: SkillSnapshot[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) {
        continue;
      }
      const snapshotPath = path.join(snapshotRootPath, entry.name);
      try {
        const content = await readFile(path.join(snapshotPath, "SKILL.md"), "utf8");
        snapshots.push({
          skillId: skill.id,
          snapshotId: entry.name,
          createdAt: entry.name.replace(/-/g, ":"),
          contentPreview: content.replace(/\s+/g, " ").trim().slice(0, 120)
        });
      } catch {
        continue;
      }
    }

    return snapshots.sort((left, right) => right.snapshotId.localeCompare(left.snapshotId));
  }

  async restoreSkillSnapshot(input: SkillSnapshotRestoreInput): Promise<SkillContent> {
    const parsed = SkillSnapshotRestoreInputSchema.parse(input);
    const skill = await this.getSkillById(parsed.skillId);
    if (!skill.isEditable) {
      throw new Error("官方原版 Skill 不可还原");
    }
    if (parsed.snapshotId.includes("..") || parsed.snapshotId.includes("/") || parsed.snapshotId.includes("\\")) {
      throw new Error("快照 ID 非法");
    }
    const snapshotPath = path.join(skill.rootPath, ".snapshots", parsed.snapshotId);
    const snapshotSkillMd = path.join(snapshotPath, "SKILL.md");
    const snapshotMeta = path.join(snapshotPath, "meta.json");
    await stat(snapshotSkillMd);
    await this.createSkillSnapshotIfNeeded(skill.rootPath, nowIso());
    await cp(snapshotSkillMd, path.join(skill.rootPath, "SKILL.md"));
    try {
      await cp(snapshotMeta, path.join(skill.rootPath, "meta.json"));
    } catch {
      // Older snapshots may contain only SKILL.md.
    }
    return this.readSkillContent({ skillId: parsed.skillId });
  }

  async createOfficialSkillCopy(input: SkillCreateOfficialCopyInput): Promise<SkillRecord> {
    const parsed = SkillCreateOfficialCopyInputSchema.parse(input);
    const official = await this.getSkillById(parsed.skillId);
    if (official.sourceType !== "official") {
      throw new Error("只能从官方原版创建副本");
    }
    const copyId = parsed.copySkillId ?? `${official.id}-copy`;
    const safeName = toSafeSkillDirectoryName(copyId);
    if (!safeName || safeName !== copyId) {
      throw new Error("副本 Skill ID 只能包含字母、数字、下划线和短横线");
    }
    const copyRootPath = path.join(this.userDataPath, "skills", "user", safeName);
    if (existsSync(copyRootPath)) {
      throw new Error("副本 Skill ID 已存在");
    }
    await cp(official.rootPath, copyRootPath, {
      recursive: true,
      filter: (source) => !source.split(path.sep).includes(".snapshots")
    });
    const timestamp = nowIso();
    await writeJsonAtomic(path.join(copyRootPath, "meta.json"), {
      id: copyId,
      displayName: parsed.displayName ?? `${official.displayName} 副本`,
      type: official.type,
      sourceType: "copy",
      version: official.version,
      description: official.description,
      defaultModel: official.defaultModel,
      supportedModels: official.supportedModels,
      origin: {
        skillId: official.id,
        version: official.version
      },
      updatedAt: timestamp
    });
    await this.writeOfficialCopyBaseSnapshot(copyRootPath);
    const copy = await this.getSkillById(copyId);
    return copy;
  }

  async restoreOfficialSkillCopy(input: SkillOfficialCopyInput): Promise<SkillContent> {
    const copy = await this.getOfficialCopy(input);
    const basePath = this.getOfficialCopyBaseSnapshotPath(copy.rootPath);
    await stat(path.join(basePath, "SKILL.md"));
    await this.createSkillSnapshotIfNeeded(copy.rootPath, nowIso());
    await this.replaceSkillFilesFromSource(basePath, copy.rootPath, {
      id: copy.id,
      displayName: copy.displayName,
      sourceType: "copy",
      origin: copy.origin
    });
    return this.readSkillContent({ skillId: copy.id });
  }

  async upgradeOfficialSkillCopy(input: SkillOfficialCopyInput): Promise<SkillContent> {
    const copy = await this.getOfficialCopy(input);
    const originSkillId = copy.origin?.skillId;
    if (!originSkillId) {
      throw new Error("副本缺少 origin 信息");
    }
    const official = await this.getSkillById(originSkillId);
    if (official.sourceType !== "official") {
      throw new Error("origin 官方 Skill 不存在");
    }
    await this.createSkillSnapshotIfNeeded(copy.rootPath, nowIso());
    await this.replaceSkillFilesFromSource(official.rootPath, copy.rootPath, {
      id: copy.id,
      displayName: copy.displayName,
      sourceType: "copy",
      origin: {
        skillId: official.id,
        version: official.version
      }
    });
    await this.writeOfficialCopyBaseSnapshot(copy.rootPath);
    return this.readSkillContent({ skillId: copy.id });
  }

  async getSkillActivation(workspaceId?: string): Promise<SkillActivationConfig> {
    const workspace = this.getWorkspaceForActivation(workspaceId);
    const filePath = this.getSkillActivationPath(workspace.id);
    try {
      const parsed = SkillActivationConfigSchema.parse(JSON.parse(await readFile(filePath, "utf8")));
      return {
        ...parsed,
        enabledSkillIds: uniqueValues(parsed.enabledSkillIds)
      };
    } catch {
      const repaired = {
        workspaceId: workspace.id,
        enabledSkillIds: [],
        updatedAt: nowIso()
      };
      await writeJsonAtomic(filePath, repaired);
      return repaired;
    }
  }

  async updateSkillActivation(input: SkillActivationUpdateInput): Promise<SkillActivationConfig> {
    const parsed = SkillActivationUpdateInputSchema.parse(input);
    const workspace = this.getWorkspaceForActivation(parsed.workspaceId);
    const knownSkillIds = new Set((await this.listSkills()).map((skill) => skill.id));
    const enabledSkillIds = uniqueValues(parsed.enabledSkillIds).filter((skillId) => knownSkillIds.has(skillId));
    const config = {
      workspaceId: workspace.id,
      enabledSkillIds,
      updatedAt: nowIso()
    };
    await writeJsonAtomic(this.getSkillActivationPath(workspace.id), config);
    return config;
  }

  async listEnabledSkills(workspaceId?: string, type?: SkillWorkflowType): Promise<SkillRecord[]> {
    const activation = await this.getSkillActivation(workspaceId);
    const enabledIds = new Set(activation.enabledSkillIds);
    return (await this.listSkills()).filter((skill) => enabledIds.has(skill.id) && (!type || skill.type === type));
  }

  private getPreference(key: string): string | null {
    const row = this.db.prepare("SELECT value FROM preferences WHERE key = ?").get(key);
    return row ? rowString(row, "value") : null;
  }

  private getSkillMarketCachePath(): string {
    return path.join(this.userDataPath, "cache", "skill-market", "manifest-cache.json");
  }

  private async isFreshSkillMarketCache(cachePath: string): Promise<boolean> {
    try {
      const cacheStat = await stat(cachePath);
      return Date.now() - cacheStat.mtimeMs < SKILL_MARKET_MANIFEST_TTL_MS;
    } catch {
      return false;
    }
  }

  private async readSkillMarketCache(
    cachePath: string
  ): Promise<{ manifestUrl: string; fetchedAt: string; manifest: SkillMarketManifest } | null> {
    try {
      const raw = JSON.parse(await readFile(cachePath, "utf8")) as unknown;
      if (!raw || typeof raw !== "object") {
        return null;
      }
      const cache = raw as Record<string, unknown>;
      return {
        manifestUrl: typeof cache.manifestUrl === "string" ? cache.manifestUrl : DEFAULT_SKILL_MARKET_MANIFEST_URL,
        fetchedAt: typeof cache.fetchedAt === "string" ? cache.fetchedAt : "",
        manifest: normalizeSkillMarketManifest(cache.manifest)
      };
    } catch {
      return null;
    }
  }

  private async writeOfficialSkillMeta(rootPath: string, skill: SkillMarketSkill): Promise<void> {
    const metaPath = path.join(rootPath, "meta.json");
    let existing: Record<string, unknown> = {};
    try {
      existing = JSON.parse(await readFile(metaPath, "utf8")) as Record<string, unknown>;
    } catch {
      existing = {};
    }
    await writeJsonAtomic(metaPath, {
      ...existing,
      id: skill.name,
      displayName: skill.displayName,
      type: skill.type,
      sourceType: "official",
      version: skill.version,
      description: skill.description,
      defaultModel: skill.defaultModel ?? null,
      supportedModels: skill.supportedModels,
      origin: null,
      updatedAt: nowIso()
    });
  }

  private getOfficialCopyBaseSnapshotPath(rootPath: string): string {
    return path.join(rootPath, ".origin", "base");
  }

  private async getOfficialCopy(input: SkillOfficialCopyInput): Promise<SkillRecord> {
    const parsed = SkillOfficialCopyInputSchema.parse(input);
    const copy = await this.getSkillById(parsed.skillId);
    if (copy.sourceType !== "copy" || !copy.origin) {
      throw new Error("该 Skill 不是官方副本");
    }
    return copy;
  }

  private async writeOfficialCopyBaseSnapshot(rootPath: string): Promise<void> {
    const basePath = this.getOfficialCopyBaseSnapshotPath(rootPath);
    await rm(basePath, { recursive: true, force: true });
    await mkdir(basePath, { recursive: true });
    await this.copySkillEditableFiles(rootPath, basePath);
  }

  private async replaceSkillFilesFromSource(
    sourceRootPath: string,
    targetRootPath: string,
    metaOverrides: {
      id: string;
      displayName: string;
      sourceType: SkillSourceType;
      origin: SkillRecord["origin"];
    }
  ): Promise<void> {
    await this.removeSkillEditableFiles(targetRootPath);
    await this.copySkillEditableFiles(sourceRootPath, targetRootPath);
    const rawMeta = JSON.parse(await readFile(path.join(targetRootPath, "meta.json"), "utf8")) as Record<string, unknown>;
    await writeJsonAtomic(path.join(targetRootPath, "meta.json"), {
      ...rawMeta,
      id: metaOverrides.id,
      displayName: metaOverrides.displayName,
      sourceType: metaOverrides.sourceType,
      origin: metaOverrides.origin,
      updatedAt: nowIso()
    });
  }

  private async copySkillEditableFiles(sourceRootPath: string, targetRootPath: string): Promise<void> {
    const entries = await readdir(sourceRootPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === ".snapshots" || entry.name === ".origin") {
        continue;
      }
      const sourcePath = path.join(sourceRootPath, entry.name);
      const targetPath = path.join(targetRootPath, entry.name);
      if (entry.isDirectory()) {
        await cp(sourcePath, targetPath, { recursive: true });
      } else if (entry.isFile()) {
        await mkdir(path.dirname(targetPath), { recursive: true });
        await cp(sourcePath, targetPath);
      }
    }
  }

  private async removeSkillEditableFiles(rootPath: string): Promise<void> {
    const entries = await readdir(rootPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === ".snapshots" || entry.name === ".origin") {
        continue;
      }
      await rm(path.join(rootPath, entry.name), { recursive: true, force: true });
    }
  }

  private setPreference(key: string, value: string): void {
    this.db
      .prepare(
        `INSERT INTO preferences (key, value, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
      )
      .run(key, value, nowIso());
  }

  private async listSkillsFromDirectory(rootPath: string, expectedSourceType: SkillSourceType): Promise<SkillRecord[]> {
    const records: SkillRecord[] = [];
    let entries: Dirent[];
    try {
      entries = await readdir(rootPath, { withFileTypes: true });
    } catch {
      return records;
    }

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) {
        continue;
      }
      const skillRootPath = path.join(rootPath, entry.name);
      const metaPath = path.join(skillRootPath, "meta.json");
      try {
        const raw = JSON.parse(await readFile(metaPath, "utf8")) as unknown;
        const parsed = SkillMetaSchema.parse(raw);
        if (expectedSourceType === "official" && parsed.sourceType !== "official") {
          continue;
        }
        if (expectedSourceType === "user" && parsed.sourceType === "official") {
          continue;
        }
        records.push({
          ...parsed,
          rootPath: skillRootPath,
          isEditable: parsed.sourceType !== "official",
          isRestorable: parsed.sourceType === "copy",
          isMissing: false,
          updatedAt:
            typeof raw === "object" && raw !== null && "updatedAt" in raw && typeof raw.updatedAt === "string"
              ? raw.updatedAt
              : null
        });
      } catch {
        continue;
      }
    }

    return records;
  }

  private getWorkspaceForActivation(workspaceId?: string): WorkspaceRecord {
    const id = workspaceId ?? this.getRuntimeState().activeWorkspaceId;
    if (!id) {
      throw new Error("请先创建或选择工作空间");
    }
    const workspace = this.getWorkspace(id);
    if (!workspace) {
      throw new Error("工作空间不存在");
    }
    return workspace;
  }

  private async getSkillById(skillId: string): Promise<SkillRecord> {
    const skill = (await this.listSkills()).find((candidate) => candidate.id === skillId);
    if (!skill) {
      throw new Error("Skill 不存在");
    }
    return skill;
  }

  private async resolveSkillMarkdownPath(rootPath: string, relativePath: string, allowMissing = false): Promise<string> {
    const normalized = normalizeSkillFilePath(relativePath);
    const resolvedRoot = path.resolve(rootPath);
    const candidate = path.resolve(resolvedRoot, normalized);
    if (candidate !== resolvedRoot && !candidate.startsWith(`${resolvedRoot}${path.sep}`)) {
      throw new Error("Skill 文件路径越界");
    }
    if (!allowMissing) {
      const fileStat = await stat(candidate);
      if (!fileStat.isFile()) {
        throw new Error("Skill 文件不是普通文件");
      }
    }
    return candidate;
  }

  private async collectSkillMarkdownFiles(rootPath: string, currentPath: string, files: SkillFile[]): Promise<void> {
    const entries = await readdir(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith(".") || entry.name === ".snapshots") {
        continue;
      }
      const absolutePath = path.join(currentPath, entry.name);
      const relativePath = path.relative(rootPath, absolutePath).replaceAll(path.sep, "/");
      if (entry.isDirectory()) {
        await this.collectSkillMarkdownFiles(rootPath, absolutePath, files);
        continue;
      }
      if (!entry.isFile() || path.posix.extname(relativePath) !== ".md") {
        continue;
      }
      const fileStat = await stat(absolutePath);
      files.push({
        relativePath,
        name: entry.name,
        isEntry: relativePath === "SKILL.md",
        sizeBytes: fileStat.size,
        updatedAt: fileStat.mtime.toISOString()
      });
    }
  }

  private getSkillActivationPath(workspaceId: string): string {
    const workspace = this.getWorkspace(workspaceId);
    if (!workspace) {
      throw new Error("工作空间不存在");
    }
    return path.join(workspace.rootPath, "skills_config", "activation.json");
  }

  private async createSkillSnapshotIfNeeded(rootPath: string, timestamp: string): Promise<void> {
    try {
      const skillMdPath = path.join(rootPath, "SKILL.md");
      const metaPath = path.join(rootPath, "meta.json");
      await stat(skillMdPath);
      const snapshotRootPath = path.join(rootPath, ".snapshots", timestamp.replace(/[:.]/g, "-"));
      await mkdir(snapshotRootPath, { recursive: true });
      await cp(skillMdPath, path.join(snapshotRootPath, "SKILL.md"));
      await cp(metaPath, path.join(snapshotRootPath, "meta.json"));
      await this.pruneSkillSnapshots(rootPath);
    } catch {
      return;
    }
  }

  private async pruneSkillSnapshots(rootPath: string): Promise<void> {
    const retention = Math.max(1, this.skillSnapshotRetention);
    const snapshotRootPath = path.join(rootPath, ".snapshots");
    let entries: Dirent[];
    try {
      entries = await readdir(snapshotRootPath, { withFileTypes: true });
    } catch {
      return;
    }
    const snapshotDirs = entries
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
      .map((entry) => entry.name)
      .sort((left, right) => right.localeCompare(left));
    for (const snapshotId of snapshotDirs.slice(retention)) {
      await rm(path.join(snapshotRootPath, snapshotId), { recursive: true, force: true });
    }
  }

  private async ensureWritableDirectory(rootPath: string): Promise<void> {
    await mkdir(rootPath, { recursive: true });
    const rootStat = await stat(rootPath);
    if (!rootStat.isDirectory()) {
      throw new Error("工作空间根路径不是目录");
    }
    await access(rootPath, constants.R_OK | constants.W_OK);
  }

  private async createWorkspaceFiles(input: {
    id: string;
    name: string;
    rootPath: string;
    macRootPath: string;
    winRootPath: string;
    createdAt: string;
  }): Promise<void> {
    await this.assertNoFreshLock(input.rootPath);
    await Promise.all(WORKSPACE_DIRECTORIES.map((dir) => mkdir(path.join(input.rootPath, dir), { recursive: true })));
    await Promise.all(
      ImageSubdirectories.map((dir) => mkdir(path.join(input.rootPath, "images", dir), { recursive: true }))
    );

    const workspaceDb = await openSqliteDatabase(path.join(input.rootPath, "workspace.db"));
    applySqlMigrations(workspaceDb, WORKSPACE_MIGRATIONS);
    workspaceDb.close();

    await writeJsonAtomic(path.join(input.rootPath, "workspace.json"), {
      id: input.id,
      name: input.name,
      macRootPath: input.macRootPath,
      winRootPath: input.winRootPath,
      createdAt: input.createdAt,
      updatedAt: input.createdAt
    });

    await writeJsonAtomic(path.join(input.rootPath, "skills_config", "activation.json"), {
      workspaceId: input.id,
      enabledSkillIds: [],
      updatedAt: input.createdAt
    });

    await writeJsonAtomic(path.join(input.rootPath, "workspace.lock"), {
      workspaceId: input.id,
      deviceId: os.hostname(),
      os: process.platform,
      appInstanceId: this.appInstanceId,
      openedAt: input.createdAt,
      lastHeartbeatAt: input.createdAt
    });
  }

  private async assertNoFreshLock(rootPath: string): Promise<void> {
    const lockPath = path.join(rootPath, "workspace.lock");
    try {
      const raw = await readFile(lockPath, "utf8");
      const parsed = JSON.parse(raw) as { lastHeartbeatAt?: string };
      const lastHeartbeatAt = parsed.lastHeartbeatAt ? Date.parse(parsed.lastHeartbeatAt) : 0;
      if (Number.isFinite(lastHeartbeatAt) && Date.now() - lastHeartbeatAt < LOCK_STALE_AFTER_MS) {
        throw new Error("检测到有效工作空间锁，已阻止 SQLite 云盘双写");
      }
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error("工作空间锁文件损坏，请确认没有其他实例正在写入");
      }
      if (error instanceof Error && error.message.includes("有效工作空间锁")) {
        throw error;
      }
    }
  }
}
