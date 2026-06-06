import { existsSync, cpSync, rmSync, readdirSync, rmdirSync, writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { assertValidSkillId, librarySkillDir, projectSkillDir, projectSkillsRoot } from './paths'

/**
 * 生成期 skill 落盘：codex 只从其会扫描的目录（含项目级 .codex/skills/）发现 skill。
 * 故每次生成前把当前 skill 从自管库同步到项目 .codex/skills/<id>/，生成后清理。
 * 全程不触碰本机 ~/.codex/skills/。
 *
 * 所有权标记：本应用同步的副本内写一个 .gaf-managed 标记文件。清理只删带标记的目录，
 * 绝不动用户自己在项目 .codex/skills/ 下维护的同名 skill（无标记）。
 */

/** 同步副本的所有权标记文件名。 */
const OWNERSHIP_MARKER = '.gaf-managed'

/** 该目录是否为本应用同步的副本（含所有权标记）。 */
function isManaged(dir: string): boolean {
  return existsSync(join(dir, OWNERSHIP_MARKER))
}

/** 目录存在且为空则删除（不删非空目录，避免误删用户在 .codex 下的其它内容）。 */
function removeIfEmpty(dir: string): void {
  try {
    if (existsSync(dir) && readdirSync(dir).length === 0) rmdirSync(dir)
  } catch {
    /* 并发/权限问题静默：清理是尽力而为，不应影响生成结果 */
  }
}

/**
 * 把自管库中的某 skill 同步到项目 .codex/skills/<id>/，供 codex（-C 项目目录）挂载。
 * - id 经 assertValidSkillId 校验，杜绝路径穿越。
 * - 目标已存在但**无所有权标记** → 视为用户自有，抛冲突错误中止，绝不覆盖。
 * - 先建目录 + 写标记，再 cpSync：中途失败留下的半拷贝也带标记，可被 cleanup 清除（M1）。
 * 库内无该 skill → 抛错由调用方处理。
 */
export function syncSkillToProject(skillId: string, projectDir: string): void {
  assertValidSkillId(skillId)
  const src = librarySkillDir(skillId)
  if (!existsSync(src)) throw new Error(`自管库中找不到 skill：${skillId}`)
  const dest = projectSkillDir(projectDir, skillId)
  if (existsSync(dest)) {
    if (!isManaged(dest)) {
      throw new Error(
        `项目内已存在非本应用管理的 .codex/skills/${skillId}，为避免覆盖你的文件已中止；请先移除该目录后重试`
      )
    }
    rmSync(dest, { recursive: true, force: true })
  }
  mkdirSync(dest, { recursive: true })
  writeFileSync(join(dest, OWNERSHIP_MARKER), '', 'utf8') // 先声明所有权，再拷贝
  cpSync(src, dest, { recursive: true })
}

/**
 * 清理项目内某 skill 的临时副本，并删除随之变空的 .codex/skills 与 .codex 空壳。
 * 仅删除带所有权标记的副本（不动用户自有同名目录）。对取消/失败/崩溃健壮：
 * rmSync force + try/catch，清理失败静默不影响生成落库。
 */
export function cleanupSkillInProject(skillId: string, projectDir: string): void {
  // 非法 id 无可清之物（sync 早已拒绝），直接返回；防御性挡 chat 失败路径用非法 skill 调入。
  try {
    assertValidSkillId(skillId)
  } catch {
    return
  }
  const dest = projectSkillDir(projectDir, skillId)
  try {
    if (existsSync(dest) && isManaged(dest)) rmSync(dest, { recursive: true, force: true })
  } catch {
    /* 文件占用/权限：尽力而为 */
  }
  const skillsRoot = projectSkillsRoot(projectDir)
  removeIfEmpty(skillsRoot)
  removeIfEmpty(dirname(skillsRoot)) // <项目>/.codex
}

/**
 * 项目打开时清理崩溃残留：扫描项目 .codex/skills/ 下**带所有权标记**的目录并删除。
 * 按标记识别（而非按库 id 遍历），既能清掉库里已删 skill 的残留，也绝不误删用户自有 skill。
 */
export function cleanupResidualSkills(projectDir: string): void {
  const skillsRoot = projectSkillsRoot(projectDir)
  let entries: string[]
  try {
    entries = readdirSync(skillsRoot)
  } catch {
    return // 无 .codex/skills 目录 → 无残留
  }
  for (const name of entries) {
    const dir = join(skillsRoot, name)
    try {
      if (isManaged(dir)) rmSync(dir, { recursive: true, force: true })
    } catch {
      /* 尽力而为 */
    }
  }
  removeIfEmpty(skillsRoot)
  removeIfEmpty(dirname(skillsRoot))
}
