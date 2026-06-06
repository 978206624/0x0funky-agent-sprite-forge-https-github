import { create } from 'zustand'
import type { SkillListResult } from '@shared/types'

interface SkillState {
  /** 最近一次列表结果；null=尚未加载。 */
  result: SkillListResult | null
  loading: boolean
  /** 当前选中 skill 的 id；null=未选（加载后默认选首个已适配 skill）。 */
  currentId: string | null
  /** 最近一次管理操作（导入/新建/删除）的错误；null=无。 */
  actionError: string | null

  /** 加载 app 自管 skill 库；成功后若当前未选/所选已失效，默认选中首个已适配 skill。 */
  list: () => Promise<void>
  /** 切换当前 skill（仅 UI 允许点击已适配项，故传入的应为已适配 id）。 */
  setCurrent: (id: string) => void
  /** 导入本机 skill 文件夹（原生选择器）；取消静默，失败记 actionError。 */
  importFolder: () => Promise<void>
  /** 导入 skill .zip（原生选择器）；取消静默，失败记 actionError。 */
  importZip: () => Promise<void>
  /** 新建一个最小 skill。 */
  create: (name: string) => Promise<void>
  /** 删除受管 skill（内置项会被主进程拒绝）。 */
  remove: (id: string) => Promise<void>
  /** 清除 actionError。 */
  clearError: () => void
}

/** skill 库列表 + 当前选中 skill（设置页 Skill 库、状态条第三灯、右栏徽标共享的单一来源）。 */
export const useSkillStore = create<SkillState>((set, get) => ({
  result: null,
  loading: true,
  currentId: null,
  actionError: null,

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
  },

  importFolder: async () => {
    set({ actionError: null })
    try {
      const info = await window.api.skills.importFolder()
      if (info) await get().list() // null=用户取消，静默
    } catch (e) {
      set({ actionError: `导入文件夹失败：${errMsg(e)}` })
    }
  },

  importZip: async () => {
    set({ actionError: null })
    try {
      const info = await window.api.skills.importZip()
      if (info) await get().list()
    } catch (e) {
      set({ actionError: `导入 zip 失败：${errMsg(e)}` })
    }
  },

  create: async (name) => {
    set({ actionError: null })
    try {
      await window.api.skills.create(name)
      await get().list()
    } catch (e) {
      set({ actionError: `新建失败：${errMsg(e)}` })
    }
  },

  remove: async (id) => {
    set({ actionError: null })
    try {
      await window.api.skills.remove(id)
      await get().list()
    } catch (e) {
      set({ actionError: `删除失败：${errMsg(e)}` })
    }
  },

  clearError: () => set({ actionError: null })
}))

/** 从 IPC reject 的 Error 中提取可读信息（主进程抛错经 electron 包装为 "Error: xxx"）。 */
function errMsg(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e)
  // electron IPC 把主进程错误包成 "Error invoking remote method 'skills:xxx': Error: 真实信息"
  const idx = m.lastIndexOf('Error: ')
  return idx >= 0 ? m.slice(idx + 'Error: '.length) : m
}
