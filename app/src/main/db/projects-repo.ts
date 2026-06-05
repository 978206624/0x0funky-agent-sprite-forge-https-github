import type Database from 'better-sqlite3'
import { resolve } from 'path'
import type { Project, ProjectInput } from '../../shared/types'

/**
 * 路径规范化兜底：统一斜杠、去尾分隔符、解析 `.`/`..`，使去重对斜杠/尾分隔符差异生效。
 * 注意：`path.resolve` 不折叠 Windows 大小写（`C:` vs `c:`）。完整的大小写不敏感去重
 * 由 Phase 5 项目管理边界用 `fs.realpathSync.native` 处理（那里有目录存在性校验）。
 */
function normalizeAbsPath(p: string): string {
  return resolve(p)
}

/** projects 表行（snake_case）。 */
interface ProjectRow {
  id: number
  name: string
  abs_path: string
  created_at: string
  updated_at: string
  last_opened_at: string | null
}

function rowToProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    absPath: row.abs_path,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastOpenedAt: row.last_opened_at
  }
}

/**
 * 新建项目。abs_path 唯一：若已存在则更新 name 并刷新打开时间（去重），
 * 始终返回该路径对应的最新记录。
 */
export function createProject(db: Database.Database, input: ProjectInput): Project {
  const absPath = normalizeAbsPath(input.absPath)
  const now = new Date().toISOString()
  db.prepare(
    `INSERT INTO projects (name, abs_path, created_at, updated_at, last_opened_at)
     VALUES (@name, @absPath, @now, @now, @now)
     ON CONFLICT(abs_path) DO UPDATE SET
       name = @name, updated_at = @now, last_opened_at = @now`
  ).run({ name: input.name, absPath, now })
  return getProjectByPath(db, absPath) as Project
}

/** 按 id 查项目。 */
export function getProject(db: Database.Database, id: number): Project | null {
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as ProjectRow | undefined
  return row ? rowToProject(row) : null
}

/** 按绝对路径查项目。 */
export function getProjectByPath(db: Database.Database, absPath: string): Project | null {
  const row = db.prepare('SELECT * FROM projects WHERE abs_path = ?').get(normalizeAbsPath(absPath)) as
    | ProjectRow
    | undefined
  return row ? rowToProject(row) : null
}

/** 最近项目列表：已打开的按 last_opened_at 倒序在前，未打开的按 created_at 倒序在后。 */
export function listProjects(db: Database.Database): Project[] {
  const rows = db
    .prepare(
      `SELECT * FROM projects
       ORDER BY last_opened_at IS NULL, last_opened_at DESC, created_at DESC`
    )
    .all() as ProjectRow[]
  return rows.map(rowToProject)
}

/** 刷新最近打开时间。 */
export function touchProject(db: Database.Database, id: number): void {
  const now = new Date().toISOString()
  db.prepare('UPDATE projects SET last_opened_at = ?, updated_at = ? WHERE id = ?').run(now, now, id)
}

/** 删除项目（外键 ON DELETE CASCADE：级联删除其 generations）。 */
export function deleteProject(db: Database.Database, id: number): void {
  db.prepare('DELETE FROM projects WHERE id = ?').run(id)
}
