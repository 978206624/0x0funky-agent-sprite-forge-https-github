import { create } from 'zustand'
import type { GenParams } from '@shared/types'
import { GRID_PRESETS, MULTIDIR_PRESETS, ACTION_DEFAULT_GRID } from '@shared/sprite-grid'

/** 参数表单的受控状态。空字符串的高级数值项表示「交给 skill 推断」。 */
export interface FormState {
  theme: string
  action: string
  /** 视角：side / topdown / 3-4 */
  view: string
  /** 单方向朝向：down / left / right / up（multiDir 时忽略） */
  direction: string
  /** 四方向整表：true 时行锁 4=朝向、列=每方向帧数，隐藏方向控件 */
  multiDir: boolean
  /** 网格是否处于「自定义…」态（手填 rows×cols）；false 时由预设/动作联动驱动 */
  gridCustom: boolean
  rows: number
  cols: number
  cell: number
  align: string
  fitScale: string
  sourcePadding: string
  duration: string
  sharedScale: boolean
  /** 参考图绝对路径列表（经 codex --image 参与生成）。 */
  refImages: string[]
}

/** 资源描述输入框的占位示例（仅作 placeholder 提示，非预填真值）。 */
export const THEME_PLACEHOLDER = '例：火法师，红袍金边，手持法杖，施放火焰魔法，像素风格，面向右侧'

export const INITIAL_FORM: FormState = {
  theme: '',
  action: 'cast',
  view: 'side',
  direction: 'right',
  multiDir: false,
  gridCustom: false,
  // cast 默认 2×3（对齐 ACTION_DEFAULT_GRID + GRID_PRESETS，保证初始即落在预设上）
  rows: 2,
  cols: 3,
  cell: 256,
  align: 'bottom',
  fitScale: '',
  sourcePadding: '',
  duration: '',
  sharedScale: true,
  refImages: []
}

// ============================================================
// 网格预设 ↔ 下拉值 的纯函数助手（UI 复用 Phase 2 落的 shared 常量，不另写一份）
// ============================================================

/** 「自定义…」选项的下拉值。 */
export const CUSTOM_GRID = 'custom'

/** 网格预设值编码：`${rows}x${cols}`（如 "2x3"）。 */
export function gridValue(rows: number, cols: number): string {
  return `${rows}x${cols}`
}

/** 解析网格下拉值；'custom' 或非法值回 null。 */
export function parseGridValue(v: string): { rows: number; cols: number } | null {
  if (v === CUSTOM_GRID) return null
  const [r, c] = v.split('x').map(Number)
  return Number.isFinite(r) && Number.isFinite(c) && r > 0 && c > 0 ? { rows: r, cols: c } : null
}

/** rows×cols 是否命中单方向预设（用于反推下拉选中态）。 */
function matchesPreset(rows: number, cols: number): boolean {
  return GRID_PRESETS.some((p) => p.rows === rows && p.cols === cols)
}

/** 网格下拉的选项形状（结构兼容 ui/select 的 SelectOption）。 */
export interface GridOption {
  value: string
  label: string
  sublabel?: string
}

/** 网格下拉选项：multiDir → 4×N「每向 N 帧」；单方向 → 6 个预设 + 末项「自定义…」。 */
export function gridOptions(multiDir: boolean): GridOption[] {
  if (multiDir) {
    return MULTIDIR_PRESETS.map((p) => ({
      value: gridValue(p.rows, p.cols),
      label: `${p.rows}×${p.cols}`,
      sublabel: `每向 ${p.cols} 帧`
    }))
  }
  return [
    ...GRID_PRESETS.map((p) => ({
      value: gridValue(p.rows, p.cols),
      label: `${p.rows}×${p.cols}`,
      sublabel: `${p.frames} 帧`
    })),
    { value: CUSTOM_GRID, label: '自定义…' }
  ]
}

/** 当前表单 → 网格下拉选中值。单方向自定义态或无匹配预设 → 'custom'。 */
export function gridSelectValue(f: FormState): string {
  if (f.multiDir) return gridValue(4, f.cols)
  if (f.gridCustom || !matchesPreset(f.rows, f.cols)) return CUSTOM_GRID
  return gridValue(f.rows, f.cols)
}

/** 动作默认网格（命中 ACTION_DEFAULT_GRID，否则 2×2）。 */
function actionDefaultGrid(action: string): { rows: number; cols: number } {
  const def = ACTION_DEFAULT_GRID[action.toLowerCase()]
  return def ? { rows: def.rows, cols: def.cols } : { rows: 2, cols: 2 }
}

/** 切动作：非自定义且非 multiDir 时联动默认网格；否则只换动作。 */
export function actionChangePatch(f: FormState, action: string): Partial<FormState> {
  if (f.gridCustom || f.multiDir) return { action }
  return { action, ...actionDefaultGrid(action) }
}

/** 切四方向整表：on → 行锁 4 + 保留合法列(命中预设否则取首个预设列)；off → 恢复动作默认单方向网格。 */
export function multiDirChangePatch(f: FormState, on: boolean): Partial<FormState> {
  if (on) {
    // 合法列集 + 兜底列均从 MULTIDIR_PRESETS 派生，避免与 Phase 2 预设漂移。
    const cols = MULTIDIR_PRESETS.some((p) => p.cols === f.cols) ? f.cols : MULTIDIR_PRESETS[0].cols
    return { multiDir: true, gridCustom: false, rows: 4, cols }
  }
  // 关 multiDir：显式清自定义态 + 恢复动作默认单方向网格（gridCustom 显式落 false，不依赖进入时已清）。
  return { multiDir: false, gridCustom: false, ...actionDefaultGrid(f.action) }
}

/** 切网格预设：单方向 'custom' → 进自定义态；否则套用预设（multiDir 只取列、行恒 4）。 */
export function gridChangePatch(v: string, multiDir: boolean): Partial<FormState> {
  if (!multiDir && v === CUSTOM_GRID) return { gridCustom: true }
  const g = parseGridValue(v)
  if (!g) return {}
  if (multiDir) return { rows: 4, cols: g.cols }
  return { gridCustom: false, rows: g.rows, cols: g.cols }
}

/** 正整数兜底：清空/非法输入（NaN/0/负）回退到 fallback，避免把 0 或 NaN 传给后端。 */
function posInt(v: number, fallback: number): number {
  const n = Math.floor(v)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

/** 受控表单 → GenParams（仅带上有效字段，数值做正整数兜底）。 */
export function toParams(f: FormState): GenParams {
  const p: GenParams = {
    theme: f.theme.trim() || undefined,
    assetType: 'player',
    action: f.action,
    view: f.view,
    gridRows: posInt(f.rows, 1),
    gridCols: posInt(f.cols, 1),
    frameWidth: posInt(f.cell, 256),
    alignment: f.align,
    sharedScale: f.sharedScale
  }
  // 四方向整表：带 multiDir、不带 direction（朝向由 4 行布局表达）；单方向反之。
  if (f.multiDir) p.multiDir = true
  else p.direction = f.direction
  if (f.refImages.length) p.refImages = f.refImages
  // 高级数值：仅在填了且为有限数时带上，否则交给 skill 推断。
  const fit = Number(f.fitScale)
  if (f.fitScale !== '' && Number.isFinite(fit)) p.fitScale = fit
  const pad = Number(f.sourcePadding)
  if (f.sourcePadding !== '' && Number.isFinite(pad)) p.sourcePadding = pad
  const dur = Number(f.duration)
  if (f.duration !== '' && Number.isFinite(dur)) p.duration = dur
  return p
}

/** 数值 → 受控字符串（无效/缺省回 '' 即「auto」），用于回填高级数值项。 */
function numToStr(n: number | undefined): string {
  return n !== undefined && Number.isFinite(n) ? String(n) : ''
}

/**
 * GenParams（来自历史记录）→ FormState：点击历史卡片时回填右栏表单。
 * 与 toParams 互为逆：toParams 省略的高级数值在此回 ''（auto），实现往返一致。
 * 缺省字段回退到 INITIAL_FORM，保证旧记录也能回填出合法表单。
 * 网格按 rows/cols 反推预设：multiDir 行恒 4；单方向无匹配预设 → 落「自定义」态。
 */
function paramsToForm(p: GenParams | null): FormState {
  if (!p) return { ...INITIAL_FORM }
  const multiDir = p.multiDir ?? false
  const rows = p.gridRows ?? INITIAL_FORM.rows
  let cols = p.gridCols ?? INITIAL_FORM.cols
  // multiDir 脏数据兜底：列非四方向预设值（仅可能 2/3/4）时回落首预设列，保证网格下拉有匹配项不空显。
  if (multiDir && !MULTIDIR_PRESETS.some((pp) => pp.cols === cols)) cols = MULTIDIR_PRESETS[0].cols
  return {
    theme: p.theme ?? INITIAL_FORM.theme,
    action: p.action ?? INITIAL_FORM.action,
    view: p.view ?? INITIAL_FORM.view,
    direction: p.direction ?? INITIAL_FORM.direction,
    multiDir,
    gridCustom: !multiDir && !matchesPreset(rows, cols),
    rows: multiDir ? 4 : rows,
    cols,
    cell: p.frameWidth ?? INITIAL_FORM.cell,
    align: p.alignment ?? INITIAL_FORM.align,
    fitScale: numToStr(p.fitScale),
    sourcePadding: numToStr(p.sourcePadding),
    duration: numToStr(p.duration),
    sharedScale: p.sharedScale ?? INITIAL_FORM.sharedScale,
    refImages: p.refImages ?? []
  }
}

interface ParamState {
  form: FormState
  set: (patch: Partial<FormState>) => void
  /** 用历史记录的参数回填表单（点击历史卡片时调用，支撑「改参重生」）。 */
  backfill: (params: GenParams | null) => void
  reset: () => void
}

/** 参数表单状态（右栏表单 + 历史回填共享的单一来源）。 */
export const useParamStore = create<ParamState>((set) => ({
  form: { ...INITIAL_FORM },
  set: (patch) => set((s) => ({ form: { ...s.form, ...patch } })),
  backfill: (params) => set({ form: paramsToForm(params) }),
  reset: () => set({ form: { ...INITIAL_FORM } })
}))
