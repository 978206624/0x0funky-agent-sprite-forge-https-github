import { ipcMain } from 'electron'
import { getDb } from '../db'
import { listProjects } from '../db/projects-repo'
import {
  pickAndCreateProject,
  openExistingProject,
  setCurrentProject,
  getCurrentProject
} from '../projects/manager'
import type { Project } from '../../shared/types'

/** 注册项目管理相关 IPC handler。须在 app ready 且 initDatabase() 之后调用一次。 */
export function registerProjectsIpc(): void {
  ipcMain.handle('projects:list', (): Project[] => listProjects(getDb()))
  // 选目录 + 新建/打开为主进程原子操作：路径不经 renderer，杜绝任意路径注入。
  ipcMain.handle('projects:pickAndCreate', (_e, name?: string): Promise<Project | null> =>
    pickAndCreateProject(name)
  )
  ipcMain.handle('projects:open', (_e, id: number): Project => openExistingProject(id))
  ipcMain.handle('projects:setCurrent', (_e, id: number | null): Project | null =>
    setCurrentProject(id)
  )
  ipcMain.handle('projects:getCurrent', (): Project | null => getCurrentProject())
}
