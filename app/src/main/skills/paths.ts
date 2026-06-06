import { app } from 'electron'
import { join, resolve, sep } from 'path'

/**
 * skill 相关路径解析单一事实源（主进程）。三类目录集中此处，避免散落：
 * - 内置蓝本目录：随 app 分发的只读原型（vendoring 进仓库 resources/bundled-skills/）
 * - 自管库根：app 可写数据目录下的 skill 库（userData/skills/），用户编辑/导入/新建落此
 * - 项目临时挂载目录：生成前把当前 skill 同步到 <项目>/.codex/skills/ 供 codex 挂载，用后清理
 *
 * 与本机 ~/.codex/skills/ 完全隔离：本模块不解析、不触碰用户本机 codex skill 目录。
 */

/**
 * 内置 skill id 集合（单一事实源）。决定"不可删除"判定：列表内的 id 在 UI 无删除入口、
 * deleteSkill 直接拒绝。首版仅 generate2dsprite。
 */
export const BUILTIN_SKILL_IDS = ['generate2dsprite'] as const

export type BuiltinSkillId = (typeof BUILTIN_SKILL_IDS)[number]

/** 判定某 id 是否内置 skill。 */
export function isBuiltinSkill(id: string): boolean {
  return (BUILTIN_SKILL_IDS as readonly string[]).includes(id)
}

/** 合法 skill id 字符集：与 sanitizeId 产出同口径（小写/数字/`-`/`_`，大小写放行以容旧目录）。 */
const SKILL_ID_RE = /^[A-Za-z0-9_-]+$/

/**
 * 校验来自 renderer / 会话的 skill id 为不可信输入：必须是单段安全名，
 * 且 resolve 后仍落在自管库根之内（双保险防 `..` / 分隔符 / 越界）。
 * 所有以 id 拼接库内/项目内路径的入口（delete/list/read/write/sync/cleanup）必须先调用。
 * 非法即抛错，杜绝 `deleteSkill('..')` 删到库根/userData 之类的路径穿越。
 */
export function assertValidSkillId(id: string): void {
  if (typeof id !== 'string' || !SKILL_ID_RE.test(id) || id === '.' || id === '..') {
    throw new Error(`非法 skill id：${String(id)}`)
  }
  const root = resolve(skillLibraryRoot())
  const target = resolve(librarySkillDir(id))
  if (target === root || !target.startsWith(root + sep)) {
    throw new Error(`非法 skill id（越界）：${id}`)
  }
}

/**
 * 内置蓝本根目录。
 * - dev（electron-vite dev，app.isPackaged=false）：仓库 app 根下 resources/bundled-skills/
 *   （app.getAppPath() 在 dev 返回 app 根，即含 package.json 的目录）
 * - packaged：process.resourcesPath/bundled-skills/
 *   ⚠ 打包发布时需在 electron-builder 配置 extraResources 把 resources/bundled-skills/
 *   复制到 resourcesPath 下（本项目首版尚无 builder 配置，发布阶段补）。
 */
export function bundledSkillsRoot(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'bundled-skills')
    : join(app.getAppPath(), 'resources', 'bundled-skills')
}

/** 单个内置 skill 的蓝本目录。 */
export function bundledSkillDir(id: string): string {
  return join(bundledSkillsRoot(), id)
}

/** 自管 skill 库根目录（userData/skills/）。所有受管 skill（内置 seed + 导入 + 新建）存此。 */
export function skillLibraryRoot(): string {
  return join(app.getPath('userData'), 'skills')
}

/** 单个受管 skill 在自管库中的目录。 */
export function librarySkillDir(id: string): string {
  return join(skillLibraryRoot(), id)
}

/** 项目内 codex skill 挂载根目录（<项目>/.codex/skills/）。生成前临时同步、用后清理。 */
export function projectSkillsRoot(projectDir: string): string {
  return join(projectDir, '.codex', 'skills')
}

/** 单个 skill 在项目内的临时挂载目录。 */
export function projectSkillDir(projectDir: string, id: string): string {
  return join(projectSkillsRoot(projectDir), id)
}
