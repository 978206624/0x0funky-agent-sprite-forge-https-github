export type LightStatus = 'success' | 'warning' | 'error' | 'muted'

const dotClass: Record<LightStatus, string> = {
  success: 'bg-success',
  warning: 'bg-warning',
  error: 'bg-error',
  muted: 'bg-fg-dim'
}

interface StatusLightProps {
  status: LightStatus
  label: string
}

export function StatusLight({ status, label }: StatusLightProps) {
  return (
    <div className="inline-flex items-center gap-2 rounded px-2 py-1">
      <span className={`h-2 w-2 rounded-full ${dotClass[status]}`} />
      <span className="text-xs font-medium text-fg-soft">{label}</span>
    </div>
  )
}
