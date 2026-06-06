import { useMemo } from 'react'
import type { GenParams } from '@shared/types'
import { useGenerationStore } from '../store/generation-store'

export interface PreviewData {
  slug: string
  /** 整张透明精灵表 asset:// URL。 */
  sheetUrl: string
  /** 预览 GIF asset:// URL。 */
  gifUrl: string
  /** 各单帧 asset:// URL（1..frameCount）。 */
  frameUrls: string[]
  frameCount: number
  rows: number
  cols: number
  cell: number
}

/** 与 main/prompt-builder.resolveGrid 对齐的网格推导（renderer 侧轻量复刻）。 */
function resolveGrid(params: GenParams | null): { rows: number; cols: number } {
  const r = params?.gridRows
  const c = params?.gridCols
  if (r && c && r > 0 && c > 0) return { rows: Math.floor(r), cols: Math.floor(c) }
  const action = (params?.action ?? '').toLowerCase()
  if (action === 'cast' || action === 'attack' || action === 'run' || action === 'charge') {
    return { rows: 3, cols: 2 }
  }
  return { rows: 2, cols: 2 }
}

/**
 * 从最近一次成功生成的记录组装预览数据（asset:// URL + 元信息）。
 * 仅当存在成功记录时返回；否则 null（中栏据此显示空态/生成态）。
 * asset:// 路径相对当前项目 assets/，故为 asset://sprites/<slug>/...。
 */
export function usePreview(): PreviewData | null {
  const record = useGenerationStore((s) => s.lastRecord)

  return useMemo(() => {
    if (!record || record.status !== 'success' || !record.slug) return null
    const { slug, params } = record
    const { rows, cols } = resolveGrid(params)
    const frameCount = rows * cols
    const cell = params?.frameWidth && params.frameWidth > 0 ? Math.floor(params.frameWidth) : 256
    const baseUrl = `asset://sprites/${encodeURIComponent(slug)}`
    const frameUrls = Array.from(
      { length: frameCount },
      (_, i) => `${baseUrl}/${encodeURIComponent(`${slug}-${i + 1}`)}.png`
    )
    return {
      slug,
      sheetUrl: `${baseUrl}/sheet-transparent.png`,
      gifUrl: `${baseUrl}/animation.gif`,
      frameUrls,
      frameCount,
      rows,
      cols,
      cell
    }
  }, [record])
}
