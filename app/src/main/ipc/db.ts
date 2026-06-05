import { ipcMain } from 'electron'
import { getDb } from '../db'
import * as projects from '../db/projects-repo'
import * as generations from '../db/generations-repo'
import * as settings from '../db/settings-repo'
import type { GenerationInput, GenerationUpdate } from '../../shared/types'

/** 注册 db 相关 IPC handler。须在 app ready 且 initDatabase() 之后调用一次。 */
export function registerDbIpc(): void {
  // ---- projects（只读查询；新建/打开/删除等写操作统一走 projects:* 经项目管理层，
  //      以保证目录校验、canonical 化与 assets 初始化不被绕过） ----
  ipcMain.handle('db:projects:list', () => projects.listProjects(getDb()))
  ipcMain.handle('db:projects:get', (_e, id: number) => projects.getProject(getDb(), id))

  // ---- generations ----
  ipcMain.handle('db:generations:listByProject', (_e, projectId: number) =>
    generations.listGenerationsByProject(getDb(), projectId)
  )
  ipcMain.handle('db:generations:get', (_e, id: number) => generations.getGeneration(getDb(), id))
  ipcMain.handle('db:generations:create', (_e, input: GenerationInput) =>
    generations.createGeneration(getDb(), input)
  )
  ipcMain.handle('db:generations:update', (_e, id: number, patch: GenerationUpdate) =>
    generations.updateGeneration(getDb(), id, patch)
  )

  // ---- settings ----
  ipcMain.handle('db:settings:get', (_e, key: string) => settings.getSetting(getDb(), key))
  ipcMain.handle('db:settings:set', (_e, key: string, value: string) =>
    settings.setSetting(getDb(), key, value)
  )
  ipcMain.handle('db:settings:getAll', () => settings.getAllSettings(getDb()))
}
