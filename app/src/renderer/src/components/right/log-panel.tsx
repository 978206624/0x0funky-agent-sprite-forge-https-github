import { useEffect, useRef } from 'react'
import { useGenerationStore, type GenStatus, type LogTone } from '../../store/generation-store'

const TONE_CLASS: Record<LogTone, string> = {
  dim: 'text-fg-dim',
  soft: 'text-fg-soft',
  error: 'text-error',
  success: 'text-success'
}

/** 生成状态 → 状态徽标。 */
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

/**
 * 生成日志面板（原中间区底部「Codex 日志」迁入右栏，与对话面板切换显示）。
 * 命名去掉具体模型字样——后续生成不一定只走 Codex，此处统称「生成日志」。
 */
export function LogPanel() {
  const status = useGenerationStore((s) => s.status)
  const logs = useGenerationStore((s) => s.logs)
  const running = status === 'running'
  const badge = statusBadge(status)

  // 新日志自动滚到底。
  const logEndRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ block: 'end' })
  }, [logs.length])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* 生成中：顶部琥珀进度条（codex 无百分比，用 indeterminate 脉冲，诚实表达进行中）。 */}
      <div className="h-0.5 shrink-0 overflow-hidden bg-edge">
        {running && <div className="h-full w-full animate-pulse bg-accent" />}
      </div>
      <div className="flex h-9 shrink-0 items-center border-b border-edge px-4">
        <span className={`text-xs ${badge.className}`}>{badge.text}</span>
      </div>
      <div className="flex flex-1 flex-col gap-1 overflow-auto px-4 py-2">
        {logs.length === 0 ? (
          <span className="text-[11px] text-fg-dim">填参数点「生成」开始。</span>
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
  )
}
