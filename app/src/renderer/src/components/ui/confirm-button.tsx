import { useState } from 'react'
import type { ReactNode } from 'react'

interface ConfirmButtonProps {
  /** 确认后执行。 */
  onConfirm: () => void
  /** 静默态按钮内容。 */
  children: ReactNode
  /** 确认态提示文案，默认「确认?」。 */
  confirmLabel?: string
  disabled?: boolean
  /** danger 语义：红色（破坏性操作）。 */
  tone?: 'danger' | 'default'
}

/**
 * 内联二次确认按钮（不弹窗，符合工具感）：第一次点变「确认? / 取消」两步，确认才执行。
 * 用于清空历史等破坏性操作；失焦/取消即复位。
 */
export function ConfirmButton({
  onConfirm,
  children,
  confirmLabel = '确认?',
  disabled = false,
  tone = 'default'
}: ConfirmButtonProps) {
  const [armed, setArmed] = useState(false)
  const base =
    'inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors disabled:pointer-events-none disabled:opacity-50'
  const idleTone =
    tone === 'danger'
      ? 'border-error/40 text-error hover:bg-error/10'
      : 'border-edge bg-elevated text-fg-soft hover:bg-hover hover:text-fg'

  if (!armed) {
    return (
      <button type="button" disabled={disabled} onClick={() => setArmed(true)} className={`${base} ${idleTone}`}>
        {children}
      </button>
    )
  }
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={() => {
          setArmed(false)
          onConfirm()
        }}
        className={`${base} border-error/40 bg-error/10 text-error hover:bg-error/20`}
      >
        {confirmLabel}
      </button>
      <button
        type="button"
        onClick={() => setArmed(false)}
        className="text-xs text-fg-dim hover:text-fg-soft"
      >
        取消
      </button>
    </span>
  )
}
