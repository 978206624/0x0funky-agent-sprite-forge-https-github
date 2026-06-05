import type { InputHTMLAttributes } from 'react'

type NumberInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>

export function NumberInput({ className = '', ...rest }: NumberInputProps) {
  return (
    <input
      type="number"
      className={`rounded-sm border border-edge bg-elevated px-3 py-2 text-center font-mono text-[13px] text-fg outline-none focus:border-accent ${className}`}
      {...rest}
    />
  )
}
