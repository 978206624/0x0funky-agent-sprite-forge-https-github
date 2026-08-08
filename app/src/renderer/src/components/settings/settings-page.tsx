import { useEffect } from 'react'
import { X } from 'lucide-react'
import { useSettingsStore, type SettingsTab } from '../../store/settings-store'
import { ProjectSection } from './sections/project-section'
import { CodexSection } from './sections/codex-section'
import { SkillSection } from './sections/skill-section'
import { GenerationDefaultsSection } from './sections/generation-defaults-section'
import { StorageSection } from './sections/storage-section'
import { ExportSection } from './sections/export-section'
import { SecuritySection } from './sections/security-section'

/** 设置页 tab 列表（顺序即侧栏从上到下）。 */
const TABS: { key: SettingsTab; label: string }[] = [
  { key: 'project', label: '项目' },
  { key: 'codex', label: 'Codex' },
  { key: 'skill', label: 'Skill' },
  { key: 'generation', label: '生成默认值' },
  { key: 'storage', label: '存储' },
  { key: 'export', label: 'Export' },
  { key: 'security', label: '安全' }
]

/**
 * 设置页：覆盖在工作台之上的全屏面板（inset-0 z-50 + backdrop + Esc 关）。
 * 左侧 tab 导航 + 右侧内容区（侧边栏式，类 VSCode/macOS 设置），不卸载工作台。
 * 由 settings-store.open + activeTab 驱动；openSettings(tab?) 支持状态条灯直达。
 */
export function SettingsPage() {
  const open = useSettingsStore((s) => s.open)
  const activeTab = useSettingsStore((s) => s.activeTab)
  const setTab = useSettingsStore((s) => s.setTab)
  const close = useSettingsStore((s) => s.close)

  // Esc 关闭。
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, close])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-center bg-black/50" onClick={close}>
      <div
        className="mt-10 flex h-[calc(100vh-5rem)] w-[760px] max-w-[94vw] flex-col rounded-t-lg border border-edge bg-panel shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-edge px-5">
          <span className="text-sm font-semibold text-fg">设置</span>
          <button
            type="button"
            onClick={close}
            title="关闭 (Esc)"
            className="rounded-sm p-1 text-fg-dim hover:bg-hover hover:text-fg"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex min-h-0 flex-1">
          {/* 左侧 tab 导航。 */}
          <nav className="flex w-44 shrink-0 flex-col gap-0.5 border-r border-edge p-2">
            {TABS.map((t) => {
              const active = t.key === activeTab
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={`flex h-8 items-center rounded-sm px-3 text-left text-[13px] transition-colors ${
                    active
                      ? 'bg-accent-soft font-semibold text-accent'
                      : 'text-fg-soft hover:bg-hover hover:text-fg'
                  }`}
                >
                  {t.label}
                </button>
              )
            })}
          </nav>

          {/* 右侧内容区：仅渲染激活的 tab，避免隐藏 tab 的副作用/effect 误触发。 */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {activeTab === 'project' && <ProjectSection />}
            {activeTab === 'codex' && <CodexSection />}
            {activeTab === 'skill' && <SkillSection />}
            {activeTab === 'generation' && <GenerationDefaultsSection />}
            {activeTab === 'storage' && <StorageSection />}
            {activeTab === 'export' && <ExportSection />}
            {activeTab === 'security' && <SecuritySection />}
          </div>
        </div>
      </div>
    </div>
  )
}
