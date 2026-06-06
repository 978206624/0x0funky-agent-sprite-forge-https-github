import type Database from 'better-sqlite3'
import type {
  Conversation,
  ConversationInput,
  ChatMessage,
  ChatMessageInput,
  ChatMessageUpdate,
  ChatMessageWithGen,
  ChatRole
} from '../../shared/types'
import { CHAT_ROLES } from '../../shared/types'
import { getGeneration } from './generations-repo'

/** 写入边界运行时校验：拒绝非法 role 进库（与 DB CHECK 双重防线）。 */
function assertValidRole(role: string): void {
  if (!(CHAT_ROLES as readonly string[]).includes(role)) {
    throw new Error(`非法 chat role: "${role}"，须为 ${CHAT_ROLES.join(' / ')} 之一`)
  }
}

// ---------------- conversations ----------------

/** conversations 表行（snake_case）。 */
interface ConversationRow {
  id: number
  project_id: number
  skill: string
  title: string | null
  created_at: string
  updated_at: string
}

function rowToConversation(row: ConversationRow): Conversation {
  return {
    id: row.id,
    projectId: row.project_id,
    skill: row.skill,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

/** 新建会话（绑定 project_id）。 */
export function createConversation(
  db: Database.Database,
  input: ConversationInput
): Conversation {
  const now = new Date().toISOString()
  const info = db
    .prepare(
      `INSERT INTO conversations (project_id, skill, title, created_at, updated_at)
       VALUES (@projectId, @skill, @title, @now, @now)`
    )
    .run({
      projectId: input.projectId,
      skill: input.skill,
      title: input.title ?? null,
      now
    })
  return getConversation(db, Number(info.lastInsertRowid)) as Conversation
}

/** 按 id 查会话。 */
export function getConversation(db: Database.Database, id: number): Conversation | null {
  const row = db.prepare('SELECT * FROM conversations WHERE id = ?').get(id) as
    | ConversationRow
    | undefined
  return row ? rowToConversation(row) : null
}

/** 取某项目最近的会话（按创建时间倒序首条）；无则 null。首版单活跃会话即取此。 */
export function getLatestConversationByProject(
  db: Database.Database,
  projectId: number
): Conversation | null {
  const row = db
    .prepare(
      'SELECT * FROM conversations WHERE project_id = ? ORDER BY created_at DESC, id DESC LIMIT 1'
    )
    .get(projectId) as ConversationRow | undefined
  return row ? rowToConversation(row) : null
}

// ---------------- chat_messages ----------------

/** chat_messages 表行（snake_case）。 */
interface ChatMessageRow {
  id: number
  conversation_id: number
  role: string
  content: string
  generation_id: number | null
  created_at: string
  updated_at: string
}

function rowToMessage(row: ChatMessageRow): ChatMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role as ChatRole,
    content: row.content,
    generationId: row.generation_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

/** 新建消息（绑定 conversation_id）。 */
export function createMessage(db: Database.Database, input: ChatMessageInput): ChatMessage {
  assertValidRole(input.role)
  const now = new Date().toISOString()
  const info = db
    .prepare(
      `INSERT INTO chat_messages (conversation_id, role, content, generation_id, created_at, updated_at)
       VALUES (@conversationId, @role, @content, @generationId, @now, @now)`
    )
    .run({
      conversationId: input.conversationId,
      role: input.role,
      content: input.content,
      generationId: input.generationId ?? null,
      now
    })
  return getMessage(db, Number(info.lastInsertRowid)) as ChatMessage
}

/** 按 id 查消息。 */
export function getMessage(db: Database.Database, id: number): ChatMessage | null {
  const row = db.prepare('SELECT * FROM chat_messages WHERE id = ?').get(id) as
    | ChatMessageRow
    | undefined
  return row ? rowToMessage(row) : null
}

/** 更新消息的部分字段（content / generationId）。 */
export function updateMessage(
  db: Database.Database,
  id: number,
  patch: ChatMessageUpdate
): ChatMessage | null {
  const sets: string[] = []
  const params: Record<string, string | number | null> = { id }
  if (patch.content !== undefined) {
    sets.push('content = @content')
    params.content = patch.content
  }
  if (patch.generationId !== undefined) {
    sets.push('generation_id = @generationId')
    params.generationId = patch.generationId
  }
  if (sets.length === 0) return getMessage(db, id)
  sets.push('updated_at = @now')
  params.now = new Date().toISOString()
  db.prepare(`UPDATE chat_messages SET ${sets.join(', ')} WHERE id = @id`).run(params)
  return getMessage(db, id)
}

/**
 * 列出会话消息（按时间正序），并 join 关联产出为 ChatMessageWithGen。
 * 渲染层据此内联缩略图 + 「应用为产出」；逐条 getGeneration（对话规模 N+1 可接受），
 * 重启后仍拿得到完整记录，无需易失效的 generationId→record map。
 */
export function listMessages(
  db: Database.Database,
  conversationId: number
): ChatMessageWithGen[] {
  const rows = db
    .prepare(
      'SELECT * FROM chat_messages WHERE conversation_id = ? ORDER BY created_at ASC, id ASC'
    )
    .all(conversationId) as ChatMessageRow[]
  return rows.map((row) => {
    const msg = rowToMessage(row)
    const generation = msg.generationId !== null ? getGeneration(db, msg.generationId) : null
    return { ...msg, generation }
  })
}
