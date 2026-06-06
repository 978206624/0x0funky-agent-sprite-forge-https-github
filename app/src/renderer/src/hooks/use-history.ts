import { useEffect } from 'react'
import type { GenerationRecord } from '@shared/types'
import { useHistoryStore } from '../store/history-store'
import { useParamStore } from '../store/param-store'
import { useProjectStore } from '../store/project-store'

export interface UseHistory {
  records: GenerationRecord[]
  selected: GenerationRecord | null
  loading: boolean
  /** 打开一条历史记录：选中（驱动中栏预览）+ 回填右栏参数（支撑改参重生）。 */
  open: (record: GenerationRecord) => void
}

/**
 * 按当前项目从 DB 加载产出历史；暴露列表 + 选中 + 打开（选中 + 回填）。
 * 在 LeftRail 调用一次。当前项目变化（进入/切换/刷新水合）时自动重载。
 */
export function useHistory(): UseHistory {
  const currentId = useProjectStore((s) => s.current?.id ?? null)
  const records = useHistoryStore((s) => s.records)
  const selected = useHistoryStore((s) => s.selected)
  const loading = useHistoryStore((s) => s.loading)
  const load = useHistoryStore((s) => s.load)
  const select = useHistoryStore((s) => s.select)
  const backfill = useParamStore((s) => s.backfill)

  useEffect(() => {
    if (currentId !== null) void load(currentId)
  }, [currentId, load])

  const open = (record: GenerationRecord): void => {
    select(record)
    backfill(record.params)
  }

  return { records, selected, loading, open }
}
