import { existsSync, mkdirSync, cpSync, readdirSync, readFileSync, statSync } from 'fs'
import { join } from 'path'
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

/**
 * 自管 skill 库初始化（app 启动时调用一次）。
 * - 确保库根 userData/skills/ 存在
 * - 对每个内置 skill：若库内缺失，则从内置蓝本 seed 一份（拷贝），使其可编辑
 *
 * seed 仅在"库内不存在"时发生：用户编辑过的内置 skill 不会被覆盖（无"恢复默认"，按 Spec v2.5 决策）。
 * 单个内置蓝本缺失（异常打包/路径错误）不阻断启动，仅记 warn——其余 skill 仍可用。
 *
 * Phase 2 将在本模块补 listSkills() 等读取/分类能力。
 */
export function initSkillLibrary(): void {
  const root = skillLibraryRoot()
  mkdirSync(root, { recursive: true })

  for (const id of BUILTIN_SKILL_IDS) {
    const target = librarySkillDir(id)
    if (existsSync(target)) continue
    const blueprint = bundledSkillDir(id)
    if (!existsSync(blueprint)) {
      console.warn(`[skill-library] 内置蓝本缺失，跳过 seed：${id} (${blueprint})`)
      continue
    }
    try {
      cpSync(blueprint, target, { recursive: true })
    } catch (err) {
      console.warn(`[skill-library] seed 内置 skill 失败：${id} — ${String(err)}`)
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

/** 读取单个 skill 目录的 SKILL.md 并构造 SkillInfo；无 SKILL.md / 读取失败返回 null（跳过）。 */
function readSkill(root: string, id: string): SkillInfo | null {
  const dir = join(root, id)
  let md: string
  try {
    md = readFileSync(join(dir, 'SKILL.md'), 'utf8')
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
