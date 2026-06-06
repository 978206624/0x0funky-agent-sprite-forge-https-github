import { existsSync, mkdirSync, cpSync } from 'fs'
import { BUILTIN_SKILL_IDS, bundledSkillDir, librarySkillDir, skillLibraryRoot } from './paths'

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
