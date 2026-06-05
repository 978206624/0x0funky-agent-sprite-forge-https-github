interface SegmentOption<T extends string> {
  value: T
  label: string
}

interface SegmentedControlProps<T extends string> {
  options: SegmentOption<T>[]
  value: T
  onChange: (value: T) => void
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange
}: SegmentedControlProps<T>) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-md border border-edge bg-base p-[3px]">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`rounded-sm px-3 py-1 text-xs font-medium transition-colors ${
            value === opt.value ? 'bg-accent-soft text-accent' : 'text-fg-soft hover:text-fg'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
