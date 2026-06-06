import { Settings } from 'lucide-react'
import { SectionHeader } from '../ui/section-header'
import { HistoryGrid } from '../left/history-grid'
import { useSettingsStore } from '../../store/settings-store'

/**
 * 左栏：仅产出历史（占满主区）+ 底部设置入口。
 * Skill 库已迁入设置页「Skill」tab（首版仅一个适配 skill，切换低频，不占左栏黄金位）；
 * 当前选中 skill 由右栏顶部徽标常驻显示。
 */
export function LeftRail() {
  const openSettings = useSettingsStore((s) => s.openSettings)
  return (
    <aside className="flex w-60 shrink-0 flex-col gap-5 border-r border-edge bg-panel p-3">
      <section className="flex flex-1 flex-col gap-3 overflow-hidden">
        <SectionHeader>产出历史</SectionHeader>
        <div className="flex-1 overflow-auto">
          <HistoryGrid />
        </div>
      </section>

      <button
        type="button"
        onClick={() => openSettings()}
        className="flex items-center gap-2 rounded-sm px-3 py-2 text-left hover:bg-hover"
      >
        <Settings className="h-4 w-4 text-fg-soft" />
        <span className="text-[13px] text-fg-soft">设置</span>
      </button>
    </aside>
  )
}
