import { Box, Folder, PanelRightClose, PanelRightOpen } from 'lucide-react'
import { useEffect } from 'react'
import { useSettingsStore, SETTINGS_KEYS } from '../../store/settings-store'
import { SETTINGS_DEFAULTS } from '@shared/settings-keys'
import { useProjectStore } from '../../store/project-store'
import { useLayoutStore } from '../../store/layout-store'

export function TopBar() {
  const values = useSettingsStore((s) => s.values)
  const load = useSettingsStore((s) => s.load)
  const current = useProjectStore((s) => s.current)
  const chatOpen = useLayoutStore((s) => s.chatOpen)
  const toggleChat = useLayoutStore((s) => s.toggleChat)

  // 启动加载一次设置，让徽标反映真实生成默认值（而非硬编码）。
  useEffect(() => {
    if (!values) void load()
  }, [values, load])

  const model = values?.[SETTINGS_KEYS.genModel]?.trim() || 'Codex 默认'
  const sandbox = values?.[SETTINGS_KEYS.genSandbox]?.trim() || SETTINGS_DEFAULTS[SETTINGS_KEYS.genSandbox]

  return (
    <header className="flex h-11 shrink-0 items-center justify-between border-b border-edge bg-panel px-4">
      <div className="flex min-w-0 items-center gap-2">
        <Box className="h-[18px] w-[18px] shrink-0 text-accent" />
        <span className="shrink-0 text-sm font-semibold text-fg">Game Asset Forge</span>
        {/* 当前项目状态（由原左栏概览列迁入顶部栏） */}
        {current && (
          <>
            <span className="h-4 w-px shrink-0 bg-edge" />
            <Folder className="h-3.5 w-3.5 shrink-0 text-fg-dim" />
            <span className="truncate text-[13px] text-fg-soft" title={current.absPath}>
              {current.name}
            </span>
          </>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span
          className="font-mono text-xs text-fg-dim"
          title="生成默认值（设置页可改）；danger 沙箱在未授权时会被自动降级"
        >
          {model} · {sandbox}
        </span>
        <div className="h-5 w-px bg-edge" />
        <button
          type="button"
          onClick={toggleChat}
          title={chatOpen ? '收起对话面板' : '展开对话面板'}
          className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
            chatOpen
              ? 'bg-accent-soft text-accent'
              : 'text-fg-dim hover:bg-hover hover:text-fg'
          }`}
        >
          {chatOpen ? (
            <PanelRightClose className="h-[15px] w-[15px]" />
          ) : (
            <PanelRightOpen className="h-[15px] w-[15px]" />
          )}
        </button>
      </div>
    </header>
  )
}
