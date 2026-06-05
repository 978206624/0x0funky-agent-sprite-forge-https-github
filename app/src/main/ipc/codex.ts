import { ipcMain } from 'electron'
import { detectCodex } from '../codex/health'

/** 注册 codex 相关 IPC handler。在 app ready 后调用一次。 */
export function registerCodexIpc(): void {
  ipcMain.handle('codex:detect', () => detectCodex())
}
