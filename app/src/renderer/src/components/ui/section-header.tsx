import type { ReactNode } from 'react'

interface SectionHeaderProps {
  children: ReactNode
  action?: ReactNode
}

export function SectionHeader({ children, action }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-fg-dim">
        {children}
      </span>
      {action}
    </div>
  )
}
