import { Circle, CircleCheck, PlugZap, RotateCw, Settings } from 'lucide-react'
import type { CodexHealth } from '@shared/types'

interface CodexNotReadyProps {
  health: CodexHealth | null
  onRetry: () => void
}

export function CodexNotReady({ health, onRetry }: CodexNotReadyProps) {
  const notInstalled = !health?.installed
  const steps = [
    { label: '检测 Codex 可执行文件', done: !!health?.installed },
    { label: '登录 Codex 账号', done: !!health?.loggedIn },
    { label: '挂载 generate2dsprite skill', done: false }
  ]

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-base p-6">
      <div className="flex h-[88px] w-[88px] items-center justify-center rounded-lg border border-warning/25 bg-warning/10">
        <PlugZap className="h-10 w-10 text-warning" />
      </div>

      <p className="text-xl font-semibold text-fg-soft">
        {notInstalled ? '未检测到 Codex CLI' : 'Codex 未登录'}
      </p>
      <p className="max-w-md text-center text-sm leading-relaxed text-fg-dim">
        本工作台依赖本机的 Codex CLI 生成资源。请配置 Codex 路径并完成登录后再开始。
      </p>

      <div className="flex flex-col gap-2">
        {steps.map((s) => (
          <div key={s.label} className="flex items-center gap-2">
            {s.done ? (
              <CircleCheck className="h-4 w-4 text-success" />
            ) : (
              <Circle className="h-4 w-4 text-fg-dim" />
            )}
            <span className={`text-sm ${s.done ? 'text-fg-soft' : 'text-fg-dim'}`}>{s.label}</span>
          </div>
        ))}
      </div>

      {health?.error ? (
        <p className="max-w-md break-all text-center font-mono text-xs text-error">{health.error}</p>
      ) : null}

      <div className="mt-1 flex gap-3">
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-2 rounded-md border border-edge bg-elevated px-3.5 py-2 text-sm font-medium text-fg-soft hover:bg-hover hover:text-fg"
        >
          <RotateCw className="h-4 w-4" />
          重新检测
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-md bg-accent px-3.5 py-2 text-sm font-medium text-white hover:bg-accent-hover"
        >
          <Settings className="h-4 w-4" />
          前往设置
        </button>
      </div>
    </div>
  )
}
