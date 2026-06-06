import { Box } from 'lucide-react'
import { useEffect } from 'react'
import { useSettingsStore, SETTINGS_KEYS } from '../../store/settings-store'
import { SETTINGS_DEFAULTS } from '@shared/settings-keys'

export function TopBar() {
  const values = useSettingsStore((s) => s.values)
  const load = useSettingsStore((s) => s.load)

  // 启动加载一次设置，让徽标反映真实生成默认值（而非硬编码）。
  useEffect(() => {
    if (!values) void load()
  }, [values, load])

  const model = values?.[SETTINGS_KEYS.genModel]?.trim() || '默认模型'
  const sandbox = values?.[SETTINGS_KEYS.genSandbox]?.trim() || SETTINGS_DEFAULTS[SETTINGS_KEYS.genSandbox]

  return (
    <header className="flex h-11 shrink-0 items-center justify-between border-b border-edge bg-panel px-4">
      <div className="flex items-center gap-2">
        <Box className="h-[18px] w-[18px] text-accent" />
        <span className="text-sm font-semibold text-fg">Game Asset Forge</span>
      </div>
      <span
        className="font-mono text-xs text-fg-dim"
        title="生成默认值（设置页可改）；danger 沙箱在未授权时会被自动降级"
      >
        {model} · {sandbox}
      </span>
    </header>
  )
}
