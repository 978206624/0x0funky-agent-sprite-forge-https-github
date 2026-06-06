import { ipcMain } from 'electron'
import { scanSkills } from '../skills/scanner'
import type { SkillScanResult } from '../../shared/types'

/** 注册 skill 相关 IPC handler。在 app ready 后调用一次。 */
export function registerSkillsIpc(): void {
  // scan 与 rescan 同一实现（重新扫描即再次调用）；renderer 手动重扫复用此频道。
  const handler = (): SkillScanResult => scanSkills()
  ipcMain.handle('skills:scan', handler)
  ipcMain.handle('skills:rescan', handler)
}
