import { Box } from 'lucide-react'

export function TopBar() {
  return (
    <header className="flex h-11 shrink-0 items-center justify-between border-b border-edge bg-panel px-4">
      <div className="flex items-center gap-2">
        <Box className="h-[18px] w-[18px] text-accent" />
        <span className="text-sm font-semibold text-fg">Game Asset Forge</span>
      </div>
      <span className="font-mono text-xs text-fg-dim">gpt-5-codex · workspace-write</span>
    </header>
  )
}
