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

/** 左栏产出历史：按当前项目从 DB 列记录，点击重载预览 + 回填参数。 */
export function HistoryGrid() {
  const { records, selected, loading, open } = useHistory()

  if (loading && records.length === 0) {
    return <p className="text-[11px] text-fg-dim">加载中…</p>
  }
  if (records.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-edge bg-base/50 p-3 text-center text-[11px] text-fg-dim">
        还没有产出，填右侧参数点「生成」开始。
      </p>
    )
  }
  return (
    <div className="grid grid-cols-2 gap-2">
      {records.map((r) => (
        <HistoryCard
          key={r.id}
          record={r}
          selected={selected?.id === r.id}
          onOpen={() => open(r)}
        />
      ))}
    </div>
  )
}
