// Phase 5 功能验证：projects manager 目录校验 / assets 初始化 / 新建打开 / 当前项目。
// esbuild 打包 + ELECTRON_RUN_AS_NODE 运行（better-sqlite3 + electron external）。
// 非生产代码，不纳入 tsconfig include。
import { tmpdir } from 'os'
import { join } from 'path'
import { mkdtempSync, rmSync, existsSync, mkdirSync } from 'fs'
import { initDatabase, getDb, closeDatabase } from '../src/main/db'
import { listProjects } from '../src/main/db/projects-repo'
import {
  openProjectAt,
  openExistingProject,
  setCurrentProject,
  getCurrentProjectId
} from '../src/main/projects/manager'

let passed = 0
function assert(cond: unknown, msg: string): void {
  if (!cond) {
    console.error('FAIL: ' + msg)
    process.exit(1)
  }
  passed++
  console.log('PASS: ' + msg)
}

const root = mkdtempSync(join(tmpdir(), 'gaf-proj-'))
const dbFile = join(root, 'forge.db')
const projDir = join(root, 'my-game')
mkdirSync(projDir, { recursive: true })

initDatabase(dbFile)

// 新建/打开项目：校验 + 初始化 assets + 入库
const p = openProjectAt(projDir)
assert(p.id > 0, 'openProjectAt 创建项目并入库')
assert(p.name === 'my-game', '缺省项目名取目录名')
assert(existsSync(join(projDir, 'assets', 'sprites')), '项目目录下初始化 assets/sprites/')

// upsert 去重：同目录再开不新增
const p2 = openProjectAt(projDir, '改个名')
assert(p2.id === p.id && p2.name === '改个名', '同目录 upsert 去重 + 更新名称')
assert(listProjects(getDb()).length === 1, '去重后仍只有 1 个 project')

// 打开最近项目（按 id，校验目录仍在）
const reopened = openExistingProject(p.id)
assert(reopened.id === p.id, 'openExistingProject 按 id 打开')
assert(reopened.lastOpenedAt !== null, '打开后刷新 last_opened_at')

// 当前项目主进程状态
assert(getCurrentProjectId() === null, '初始当前项目为空')
setCurrentProject(p.id)
assert(getCurrentProjectId() === p.id, 'setCurrentProject 设置生效')
setCurrentProject(null)
assert(getCurrentProjectId() === null, 'setCurrentProject(null) 清空')

// 不存在的目录 → 抛错
let rejected = false
try {
  openProjectAt(join(root, 'does-not-exist'))
} catch {
  rejected = true
}
assert(rejected, '打开不存在目录被拒')

// 打开已删除目录的最近项目 → 抛错
rmSync(projDir, { recursive: true, force: true })
let openRejected = false
try {
  openExistingProject(p.id)
} catch {
  openRejected = true
}
assert(openRejected, '最近项目目录已删除时打开被拒')

closeDatabase()
rmSync(root, { recursive: true, force: true })
console.log(`\nALL ${passed} PROJECTS SMOKE TESTS PASSED`)
