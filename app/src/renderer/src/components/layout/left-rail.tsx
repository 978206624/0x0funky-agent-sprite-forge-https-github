import { Layers, Settings, Sparkles } from 'lucide-react'
import type { ReactNode } from 'react'
import { SectionHeader } from '../ui/section-header'
import { HistoryGrid } from '../left/history-grid'

interface SkillItemProps {
  icon: ReactNode
  label: string
  active?: boolean
  disabled?: boolean
}

function SkillItem({ icon, label, active = false, disabled = false }: SkillItemProps) {
  const tone = disabled ? 'text-fg-dim' : active ? 'text-fg' : 'text-fg-soft'
  return (
    <button
      type="button"
      disabled={disabled}
      className={`flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left disabled:cursor-default ${active ? 'bg-accent-soft' : ''} ${disabled ? '' : 'hover:bg-hover'}`}
    >
      <span className={active ? 'text-accent' : tone}>{icon}</span>
      <span className={`text-[13px] font-medium ${active ? 'text-fg' : tone}`}>{label}</span>
    </button>
  )
}

export function LeftRail() {
  return (
    <aside className="flex w-60 shrink-0 flex-col gap-5 border-r border-edge bg-panel p-3">
      <section className="flex flex-col gap-2">
        <SectionHeader>Skill 库</SectionHeader>
        <SkillItem icon={<Sparkles className="h-4 w-4" />} label="generate2dsprite" active />
        <SkillItem icon={<Layers className="h-4 w-4" />} label="generate-tileset" disabled />
      </section>

      <section className="flex flex-1 flex-col gap-3 overflow-hidden">
        <SectionHeader>产出历史</SectionHeader>
        <div className="flex-1 overflow-auto">
          <HistoryGrid />
        </div>
      </section>

      <button
        type="button"
        className="flex items-center gap-2 rounded-sm px-3 py-2 text-left hover:bg-hover"
      >
        <Settings className="h-4 w-4 text-fg-soft" />
        <span className="text-[13px] text-fg-soft">设置</span>
      </button>
    </aside>
  )
}
