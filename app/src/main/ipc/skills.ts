import { ipcMain } from 'electron'
import { listSkills } from '../skills/library'
import type { SkillListResult } from '../../shared/types'

/** 注册 skill 相关 IPC handler。在 app ready 后调用一次。 */
export function registerSkillsIpc(): void {
  // 列出 app 自管库（userData/skills/）中的受管 skill（内置 + 导入/新建）。不再扫描本机目录。
  ipcMain.handle('skills:list', (): SkillListResult => listSkills())
}
