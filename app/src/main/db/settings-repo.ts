import type Database from 'better-sqlite3'
import type { AppSettings } from '../../shared/types'

/** 读取单个设置项；不存在返回 null。 */
export function getSetting(db: Database.Database, key: string): string | null {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as
    | { value: string }
    | undefined
  return row ? row.value : null
}

/** 写入设置项（key 已存在则覆盖 value）。 */
export function setSetting(db: Database.Database, key: string, value: string): void {
  const now = new Date().toISOString()
  db.prepare(
    `INSERT INTO settings (key, value, created_at, updated_at)
     VALUES (@key, @value, @now, @now)
     ON CONFLICT(key) DO UPDATE SET value = @value, updated_at = @now`
  ).run({ key, value, now })
}

/** 读取全部设置为 key-value 映射。 */
export function getAllSettings(db: Database.Database): AppSettings {
  const rows = db.prepare('SELECT key, value FROM settings').all() as Array<{
    key: string
    value: string
  }>
  const out: AppSettings = {}
  for (const r of rows) out[r.key] = r.value
  return out
}
