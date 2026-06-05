import { Layers, Settings, Sparkles } from 'lucide-react'
import type { ReactNode } from 'react'
import { SectionHeader } from '../ui/section-header'

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

interface HistoryCardProps {
  name: string
  ok: boolean
}

function HistoryCard({ name, ok }: HistoryCardProps) {
  return (
    <button type="button" className="flex w-full flex-col gap-1 text-left">
      <span className="relative block h-[88px] overflow-hidden rounded-md border border-edge bg-base">
        <span
          className={`absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded text-[10px] font-bold text-black ${ok ? 'bg-success' : 'bg-error'}`}
        >
          {ok ? '✓' : '×'}
        </span>
      </span>
      <span className="truncate text-[11px] text-fg-soft">{name}</span>
    </button>
  )
}

const HISTORY: HistoryCardProps[] = [
  { name: '火法师施法', ok: true },
  { name: '女孩待机', ok: true },
  { name: '骑士奔跑', ok: true },
  { name: '弓箭手', ok: false }
]

export function LeftRail() {
  return (
    <aside className="flex w-60 shrink-0 flex-col gap-5 border-r border-edge bg-panel p-3">
      <section className="flex flex-col gap-2">
        <SectionHeader>Skill 库</SectionHeader>
        <SkillItem icon={<Sparkles className="h-4 w-4" />} label="generate2dsprite" active />
        <SkillItem icon={<Layers className="h-4 w-4" />} label="generate-tileset" disabled />
      </section>

      <section className="flex flex-1 flex-col gap-3">
        <SectionHeader>产出历史</SectionHeader>
        <div className="grid grid-cols-2 gap-2">
          {HISTORY.map((h) => (
            <HistoryCard key={h.name} {...h} />
          ))}
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
