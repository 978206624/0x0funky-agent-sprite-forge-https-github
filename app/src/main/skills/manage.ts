import {
  existsSync,
  cpSync,
  mkdirSync,
  rmSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  lstatSync,
  realpathSync
} from 'fs'
import { join, basename, dirname, resolve, sep } from 'path'
import { tmpdir } from 'os'
import extract from 'extract-zip'
import type { SkillInfo } from '../../shared/types'
import { getSkillInfo } from './library'
import { assertValidSkillId, isBuiltinSkill, librarySkillDir } from './paths'

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

/** 该目录是否含一个**常规文件** SKILL.md（lstat 不跟随 symlink，防 symlink SKILL.md 诱导）。 */
function hasRegularSkillMd(dir: string): boolean {
  try {
    return lstatSync(join(dir, 'SKILL.md')).isFile()
  } catch {
    return false
  }
}

/** 递归 lstat 扫描，若目录树内含任何 symlink 则抛错（导入侧拒绝符号链接，防越界读写）。 */
function assertNoSymlinks(dir: string): void {
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return
  }
  for (const name of entries) {
    const abs = join(dir, name)
    let stat: ReturnType<typeof lstatSync>
    try {
      stat = lstatSync(abs)
    } catch {
      continue
    }
    if (stat.isSymbolicLink()) {
      throw new Error(`skill 含符号链接（${name}），出于安全拒绝导入`)
    }
    if (stat.isDirectory()) assertNoSymlinks(abs)
  }
}

/** 在目录树中向下（最多 2 层）寻找含常规文件 SKILL.md 的 skill 根；找不到返回 null。 */
function findSkillRoot(dir: string, depth = 2): string | null {
  if (hasRegularSkillMd(dir)) return dir
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
      // lstat 不跟随 symlink：恶意 zip 用 symlink 目录诱导 findSkillRoot 越界时跳过。
      if (!lstatSync(sub).isDirectory()) continue
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
  if (!hasRegularSkillMd(srcDir)) {
    throw new Error('所选内容不含 SKILL.md（或为符号链接），不是有效 skill')
  }
  assertNoSymlinks(srcDir) // 拒绝含 symlink 的 skill，杜绝入库后跟随软链接越界读
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
  // frontmatter name 与 H1 统一用 displayName（转义双引号防 YAML 破损），避免二者不一致。
  const safeName = displayName.replace(/"/g, '\\"')
  const md = `---
name: "${safeName}"
description: "${safeName} — 在此填写 skill 的用途与触发条件"
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
  assertValidSkillId(id) // 先校验 id 合法，杜绝 '..'/分隔符 越界删到库根/userData
  if (isBuiltinSkill(id)) throw new Error('内置 skill 不可删除')
  const dir = librarySkillDir(id)
  if (!existsSync(dir)) throw new Error(`skill 不存在：${id}`)
  rmSync(dir, { recursive: true, force: true })
}

/**
 * 解析 skill 内文件的绝对路径，确保不越出该 skill 目录（防路径穿越）。
 * 三重防护：① id 合法性；② relPath 拼接后字符串 containment；③ realpath 兜底——
 * 对目标最近的已存在祖先做 realpathSync，挡 symlink 指向库根外（读写都覆盖）。
 */
function resolveInSkill(id: string, relPath: string): string {
  assertValidSkillId(id)
  const base = resolve(librarySkillDir(id))
  const target = resolve(base, relPath)
  if (target !== base && !target.startsWith(base + sep)) {
    throw new Error('非法路径：越出 skill 目录')
  }
  const realBase = realpathSync(base)
  let probe = target
  while (!existsSync(probe)) probe = dirname(probe)
  const realProbe = realpathSync(probe)
  if (realProbe !== realBase && !realProbe.startsWith(realBase + sep)) {
    throw new Error('非法路径：symlink 越出 skill 目录')
  }
  return target
}

/** 递归列出 skill 目录内的文件相对路径（跳过隐藏目录与 __pycache__）。 */
export function listSkillFiles(id: string): string[] {
  assertValidSkillId(id)
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
      let stat: ReturnType<typeof lstatSync>
      try {
        // lstat 不跟随 symlink：symlink 项一律跳过，不列出、不递归（防越界编辑）。
        stat = lstatSync(abs)
      } catch {
        continue
      }
      if (stat.isSymbolicLink()) continue
      if (stat.isDirectory()) walk(abs, rel)
      else if (stat.isFile()) out.push(rel)
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
