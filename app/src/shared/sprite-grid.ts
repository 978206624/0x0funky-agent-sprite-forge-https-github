import type { GenParams } from './types'

/**
 * 精灵网格/帧尺寸的纯计算（无副作用），主进程 prompt-builder 与渲染层 use-preview 共用，
 * 避免两处双写导致口径漂移。参照 SKILL.md Defaults。
 */

/** 网格预设：rows×cols 与派生总帧数。Phase 3 UI 下拉与 resolveGrid 共用同一份定义。 */
export interface GridPreset {
  rows: number
  cols: number
  /** rows × cols，预先算好供 UI 直接显示「帧数·R×C」 */
  frames: number
}

const preset = (rows: number, cols: number): GridPreset => ({ rows, cols, frames: rows * cols })

/**
 * 单方向网格预设（行=布局，列=布局；与 SKILL.md「Animated body grid guardrail」对齐）：
 * 4 帧→2×2，6 帧→2×3，8 帧→2×4，9 帧→3×3，12 帧→3×4，16 帧→4×4。
 */
export const GRID_PRESETS: readonly GridPreset[] = [
  preset(2, 2),
  preset(2, 3),
  preset(2, 4),
  preset(3, 3),
  preset(3, 4),
  preset(4, 4)
] as const

/**
 * 四方向整表预设（行恒为 4=朝向，列=每方向帧数）：
 * 4×2（每向 2 帧）/ 4×3（每向 3 帧）/ 4×4（每向 4 帧）。
 */
export const MULTIDIR_PRESETS: readonly GridPreset[] = [preset(4, 2), preset(4, 3), preset(4, 4)] as const

/**
 * 动作 → 单方向默认预设（单一事实源）：
 * idle/walk/jump → 2×2；cast/attack/run/charge → 2×3。其余动作回退 2×2。
 * resolveGrid 的单方向 fallback 与 Phase 3 表单「按动作联动默认网格」都读这份。
 */
export const ACTION_DEFAULT_GRID: Readonly<Record<string, GridPreset>> = {
  idle: preset(2, 2),
  walk: preset(2, 2),
  jump: preset(2, 2),
  cast: preset(2, 3),
  attack: preset(2, 3),
  run: preset(2, 3),
  charge: preset(2, 3)
}

/** 单方向默认预设兜底（动作未命中 ACTION_DEFAULT_GRID 时）。 */
const DEFAULT_PRESET = preset(2, 2)

/** 四方向整表未指定每方向帧数时的默认列数（4×2=每向 2 帧）。 */
const DEFAULT_MULTIDIR_COLS = 2

/** 正整数兜底：非法（小数/0/负/NaN/Infinity）回 null，供 rows/cols 安全取值。 */
function posInt(n: number | undefined | null): number | null {
  const v = Math.floor(n ?? NaN)
  return Number.isFinite(v) && v > 0 ? v : null
}

/**
 * 解析有效网格（rows×cols）。
 * - multiDir=true：行锁定为 4（= 下/左/右/上 四朝向），列 = 每方向帧数（取 gridCols，非法/缺省回退 2），忽略传入 gridRows。
 * - 否则：优先用合法的 gridRows×gridCols；缺省/非法时按动作走 ACTION_DEFAULT_GRID。
 * 网格值统一经 posInt 兜底，杜绝 0.5→0、Infinity 等非法正数生成 4x0/无限帧。
 */
export function resolveGrid(params: GenParams | null | undefined): { rows: number; cols: number } {
  const action = (params?.action ?? '').toLowerCase()
  if (params?.multiDir) {
    return { rows: 4, cols: posInt(params?.gridCols) ?? DEFAULT_MULTIDIR_COLS }
  }
  const r = posInt(params?.gridRows)
  const c = posInt(params?.gridCols)
  if (r && c) return { rows: r, cols: c }
  const def = ACTION_DEFAULT_GRID[action] ?? DEFAULT_PRESET
  return { rows: def.rows, cols: def.cols }
}

/** 总帧数 = rows × cols（multiDir 时 = 4 × 每方向帧数）。 */
export function frameCount(params: GenParams | null | undefined): number {
  const { rows, cols } = resolveGrid(params)
  return rows * cols
}

/** cell_size 正整数兜底：非法（小数/0/负/NaN/Infinity）回退 256。 */
export function resolveCell(params: GenParams | null | undefined): number {
  return posInt(params?.frameWidth) ?? 256
}
