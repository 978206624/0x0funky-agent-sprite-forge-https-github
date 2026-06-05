import { ipcMain } from 'electron'
import { getDb } from '../db'
import { listProjects } from '../db/projects-repo'
import {
  pickDirectory,
  openProjectAt,
  openExistingProject,
  setCurrentProject
} from '../projects/manager'
import type { Project } from '../../shared/types'

/** 注册项目管理相关 IPC handler。须在 app ready 且 initDatabase() 之后调用一次。 */
export function registerProjectsIpc(): void {
  ipcMain.handle('projects:list', (): Project[] => listProjects(getDb()))
  ipcMain.handle('projects:pickDir', (): Promise<string | null> => pickDirectory())
  ipcMain.handle('projects:create', (_e, absPath: string, name?: string): Project =>
    openProjectAt(absPath, name)
  )
  ipcMain.handle('projects:open', (_e, id: number): Project => openExistingProject(id))
  ipcMain.handle('projects:setCurrent', (_e, id: number | null): void => setCurrentProject(id))
}
