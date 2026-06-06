import { create } from 'zustand'
import type { GenParams } from '@shared/types'

/** 参数表单的受控状态。空字符串的高级数值项表示「交给 skill 推断」。 */
export interface FormState {
  theme: string
  action: string
  rows: number
  cols: number
  cell: number
  align: string
  fitScale: string
  sourcePadding: string
  duration: string
  sharedScale: boolean
}

export const INITIAL_FORM: FormState = {
  theme: '火法师，红袍金边，手持法杖，施放火焰魔法，像素风格，面向右侧',
  action: 'cast',
  rows: 3,
  cols: 2,
  cell: 256,
  align: 'bottom',
  fitScale: '',
  sourcePadding: '',
  duration: '',
  sharedScale: true
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
    view: 'side',
    gridRows: posInt(f.rows, 1),
    gridCols: posInt(f.cols, 1),
    frameWidth: posInt(f.cell, 256),
    alignment: f.align,
    sharedScale: f.sharedScale
  }
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
 */
function paramsToForm(p: GenParams | null): FormState {
  if (!p) return { ...INITIAL_FORM }
  return {
    theme: p.theme ?? INITIAL_FORM.theme,
    action: p.action ?? INITIAL_FORM.action,
    rows: p.gridRows ?? INITIAL_FORM.rows,
    cols: p.gridCols ?? INITIAL_FORM.cols,
    cell: p.frameWidth ?? INITIAL_FORM.cell,
    align: p.alignment ?? INITIAL_FORM.align,
    fitScale: numToStr(p.fitScale),
    sourcePadding: numToStr(p.sourcePadding),
    duration: numToStr(p.duration),
    sharedScale: p.sharedScale ?? INITIAL_FORM.sharedScale
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
