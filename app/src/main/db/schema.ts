import type Database from 'better-sqlite3'
import { GENERATION_STATUSES, CHAT_ROLES } from '../../shared/types'

/** generations.status 的 CHECK 白名单，由 GENERATION_STATUSES 派生（单一事实源）。值为本地常量字面量，无注入面。 */
const STATUS_CHECK_LIST = GENERATION_STATUSES.map((s) => `'${s}'`).join(', ')

/** chat_messages.role 的 CHECK 白名单，由 CHAT_ROLES 派生（单一事实源）。 */
const ROLE_CHECK_LIST = CHAT_ROLES.map((r) => `'${r}'`).join(', ')

/**
 * 建表 + 索引。全部 `CREATE ... IF NOT EXISTS`，幂等可重复执行。
 * 命名 snake_case；时间戳以 TEXT 存 ISO 字符串（由应用层写入，便于跨时区一致）。
 *
 * 表关系：
 * - generations.project_id → projects.id（外键，ON DELETE CASCADE：删项目级联删其产出）
 * - settings 为全局 key-value，与项目无关
 */
export function createTables(db: Database.Database): void {
  db.exec(`
    -- 项目：用户选定的磁盘目录元数据
    CREATE TABLE IF NOT EXISTS projects (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      name            TEXT NOT NULL,
      abs_path        TEXT NOT NULL UNIQUE,        -- 项目目录绝对路径，唯一
      created_at      TEXT NOT NULL,
      updated_at      TEXT NOT NULL,
      last_opened_at  TEXT                          -- 最近打开时间，从未打开为 NULL
    );

    -- 产出记录：一次生成的元数据，绑定所属项目
    CREATE TABLE IF NOT EXISTS generations (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id  INTEGER NOT NULL,
      slug        TEXT NOT NULL,                   -- 对应 <项目>/assets/sprites/<slug>/
      skill       TEXT NOT NULL,                   -- 如 generate2dsprite
      status      TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN (${STATUS_CHECK_LIST})), -- GenerationStatus 白名单

      thumbnail   TEXT,
      params      TEXT,                            -- JSON: GenParams（见 shared/types.ts）
      prompt      TEXT,
      output_dir  TEXT,
      created_at  TEXT NOT NULL,
      updated_at  TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_generations_project
      ON generations(project_id, created_at DESC);

    -- 全局设置：key-value
    CREATE TABLE IF NOT EXISTS settings (
      key         TEXT PRIMARY KEY,
      value       TEXT NOT NULL,
      created_at  TEXT NOT NULL,
      updated_at  TEXT NOT NULL
    );

    -- 对话会话（Phase 9）：绑定项目与发起时所用 skill
    CREATE TABLE IF NOT EXISTS conversations (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id  INTEGER NOT NULL,
      skill       TEXT NOT NULL,
      title       TEXT,
      created_at  TEXT NOT NULL,
      updated_at  TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_conversations_project
      ON conversations(project_id, created_at DESC);

    -- 对话消息（Phase 9）：user/assistant 交替；assistant 可关联一次产出
    CREATE TABLE IF NOT EXISTS chat_messages (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL,
      role            TEXT NOT NULL CHECK (role IN (${ROLE_CHECK_LIST})), -- ChatRole 白名单
      content         TEXT NOT NULL DEFAULT '',
      generation_id   INTEGER,                  -- 该条 assistant 消息产出的 generation；删产出则置 NULL
      created_at      TEXT NOT NULL,
      updated_at      TEXT NOT NULL,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
      FOREIGN KEY (generation_id) REFERENCES generations(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation
      ON chat_messages(conversation_id, created_at ASC, id ASC);
  `)
}

/**
 * 轻量迁移：对已存在的老库补加新列。
 * `CREATE TABLE IF NOT EXISTS` 对已存在的表是 no-op、加不了列，故老库需 ALTER。
 * 约定：每条迁移先 `pragma table_info(<表>)` 确认列不存在再 ALTER，幂等、可重复执行；
 * 新库经 createTables 已含全部列，pragma 命中后自动跳过。
 *
 * 首版（Phase 4）无历史库，此处为后续扩展预留；新增列时按上述约定追加。
 */
export function runMigrations(_db: Database.Database): void {
  // 暂无迁移项。示例：
  //   const cols = _db.pragma('table_info(generations)') as Array<{ name: string }>
  //   if (!cols.some((c) => c.name === 'new_col')) {
  //     _db.exec(`ALTER TABLE generations ADD COLUMN new_col TEXT NOT NULL DEFAULT ''`)
  //   }
}
