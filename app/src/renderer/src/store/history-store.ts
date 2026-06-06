import { create } from 'zustand'
import type { GenerationRecord } from '@shared/types'
import { useProjectStore } from './project-store'

interface HistoryState {
  /** 当前项目的产出历史（按创建时间倒序，来自 DB）。 */
  records: GenerationRecord[]
  /** 当前选中的记录：驱动中栏预览的单一来源（替代 generation-store.lastRecord，刷新/重启后可从 DB 恢复）。 */
  selected: GenerationRecord | null
  loading: boolean

  /** 按项目从 DB 加载历史列表（不动 selected，避免刷新时丢选中）。 */
  load: (projectId: number) => Promise<void>
  /** 选中一条记录用于预览（点击历史卡片时调用）。 */
  select: (record: GenerationRecord) => void
  /** 生成结束回调：仅对当前项目刷新列表，成功则自动选中新记录到预览。 */
  onDone: (record: GenerationRecord) => Promise<void>
  /** 清空到初始态（切换/进入项目时调用，避免把上一个项目的历史/选中带过去）。 */
  reset: () => void
}

/**
 * 在途加载序号：防陈旧请求覆盖。快速切换项目时旧项目的 listByProject() 可能晚返回，
 * 用序号 + 当前项目双校验，过期结果直接丢弃；reset() 递增序号让在途请求失效。
 */
let loadSeq = 0

/** 当前项目是否仍为 projectId（写入前校验，避免把旧项目数据灌进新项目）。 */
function stillCurrent(projectId: number): boolean {
  return useProjectStore.getState().current?.id === projectId
}

/** 产出历史 + 当前选中记录（左栏历史网格 + 中栏预览共享的单一来源）。 */
export const useHistoryStore = create<HistoryState>((set, get) => ({
  records: [],
  selected: null,
  loading: false,

  load: async (projectId) => {
    const seq = ++loadSeq
    set({ loading: true })
    try {
      const records = await window.api.db.generations.listByProject(projectId)
      if (seq !== loadSeq || !stillCurrent(projectId)) return
      set({ records, loading: false })
    } catch {
      if (seq !== loadSeq || !stillCurrent(projectId)) return
      set({ records: [], loading: false })
    }
  },

  select: (record) => set({ selected: record }),

  onDone: async (record) => {
    // 仅当结束的记录属于当前项目才刷新（生成中已禁用切换项目，正常不会错配，仍防御）。
    if (!stillCurrent(record.projectId)) return
    await get().load(record.projectId)
    // await 后项目可能已切换：再次校验，避免把旧项目记录灌进新项目预览。
    if (!stillCurrent(record.projectId)) return
    // 成功才自动选中预览；失败/取消只刷新列表（带红角标），不抢占当前预览。
    if (record.status === 'success') set({ selected: record })
  },

  reset: () => {
    loadSeq += 1
    set({ records: [], selected: null, loading: false })
  }
}))
