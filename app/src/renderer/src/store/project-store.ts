import { create } from 'zustand'
import type { Project } from '@shared/types'

interface ProjectState {
  /** 当前打开的项目；null=未选择（启动路由据此显示项目页）。 */
  current: Project | null
  /** 是否已从主进程同步过当前项目（启动/刷新各一次）。水合完成前不渲染路由，避免闪烁。 */
  hydrated: boolean
  setCurrent: (p: Project | null) => void
  /**
   * 从主进程读取当前项目以水合 renderer 状态。
   * 解决「renderer 刷新后 current 归零、主进程仍保留 currentProjectId」的两端脱节：
   * 刷新后据主进程真实当前项目恢复工作台，而非误回项目页。
   */
  hydrate: () => Promise<void>
}

/** 当前项目上下文（前端路由 + 状态条显示的单一来源）。 */
export const useProjectStore = create<ProjectState>((set) => ({
  current: null,
  hydrated: false,
  setCurrent: (p) => set({ current: p }),
  hydrate: async () => {
    try {
      const current = await window.api.projects.getCurrent()
      set({ current, hydrated: true })
    } catch {
      // 读取失败按无当前项目处理（回项目页），显式清空 current 让语义在非冷启动也成立；仍标记已水合避免卡白屏。
      set({ current: null, hydrated: true })
    }
  }
}))
