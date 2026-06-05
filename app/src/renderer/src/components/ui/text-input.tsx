import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react'

export function TextInput({ className = '', ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full rounded-sm border border-edge bg-elevated px-3 py-2 text-[13px] text-fg outline-none placeholder:text-fg-dim focus:border-accent ${className}`}
      {...rest}
    />
  )
}

export function TextArea({
  className = '',
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`w-full resize-none rounded-sm border border-edge bg-elevated px-3 py-2 text-[13px] leading-relaxed text-fg outline-none placeholder:text-fg-dim focus:border-accent ${className}`}
      {...rest}
    />
  )
}
