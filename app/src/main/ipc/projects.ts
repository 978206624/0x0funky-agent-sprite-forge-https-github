import { ipcMain } from 'electron'
import { getDb } from '../db'
import { listProjects, forgetProject } from '../db/projects-repo'
import {
  pickAndCreateProject,
  openExistingProject,
  setCurrentProject,
  getCurrentProject,
  getCurrentProjectId
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
  // 从「最近」无损隐藏（置空 last_opened_at，保留行 + 历史）。拒绝隐藏当前项目（仍在用）。
  ipcMain.handle('projects:forget', (_e, id: number): void => {
    if (id === getCurrentProjectId()) throw new Error('无法移除当前打开的项目，请先切换项目')
    forgetProject(getDb(), id)
  })
}
