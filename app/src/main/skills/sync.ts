import { existsSync, cpSync, rmSync, readdirSync, rmdirSync } from 'fs'
import { dirname } from 'path'
import { librarySkillDir, projectSkillDir, projectSkillsRoot } from './paths'
import { listSkills } from './library'

/**
 * 生成期 skill 落盘：codex 只从其会扫描的目录（含项目级 .codex/skills/）发现 skill。
 * 故每次生成前把当前 skill 从自管库同步到项目 .codex/skills/<id>/，生成后清理。
 * 全程不触碰本机 ~/.codex/skills/。
 */

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
 * 先清项目内旧副本（防上次残留污染），再整目录拷入。库内无该 skill → 抛错由调用方处理。
 */
export function syncSkillToProject(skillId: string, projectDir: string): void {
  const src = librarySkillDir(skillId)
  if (!existsSync(src)) throw new Error(`自管库中找不到 skill：${skillId}`)
  const dest = projectSkillDir(projectDir, skillId)
  rmSync(dest, { recursive: true, force: true })
  cpSync(src, dest, { recursive: true })
}

/**
 * 清理项目内某 skill 的临时副本，并删除随之变空的 .codex/skills 与 .codex 空壳。
 * 对取消/失败/崩溃健壮：rmSync force 不因目录不存在报错；清理失败静默不影响生成落库。
 */
export function cleanupSkillInProject(skillId: string, projectDir: string): void {
  try {
    rmSync(projectSkillDir(projectDir, skillId), { recursive: true, force: true })
  } catch {
    /* 文件占用/权限：尽力而为 */
  }
  const skillsRoot = projectSkillsRoot(projectDir)
  removeIfEmpty(skillsRoot)
  removeIfEmpty(dirname(skillsRoot)) // <项目>/.codex
}

/**
 * 项目打开时清理可能的崩溃残留：对自管库中的每个 skill id，清掉其在该项目内的临时副本。
 * 正常生成已在结束时清理；此为进程被强杀（未跑到 finally）时的兜底。
 */
export function cleanupResidualSkills(projectDir: string): void {
  for (const s of listSkills().skills) {
    cleanupSkillInProject(s.id, projectDir)
  }
}
