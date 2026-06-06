import { ipcMain, dialog, type IpcMainInvokeEvent } from 'electron'
import { getDb } from '../db'
import { getGeneration } from '../db/generations-repo'
import { exportBundle } from '../generation/exporter'
import type { ExportResult } from '../../shared/types'

/** 注册导出相关 IPC handler。须在 app ready 且 initDatabase() 之后调用一次。 */
export function registerExportIpc(): void {
  // 按 generationId 查记录 → 校验可导出 → 原生目录选择 → 复制整套 bundle 到目标目录。
  // 目标路径只来自原生目录选择器，renderer 无从注入任意路径（与项目目录信任边界一致）。
  ipcMain.handle(
    'export:bundle',
    async (_e: IpcMainInvokeEvent, generationId: number): Promise<ExportResult | null> => {
      const record = getGeneration(getDb(), generationId)
      if (!record) throw new Error(`产出记录不存在：id=${generationId}`)
      if (record.status !== 'success') throw new Error('仅成功的产出可导出')
      if (!record.outputDir) throw new Error('该产出无产物目录')

      const res = await dialog.showOpenDialog({
        title: '选择导出目录',
        properties: ['openDirectory', 'createDirectory']
      })
      if (res.canceled || res.filePaths.length === 0) return null

      const dest = await exportBundle({
        outputDir: record.outputDir,
        slug: record.slug,
        destRoot: res.filePaths[0]
      })
      return { slug: record.slug, dest }
    }
  )
}
