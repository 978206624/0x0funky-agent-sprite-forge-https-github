import { app } from 'electron'
import { join } from 'path'
import Database from 'better-sqlite3'
import { createTables, runMigrations } from './schema'

/** 全局单库文件名（位于用户数据目录）。 */
const DB_FILENAME = 'game-asset-forge.db'

let db: Database.Database | null = null

/**
 * 初始化全局数据库（应用启动时调用一次）。
 * 默认建库于用户数据目录（app.getPath('userData')），与项目目录解耦、重启不丢；
 * 可传 dbPath 覆盖路径（测试用）。开启 WAL 与外键约束，建表 + 迁移。
 */
export function initDatabase(dbPath?: string): Database.Database {
  if (db) return db
  const file = dbPath ?? join(app.getPath('userData'), DB_FILENAME)
  db = new Database(file)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  createTables(db)
  runMigrations(db)
  return db
}

/** 获取数据库实例；未初始化则抛错（调用方须先 initDatabase）。 */
export function getDb(): Database.Database {
  if (!db) throw new Error('数据库未初始化，请先调用 initDatabase()')
  return db
}

/** 关闭数据库（应用退出时调用）。 */
export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
  }
}
