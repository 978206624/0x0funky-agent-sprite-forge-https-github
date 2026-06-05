import type Database from 'better-sqlite3'
import type {
  GenerationRecord,
  GenerationInput,
  GenerationUpdate,
  GenParams,
  GenerationStatus
} from '../../shared/types'
import { GENERATION_STATUSES } from '../../shared/types'

/** 写入边界运行时校验：拒绝非法 status 进库（与 DB CHECK 双重防线）。 */
function assertValidStatus(status: string): void {
  if (!(GENERATION_STATUSES as readonly string[]).includes(status)) {
    throw new Error(
      `非法 generation status: "${status}"，须为 ${GENERATION_STATUSES.join(' / ')} 之一`
    )
  }
}

/** generations 表行（snake_case）。params 为 JSON 字符串。 */
interface GenerationRow {
  id: number
  project_id: number
  slug: string
  skill: string
  status: string
  thumbnail: string | null
  params: string | null
  prompt: string | null
  output_dir: string | null
  created_at: string
  updated_at: string
}

function parseParams(json: string | null): GenParams | null {
  if (!json) return null
  try {
    return JSON.parse(json) as GenParams
  } catch {
    return null
  }
}

function rowToGeneration(row: GenerationRow): GenerationRecord {
  return {
    id: row.id,
    projectId: row.project_id,
    slug: row.slug,
    skill: row.skill,
    status: row.status as GenerationStatus,
    thumbnail: row.thumbnail,
    params: parseParams(row.params),
    prompt: row.prompt,
    outputDir: row.output_dir,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

/** 新建产出记录（绑定 project_id）。 */
export function createGeneration(db: Database.Database, input: GenerationInput): GenerationRecord {
  const status = input.status ?? 'pending'
  assertValidStatus(status)
  const now = new Date().toISOString()
  const info = db
    .prepare(
      `INSERT INTO generations
         (project_id, slug, skill, status, thumbnail, params, prompt, output_dir, created_at, updated_at)
       VALUES
         (@projectId, @slug, @skill, @status, @thumbnail, @params, @prompt, @outputDir, @now, @now)`
    )
    .run({
      projectId: input.projectId,
      slug: input.slug,
      skill: input.skill,
      status,
      thumbnail: input.thumbnail ?? null,
      params: input.params ? JSON.stringify(input.params) : null,
      prompt: input.prompt ?? null,
      outputDir: input.outputDir ?? null,
      now
    })
  return getGeneration(db, Number(info.lastInsertRowid)) as GenerationRecord
}

/** 按 id 查产出记录。 */
export function getGeneration(db: Database.Database, id: number): GenerationRecord | null {
  const row = db.prepare('SELECT * FROM generations WHERE id = ?').get(id) as
    | GenerationRow
    | undefined
  return row ? rowToGeneration(row) : null
}

/** 按项目列出产出记录，按创建时间倒序。 */
export function listGenerationsByProject(
  db: Database.Database,
  projectId: number
): GenerationRecord[] {
  const rows = db
    .prepare('SELECT * FROM generations WHERE project_id = ? ORDER BY created_at DESC, id DESC')
    .all(projectId) as GenerationRow[]
  return rows.map(rowToGeneration)
}

/** 更新产出记录的部分字段（status / thumbnail / outputDir / params）。 */
export function updateGeneration(
  db: Database.Database,
  id: number,
  patch: GenerationUpdate
): GenerationRecord | null {
  const sets: string[] = []
  const params: Record<string, string | number | null> = { id }
  if (patch.status !== undefined) {
    assertValidStatus(patch.status)
    sets.push('status = @status')
    params.status = patch.status
  }
  if (patch.thumbnail !== undefined) {
    sets.push('thumbnail = @thumbnail')
    params.thumbnail = patch.thumbnail
  }
  if (patch.outputDir !== undefined) {
    sets.push('output_dir = @outputDir')
    params.outputDir = patch.outputDir
  }
  if (patch.params !== undefined) {
    sets.push('params = @params')
    params.params = patch.params ? JSON.stringify(patch.params) : null
  }
  if (sets.length === 0) return getGeneration(db, id)
  sets.push('updated_at = @now')
  params.now = new Date().toISOString()
  db.prepare(`UPDATE generations SET ${sets.join(', ')} WHERE id = @id`).run(params)
  return getGeneration(db, id)
}
