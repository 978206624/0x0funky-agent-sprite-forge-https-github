import { ipcMain } from 'electron'
import { getDb } from '../db'
import * as projects from '../db/projects-repo'
import * as generations from '../db/generations-repo'
import * as settings from '../db/settings-repo'
import type { ProjectInput, GenerationInput, GenerationUpdate } from '../../shared/types'

/** 注册 db 相关 IPC handler。须在 app ready 且 initDatabase() 之后调用一次。 */
export function registerDbIpc(): void {
  // ---- projects ----
  ipcMain.handle('db:projects:list', () => projects.listProjects(getDb()))
  ipcMain.handle('db:projects:get', (_e, id: number) => projects.getProject(getDb(), id))
  ipcMain.handle('db:projects:create', (_e, input: ProjectInput) =>
    projects.createProject(getDb(), input)
  )
  ipcMain.handle('db:projects:touch', (_e, id: number) => projects.touchProject(getDb(), id))
  ipcMain.handle('db:projects:delete', (_e, id: number) => projects.deleteProject(getDb(), id))

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
