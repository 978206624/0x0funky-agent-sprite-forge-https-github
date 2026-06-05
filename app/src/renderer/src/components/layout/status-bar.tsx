import type { CodexHealth } from '@shared/types'
import { StatusLight, type LightStatus } from '../ui/status-light'

interface StatusBarProps {
  health: CodexHealth | null
  loading: boolean
}

export function StatusBar({ health, loading }: StatusBarProps) {
  const installedStatus: LightStatus = loading ? 'muted' : health?.installed ? 'success' : 'error'
  const installedLabel = loading
    ? 'Codex 检测中…'
    : health?.installed
      ? `Codex ${health.version ?? ''} 已安装`.replace(/\s+/g, ' ').trim()
      : 'Codex 未检测到'

  const loginStatus: LightStatus = loading || !health?.installed
    ? 'muted'
    : health.loggedIn
      ? 'success'
      : 'error'
  const loginLabel = health?.installed && health.loggedIn
    ? health.loginMethod
      ? `已登录 · ${health.loginMethod}`
      : '已登录'
    : '未登录'

  return (
    <footer className="flex h-[30px] shrink-0 items-center justify-between border-t border-edge bg-panel px-3">
      <div className="flex items-center gap-2">
        <StatusLight status={installedStatus} label={installedLabel} />
        <StatusLight status={loginStatus} label={loginLabel} />
        <StatusLight status="muted" label="skill 待扫描" />
      </div>
      <span className="font-mono text-[11px] text-fg-dim">workspace: 未选择</span>
    </footer>
  )
}
