import {
  existsSync,
  mkdirSync,
  cpSync,
  rmSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  statSync,
  lstatSync
} from 'fs'
import { join } from 'path'
import { createHash } from 'crypto'
import type { SkillInfo, SkillListResult } from '../../shared/types'
import {
  BUILTIN_SKILL_IDS,
  bundledSkillDir,
  isBuiltinSkill,
  librarySkillDir,
  skillLibraryRoot
} from './paths'

/**
 * 已被本应用适配的 skill 白名单。首版仅 generate2dsprite 有对应参数表单与产物管线，
 * 点亮可选；导入的其他 skill 仍会列出，但标记未适配（灰显不可选）。
 * 后续适配新 skill 时在此登记即可。
 */
const ADAPTED_SKILLS = new Set<string>(['generate2dsprite'])

/** userData 副本内的 seed 记录文件：记录 seed 自哪个蓝本版本 + seed 时刻内容哈希。 */
const SEED_RECORD = '.gaf-seed'

interface SeedRecord {
  version: number
  hash: string
}

/** 读取内置蓝本版本（resources/bundled-skills/<id>/.bundled-version）；无/非法回退 0。 */
function readBundledVersion(id: string): number {
  try {
    const n = parseInt(readFileSync(join(bundledSkillDir(id), '.bundled-version'), 'utf8').trim(), 10)
    return Number.isFinite(n) ? n : 0
  } catch {
    return 0
  }
}

/** 计算 skill 目录内容哈希：排序后的 (相对路径 + 文件内容) sha256，跳过 seed 记录文件。 */
function hashSkillDir(dir: string): string {
  const rels: string[] = []
  const walk = (d: string, prefix: string): void => {
    let entries: string[]
    try {
      entries = readdirSync(d)
    } catch {
      return
    }
    for (const name of entries) {
      if (name === SEED_RECORD) continue
      const abs = join(d, name)
      const rel = prefix ? `${prefix}/${name}` : name
      let st: ReturnType<typeof statSync>
      try {
        st = statSync(abs)
      } catch {
        continue
      }
      if (st.isDirectory()) walk(abs, rel)
      else if (st.isFile()) rels.push(rel)
    }
  }
  walk(dir, '')
  rels.sort()
  const h = createHash('sha256')
  for (const rel of rels) {
    h.update(rel)
    h.update(readFileSync(join(dir, rel)))
  }
  return h.digest('hex')
}

function readSeedRecord(dir: string): SeedRecord | null {
  try {
    const r = JSON.parse(readFileSync(join(dir, SEED_RECORD), 'utf8')) as SeedRecord
    if (typeof r.version === 'number' && typeof r.hash === 'string') return r
    return null
  } catch {
    return null
  }
}

function writeSeedRecord(dir: string, rec: SeedRecord): void {
  writeFileSync(join(dir, SEED_RECORD), JSON.stringify(rec), 'utf8')
}

/** 从蓝本拷贝并写 seed 记录（覆盖式：先清旧副本再拷，避免残留文件）。 */
function seedFrom(blueprint: string, target: string, version: number): void {
  rmSync(target, { recursive: true, force: true })
  cpSync(blueprint, target, { recursive: true })
  writeSeedRecord(target, { version, hash: hashSkillDir(target) })
}

/**
 * 自管 skill 库初始化（app 启动时调用一次）。
 * - 确保库根 userData/skills/ 存在
 * - 对每个内置 skill 执行**版本感 seed/re-seed**：
 *   ① 缺失 → seed + 记录当前蓝本版本与哈希；
 *   ② 已存在且有记录 → 仅当"用户未编辑（当前哈希==记录哈希）且蓝本版本更新"时覆盖刷新（带入增强）；
 *      用户编辑过则保留不动（不克抹用户改动，符合"无恢复默认"）；
 *   ③ 已存在但无记录（版本机制前的旧 seed）→ **默认保护**：只补记录(version=当前蓝本版本, hash=当前内容)、
 *      本次不覆盖，避免把"版本机制上线前已编辑过"的内容静默清掉；后续蓝本 bump 时再经②判定。
 * 单个内置蓝本缺失不阻断启动，仅记 warn。
 */
export function initSkillLibrary(): void {
  const root = skillLibraryRoot()
  mkdirSync(root, { recursive: true })

  for (const id of BUILTIN_SKILL_IDS) {
    const target = librarySkillDir(id)
    const blueprint = bundledSkillDir(id)
    if (!existsSync(blueprint)) {
      console.warn(`[skill-library] 内置蓝本缺失，跳过：${id} (${blueprint})`)
      continue
    }
    const bundledVer = readBundledVersion(id)
    try {
      if (!existsSync(target)) {
        seedFrom(blueprint, target, bundledVer) // ① 全新 seed
        continue
      }
      // ③ 旧 seed 无记录（版本机制上线前的副本）：**默认保护，不覆盖**。
      // 不能用"当前内容算 hash 当基线"——那会把已编辑内容误判为未编辑并被蓝本覆盖、静默丢失用户改动。
      // 故仅补一条记录把版本钉到当前蓝本（hash=当前内容），本次不刷新；
      // 后续蓝本再 bump 时，会经②正常判定（未编辑才刷新）。
      const rec = readSeedRecord(target)
      if (!rec) {
        writeSeedRecord(target, { version: bundledVer, hash: hashSkillDir(target) })
        continue
      }
      // ② 未编辑且蓝本更新 → 刷新；用户编辑过 → 保留
      const edited = hashSkillDir(target) !== rec.hash
      if (!edited && bundledVer > rec.version) {
        seedFrom(blueprint, target, bundledVer)
      }
    } catch (err) {
      console.warn(`[skill-library] seed/re-seed 内置 skill 失败：${id} — ${String(err)}`)
    }
  }
}

/** 从 SKILL.md 文本解析 frontmatter 的 name / description（单行值，去成对引号）。 */
function parseFrontmatter(md: string): { name?: string; description?: string } {
  const block = /^---\r?\n([\s\S]*?)\r?\n---/.exec(md)
  if (!block) return {}
  const out: { name?: string; description?: string } = {}
  for (const line of block[1].split(/\r?\n/)) {
    // 仅在首个 `key:` 处切分——description 值本身常含冒号，故取冒号后全部。
    const kv = /^(\w+)\s*:\s*(.*)$/.exec(line)
    if (!kv) continue
    const key = kv[1]
    let val = kv[2].trim()
    if (
      val.length >= 2 &&
      ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
    ) {
      val = val.slice(1, -1)
    }
    if (key === 'name') out.name = val
    else if (key === 'description') out.description = val
  }
  return out
}

/** 读取单个 skill 目录的 SKILL.md 并构造 SkillInfo；无 SKILL.md / 非常规文件 / 读取失败返回 null（跳过）。 */
function readSkill(root: string, id: string): SkillInfo | null {
  const dir = join(root, id)
  const skillMd = join(dir, 'SKILL.md')
  let md: string
  try {
    // lstat 防跟随：SKILL.md 必须是常规文件，挡 symlink 指向库外（导入侧已拒 symlink，此处兜底）。
    if (!lstatSync(skillMd).isFile()) return null
    md = readFileSync(skillMd, 'utf8')
  } catch {
    // 无 SKILL.md 的目录不是有效 skill，跳过。
    return null
  }
  const fm = parseFrontmatter(md)
  return {
    id,
    name: fm.name?.trim() || id,
    description: fm.description?.trim() || null,
    adapted: ADAPTED_SKILLS.has(id),
    builtin: isBuiltinSkill(id),
    dir
  }
}

/** 读取自管库中单个 skill 的 SkillInfo；不存在/无 SKILL.md 返回 null。 */
export function getSkillInfo(id: string): SkillInfo | null {
  return readSkill(skillLibraryRoot(), id)
}

/**
 * 列出 app 自管库（userData/skills/）中的受管 skill。
 * 跳过：以 `.` 开头的隐藏目录、非目录项、无 SKILL.md 的目录。
 * 排序：内置优先 → 已适配优先 → 名称字母序（保证 generate2dsprite 置顶可选）。
 * 库根不可读时返回 error（initSkillLibrary 已确保其存在，正常不触发）。
 */
export function listSkills(): SkillListResult {
  const root = skillLibraryRoot()
  let entries: string[]
  try {
    entries = readdirSync(root)
  } catch {
    return { skills: [], error: `skill 库目录不可读：${root}` }
  }

  const skills: SkillInfo[] = []
  for (const name of entries) {
    if (name.startsWith('.')) continue
    try {
      if (!statSync(join(root, name)).isDirectory()) continue
    } catch {
      continue
    }
    const skill = readSkill(root, name)
    if (skill) skills.push(skill)
  }

  skills.sort((a, b) => {
    if (a.builtin !== b.builtin) return a.builtin ? -1 : 1
    if (a.adapted !== b.adapted) return a.adapted ? -1 : 1
    return a.name.localeCompare(b.name)
  })

  return { skills, error: null }
}
