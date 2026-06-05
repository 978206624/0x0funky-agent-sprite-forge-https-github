import { create } from 'zustand'
import type { Project } from '@shared/types'

interface ProjectState {
  /** 当前打开的项目；null=未选择（启动路由据此显示项目页）。 */
  current: Project | null
  setCurrent: (p: Project | null) => void
}

/** 当前项目上下文（前端路由 + 状态条显示的单一来源）。 */
export const useProjectStore = create<ProjectState>((set) => ({
  current: null,
  setCurrent: (p) => set({ current: p })
}))
