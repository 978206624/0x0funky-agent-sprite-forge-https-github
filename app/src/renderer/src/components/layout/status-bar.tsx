import { StatusLight } from '../ui/status-light'

export function StatusBar() {
  return (
    <footer className="flex h-[30px] shrink-0 items-center justify-between border-t border-edge bg-panel px-3">
      <div className="flex items-center gap-2">
        <StatusLight status="success" label="Codex 1.0.2 已安装" />
        <StatusLight status="success" label="已登录" />
        <StatusLight status="success" label="generate2dsprite 已挂载" />
      </div>
      <span className="font-mono text-[11px] text-fg-dim">workspace: D:/projects/my-game</span>
    </footer>
  )
}
