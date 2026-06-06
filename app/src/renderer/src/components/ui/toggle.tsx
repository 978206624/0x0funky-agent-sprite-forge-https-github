interface ToggleProps {
  checked: boolean
  onChange: (next: boolean) => void
  disabled?: boolean
  /** danger 语义：开启态用红色（安全危险开关）。 */
  tone?: 'accent' | 'danger'
}

/** 开关控件（深色引擎风）。开启态：accent 紫 / danger 红。 */
export function Toggle({ checked, onChange, disabled = false, tone = 'accent' }: ToggleProps) {
  const onColor = tone === 'danger' ? 'bg-error' : 'bg-accent'
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-40 ${
        checked ? onColor : 'bg-edge-strong'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
          checked ? 'translate-x-[18px]' : 'translate-x-0.5'
        }`}
      />
    </button>
  )
}
