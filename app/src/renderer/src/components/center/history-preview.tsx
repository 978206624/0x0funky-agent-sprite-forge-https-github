import { ArrowRightToLine, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { GenerationRecord, GenerationStatus } from '@shared/types'

function enc(s: string): string {
  return encodeURIComponent(s)
}
/** 成功产出的动图 URL（优先动图，失败回退首帧）。 */
function gifUrl(slug: string): string {
  return `asset://sprites/${enc(slug)}/animation.gif`
}
function frameUrl(slug: string): string {
  return `asset://sprites/${enc(slug)}/${enc(`${slug}-1`)}.png`
}

const STATUS_TEXT: Record<GenerationStatus, { text: string; cls: string }> = {
  success: { text: '✓ 成功', cls: 'text-success' },
  failed: { text: '✗ 失败', cls: 'text-error' },
  running: { text: '生成中…', cls: 'text-accent' },
  pending: { text: '排队中', cls: 'text-fg-dim' },
  canceled: { text: '已取消', cls: 'text-fg-dim' }
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="shrink-0 text-xs text-fg-soft">{label}</span>
      <span className="min-w-0 text-right text-xs text-fg">{value}</span>
    </div>
  )
}

/**
 * 产出历史的独立预览组件：以浮层展示选中产出的动图 + 元信息。
 * 仅本地预览，不触碰工作台/参数表单；需要改参重生时点「应用到工作台」显式触发。
 */
export function HistoryPreview({
  record,
  onClose,
  onApply
}: {
  record: GenerationRecord
  onClose: () => void
  onApply: () => void
}) {
  // 预览源：success → 先动图、坏了回退首帧、再坏 → 占位；非 success → 直接占位。
  const [stage, setStage] = useState<'gif' | 'frame' | 'none'>('none')
  useEffect(() => {
    setStage(record.status === 'success' ? 'gif' : 'none')
  }, [record.slug, record.status])

  // Esc 关闭。
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const p = record.params
  const status = STATUS_TEXT[record.status]
  const grid = p?.gridRows && p?.gridCols ? `${p.gridRows}×${p.gridCols}` : null

  return (
    <div
      className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 p-6"
      onClick={onClose}
    >
      <div
        className="flex max-h-full w-[440px] max-w-full flex-col overflow-hidden rounded-xl border border-edge bg-panel shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-edge px-4">
          <span className="truncate font-mono text-sm text-fg">{record.slug}</span>
          <button
            type="button"
            onClick={onClose}
            title="关闭"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-fg-soft transition-colors hover:bg-hover hover:text-fg"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4">
          <div className="checker-bg flex aspect-square w-full items-center justify-center overflow-hidden rounded-md border border-edge">
            {stage === 'gif' ? (
              <img
                src={gifUrl(record.slug)}
                alt={record.slug}
                draggable={false}
                onError={() => setStage('frame')}
                className="pixelated h-full w-full object-contain"
              />
            ) : stage === 'frame' ? (
              <img
                src={frameUrl(record.slug)}
                alt={record.slug}
                draggable={false}
                onError={() => setStage('none')}
                className="pixelated h-full w-full object-contain"
              />
            ) : (
              <span className="text-xs text-fg-dim">无可用预览</span>
            )}
          </div>

          <div className="mt-4 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-fg-soft">状态</span>
              <span className={`text-xs ${status.cls}`}>{status.text}</span>
            </div>
            {p?.theme && <MetaRow label="描述" value={p.theme} />}
            {p?.action && <MetaRow label="动作" value={p.action} />}
            {grid && <MetaRow label="网格" value={grid} />}
            {p?.frameWidth && <MetaRow label="帧尺寸" value={`${p.frameWidth}px`} />}
            {p?.refImages?.length ? (
              <MetaRow label="参考图" value={`${p.refImages.length} 张`} />
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-end border-t border-edge p-3">
          <button
            type="button"
            onClick={onApply}
            title="把此产出选中到工作台预览，并将其参数回填到参数表单（用于改参重生）"
            className="inline-flex items-center gap-2 rounded-md bg-accent px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-accent-hover"
          >
            <ArrowRightToLine className="h-4 w-4" />
            应用到工作台
          </button>
        </div>
      </div>
    </div>
  )
}
