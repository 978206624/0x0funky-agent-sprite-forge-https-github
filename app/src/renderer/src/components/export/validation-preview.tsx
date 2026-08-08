import { CheckCircle, AlertCircle, AlertTriangle } from 'lucide-react'
import type { ValidationReport } from '@shared/types'

interface ValidationPreviewProps {
  validation: ValidationReport | null
  error: string | null
  loading: boolean
}

/** 校验预览区域：显示 validation report 的三态（loading / error / report）。 */
export function ValidationPreview({ validation, error, loading }: ValidationPreviewProps) {
  if (loading) {
    return (
      <p className="mt-2 flex items-center gap-2 text-xs text-fg-dim">
        <LoaderSpinner />
        校验中…
      </p>
    )
  }

  if (error) {
    return (
      <div className="mt-2 flex items-start gap-1.5 rounded-md border border-error/30 bg-error/10 px-3 py-2">
        <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0 text-error" />
        <span className="text-xs text-error">{error}</span>
      </div>
    )
  }

  if (!validation) return null

  return (
    <div className="mt-2 space-y-2">
      {/* 总览条 */}
      <div
        className={`flex items-center gap-2 rounded-md border px-3 py-2 ${
          validation.ok ? 'border-success/30 bg-success/10' : 'border-error/30 bg-error/10'
        }`}
      >
        {validation.ok ? (
          <CheckCircle className="h-4 w-4 text-success" />
        ) : (
          <AlertCircle className="h-4 w-4 text-error" />
        )}
        <span className={`text-xs font-semibold ${validation.ok ? 'text-success' : 'text-error'}`}>
          {validation.ok ? '验证通过' : '验证未通过'}
        </span>
      </div>
      {/* 错误 */}
      {validation.errors.length > 0 && (
        <div className="rounded-md border border-error/20 bg-error/5 px-3 py-2">
          <span className="text-[10px] font-semibold uppercase text-error">错误</span>
          <ul className="mt-1 list-inside list-disc text-xs text-error space-y-0.5">
            {validation.errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}
      {/* 警告 */}
      {validation.warnings.length > 0 && (
        <div className="rounded-md border border-warning/20 bg-warning/5 px-3 py-2">
          <span className="flex items-center gap-1 text-[10px] font-semibold uppercase text-warning">
            <AlertTriangle className="h-3 w-3" />
            警告
          </span>
          <ul className="mt-1 list-inside list-disc text-xs text-warning space-y-0.5">
            {validation.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

/** 内联微 spinner。 */
function LoaderSpinner() {
  // 避免额外 import — 用 CSS 动画实现
  return (
    <svg
      className="h-3 w-3 animate-spin text-fg-dim"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  )
}
