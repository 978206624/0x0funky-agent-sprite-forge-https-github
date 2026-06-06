import { Images, LayoutDashboard, Settings } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useSettingsStore } from '../../store/settings-store'
import { useLayoutStore, type LeftTab } from '../../store/layout-store'

const TABS: { key: LeftTab; label: string; icon: LucideIcon }[] = [
  { key: 'workbench', label: '工作台', icon: LayoutDashboard },
  { key: 'history', label: '产出历史', icon: Images }
]

/**
 * 左栏：VSCode 风格图标活动栏。切换的是整个中间主区（工作台 / 产出历史），
 * 不再带独立侧栏列；项目状态信息已移至顶部栏。底部为设置入口。
 */
export function LeftRail() {
  const openSettings = useSettingsStore((s) => s.openSettings)
  const leftTab = useLayoutStore((s) => s.leftTab)
  const setLeftTab = useLayoutStore((s) => s.setLeftTab)

  return (
    <nav className="flex w-12 shrink-0 flex-col items-center border-r border-edge bg-base py-2">
      <div className="flex flex-1 flex-col items-center gap-1">
        {TABS.map(({ key, label, icon: Icon }) => {
          const active = key === leftTab
          return (
            <button
              key={key}
              type="button"
              onClick={() => setLeftTab(key)}
              title={label}
              className={`relative flex h-10 w-10 items-center justify-center rounded-md transition-colors ${
                active ? 'text-fg' : 'text-fg-dim hover:bg-hover hover:text-fg'
              }`}
            >
              {/* 选中态左侧高亮条（VSCode 同款） */}
              {active && (
                <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r bg-accent" />
              )}
              <Icon className="h-5 w-5" />
            </button>
          )
        })}
      </div>
      <button
        type="button"
        onClick={() => openSettings()}
        title="设置"
        className="flex h-10 w-10 items-center justify-center rounded-md text-fg-dim transition-colors hover:bg-hover hover:text-fg"
      >
        <Settings className="h-5 w-5" />
      </button>
    </nav>
  )
}
