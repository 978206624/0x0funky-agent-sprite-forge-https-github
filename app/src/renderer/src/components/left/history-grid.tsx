import { ImageOff } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { GenerationRecord, GenerationStatus } from '@shared/types'
import { useHistory } from '../../hooks/use-history'

/** 状态 → 角标（成功绿✓ / 失败红× / 进行中琥珀… / 取消灰–；其余无角标）。 */
function statusBadge(status: GenerationStatus): { mark: string; cls: string } | null {
  switch (status) {
    case 'success':
      return { mark: '✓', cls: 'bg-success' }
    case 'failed':
      return { mark: '×', cls: 'bg-error' }
    case 'running':
    case 'pending':
      return { mark: '…', cls: 'bg-accent' }
    case 'canceled':
      return { mark: '–', cls: 'bg-fg-dim' }
    default:
      return null
  }
}

/** 成功记录的缩略图 asset:// URL（第 1 帧），与 use-preview 的编码方式一致。 */
function thumbUrl(slug: string): string {
  return `asset://sprites/${encodeURIComponent(slug)}/${encodeURIComponent(`${slug}-1`)}.png`
}

function HistoryCard({
  record,
  selected,
  onOpen
}: {
  record: GenerationRecord
  selected: boolean
  onOpen: () => void
}) {
  const badge = statusBadge(record.status)
  const showThumb = record.status === 'success'
  const [errored, setErrored] = useState(false)
  useEffect(() => setErrored(false), [record.slug])

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-pressed={selected}
      className="flex w-full flex-col gap-1 text-left"
    >
      <span
        className={`checker-bg relative block h-[88px] overflow-hidden rounded-md border ${
          selected ? 'border-accent ring-1 ring-accent' : 'border-edge'
        }`}
      >
        {showThumb && !errored ? (
          <img
            src={thumbUrl(record.slug)}
            alt={record.slug}
            draggable={false}
            onError={() => setErrored(true)}
            className="pixelated h-full w-full object-contain"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-fg-dim">
            <ImageOff className="h-5 w-5" />
          </span>
        )}
        {badge && (
          <span
            className={`absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded text-[10px] font-bold text-black ${badge.cls}`}
          >
            {badge.mark}
          </span>
        )}
      </span>
      <span className={`block w-full truncate text-[11px] ${selected ? 'text-fg' : 'text-fg-soft'}`}>
        {record.slug}
      </span>
    </button>
  )
}

/**
 * 产出历史网格：按当前项目从 DB 列记录。
 * variant：'rail' 窄列两栏（默认）/ 'full' 铺满主区自适应多列。
 * onPick：覆盖点卡片行为（如历史视图改为本地预览，不回填参数/不跳工作台）；
 *         不传则走默认 open（选中预览 + 回填参数表单，即改参重生）。
 * selectedId：外部受控高亮（配合 onPick）；不传则用全局 selected 高亮。
 */
export function HistoryGrid({
  variant = 'rail',
  onPick,
  selectedId
}: {
  variant?: 'rail' | 'full'
  onPick?: (record: GenerationRecord) => void
  selectedId?: number
} = {}) {
  const { records, selected, loading, open } = useHistory()

  if (loading && records.length === 0) {
    return <p className="text-[11px] text-fg-dim">加载中…</p>
  }
  if (records.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-edge bg-base/50 p-3 text-center text-[11px] text-fg-dim">
        还没有产出，填参数点「生成」开始。
      </p>
    )
  }
  const gridClass =
    variant === 'full'
      ? 'grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3'
      : 'grid grid-cols-2 gap-2'
  const isSelected = (r: GenerationRecord): boolean =>
    selectedId !== undefined ? r.id === selectedId : selected?.id === r.id
  return (
    <div className={gridClass}>
      {records.map((r) => (
        <HistoryCard
          key={r.id}
          record={r}
          selected={isSelected(r)}
          onOpen={() => (onPick ? onPick(r) : open(r))}
        />
      ))}
    </div>
  )
}
