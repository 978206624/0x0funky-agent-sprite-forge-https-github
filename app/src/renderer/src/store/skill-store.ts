import { create } from 'zustand'
import type { SkillListResult } from '@shared/types'

interface SkillState {
  /** 最近一次列表结果；null=尚未加载。 */
  result: SkillListResult | null
  loading: boolean
  /** 当前选中 skill 的 id；null=未选（加载后默认选首个已适配 skill）。 */
  currentId: string | null

  /** 加载 app 自管 skill 库；成功后若当前未选/所选已失效，默认选中首个已适配 skill。 */
  list: () => Promise<void>
  /** 切换当前 skill（仅 UI 允许点击已适配项，故传入的应为已适配 id）。 */
  setCurrent: (id: string) => void
}

/** skill 库列表 + 当前选中 skill（设置页 Skill 库、状态条第三灯、右栏徽标共享的单一来源）。 */
export const useSkillStore = create<SkillState>((set, get) => ({
  result: null,
  loading: true,
  currentId: null,

  list: async () => {
    set({ loading: true })
    try {
      const result = await window.api.skills.list()
      const adapted = result.skills.filter((s) => s.adapted)
      const cur = get().currentId
      const stillValid = cur !== null && adapted.some((s) => s.id === cur)
      const currentId = stillValid ? cur : (adapted[0]?.id ?? null)
      set({ result, loading: false, currentId })
    } catch {
      set({
        result: {
          skills: [],
          error: 'IPC 调用失败，主进程未响应 skills:list'
        },
        loading: false
      })
    }
  },

  // 防御性：只接受列表内且已适配的 skill id，挡住调试/未来调用方把 currentId 设成
  // 未适配或不存在值，避免右栏徽标与状态条不一致。非法 id 忽略，保留当前选中。
  setCurrent: (id) => {
    const ok = get().result?.skills.some((s) => s.id === id && s.adapted)
    if (ok) set({ currentId: id })
  }
}))
