import { Download, Loader2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { CodexHealth } from '@shared/types'
import { CodexNotReady } from '../states/codex-not-ready'
import { EmptyState } from '../states/empty-state'
import { ErrorState } from '../states/error-state'
import { ParamsPanel } from '../center/params-panel'
import { PreviewStage, type PreviewView } from '../center/preview-stage'
import { PlaybackBar } from '../center/playback-bar'
import { SegmentedControl } from '../ui/segmented-control'
import { useGenerationStore } from '../../store/generation-store'
import { useHistoryStore } from '../../store/history-store'
import { usePreview } from '../../hooks/use-preview'
import { usePlayback } from '../../hooks/use-playback'

const VIEW_OPTIONS = [
  { value: 'sheet' as const, label: '精灵表' },
  { value: 'frame' as const, label: '单帧' },
  { value: 'gif' as const, label: 'GIF' }
]

interface CenterPanelProps {
  ready: boolean
  health: CodexHealth | null
  loading: boolean
  onRetry: () => void
}

export function CenterPanel({ ready, health, loading, onRetry }: CenterPanelProps) {
  const [view, setView] = useState<PreviewView>('sheet')
  const status = useGenerationStore((s) => s.status)
  const slug = useGenerationStore((s) => s.slug)
  const running = status === 'running'
  const preview = usePreview()
  const pb = usePlayback(preview?.frameCount ?? 0, view === 'frame')

  // 导出当前选中产出：仅成功记录可导出（来自历史选中，刷新后仍可用）。
  const selected = useHistoryStore((s) => s.selected)
  const canExport = selected?.status === 'success'
  const [exporting, setExporting] = useState(false)
  const [exportMsg, setExportMsg] = useState<{ text: string; ok: boolean } | null>(null)
  // 成功反馈自动消失定时器；卸载/重发时清理，避免滞留与内存泄漏。
  const exportTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => clearExportTimer(), [])

  function clearExportTimer(): void {
    if (exportTimer.current) {
      clearTimeout(exportTimer.current)
      exportTimer.current = null
    }
  }

  const handleExport = async (): Promise<void> => {
    if (!selected || selected.status !== 'success' || exporting) return
    clearExportTimer()
    setExporting(true)
    setExportMsg(null)
    try {
      const res = await window.api.export.bundle(selected.id)
      // res 为 null = 用户取消选择目录，不提示。成功提示 4s 后自动消失（错误保留待用户处理）。
      if (res) {
        setExportMsg({ text: `已导出到 ${res.dest}`, ok: true })
        exportTimer.current = setTimeout(() => setExportMsg(null), 4000)
      }
    } catch (e) {
      setExportMsg({ text: e instanceof Error ? e.message : '导出失败', ok: false })
    } finally {
      setExporting(false)
    }
  }

  // 中间区域 = 左侧参数面板 + 右侧预览列。Codex 未就绪只接管预览列，
  // 参数面板始终可用（可先填表，待 Codex 就绪即可生成）。
  if (!loading && !ready) {
    return (
      <main className="flex flex-1 overflow-hidden bg-base">
        <ParamsPanel ready={ready} />
        <div className="flex min-w-0 flex-1 flex-col">
          <CodexNotReady health={health} onRetry={onRetry} />
        </div>
      </main>
    )
  }

  return (
    <main className="flex flex-1 overflow-hidden bg-base">
      <ParamsPanel ready={ready} />
      <div className="flex min-w-0 flex-1 flex-col">
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-edge px-4">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-fg">
            {running ? (slug ?? '生成中…') : (selected?.slug ?? '尚未生成')}
          </span>
          {running && <Loader2 className="h-4 w-4 animate-spin text-accent" />}
          {preview && (
            <span className="font-mono text-xs text-fg-dim">
              {preview.frameCount} 帧 · {preview.cell}px · {preview.rows}×{preview.cols}
            </span>
          )}
        </div>
        <div className="flex min-w-0 items-center gap-3">
          {exportMsg && (
            <span
              title={exportMsg.text}
              className={`max-w-[260px] truncate font-mono text-[11px] ${exportMsg.ok ? 'text-success' : 'text-error'}`}
            >
              {exportMsg.text}
            </span>
          )}
          <SegmentedControl options={VIEW_OPTIONS} value={view} onChange={setView} />
          <span className="font-mono text-xs text-fg-soft">100%</span>
          <button
            type="button"
            disabled={!canExport || exporting}
            onClick={() => void handleExport()}
            className="inline-flex items-center gap-2 rounded-md border border-edge bg-elevated px-3 py-2 text-xs font-medium text-fg-soft hover:bg-hover hover:text-fg disabled:pointer-events-none disabled:opacity-50"
          >
            {exporting ? (
              <Loader2 className="h-[15px] w-[15px] animate-spin" />
            ) : (
              <Download className="h-[15px] w-[15px]" />
            )}
            {exporting ? '导出中…' : '导出'}
          </button>
        </div>
      </div>

      {/*
        中栏主区以 selected（单一事实源）驱动，生成中优先显进度占位：
        生成中→进行中占位；选中失败记录→错误态；选中成功记录→预览；否则→空态引导。
        失败记录由 history-store.onDone 自动选中，故失败即显错误态；点其它历史卡可切走，不霸屏。
      */}
      {running ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6">
          <div className="checker-bg flex h-[480px] w-[672px] items-center justify-center rounded-md border border-edge-strong">
            <span className="text-sm text-fg-dim">生成中…</span>
          </div>
        </div>
      ) : selected?.status === 'failed' ? (
        <ErrorState />
      ) : preview ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6">
          <PreviewStage preview={preview} view={view} frameIndex={pb.frame} />
          {view === 'frame' && <PlaybackBar pb={pb} frameCount={preview.frameCount} />}
        </div>
      ) : (
        <EmptyState />
      )}
      </div>
    </main>
  )
}
