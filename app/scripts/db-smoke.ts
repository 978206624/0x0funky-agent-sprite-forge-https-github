// Phase 4 功能验证：DAO 真实读写 + 持久化 + 外键级联。
// 用 esbuild 打包后以 ELECTRON_RUN_AS_NODE 在 Electron ABI 下运行（better-sqlite3 external）。
// 非生产代码，不纳入 tsconfig include。
import { tmpdir } from 'os'
import { join, resolve } from 'path'
import { mkdtempSync, rmSync, existsSync } from 'fs'
import { initDatabase, getDb, closeDatabase } from '../src/main/db'
import {
  createProject,
  listProjects,
  getProjectByPath,
  deleteProject
} from '../src/main/db/projects-repo'
import {
  createGeneration,
  listGenerationsByProject,
  updateGeneration
} from '../src/main/db/generations-repo'
import { setSetting, getSetting } from '../src/main/db/settings-repo'

let passed = 0
function assert(cond: unknown, msg: string): void {
  if (!cond) {
    console.error('FAIL: ' + msg)
    process.exit(1)
  }
  passed++
  console.log('PASS: ' + msg)
}

const dir = mkdtempSync(join(tmpdir(), 'gaf-db-'))
const dbFile = join(dir, 'forge.db')

// ---- 会话 1：写入 ----
initDatabase(dbFile)
assert(existsSync(dbFile), '启动自动建库文件存在')

const ABS = resolve('C:/games/demo') // 规范化后的期望存储形态（Windows 下为反斜杠）
const project = createProject(getDb(), { name: 'Demo 项目', absPath: 'C:/games/demo' })
assert(project.id > 0, 'project 写入并返回自增 id')
assert(project.absPath === ABS, 'project.absPath 入库前已规范化')

const gen = createGeneration(getDb(), {
  projectId: project.id,
  slug: 'walk-01',
  skill: 'generate2dsprite',
  status: 'success',
  params: { action: 'walk', gridCols: 4, frameWidth: 64 },
  prompt: '一个行走的骑士',
  outputDir: 'C:/games/demo/assets/sprites/walk-01'
})
assert(gen.projectId === project.id, 'generation 绑定到 project_id 外键')
assert(gen.params?.action === 'walk' && gen.params?.gridCols === 4, 'params JSON 往返一致')

setSetting(getDb(), 'sandbox', 'workspace-write')
closeDatabase()

// ---- 会话 2：重开同一文件，验证重启不丢 ----
initDatabase(dbFile)
const projects = listProjects(getDb())
assert(projects.length === 1 && projects[0].absPath === ABS, 'project 重启后仍可读回')

const reread = getProjectByPath(getDb(), 'C:/games/demo')
assert(reread !== null && reread.id === project.id, 'getProjectByPath 命中（查询前同样规范化）')

const gens = listGenerationsByProject(getDb(), projects[0].id)
assert(
  gens.length === 1 && gens[0].slug === 'walk-01',
  'generation 按 project_id 查询并重启后仍在'
)
assert(getSetting(getDb(), 'sandbox') === 'workspace-write', 'setting 重启后持久')

// ---- 更新 ----
const updated = updateGeneration(getDb(), gens[0].id, { status: 'failed' })
assert(updated?.status === 'failed', 'updateGeneration 改 status 生效')

// ---- abs_path 唯一去重（含路径变体：反斜杠 + 尾分隔符指向同一目录）----
const dup = createProject(getDb(), { name: 'Demo 改名', absPath: 'C:\\games\\demo\\' })
assert(dup.id === project.id && dup.name === 'Demo 改名', 'abs_path 变体经规范化后走更新不新增')
assert(listProjects(getDb()).length === 1, 'abs_path 去重后仍只有 1 个 project')

// ---- status 白名单：非法 status 在写入边界被拒（运行时校验 + DB CHECK 双防线）----
let createRejected = false
try {
  createGeneration(getDb(), { projectId: project.id, slug: 'bad', skill: 'x', status: 'done' as never })
} catch {
  createRejected = true
}
assert(createRejected, 'createGeneration 拒绝非法 status "done"')

let updateRejected = false
try {
  updateGeneration(getDb(), gens[0].id, { status: 'oops' as never })
} catch {
  updateRejected = true
}
assert(updateRejected, 'updateGeneration 拒绝非法 status "oops"')

// ---- 外键 ON DELETE CASCADE ----
deleteProject(getDb(), projects[0].id)
assert(
  listGenerationsByProject(getDb(), projects[0].id).length === 0,
  '删除 project 级联删除其 generations（FK CASCADE 生效）'
)

closeDatabase()
rmSync(dir, { recursive: true, force: true })
console.log(`\nALL ${passed} DB SMOKE TESTS PASSED`)
