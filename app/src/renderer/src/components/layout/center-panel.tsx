import { ChevronDown, Download } from 'lucide-react'
import { useState } from 'react'
import type { CodexHealth } from '@shared/types'
import { CodexNotReady } from '../states/codex-not-ready'
import { SegmentedControl } from '../ui/segmented-control'

type PreviewView = 'sheet' | 'frame' | 'gif'

const VIEW_OPTIONS = [
  { value: 'sheet' as const, label: '精灵表' },
  { value: 'frame' as const, label: '单帧' },
  { value: 'gif' as const, label: 'GIF' }
]

const LOGS: [string, string][] = [
  ['12:04:18', 'invoking generate2dsprite · mode=cast'],
  ['12:04:22', 'raw sheet generated · 1024x1536 · chroma-key #FF00FF'],
  ['12:04:27', 'postprocess · removed magenta · 6 components found'],
  ['12:04:30', 'relayout + trim + pack → sheet-transparent.png'],
  ['12:04:31', 'done · 6 frames · animation.gif written']
]

interface CenterPanelProps {
  ready: boolean
  health: CodexHealth | null
  loading: boolean
  onRetry: () => void
}

export function CenterPanel({ ready, health, loading, onRetry }: CenterPanelProps) {
  const [view, setView] = useState<PreviewView>('sheet')

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
          <span className="text-sm font-semibold text-fg">火法师施法</span>
          <span className="font-mono text-xs text-fg-dim">6 帧 · 256px · 2×3</span>
        </div>
        <div className="flex items-center gap-3">
          <SegmentedControl options={VIEW_OPTIONS} value={view} onChange={setView} />
          <span className="font-mono text-xs text-fg-soft">100%</span>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-md border border-edge bg-elevated px-3 py-2 text-xs font-medium text-fg-soft hover:bg-hover hover:text-fg"
          >
            <Download className="h-[15px] w-[15px]" />
            导出
          </button>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center p-6">
        <div className="checker-bg flex h-[480px] w-[672px] items-center justify-center rounded-md border border-edge-strong">
          <span className="text-sm text-fg-dim">预览区 · {view}</span>
        </div>
      </div>

      <div className="flex h-[148px] shrink-0 flex-col border-t border-edge bg-panel">
        <div className="flex h-9 shrink-0 items-center justify-between border-b border-edge px-4">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-fg-soft">CODEX 日志</span>
            <span className="text-xs text-success">✓ 生成完成 · 12.4s</span>
          </div>
          <ChevronDown className="h-4 w-4 text-fg-dim" />
        </div>
        <div className="flex flex-1 flex-col gap-1 overflow-auto px-4 py-2">
          {LOGS.map(([time, msg]) => (
            <div key={time} className="flex gap-2 font-mono text-[11px]">
              <span className="text-fg-dim">{time}</span>
              <span className="text-fg-soft">{msg}</span>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
