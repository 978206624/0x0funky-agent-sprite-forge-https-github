import {
  existsSync,
  cpSync,
  mkdirSync,
  rmSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  statSync
} from 'fs'
import { join, basename, resolve, sep } from 'path'
import { tmpdir } from 'os'
import extract from 'extract-zip'
import type { SkillInfo } from '../../shared/types'
import { getSkillInfo } from './library'
import { isBuiltinSkill, librarySkillDir } from './paths'

/**
 * app 自管 skill 库的写操作（主进程）：导入（文件夹 / zip）、新建、删除、文件读写。
 * 所有写入限定在 userData/skills/<id>/ 内；删除拒绝内置 skill；导入校验 SKILL.md 存在。
 * 不触碰本机 ~/.codex/skills/。
 */

/** 把任意名字规整为安全的 skill 目录 id（小写、仅 a-z0-9-_，其余转 -，去首尾/重复 -）。 */
function sanitizeId(raw: string): string {
  const s = raw
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return s || 'skill'
}

/** 生成库内不冲突的 id：base 已存在则追加 -2 / -3 …。 */
function uniqueSkillId(base: string): string {
  if (!existsSync(librarySkillDir(base))) return base
  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}`
    if (!existsSync(librarySkillDir(candidate))) return candidate
  }
}

/** 在目录树中向下（最多 2 层）寻找含 SKILL.md 的 skill 根；找不到返回 null。 */
function findSkillRoot(dir: string, depth = 2): string | null {
  if (existsSync(join(dir, 'SKILL.md'))) return dir
  if (depth <= 0) return null
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return null
  }
  for (const name of entries) {
    if (name.startsWith('.')) continue
    const sub = join(dir, name)
    try {
      if (!statSync(sub).isDirectory()) continue
    } catch {
      continue
    }
    const found = findSkillRoot(sub, depth - 1)
    if (found) return found
  }
  return null
}

/** 把一个含 SKILL.md 的源目录入库（去重 id），返回入库后的 SkillInfo。 */
function ingestSkillDir(srcDir: string, baseName: string): SkillInfo {
  if (!existsSync(join(srcDir, 'SKILL.md'))) {
    throw new Error('所选内容不含 SKILL.md，不是有效 skill')
  }
  const id = uniqueSkillId(sanitizeId(baseName))
  cpSync(srcDir, librarySkillDir(id), { recursive: true })
  const info = getSkillInfo(id)
  if (!info) throw new Error('入库后读取 skill 失败')
  return info
}

/** 从本机文件夹导入 skill。 */
export function importFromFolder(srcDir: string): SkillInfo {
  return ingestSkillDir(srcDir, basename(srcDir))
}

/** 从 .zip 导入 skill：解压到临时目录 → 定位 SKILL.md 根 → 入库 → 清临时。 */
export async function importFromZip(zipPath: string): Promise<SkillInfo> {
  const temp = join(tmpdir(), `gaf-skill-import-${Date.now()}`)
  mkdirSync(temp, { recursive: true })
  try {
    await extract(zipPath, { dir: temp })
    const root = findSkillRoot(temp)
    if (!root) throw new Error('zip 内未找到含 SKILL.md 的 skill 目录')
    // SKILL.md 在 zip 根 → 用 zip 文件名；嵌套 → 用该子目录名。
    const baseName = root === temp ? basename(zipPath).replace(/\.zip$/i, '') : basename(root)
    return ingestSkillDir(root, baseName)
  } finally {
    rmSync(temp, { recursive: true, force: true })
  }
}

/** 新建一个最小 skill（scaffold SKILL.md 骨架）。 */
export function createSkill(name: string): SkillInfo {
  const id = uniqueSkillId(sanitizeId(name))
  const dir = librarySkillDir(id)
  mkdirSync(dir, { recursive: true })
  const displayName = name.trim() || id
  const md = `---
name: ${id}
description: "${displayName} — 在此填写 skill 的用途与触发条件"
---

# ${displayName}

在此编写 skill 指令。描述 codex 应当如何完成该任务。

## Workflow

1. 第一步
2. 第二步
`
  writeFileSync(join(dir, 'SKILL.md'), md, 'utf8')
  const info = getSkillInfo(id)
  if (!info) throw new Error('新建后读取 skill 失败')
  return info
}

/** 删除受管 skill；内置 skill 拒绝删除。 */
export function deleteSkill(id: string): void {
  if (isBuiltinSkill(id)) throw new Error('内置 skill 不可删除')
  const dir = librarySkillDir(id)
  if (!existsSync(dir)) throw new Error(`skill 不存在：${id}`)
  rmSync(dir, { recursive: true, force: true })
}

/** 解析 skill 内文件的绝对路径，并确保不越出该 skill 目录（防路径穿越）。 */
function resolveInSkill(id: string, relPath: string): string {
  const base = resolve(librarySkillDir(id))
  const target = resolve(base, relPath)
  if (target !== base && !target.startsWith(base + sep)) {
    throw new Error('非法路径：越出 skill 目录')
  }
  return target
}

/** 递归列出 skill 目录内的文件相对路径（跳过隐藏目录与 __pycache__）。 */
export function listSkillFiles(id: string): string[] {
  const base = librarySkillDir(id)
  const out: string[] = []
  const walk = (dir: string, prefix: string): void => {
    let entries: string[]
    try {
      entries = readdirSync(dir)
    } catch {
      return
    }
    for (const name of entries) {
      if (name.startsWith('.') || name === '__pycache__') continue
      const abs = join(dir, name)
      const rel = prefix ? `${prefix}/${name}` : name
      let isDir = false
      try {
        isDir = statSync(abs).isDirectory()
      } catch {
        continue
      }
      if (isDir) walk(abs, rel)
      else out.push(rel)
    }
  }
  walk(base, '')
  return out.sort()
}

/** 读取 skill 内某文件内容（utf8）。 */
export function readSkillFile(id: string, relPath: string): string {
  return readFileSync(resolveInSkill(id, relPath), 'utf8')
}

/** 写入 skill 内某文件内容（utf8）；自动建父目录。 */
export function writeSkillFile(id: string, relPath: string, content: string): void {
  const target = resolveInSkill(id, relPath)
  mkdirSync(join(target, '..'), { recursive: true })
  writeFileSync(target, content, 'utf8')
}
