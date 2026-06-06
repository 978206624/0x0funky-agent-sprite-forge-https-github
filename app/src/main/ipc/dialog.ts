import { ipcMain, dialog } from 'electron'

/** codex --image 支持的图片格式（BMP/TIFF/SVG/HEIC 不支持，故不放进过滤器）。 */
const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp']

/** 注册原生对话框相关 IPC。须在 app ready 之后调用一次。 */
export function registerDialogIpc(): void {
  // 选择参考图：原生多选文件对话框，仅放行 codex 支持的图片格式；返回绝对路径数组（取消=空）。
  // 路径只来自原生选择器，renderer 无从注入任意路径（与项目目录/导出信任边界一致）。
  ipcMain.handle('dialog:pickImages', async (): Promise<string[]> => {
    const res = await dialog.showOpenDialog({
      title: '选择参考图',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: '图片', extensions: IMAGE_EXTENSIONS }]
    })
    if (res.canceled) return []
    return res.filePaths
  })
}
