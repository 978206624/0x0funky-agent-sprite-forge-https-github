import type { ReactNode } from 'react'

type Tone = 'success' | 'error' | 'accent'

const toneClass: Record<Tone, string> = {
  success: 'bg-success/15 text-success',
  error: 'bg-error/15 text-error',
  accent: 'bg-accent-soft text-accent'
}

interface BadgeProps {
  tone?: Tone
  children: ReactNode
}

export function Badge({ tone = 'accent', children }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-semibold ${toneClass[tone]}`}
    >
      {children}
    </span>
  )
}
