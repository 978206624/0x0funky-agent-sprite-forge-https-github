import type { GenParams } from './types'

/**
 * 精灵网格/帧尺寸的纯计算（无副作用），主进程 prompt-builder 与渲染层 use-preview 共用，
 * 避免两处双写导致口径漂移。参照 SKILL.md Defaults。
 */

/** 解析有效网格（rows×cols）。未指定时按动作给保守默认。 */
export function resolveGrid(params: GenParams | null | undefined): { rows: number; cols: number } {
  const r = params?.gridRows
  const c = params?.gridCols
  if (r && c && r > 0 && c > 0) return { rows: Math.floor(r), cols: Math.floor(c) }
  const action = (params?.action ?? '').toLowerCase()
  if (action === 'cast' || action === 'attack' || action === 'run' || action === 'charge') {
    return { rows: 3, cols: 2 }
  }
  return { rows: 2, cols: 2 }
}

/** 总帧数 = rows × cols。 */
export function frameCount(params: GenParams | null | undefined): number {
  const { rows, cols } = resolveGrid(params)
  return rows * cols
}

/** cell_size 正整数兜底：非法（小数/0/负/NaN）回退 256。 */
export function resolveCell(params: GenParams | null | undefined): number {
  const n = Math.floor(params?.frameWidth ?? NaN)
  return Number.isFinite(n) && n > 0 ? n : 256
}
