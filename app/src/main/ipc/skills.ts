import { ipcMain, dialog } from 'electron'
import { listSkills } from '../skills/library'
import {
  importFromFolder,
  importFromZip,
  createSkill,
  deleteSkill,
  listSkillFiles,
  readSkillFile,
  writeSkillFile
} from '../skills/manage'
import type { SkillInfo, SkillListResult } from '../../shared/types'

/** 注册 skill 相关 IPC handler。在 app ready 后调用一次。 */
export function registerSkillsIpc(): void {
  // 列出 app 自管库（userData/skills/）中的受管 skill（内置 + 导入/新建）。不再扫描本机目录。
  ipcMain.handle('skills:list', (): SkillListResult => listSkills())

  // 导入：原生选择器只在主进程出，路径不经 renderer 注入（与参考图/项目目录信任边界一致）。
  ipcMain.handle('skills:importFolder', async (): Promise<SkillInfo | null> => {
    const res = await dialog.showOpenDialog({
      title: '导入 skill 文件夹',
      properties: ['openDirectory']
    })
    if (res.canceled || res.filePaths.length === 0) return null
    return importFromFolder(res.filePaths[0])
  })

  ipcMain.handle('skills:importZip', async (): Promise<SkillInfo | null> => {
    const res = await dialog.showOpenDialog({
      title: '导入 skill 压缩包',
      properties: ['openFile'],
      filters: [{ name: 'Zip 压缩包', extensions: ['zip'] }]
    })
    if (res.canceled || res.filePaths.length === 0) return null
    return importFromZip(res.filePaths[0])
  })

  ipcMain.handle('skills:create', (_e, name: string): SkillInfo => createSkill(name))

  ipcMain.handle('skills:delete', (_e, id: string): void => deleteSkill(id))

  ipcMain.handle('skills:listFiles', (_e, id: string): string[] => listSkillFiles(id))

  ipcMain.handle('skills:readFile', (_e, id: string, relPath: string): string =>
    readSkillFile(id, relPath)
  )

  ipcMain.handle('skills:writeFile', (_e, id: string, relPath: string, content: string): void =>
    writeSkillFile(id, relPath, content)
  )
}
