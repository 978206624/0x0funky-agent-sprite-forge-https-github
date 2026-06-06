import type { ReactNode } from 'react'
import { SectionHeader } from '../../ui/section-header'

/** 设置段容器：标题 + 分隔线。 */
export function SettingSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2 border-b border-edge pb-6">
      <SectionHeader>{title}</SectionHeader>
      <div className="flex flex-col">{children}</div>
    </section>
  )
}

/** 单行设置项：左侧标签 + 描述，右侧控件。 */
export function Field({
  label,
  hint,
  children
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[13px] text-fg">{label}</span>
        {hint && <span className="text-[11px] leading-relaxed text-fg-dim">{hint}</span>}
      </div>
      <div className="flex shrink-0 items-center">{children}</div>
    </div>
  )
}
