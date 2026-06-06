// Phase 9 功能验证：conversations / chat_messages DAO 读写 + 持久化 + 外键级联/置空。
// 用 esbuild 打包后以 ELECTRON_RUN_AS_NODE 在 Electron ABI 下运行（better-sqlite3 external）。
// 非生产代码，不纳入 tsconfig include。
import { tmpdir } from 'os'
import { join } from 'path'
import { mkdtempSync, rmSync, existsSync } from 'fs'
import { initDatabase, getDb, closeDatabase } from '../src/main/db'
import { createProject, deleteProject } from '../src/main/db/projects-repo'
import { createGeneration } from '../src/main/db/generations-repo'
import { setCurrentProject } from '../src/main/projects/manager'
import { tryAcquire, release, isBusy } from '../src/main/generation/lock'
import {
  createConversation,
  getLatestConversationByProject,
  createMessage,
  updateMessage,
  listMessages
} from '../src/main/db/conversations-repo'

let passed = 0
function assert(cond: unknown, msg: string): void {
  if (!cond) {
    console.error('FAIL: ' + msg)
    process.exit(1)
  }
  passed++
  console.log('PASS: ' + msg)
}

const dir = mkdtempSync(join(tmpdir(), 'gaf-chat-'))
const dbFile = join(dir, 'forge.db')

// ---- 会话 1：写入 ----
initDatabase(dbFile)
assert(existsSync(dbFile), '启动自动建库（含 conversations/chat_messages 两表）')

const project = createProject(getDb(), { name: 'Chat 项目', absPath: 'C:/games/chat-demo' })
const conv = createConversation(getDb(), { projectId: project.id, skill: 'generate2dsprite' })
assert(conv.id > 0 && conv.projectId === project.id, 'conversation 写入并绑定 project_id')
assert(conv.skill === 'generate2dsprite' && conv.title === null, 'conversation skill/title 默认')

const userMsg = createMessage(getDb(), {
  conversationId: conv.id,
  role: 'user',
  content: '火再大点'
})
assert(userMsg.role === 'user' && userMsg.content === '火再大点', 'user 消息写入读回一致')

// assistant 消息关联一次产出（generation）。
const gen = createGeneration(getDb(), {
  projectId: project.id,
  slug: 'chat-fire-01',
  skill: 'generate2dsprite',
  status: 'success',
  outputDir: 'C:/games/chat-demo/assets/sprites/chat-fire-01'
})
const asstMsg = createMessage(getDb(), {
  conversationId: conv.id,
  role: 'assistant',
  content: '已把火焰调大',
  generationId: gen.id
})
assert(asstMsg.generationId === gen.id, 'assistant 消息关联 generation_id')

// role CHECK：非法角色被拒（运行时校验 + DB CHECK 双防线）。
let roleRejected = false
try {
  createMessage(getDb(), { conversationId: conv.id, role: 'system' as never, content: 'x' })
} catch {
  roleRejected = true
}
assert(roleRejected, 'createMessage 拒绝非法 role "system"')

// updateMessage：改 content + generationId。
const updated = updateMessage(getDb(), asstMsg.id, { content: '已重画第 3 帧' })
assert(updated?.content === '已重画第 3 帧', 'updateMessage 改 content 生效')

closeDatabase()

// ---- 会话 2：重开同库，验证重启不丢 + join ----
initDatabase(dbFile)
const latest = getLatestConversationByProject(getDb(), project.id)
assert(latest !== null && latest.id === conv.id, 'getLatestConversationByProject 命中、重启不丢')

const msgs = listMessages(getDb(), conv.id)
assert(msgs.length === 2, 'listMessages 返回两条消息（时间正序）')
assert(msgs[0].role === 'user' && msgs[1].role === 'assistant', '消息按时间正序')
assert(
  msgs[1].generation !== null && msgs[1].generation.slug === 'chat-fire-01',
  'listMessages join 出关联 generation'
)
assert(msgs[0].generation === null, '无关联产出的消息 generation 为 null')

// ---- 删 generation → message.generation_id 置 NULL（ON DELETE SET NULL）----
getDb().prepare('DELETE FROM generations WHERE id = ?').run(gen.id)
const afterGenDel = listMessages(getDb(), conv.id)
assert(
  afterGenDel[1].generationId === null && afterGenDel[1].generation === null,
  '删 generation 后 chat_messages.generation_id 置 NULL（FK SET NULL 生效）'
)

// ---- 删 project → conversations + chat_messages 级联删除（ON DELETE CASCADE）----
deleteProject(getDb(), project.id)
assert(
  getLatestConversationByProject(getDb(), project.id) === null,
  '删 project 级联删 conversations（FK CASCADE）'
)
const orphanCount = getDb()
  .prepare('SELECT COUNT(*) AS n FROM chat_messages WHERE conversation_id = ?')
  .get(conv.id) as { n: number }
assert(orphanCount.n === 0, '删 project 经会话级联删 chat_messages（无孤儿消息）')

// ---- 项目隔离主进程闭环：busy（codex 任务进行中）时拒绝切换当前项目（终审 BLOCKER 修复）----
// 用真实可写目录（tmp dir）建项目，setCurrentProject 才能通过 assertWritableDir。
const lockProj = createProject(getDb(), { name: 'Lock 项目', absPath: dir })
setCurrentProject(lockProj.id)
assert(!isBusy(), '初始无任务，锁空闲')
assert(tryAcquire() === true, 'tryAcquire 抢锁成功')
let switchBlocked = false
try {
  setCurrentProject(null)
} catch {
  switchBlocked = true
}
assert(switchBlocked, 'busy 时 setCurrentProject(null) 被拒（主进程权威守卫）')
// 同项目幂等 re-set 不受阻（不影响 hydrate 等正常路径）。
assert(setCurrentProject(lockProj.id)?.id === lockProj.id, 'busy 时同项目幂等 re-set 放行')
release()
assert(setCurrentProject(null) === null, '释放锁后切项目恢复正常')

closeDatabase()
rmSync(dir, { recursive: true, force: true })
console.log(`\nALL ${passed} CHAT SMOKE TESTS PASSED`)
