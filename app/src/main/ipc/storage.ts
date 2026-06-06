import { ipcMain, app, shell } from 'electron'
import { join } from 'path'
import { getDb } from '../db'
import { clearGenerationsByProject } from '../db/generations-repo'
import { isBusy } from '../generation/lock'

/** 全局单库文件名（与 db/index.ts 一致）。 */
const DB_FILENAME = 'game-asset-forge.db'

/** SQLite 库文件绝对路径（用户数据目录下）。 */
function dbPath(): string {
  return join(app.getPath('userData'), DB_FILENAME)
}

/**
 * 注册存储/维护相关 IPC（清空历史、定位库文件）。须在 app ready 且 initDatabase() 之后调用一次。
 */
export function registerStorageIpc(): void {
  // 清空某项目的产出历史（仅删 DB 行，保留磁盘 assets）。任务进行中拒绝（防删在途 record）。
  ipcMain.handle('settings:clearHistory', (_e, projectId: number): number => {
    if (isBusy()) throw new Error('任务进行中，无法清空历史，请先取消或等待完成')
    return clearGenerationsByProject(getDb(), projectId)
  })

  // 返回 SQLite 库文件路径（设置页「存储」展示）。
  ipcMain.handle('storage:dbPath', (): string => dbPath())

  // 在系统文件管理器中定位库文件（选中高亮）。
  ipcMain.handle('storage:revealDb', (): void => {
    shell.showItemInFolder(dbPath())
  })
}
