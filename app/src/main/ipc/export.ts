import { ipcMain, dialog, type IpcMainInvokeEvent } from 'electron'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { getDb } from '../db'
import { getGeneration } from '../db/generations-repo'
import { getSetting } from '../db/settings-repo'
import { exportBundle } from '../generation/exporter'
import type { ExportResult, ExportAdapterInfo, AdapterExportResult, SpriteAssetSource, ValidationReport } from '../../shared/types'
import type { ExportOptions } from '../services/adapters/IExportAdapter'

// ---- AdapterRegistry lazy load ----

/** AdapterRegistry 单例的接口（仅含 IPC 层需要的方法）。 */
interface AdapterRegistryLike {
  listWithSettings(getSetting: (key: string) => string | undefined): ExportAdapterInfo[]
  get(id: string): { validate(source: SpriteAssetSource): ValidationReport; export(source: SpriteAssetSource, options: ExportOptions): Promise<AdapterExportResult> } | null
}

async function loadRegistry(): Promise<AdapterRegistryLike | null> {
  try {
    const mod = await import('../services/adapters/AdapterRegistry')
    return mod.adapterRegistry as unknown as AdapterRegistryLike
  } catch {
    return null
  }
}

// ---- SpriteAssetSource 组装 ----

interface PipelineMetaShape {
  rows?: unknown
  cols?: unknown
  cell_size?: unknown
  frames?: unknown[]
}

function readPipelineMeta(outputDir: string): PipelineMetaShape | null {
  try {
    return JSON.parse(readFileSync(join(outputDir, 'pipeline-meta.json'), 'utf8')) as PipelineMetaShape
  } catch {
    return null
  }
}

function probeFrameCount(outputDir: string, slug: string): number {
  let i = 1
  while (existsSync(join(outputDir, `${slug}-${i}.png`))) i++
  return i - 1
}

function posInt(v: unknown): number | null {
  const n = typeof v === 'number' ? Math.floor(v) : NaN
  return Number.isFinite(n) && n > 0 ? n : null
}

/** 组装 SpriteAssetSource：从 outputDir 读 pipeline-meta + 探测帧 PNG。 */
function assembleSource(outputDir: string, slug: string): SpriteAssetSource {
  const meta = readPipelineMeta(outputDir)
  const metaFrames = meta?.frames
  const frameCount =
    Array.isArray(metaFrames) && metaFrames.length > 0 ? metaFrames.length : probeFrameCount(outputDir, slug)

  const gridCols = posInt(meta?.cols) ?? 1
  const gridRows = posInt(meta?.rows) ?? 1
  const frameWidth = posInt(meta?.cell_size) ?? 1

  const frames: string[] = []
  for (let i = 1; i <= frameCount; i++) {
    const p = join(outputDir, `${slug}-${i}.png`)
    if (existsSync(p)) frames.push(p)
  }

  return {
    slug,
    outputDir,
    frames,
    sheet: join(outputDir, 'sheet-transparent.png'),
    gridCols,
    gridRows,
    frameWidth,
    frameHeight: frameWidth,
    frameCount
  }
}

// ---- 注册所有导出相关 IPC handler ----

export function registerExportIpc(): void {
  // ============ export:bundle（已有，不变） ============
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

  // ============ export:listAdapters ============
  ipcMain.handle('export:listAdapters', async (): Promise<ExportAdapterInfo[]> => {
    try {
      const registry = await loadRegistry()
      if (!registry) return []
      return registry.listWithSettings((key: string) => getSetting(getDb(), key) ?? undefined)
    } catch {
      return []
    }
  })

  // ============ export:adapterValidate ============
  ipcMain.handle(
    'export:adapterValidate',
    async (
      _e: IpcMainInvokeEvent,
      input: { generationId: number; adapterId: string }
    ): Promise<ValidationReport> => {
      const record = getGeneration(getDb(), input.generationId)
      if (!record) throw new Error(`产出记录不存在：id=${input.generationId}`)
      if (record.status !== 'success') throw new Error('仅成功的产出可验证')
      if (!record.outputDir) throw new Error('该产出无产物目录')

      const registry = await loadRegistry()
      if (!registry) throw new Error('导出适配器模块未就绪，请联系开发者')

      const adapter = registry.get(input.adapterId)
      if (!adapter) throw new Error(`未找到适配器：${input.adapterId}`)

      const source = assembleSource(record.outputDir, record.slug)
      return adapter.validate(source)
    }
  )

  // ============ export:adapter ============
  ipcMain.handle(
    'export:adapter',
    async (
      _e: IpcMainInvokeEvent,
      input: { generationId: number; adapterId: string; opts?: unknown }
    ): Promise<AdapterExportResult | null> => {
      const record = getGeneration(getDb(), input.generationId)
      if (!record) throw new Error(`产出记录不存在：id=${input.generationId}`)
      if (record.status !== 'success') throw new Error('仅成功的产出可导出')
      if (!record.outputDir) throw new Error('该产出无产物目录')

      // destRoot 只来自原生目录选择器（与 export:bundle 同信任边界）。
      const res = await dialog.showOpenDialog({
        title: '选择导出目标目录',
        properties: ['openDirectory', 'createDirectory']
      })
      if (res.canceled || res.filePaths.length === 0) return null

      const registry = await loadRegistry()
      if (!registry) throw new Error('导出适配器模块未就绪，请联系开发者')

      const adapter = registry.get(input.adapterId)
      if (!adapter) throw new Error(`未找到适配器：${input.adapterId}`)

      const source = assembleSource(record.outputDir, record.slug)
      return adapter.export(source, { destRoot: res.filePaths[0], opts: input.opts ?? {} })
    }
  )

  // ============ export:pickDirectory ============
  ipcMain.handle('export:pickDirectory', async (): Promise<string | null> => {
    const res = await dialog.showOpenDialog({
      title: '选择导出目标目录',
      properties: ['openDirectory', 'createDirectory']
    })
    if (res.canceled || res.filePaths.length === 0) return null
    return res.filePaths[0]
  })
}
