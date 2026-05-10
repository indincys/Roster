import type { SqlMigration } from "./sqlite";

export const CONFIG_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS schema_migrations (
  id TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS preferences (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  root_path TEXT NOT NULL,
  mac_root_path TEXT NOT NULL,
  win_root_path TEXT NOT NULL,
  color TEXT NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0,
  is_read_only INTEGER NOT NULL DEFAULT 0,
  last_opened_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_workspaces_last_opened_at ON workspaces(last_opened_at);

CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  label TEXT NOT NULL,
  ciphertext TEXT NOT NULL,
  iv TEXT NOT NULL,
  auth_tag TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`;

export const CONFIG_API_KEY_MODEL_METADATA_SQL = `
ALTER TABLE api_keys ADD COLUMN model TEXT;
ALTER TABLE api_keys ADD COLUMN is_default INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_api_keys_provider_model ON api_keys(provider, model);
CREATE INDEX IF NOT EXISTS idx_api_keys_provider_default ON api_keys(provider, is_default);
`;

export const WORKSPACE_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS schema_migrations (
  id TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS videos (
  id TEXT PRIMARY KEY,
  relative_path TEXT NOT NULL UNIQUE,
  sku TEXT,
  style TEXT,
  duration_seconds REAL,
  width INTEGER,
  height INTEGER,
  size_bytes INTEGER,
  status TEXT NOT NULL DEFAULT 'active',
  has_cover INTEGER NOT NULL DEFAULT 0,
  used_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  ratio_group TEXT NOT NULL DEFAULT 'default',
  use_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS titles (
  id TEXT PRIMARY KEY,
  text TEXT NOT NULL,
  source_skill_id TEXT,
  score INTEGER,
  use_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS prompts (
  id TEXT PRIMARY KEY,
  text TEXT NOT NULL,
  scene TEXT NOT NULL,
  generated_count INTEGER NOT NULL DEFAULT 0,
  kept_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS images (
  id TEXT PRIMARY KEY,
  prompt_id TEXT,
  relative_path TEXT NOT NULL UNIQUE,
  scene TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(prompt_id) REFERENCES prompts(id)
);

CREATE TABLE IF NOT EXISTS scripts (
  id TEXT PRIMARY KEY,
  text TEXT NOT NULL,
  source_skill_id TEXT,
  use_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS platform_accounts (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL,
  account_name TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS task_sheets (
  id TEXT PRIMARY KEY,
  sheet_date TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL,
  export_relative_dir TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS task_rows (
  id TEXT PRIMARY KEY,
  sheet_id TEXT NOT NULL,
  run_key TEXT NOT NULL UNIQUE,
  attempt_no INTEGER NOT NULL,
  video_id TEXT NOT NULL,
  title_id TEXT,
  platform_account_id TEXT NOT NULL,
  publish_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  video_relative_path TEXT NOT NULL,
  cover_relative_path TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(sheet_id) REFERENCES task_sheets(id),
  FOREIGN KEY(video_id) REFERENCES videos(id),
  FOREIGN KEY(title_id) REFERENCES titles(id),
  FOREIGN KEY(platform_account_id) REFERENCES platform_accounts(id)
);

CREATE TABLE IF NOT EXISTS processed_status_files (
  id TEXT PRIMARY KEY,
  run_key TEXT NOT NULL,
  file_hash TEXT NOT NULL,
  processed_at TEXT NOT NULL,
  UNIQUE(run_key, file_hash)
);

CREATE TABLE IF NOT EXISTS task_status_events (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  attempt_no INTEGER NOT NULL,
  run_key TEXT NOT NULL,
  status TEXT NOT NULL,
  status_file_relative_path TEXT NOT NULL,
  status_file_mtime INTEGER,
  status_file_hash TEXT NOT NULL,
  executed_at TEXT,
  platform_post_url TEXT,
  error_code TEXT,
  error_message TEXT,
  rpa_log TEXT,
  ingested_at TEXT NOT NULL,
  UNIQUE(run_key, status_file_hash),
  FOREIGN KEY(task_id) REFERENCES task_rows(id)
);

CREATE INDEX IF NOT EXISTS idx_videos_relative_path ON videos(relative_path);
CREATE INDEX IF NOT EXISTS idx_task_rows_run_key ON task_rows(run_key);
CREATE INDEX IF NOT EXISTS idx_task_rows_status ON task_rows(status);
CREATE INDEX IF NOT EXISTS idx_task_status_events_task ON task_status_events(task_id);
`;

export const WORKSPACE_VIDEO_METADATA_SQL = `
ALTER TABLE videos ADD COLUMN file_name TEXT;
ALTER TABLE videos ADD COLUMN thumbnail_relative_path TEXT;
ALTER TABLE videos ADD COLUMN metadata_error TEXT;
ALTER TABLE videos ADD COLUMN last_scanned_at TEXT;
ALTER TABLE videos ADD COLUMN last_used_at TEXT;
ALTER TABLE videos ADD COLUMN note TEXT;

CREATE INDEX IF NOT EXISTS idx_videos_status ON videos(status);
CREATE INDEX IF NOT EXISTS idx_videos_sku_style ON videos(sku, style);
`;

export const WORKSPACE_TAG_GROUPS_SQL = `
ALTER TABLE tags RENAME TO tags_legacy_0003;

CREATE TABLE tags (
  id TEXT PRIMARY KEY,
  sku_code TEXT NOT NULL,
  sku_style TEXT NOT NULL DEFAULT '',
  tag1 TEXT,
  tag2 TEXT,
  tag3 TEXT,
  tag4 TEXT,
  tag5 TEXT,
  tag_group TEXT NOT NULL DEFAULT 'default',
  use_count INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(sku_code, sku_style, tag_group)
);

INSERT INTO tags (
  id, sku_code, sku_style, tag1, tag_group, use_count, created_at, updated_at
)
SELECT
  id,
  name,
  '',
  name,
  CASE ratio_group WHEN 'test' THEN 'test' ELSE 'default' END,
  use_count,
  created_at,
  updated_at
FROM tags_legacy_0003;

DROP TABLE tags_legacy_0003;

CREATE INDEX IF NOT EXISTS idx_tags_sku_code ON tags(sku_code);
CREATE INDEX IF NOT EXISTS idx_tags_group ON tags(tag_group);
`;

export const WORKSPACE_TITLE_METADATA_SQL = `
ALTER TABLE titles ADD COLUMN status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE titles ADD COLUMN notes TEXT;
ALTER TABLE titles ADD COLUMN last_used_at TEXT;

CREATE INDEX IF NOT EXISTS idx_titles_status ON titles(status);
CREATE INDEX IF NOT EXISTS idx_titles_use_count ON titles(use_count);
`;

export const WORKSPACE_PROMPT_METADATA_SQL = `
ALTER TABLE prompts ADD COLUMN notes TEXT;

CREATE INDEX IF NOT EXISTS idx_prompts_scene ON prompts(scene);
CREATE INDEX IF NOT EXISTS idx_prompts_status ON prompts(status);
`;

export const WORKSPACE_SCRIPT_METADATA_SQL = `
ALTER TABLE scripts ADD COLUMN status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE scripts ADD COLUMN notes TEXT;
ALTER TABLE scripts ADD COLUMN last_used_at TEXT;

CREATE INDEX IF NOT EXISTS idx_scripts_status ON scripts(status);
CREATE INDEX IF NOT EXISTS idx_scripts_use_count ON scripts(use_count);
`;

export const WORKSPACE_IMAGE_METADATA_SQL = `
ALTER TABLE images ADD COLUMN file_name TEXT;
ALTER TABLE images ADD COLUMN width INTEGER;
ALTER TABLE images ADD COLUMN height INTEGER;
ALTER TABLE images ADD COLUMN aspect_ratio TEXT;
ALTER TABLE images ADD COLUMN source_model TEXT;
ALTER TABLE images ADD COLUMN tags TEXT;
ALTER TABLE images ADD COLUMN notes TEXT;
ALTER TABLE images ADD COLUMN generated_at TEXT;

CREATE INDEX IF NOT EXISTS idx_images_scene ON images(scene);
CREATE INDEX IF NOT EXISTS idx_images_status ON images(status);
CREATE INDEX IF NOT EXISTS idx_images_prompt_id ON images(prompt_id);
`;

export const WORKSPACE_TASK_ROW_METADATA_SQL = `
ALTER TABLE task_rows ADD COLUMN tag_group TEXT;
ALTER TABLE task_rows ADD COLUMN tag1 TEXT;
ALTER TABLE task_rows ADD COLUMN tag2 TEXT;
ALTER TABLE task_rows ADD COLUMN tag3 TEXT;
ALTER TABLE task_rows ADD COLUMN tag4 TEXT;
ALTER TABLE task_rows ADD COLUMN tag5 TEXT;
ALTER TABLE task_rows ADD COLUMN error_code TEXT;
ALTER TABLE task_rows ADD COLUMN error_message TEXT;

CREATE INDEX IF NOT EXISTS idx_task_sheets_date ON task_sheets(sheet_date);
CREATE INDEX IF NOT EXISTS idx_task_rows_video_platform ON task_rows(video_id, platform_account_id);
`;

export const WORKSPACE_TASK_STATUS_EVENTS_SQL = `
CREATE TABLE IF NOT EXISTS task_status_events (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  attempt_no INTEGER NOT NULL,
  run_key TEXT NOT NULL,
  status TEXT NOT NULL,
  status_file_relative_path TEXT NOT NULL,
  status_file_mtime INTEGER,
  status_file_hash TEXT NOT NULL,
  executed_at TEXT,
  platform_post_url TEXT,
  error_code TEXT,
  error_message TEXT,
  rpa_log TEXT,
  ingested_at TEXT NOT NULL,
  UNIQUE(run_key, status_file_hash),
  FOREIGN KEY(task_id) REFERENCES task_rows(id)
);

CREATE INDEX IF NOT EXISTS idx_task_status_events_task ON task_status_events(task_id);
`;

export const WORKSPACE_TASK_ROW_EDITING_SQL = `
ALTER TABLE task_rows ADD COLUMN title_text_override TEXT;
`;

export const WORKSPACE_VIDEO_COVER_PATH_SQL = `
ALTER TABLE videos ADD COLUMN cover_relative_path TEXT;
`;

export const WORKSPACE_SCHEDULED_JOBS_SQL = `
CREATE TABLE IF NOT EXISTS scheduled_jobs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  schedule_label TEXT NOT NULL,
  next_run_at TEXT,
  target_page TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS scheduled_job_runs (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  duration_ms INTEGER,
  artifact_summary TEXT,
  error_message TEXT,
  FOREIGN KEY(job_id) REFERENCES scheduled_jobs(id)
);

CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_status ON scheduled_jobs(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_job_runs_job ON scheduled_job_runs(job_id, started_at);
`;

export const WORKSPACE_SCRIPT_SKU_SQL = `
ALTER TABLE scripts ADD COLUMN sku_code TEXT;

CREATE INDEX IF NOT EXISTS idx_scripts_sku_code ON scripts(sku_code);
`;

export const WORKSPACE_SCHEDULED_JOB_MISSED_POLICY_SQL = `
ALTER TABLE scheduled_jobs ADD COLUMN missed_run_policy TEXT NOT NULL DEFAULT 'catch_up_last';

CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_missed_policy ON scheduled_jobs(missed_run_policy);
`;

export const WORKSPACE_API_CALL_LOG_SQL = `
CREATE TABLE IF NOT EXISTS api_call_log (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  workflow TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT NOT NULL,
  duration_ms INTEGER NOT NULL,
  input_tokens INTEGER,
  output_tokens INTEGER,
  total_tokens INTEGER,
  error_code TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_api_call_log_provider_model ON api_call_log(provider, model);
CREATE INDEX IF NOT EXISTS idx_api_call_log_workflow_created ON api_call_log(workflow, created_at);
CREATE INDEX IF NOT EXISTS idx_api_call_log_status ON api_call_log(status);
`;

export const WORKSPACE_IMAGE_SCENE_PRESETS_SQL = `
CREATE TABLE IF NOT EXISTS image_scene_presets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  skill_id TEXT,
  default_aspect_ratio TEXT NOT NULL,
  default_per_prompt_count INTEGER NOT NULL,
  default_output_subdir TEXT NOT NULL,
  default_image_model TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_image_scene_presets_name ON image_scene_presets(name);
`;

export const CONFIG_MIGRATIONS: SqlMigration[] = [
  {
    id: "0001_config_schema",
    sql: CONFIG_SCHEMA_SQL
  },
  {
    id: "0002_api_key_model_metadata",
    sql: CONFIG_API_KEY_MODEL_METADATA_SQL
  }
];

export const WORKSPACE_MIGRATIONS: SqlMigration[] = [
  {
    id: "0001_workspace_schema",
    sql: WORKSPACE_SCHEMA_SQL
  },
  {
    id: "0002_video_metadata_columns",
    sql: WORKSPACE_VIDEO_METADATA_SQL
  },
  {
    id: "0003_tag_groups_schema",
    sql: WORKSPACE_TAG_GROUPS_SQL
  },
  {
    id: "0004_title_metadata_columns",
    sql: WORKSPACE_TITLE_METADATA_SQL
  },
  {
    id: "0005_prompt_metadata_columns",
    sql: WORKSPACE_PROMPT_METADATA_SQL
  },
  {
    id: "0006_script_metadata_columns",
    sql: WORKSPACE_SCRIPT_METADATA_SQL
  },
  {
    id: "0007_image_metadata_columns",
    sql: WORKSPACE_IMAGE_METADATA_SQL
  },
  {
    id: "0008_task_row_metadata_columns",
    sql: WORKSPACE_TASK_ROW_METADATA_SQL
  },
  {
    id: "0009_task_status_events",
    sql: WORKSPACE_TASK_STATUS_EVENTS_SQL
  },
  {
    id: "0010_task_row_editing",
    sql: WORKSPACE_TASK_ROW_EDITING_SQL
  },
  {
    id: "0011_video_cover_path",
    sql: WORKSPACE_VIDEO_COVER_PATH_SQL
  },
  {
    id: "0012_scheduled_jobs",
    sql: WORKSPACE_SCHEDULED_JOBS_SQL
  },
  {
    id: "0013_script_sku",
    sql: WORKSPACE_SCRIPT_SKU_SQL
  },
  {
    id: "0014_scheduled_job_missed_policy",
    sql: WORKSPACE_SCHEDULED_JOB_MISSED_POLICY_SQL
  },
  {
    id: "0015_api_call_log",
    sql: WORKSPACE_API_CALL_LOG_SQL
  },
  {
    id: "0016_image_scene_presets",
    sql: WORKSPACE_IMAGE_SCENE_PRESETS_SQL
  }
];
