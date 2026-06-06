import { useState } from 'react'
import { ShieldAlert } from 'lucide-react'
import { useSettingsStore, SETTINGS_KEYS } from '../../../store/settings-store'
import { SETTING_TRUE } from '@shared/settings-keys'
import { Toggle } from '../../ui/toggle'
import { SettingSection, Field } from './field'

/** ⑥安全：danger-full-access 开关（默认关，开启需二次确认）。 */
export function SecuritySection() {
  const settingGet = useSettingsStore((s) => s.get)
  const settingSet = useSettingsStore((s) => s.set)
  const allowed = settingGet(SETTINGS_KEYS.allowDanger) === SETTING_TRUE
  const [confirming, setConfirming] = useState(false)

  const onToggle = (next: boolean): void => {
    if (next) {
      // 开启 danger 是高风险操作：先二次确认。
      setConfirming(true)
      return
    }
    // 关闭：立即生效，并把默认 sandbox 从 danger 收回到 workspace-write（避免悬空非法默认）。
    void settingSet(SETTINGS_KEYS.allowDanger, 'false')
    if (settingGet(SETTINGS_KEYS.genSandbox) === 'danger-full-access') {
      void settingSet(SETTINGS_KEYS.genSandbox, 'workspace-write')
    }
  }

  const confirmEnable = (): void => {
    void settingSet(SETTINGS_KEYS.allowDanger, SETTING_TRUE)
    setConfirming(false)
  }

  return (
    <SettingSection title="安全">
      <Field
        label="允许 danger-full-access"
        hint="放开 codex 沙箱全权访问。极高风险——codex 可读写项目外任意文件。默认关闭"
      >
        <Toggle checked={allowed} onChange={onToggle} tone="danger" />
      </Field>

      {confirming && (
        <div className="mt-1 flex flex-col gap-2 rounded-md border border-error/40 bg-error/10 p-3">
          <div className="flex items-start gap-2">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-error" />
            <p className="text-[12px] leading-relaxed text-fg-soft">
              开启后，codex 生成时可绕过沙箱读写本机任意文件。仅在你完全信任所跑 skill 时开启。确定继续？
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={confirmEnable}
              className="rounded-md bg-error px-3 py-1.5 text-xs font-medium text-black hover:opacity-90"
            >
              确认开启
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="text-xs text-fg-dim hover:text-fg-soft"
            >
              取消
            </button>
          </div>
        </div>
      )}
    </SettingSection>
  )
}
