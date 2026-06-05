import { ChevronDown } from 'lucide-react'
import type { ReactNode, SelectHTMLAttributes } from 'react'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  children: ReactNode
}

export function Select({ className = '', children, ...rest }: SelectProps) {
  return (
    <div className="relative inline-flex w-full items-center">
      <select
        className={`w-full appearance-none rounded-sm border border-edge bg-elevated py-2 pl-3 pr-8 text-[13px] text-fg outline-none focus:border-accent ${className}`}
        {...rest}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 h-4 w-4 text-fg-soft" />
    </div>
  )
}
