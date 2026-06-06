import { Layers, Settings, Sparkles } from 'lucide-react'
import { SectionHeader } from '../ui/section-header'
import { HistoryGrid } from '../left/history-grid'
import { useSkills } from '../../hooks/use-skills'

interface SkillItemProps {
  label: string
  /** 未适配 → 灰显不可选；已适配 → 可点击切换。 */
  adapted: boolean
  active: boolean
  title?: string
  onSelect: () => void
}

function SkillItem({ label, adapted, active, title, onSelect }: SkillItemProps) {
  const disabled = !adapted
  const tone = disabled ? 'text-fg-dim' : active ? 'text-fg' : 'text-fg-soft'
  return (
    <button
      type="button"
      disabled={disabled}
      title={title}
      onClick={onSelect}
      className={`flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left disabled:cursor-default ${active ? 'bg-accent-soft' : ''} ${disabled ? '' : 'hover:bg-hover'}`}
    >
      <span className={active ? 'text-accent' : tone}>
        {adapted ? <Sparkles className="h-4 w-4" /> : <Layers className="h-4 w-4" />}
      </span>
      <span className={`flex-1 truncate text-[13px] font-medium ${active ? 'text-fg' : tone}`}>
        {label}
      </span>
      {disabled && (
        <span className="shrink-0 rounded bg-base px-1 text-[11px] text-fg-soft">未适配</span>
      )}
    </button>
  )
}

/** Skill 库：扫描结果渲染（已适配高亮可选、未适配灰显），含加载/空/错误态。 */
function SkillLibrary() {
  const { skills, currentId, setCurrent, loading, error } = useSkills()

  if (loading && skills.length === 0) {
    return <p className="px-3 text-[11px] text-fg-dim">扫描中…</p>
  }
  if (error) {
    return <p className="px-3 text-[11px] text-error">{error}</p>
  }
  if (skills.length === 0) {
    return <p className="px-3 text-[11px] text-fg-dim">未发现 skill（检查 ~/.codex/skills）</p>
  }
  return (
    <>
      {skills.map((s) => (
        <SkillItem
          key={s.id}
          label={s.name}
          adapted={s.adapted}
          active={s.id === currentId}
          title={s.description ? `${s.name} — ${s.description}` : s.name}
          onSelect={() => setCurrent(s.id)}
        />
      ))}
    </>
  )
}

export function LeftRail() {
  return (
    <aside className="flex w-60 shrink-0 flex-col gap-5 border-r border-edge bg-panel p-3">
      <section className="flex shrink-0 flex-col gap-2">
        <SectionHeader>Skill 库</SectionHeader>
        {/* 限高滚动：装多个 skill 时不挤压下方产出历史（flex-1）区。 */}
        <div className="flex max-h-44 flex-col overflow-y-auto">
          <SkillLibrary />
        </div>
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
