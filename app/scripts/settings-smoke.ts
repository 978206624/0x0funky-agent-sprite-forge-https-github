// Phase 10 功能验证：settings service（默认兜底 + 安全 clamp）+ forget 无损 + clearHistory + maskSecrets。
// 用 esbuild 打包后以 ELECTRON_RUN_AS_NODE 在 Electron ABI 下运行（better-sqlite3 external）。
// 非生产代码，不纳入 tsconfig include。
import { tmpdir } from 'os'
import { join } from 'path'
import { mkdtempSync, rmSync } from 'fs'
import { initDatabase, getDb, closeDatabase } from '../src/main/db'
import { setSetting } from '../src/main/db/settings-repo'
import { createProject, listProjects, forgetProject, getProject } from '../src/main/db/projects-repo'
import { createGeneration, listGenerationsByProject, clearGenerationsByProject } from '../src/main/db/generations-repo'
import {
  getGenDefaults,
  getEffectiveSandbox,
  isDangerAllowed,
  getCodexBinOverride,
  coerceEffort
} from '../src/main/settings/service'
import { SETTINGS_KEYS } from '../src/shared/settings-keys'
import { maskSecrets, maskEvent } from '../src/shared/mask'

let passed = 0
function assert(cond: unknown, msg: string): void {
  if (!cond) {
    console.error('FAIL: ' + msg)
    process.exit(1)
  }
  passed++
  console.log('PASS: ' + msg)
}

const dir = mkdtempSync(join(tmpdir(), 'gaf-settings-'))
const dbFile = join(dir, 'forge.db')
initDatabase(dbFile)

// ---- 默认兜底（无任何 setting）----
const d0 = getGenDefaults()
assert(d0.sandbox === 'workspace-write', 'getGenDefaults 默认 sandbox=workspace-write')
assert(d0.model === undefined && d0.effort === undefined, 'model/effort 默认 undefined（交 codex 默认）')
assert(isDangerAllowed() === false, 'danger 默认不允许')
assert(getCodexBinOverride() === undefined, 'bin override 默认 undefined')

// ---- 坏值兜底 ----
setSetting(getDb(), SETTINGS_KEYS.genSandbox, 'bogus-mode')
setSetting(getDb(), SETTINGS_KEYS.genEffort, 'turbo') // 非法 effort
assert(getGenDefaults().sandbox === 'workspace-write', '非法 sandbox 值兜底回 workspace-write')
assert(getGenDefaults().effort === undefined, '非法 effort 值当未配置')

// ---- 合法值读取 ----
setSetting(getDb(), SETTINGS_KEYS.genSandbox, 'read-only')
setSetting(getDb(), SETTINGS_KEYS.genEffort, 'high')
setSetting(getDb(), SETTINGS_KEYS.genModel, 'gpt-5-codex')
const d1 = getGenDefaults()
assert(d1.sandbox === 'read-only' && d1.effort === 'high' && d1.model === 'gpt-5-codex', '合法生成默认值读回一致')

// ---- 安全 clamp ----
const c1 = getEffectiveSandbox('danger-full-access')
assert(c1.sandbox === 'workspace-write' && c1.downgraded === true, 'danger 未授权 → 降级 workspace-write + downgraded')
setSetting(getDb(), SETTINGS_KEYS.allowDanger, 'true')
const c2 = getEffectiveSandbox('danger-full-access')
assert(c2.sandbox === 'danger-full-access' && c2.downgraded === false, 'danger 已授权 → 放行不降级')
const c3 = getEffectiveSandbox('read-only')
assert(c3.sandbox === 'read-only' && c3.downgraded === false, '非 danger 请求原样放行')
const c4 = getEffectiveSandbox(undefined)
assert(c4.downgraded === false, '未指定 → 用默认（此时 allowDanger 已开，默认仍为合法值）')

// ---- forget 无损隐藏：从 listProjects 消失，但行 + 历史保留 ----
const proj = createProject(getDb(), { name: 'Forget 项目', absPath: dir })
createGeneration(getDb(), { projectId: proj.id, slug: 'g1', skill: 'generate2dsprite', status: 'success' })
assert(listProjects(getDb()).some((p) => p.id === proj.id), 'forget 前项目在最近列表')
forgetProject(getDb(), proj.id)
assert(!listProjects(getDb()).some((p) => p.id === proj.id), 'forget 后项目从最近列表隐藏')
assert(getProject(getDb(), proj.id) !== null, 'forget 后 projects 行仍保留（无损）')
assert(listGenerationsByProject(getDb(), proj.id).length === 1, 'forget 后该项目历史完好（无损）')

// ---- 重新 createProject（同路径 upsert）→ last_opened_at 回填 → 重现最近列表，历史不增不减 ----
createProject(getDb(), { name: 'Forget 项目', absPath: dir })
assert(listProjects(getDb()).some((p) => p.id === proj.id), '重新打开同路径 → 项目重现最近列表')
assert(listGenerationsByProject(getDb(), proj.id).length === 1, '重现后历史仍为 1 条（无重复无丢失）')

// ---- clearGenerationsByProject：删行、保留磁盘（此处只验 DB 行）----
createGeneration(getDb(), { projectId: proj.id, slug: 'g2', skill: 'generate2dsprite', status: 'failed' })
assert(listGenerationsByProject(getDb(), proj.id).length === 2, '清空前 2 条历史')
const removed = clearGenerationsByProject(getDb(), proj.id)
assert(removed === 2, 'clearGenerationsByProject 返回删除行数 2')
assert(listGenerationsByProject(getDb(), proj.id).length === 0, '清空后历史为空（项目行仍在）')
assert(getProject(getDb(), proj.id) !== null, '清空历史不删项目行')

// ---- coerceEffort 白名单（BLOCKER 修复：per-request effort 不可任意串）----
assert(coerceEffort('high') === 'high', 'coerceEffort 合法值放行')
assert(coerceEffort(' medium ') === 'medium', 'coerceEffort trim 后放行')
assert(coerceEffort('turbo; rm -rf') === undefined, 'coerceEffort 拒绝非法/注入串')
assert(coerceEffort('') === undefined && coerceEffort(undefined) === undefined, 'coerceEffort 空→undefined')

// ---- maskSecrets ----
assert(maskSecrets('key sk-ABCD1234efgh end').includes('sk-***'), '脱敏 sk- 密钥')
assert(!maskSecrets('Authorization: Bearer abcdef0123456789').includes('abcdef0123456789'), '脱敏 Bearer token')
assert(maskSecrets('api_key=supersecretvalue').includes('***'), '脱敏 api_key=value')
assert(!maskSecrets('OPENAI_API_KEY=sk_live_abcd1234efgh').includes('abcd1234efgh'), '脱敏带前缀 *_API_KEY=value')
assert(maskSecrets('本轮 output_tokens 1234') === '本轮 output_tokens 1234', 'output_tokens 不误伤')
assert(maskSecrets('正常日志，无密钥') === '正常日志，无密钥', '正常文本不误伤')

// ---- maskEvent：事件流字段级脱敏（BLOCKER 修复）----
const maskedEv = maskEvent({
  type: 'item.completed',
  item: { id: '1', type: 'agent_message', text: '你的 key 是 sk-SECRET12345678' }
})
assert(
  maskedEv.item.type === 'agent_message' &&
    maskedEv.item.text.includes('sk-***') &&
    !maskedEv.item.text.includes('SECRET12345678'),
  'maskEvent 脱敏 agent_message.text 且保结构'
)
const errEv = maskEvent({ type: 'error', message: 'auth failed: Bearer tok_abcdef123456' })
assert(errEv.type === 'error' && !errEv.message.includes('tok_abcdef123456'), 'maskEvent 脱敏 error.message')
// 字段内带引号的 key=value（JSON 往返会转义引号致漏脱敏——递归实现修复）。
const quotedEv = maskEvent({ message: 'OPENAI_API_KEY="abcdef123456"' })
assert(!quotedEv.message.includes('abcdef123456'), 'maskEvent 脱敏字段内带引号的 *_API_KEY="value"')
// 非字符串字段原样保留（结构不被破坏）。
const numEv = maskEvent({ type: 'turn.completed', usage: { input_tokens: 12, output_tokens: 34 } })
assert(numEv.usage.input_tokens === 12 && numEv.usage.output_tokens === 34, 'maskEvent 保留数值字段不破坏结构')

closeDatabase()
rmSync(dir, { recursive: true, force: true })
console.log(`\nALL ${passed} SETTINGS SMOKE TESTS PASSED`)
