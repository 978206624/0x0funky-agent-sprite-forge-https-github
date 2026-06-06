import { useEffect, useState } from 'react'
import { RotateCw } from 'lucide-react'
import { useCodexHealth } from '../../../hooks/use-codex-health'
import { useSettingsStore, SETTINGS_KEYS } from '../../../store/settings-store'
import { StatusLight } from '../../ui/status-light'
import { TextInput } from '../../ui/text-input'
import { SettingSection, Field } from './field'

/** ②Codex：路径/版本/登录态 + 重新检测 + CODEX_BIN 自定义路径。 */
export function CodexSection() {
  const { health, loading, refresh } = useCodexHealth()
  const settingSet = useSettingsStore((s) => s.set)
  // 订阅持久值；本地 draft 跟随它（settings 异步 load 完成后回填，避免首开显空）。
  const stored = useSettingsStore((s) => s.values?.[SETTINGS_KEYS.codexBinOverride] ?? '')
  const [bin, setBin] = useState(stored)
  useEffect(() => setBin(stored), [stored])

  const persistBin = (): void => {
    void settingSet(SETTINGS_KEYS.codexBinOverride, bin.trim())
  }

  return (
    <SettingSection title="Codex">
      <Field
        label="状态"
        hint={
          loading
            ? '检测中…'
            : health?.installed
              ? `已安装 ${health.version ?? ''}${health.loggedIn ? ` · 已登录${health.loginMethod ? ` (${health.loginMethod})` : ''}` : ' · 未登录'}`
              : '未检测到 codex'
        }
      >
        <button
          type="button"
          onClick={() => void refresh()}
          className="inline-flex items-center gap-1.5 rounded-md border border-edge bg-elevated px-3 py-1.5 text-xs font-medium text-fg-soft hover:bg-hover hover:text-fg"
        >
          <RotateCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          重新检测
        </button>
      </Field>

      {health?.binPath && (
        <Field label="可执行路径">
          <span className="max-w-[260px] truncate font-mono text-[11px] text-fg-dim" title={health.binPath}>
            {health.binPath}
          </span>
        </Field>
      )}

      {!loading && !health?.loggedIn && (
        <div className="flex items-center gap-2 py-1">
          <StatusLight status="error" label="未登录：请在终端运行 codex login 完成登录后重新检测" />
        </div>
      )}

      <Field label="自定义 codex 路径" hint="覆盖 CODEX_BIN / PATH；留空用默认。改后点「重新检测」生效">
        <TextInput
          value={bin}
          placeholder="如 C:\\path\\to\\codex.cmd"
          onChange={(e) => setBin(e.target.value)}
          onBlur={persistBin}
          className="w-[260px] font-mono text-[11px]"
        />
      </Field>
    </SettingSection>
  )
}
