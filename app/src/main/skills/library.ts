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
import { createHash } from 'node:crypto'
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

/** 读取内置蓝本目录版本（.bundled-version）；须为非负整数，无/非法回退 0。 */
function readBundledVersion(blueprint: string): number {
  try {
    const raw = readFileSync(join(blueprint, '.bundled-version'), 'utf8').trim()
    if (!/^\d+$/.test(raw)) return 0
    const version = Number(raw)
    return Number.isSafeInteger(version) ? version : 0
  } catch {
    return 0
  }
}

/** 计算 skill 目录内容哈希：排序后的 (相对路径 + 文件内容) sha256，跳过 seed 记录文件。 */
export function hashSkillDir(dir: string): string {
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

export function readSeedRecord(dir: string): SeedRecord | null {
  try {
    const value: unknown = JSON.parse(readFileSync(join(dir, SEED_RECORD), 'utf8'))
    if (
      typeof value === 'object' &&
      value !== null &&
      'version' in value &&
      'hash' in value &&
      typeof value.version === 'number' &&
      Number.isSafeInteger(value.version) &&
      value.version >= 0 &&
      typeof value.hash === 'string' &&
      /^[a-f0-9]{64}$/.test(value.hash)
    ) {
      return { version: value.version, hash: value.hash }
    }
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

/** 对单个内置蓝本执行 seed/re-seed，抽离路径依赖便于启动逻辑验证。 */
export function seedBuiltinSkill(blueprint: string, target: string): void {
  const bundledVer = readBundledVersion(blueprint)
  if (!existsSync(target)) {
    seedFrom(blueprint, target, bundledVer)
    return
  }

  // 旧 seed 无记录：当前内容作为版本 0 基线，随后立即复用升级判定。
  // Phase 1 计划已接受首次 bootstrap 可能覆盖版本机制上线前手工编辑的有限风险。
  let rec = readSeedRecord(target)
  if (rec === null) {
    rec = { version: 0, hash: hashSkillDir(target) }
    writeSeedRecord(target, rec)
  }

  const edited = hashSkillDir(target) !== rec.hash
  if (!edited && bundledVer > rec.version) seedFrom(blueprint, target, bundledVer)
}

/**
 * 自管 skill 库初始化（app 启动时调用一次）。
 * - 确保库根 userData/skills/ 存在
 * - 对每个内置 skill 执行**版本感 seed/re-seed**：
 *   ① 缺失 → seed + 记录当前蓝本版本与哈希；
 *   ② 已存在且有记录 → 仅当"用户未编辑（当前哈希==记录哈希）且蓝本版本更新"时覆盖刷新（带入增强）；
 *      用户编辑过则保留不动（不克抹用户改动，符合"无恢复默认"）；
 *   ③ 已存在但无记录（版本机制前的旧 seed）→ 先以当前内容补基线记录(version=0)，再按②刷新一次。
 *      这会把旧 seed 当作未编辑内容；版本机制上线前暂无真实用户编辑，风险由 Phase 1 计划显式接受。
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
    try {
      seedBuiltinSkill(blueprint, target)
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
