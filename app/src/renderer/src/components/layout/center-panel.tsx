import { Download, Loader2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { CodexHealth } from '@shared/types'
import { CodexNotReady } from '../states/codex-not-ready'
import { SegmentedControl } from '../ui/segmented-control'
import { useGenerationStore, type GenStatus, type LogTone } from '../../store/generation-store'

type PreviewView = 'sheet' | 'frame' | 'gif'

const VIEW_OPTIONS = [
  { value: 'sheet' as const, label: '精灵表' },
  { value: 'frame' as const, label: '单帧' },
  { value: 'gif' as const, label: 'GIF' }
]

const TONE_CLASS: Record<LogTone, string> = {
  dim: 'text-fg-dim',
  soft: 'text-fg-soft',
  error: 'text-error',
  success: 'text-success'
}

/** 生成状态 → 日志区头部的状态徽标。 */
function statusBadge(status: GenStatus): { text: string; className: string } {
  switch (status) {
    case 'running':
      return { text: '生成中…', className: 'text-accent' }
    case 'success':
      return { text: '✓ 生成完成', className: 'text-success' }
    case 'failed':
      return { text: '✗ 生成失败', className: 'text-error' }
    case 'canceled':
      return { text: '已取消', className: 'text-fg-dim' }
    default:
      return { text: '等待生成', className: 'text-fg-dim' }
  }
}

interface CenterPanelProps {
  ready: boolean
  health: CodexHealth | null
  loading: boolean
  onRetry: () => void
}

export function CenterPanel({ ready, health, loading, onRetry }: CenterPanelProps) {
  const [view, setView] = useState<PreviewView>('sheet')
  const status = useGenerationStore((s) => s.status)
  const logs = useGenerationStore((s) => s.logs)
  const slug = useGenerationStore((s) => s.slug)
  const running = status === 'running'
  const badge = statusBadge(status)

  // 新日志自动滚到底。
  const logEndRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ block: 'end' })
  }, [logs.length])

  if (!loading && !ready) {
    return (
      <main className="flex flex-1 flex-col bg-base">
        <CodexNotReady health={health} onRetry={onRetry} />
      </main>
    )
  }

  return (
    <main className="flex flex-1 flex-col bg-base">
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-edge px-4">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-fg">{slug ?? '尚未生成'}</span>
          {running && <Loader2 className="h-4 w-4 animate-spin text-accent" />}
        </div>
        <div className="flex items-center gap-3">
          <SegmentedControl options={VIEW_OPTIONS} value={view} onChange={setView} />
          <span className="font-mono text-xs text-fg-soft">100%</span>
          <button
            type="button"
            disabled={status !== 'success'}
            className="inline-flex items-center gap-2 rounded-md border border-edge bg-elevated px-3 py-2 text-xs font-medium text-fg-soft hover:bg-hover hover:text-fg disabled:pointer-events-none disabled:opacity-50"
          >
            <Download className="h-[15px] w-[15px]" />
            导出
          </button>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center p-6">
        <div className="checker-bg flex h-[480px] w-[672px] items-center justify-center rounded-md border border-edge-strong">
          <span className="text-sm text-fg-dim">
            {running ? '生成中…' : '预览区 · Phase 7 接通'}
          </span>
        </div>
      </div>

      <div className="flex h-[148px] shrink-0 flex-col border-t border-edge bg-panel">
        {/* 生成中：顶部琥珀进度条（codex 无百分比，用 indeterminate 脉冲，诚实表达进行中）。 */}
        <div className="h-0.5 shrink-0 overflow-hidden bg-edge">
          {running && <div className="h-full w-full animate-pulse bg-accent" />}
        </div>
        <div className="flex h-9 shrink-0 items-center justify-between border-b border-edge px-4">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-fg-soft">CODEX 日志</span>
            <span className={`text-xs ${badge.className}`}>{badge.text}</span>
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-1 overflow-auto px-4 py-2">
          {logs.length === 0 ? (
            <span className="text-[11px] text-fg-dim">填写右侧参数后点「生成」开始。</span>
          ) : (
            logs.map((line) => (
              <div key={line.id} className="flex gap-2 font-mono text-[11px]">
                <span className="shrink-0 text-fg-dim">{line.time}</span>
                <span className={`whitespace-pre-wrap break-all ${TONE_CLASS[line.tone]}`}>
                  {line.text}
                </span>
              </div>
            ))
          )}
          <div ref={logEndRef} />
        </div>
      </div>
    </main>
  )
}
