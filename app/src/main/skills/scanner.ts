import { homedir } from 'os'
import { join } from 'path'
import { readdirSync, readFileSync, statSync } from 'fs'
import type { SkillInfo, SkillScanResult } from '../../shared/types'
import { getSkillsDirOverride } from '../settings/service'

/**
 * 已被本应用适配的 skill 白名单。首版仅 generate2dsprite 有对应参数表单与产物管线，
 * 点亮可选；其余 skill 仍会被扫描列出，但标记未适配（灰显不可选）。
 * 后续适配新 skill 时在此登记即可。
 */
const ADAPTED_SKILLS = new Set(['generate2dsprite'])

/**
 * skill 扫描根目录：设置页自定义路径（skills.dir_override）→ CODEX_SKILLS_DIR 环境变量 → ~/.codex/skills。
 * 不缓存：改设置后「重新扫描」即时生效。
 */
export function resolveSkillsRoot(): string {
  const override = getSkillsDirOverride()
  if (override) return override
  const fromEnv = process.env.CODEX_SKILLS_DIR
  if (fromEnv && fromEnv.trim()) return fromEnv.trim()
  return join(homedir(), '.codex', 'skills')
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
  const skillMd = join(dir, 'SKILL.md')
  let md: string
  try {
    md = readFileSync(skillMd, 'utf8')
  } catch {
    // 无 SKILL.md（如 codex-primary-runtime、空目录）不是有效 skill，跳过。
    return null
  }
  const fm = parseFrontmatter(md)
  return {
    id,
    name: fm.name?.trim() || id,
    description: fm.description?.trim() || null,
    adapted: ADAPTED_SKILLS.has(id),
    dir
  }
}

/**
 * 扫描 skill 根目录，识别已安装 skill 及元信息。
 * 跳过：以 `.` 开头的隐藏目录（如 .system）、非目录项、无 SKILL.md 的目录。
 * 排序：已适配优先，其余按名称字母序，便于 generate2dsprite 置顶可选。
 * 根目录不存在/不可读时返回 rootExists=false + error，不抛异常（上层据此显示状态）。
 */
export function scanSkills(root: string = resolveSkillsRoot()): SkillScanResult {
  let entries: string[]
  try {
    entries = readdirSync(root)
  } catch {
    return { root, rootExists: false, skills: [], error: `skill 目录不存在或不可读：${root}` }
  }

  const skills: SkillInfo[] = []
  for (const name of entries) {
    if (name.startsWith('.')) continue
    let isDir = false
    try {
      isDir = statSync(join(root, name)).isDirectory()
    } catch {
      continue
    }
    if (!isDir) continue
    const skill = readSkill(root, name)
    if (skill) skills.push(skill)
  }

  skills.sort((a, b) => {
    if (a.adapted !== b.adapted) return a.adapted ? -1 : 1
    return a.name.localeCompare(b.name)
  })

  return { root, rootExists: true, skills, error: null }
}
