import { useCallback, useState } from 'react'
import type { GenerationRecord } from '@shared/types'
import { HistoryGrid } from '../left/history-grid'
import { HistoryPreview } from './history-preview'
import { useHistoryStore } from '../../store/history-store'
import { useParamStore } from '../../store/param-store'
import { useLayoutStore } from '../../store/layout-store'

/**
 * 产出历史视图：接管整个中间主区，铺满展示历史产出网格。
 * 点某条 → 仅本地弹出独立预览（不碰工作台/参数）；预览里点「应用到工作台」才
 * 显式选中预览 + 回填参数 + 切回工作台（改参重生）。
 */
export function HistoryView() {
  const count = useHistoryStore((s) => s.records.length)
  const select = useHistoryStore((s) => s.select)
  const backfill = useParamStore((s) => s.backfill)
  const setLeftTab = useLayoutStore((s) => s.setLeftTab)
  const [preview, setPreview] = useState<GenerationRecord | null>(null)
  // 稳定引用：避免 HistoryPreview 的 Esc 监听 useEffect 每次 render 重绑。
  const closePreview = useCallback(() => setPreview(null), [])

  const applyToWorkbench = (record: GenerationRecord): void => {
    select(record)
    backfill(record.params)
    setLeftTab('workbench')
    setPreview(null)
  }

  return (
    <main className="relative flex flex-1 flex-col overflow-hidden bg-base">
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-edge px-4">
        <span className="text-sm font-semibold text-fg">产出历史</span>
        <span className="font-mono text-xs text-fg-dim">{count} 个产出</span>
      </div>
      <div className="flex-1 overflow-auto p-4">
        <HistoryGrid variant="full" onPick={setPreview} selectedId={preview?.id} />
      </div>

      {preview && (
        <HistoryPreview
          record={preview}
          onClose={closePreview}
          onApply={() => applyToWorkbench(preview)}
        />
      )}
    </main>
  )
}
