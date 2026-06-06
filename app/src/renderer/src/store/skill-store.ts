import { create } from 'zustand'
import type { SkillScanResult } from '@shared/types'

interface SkillState {
  /** 最近一次扫描结果；null=尚未扫描。 */
  result: SkillScanResult | null
  loading: boolean
  /** 当前选中 skill 的 id；null=未选（扫描后默认选首个已适配 skill）。 */
  currentId: string | null

  /** 扫描 skill 目录并更新；成功后若当前未选/所选已失效，默认选中首个已适配 skill。 */
  scan: () => Promise<void>
  /** 切换当前 skill（仅 UI 允许点击已适配项，故传入的应为已适配 id）。 */
  setCurrent: (id: string) => void
}

/** skill 库扫描结果 + 当前选中 skill（左栏 Skill 库、状态条第三灯、右栏徽标共享的单一来源）。 */
export const useSkillStore = create<SkillState>((set, get) => ({
  result: null,
  loading: true,
  currentId: null,

  scan: async () => {
    set({ loading: true })
    try {
      const result = await window.api.skills.scan()
      const adapted = result.skills.filter((s) => s.adapted)
      const cur = get().currentId
      const stillValid = cur !== null && adapted.some((s) => s.id === cur)
      const currentId = stillValid ? cur : (adapted[0]?.id ?? null)
      set({ result, loading: false, currentId })
    } catch {
      set({
        result: {
          root: '',
          rootExists: false,
          skills: [],
          error: 'IPC 调用失败，主进程未响应 skills:scan'
        },
        loading: false
      })
    }
  },

  // 防御性：只接受扫描到且已适配的 skill id，挡住调试/未来调用方把 currentId 设成
  // 未适配或不存在值，避免右栏徽标与左栏/状态条不一致。非法 id 忽略，保留当前选中。
  setCurrent: (id) => {
    const ok = get().result?.skills.some((s) => s.id === id && s.adapted)
    if (ok) set({ currentId: id })
  }
}))
