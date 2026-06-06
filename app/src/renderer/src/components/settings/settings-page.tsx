import { useEffect } from 'react'
import { X } from 'lucide-react'
import { useSettingsStore } from '../../store/settings-store'
import { ProjectSection } from './sections/project-section'
import { CodexSection } from './sections/codex-section'
import { SkillSection } from './sections/skill-section'
import { GenerationDefaultsSection } from './sections/generation-defaults-section'
import { StorageSection } from './sections/storage-section'
import { SecuritySection } from './sections/security-section'

/**
 * 设置页：覆盖在工作台之上的全屏面板（inset-0 z-50 + backdrop + Esc 关）。
 * 不卸载工作台——生成/对话进行中打开设置不中断、日志滚动态不丢。由 settings-store.open 驱动。
 */
export function SettingsPage() {
  const open = useSettingsStore((s) => s.open)
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
        className="mt-10 flex h-[calc(100vh-5rem)] w-[640px] max-w-[92vw] flex-col rounded-t-lg border border-edge bg-panel shadow-2xl"
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

        <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-5 py-5">
          <ProjectSection />
          <CodexSection />
          <SkillSection />
          <GenerationDefaultsSection />
          <StorageSection />
          <SecuritySection />
        </div>
      </div>
    </div>
  )
}
