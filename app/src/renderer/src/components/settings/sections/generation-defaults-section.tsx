import { useEffect, useState } from 'react'
import { useSettingsStore, SETTINGS_KEYS } from '../../../store/settings-store'
import { EFFORTS, SANDBOX_MODES, SETTING_TRUE } from '@shared/settings-keys'
import { Select } from '../../ui/select'
import { TextInput } from '../../ui/text-input'
import { SettingSection, Field } from './field'

/** ④生成默认值：model / effort / sandbox（danger 仅在安全设置开启时可选）。 */
export function GenerationDefaultsSection() {
  const settingGet = useSettingsStore((s) => s.get)
  const settingSet = useSettingsStore((s) => s.set)
  const allowDanger = settingGet(SETTINGS_KEYS.allowDanger) === SETTING_TRUE
  const storedModel = useSettingsStore((s) => s.values?.[SETTINGS_KEYS.genModel] ?? '')
  const [model, setModel] = useState(storedModel)
  useEffect(() => setModel(storedModel), [storedModel])

  // sandbox 选项：danger 仅在 allowDanger 开时出现（UI 第一道防线，主进程 clamp 是兜底）。
  const sandboxOptions = SANDBOX_MODES.filter((m) => m !== 'danger-full-access' || allowDanger)
  const sandboxValue = settingGet(SETTINGS_KEYS.genSandbox)

  return (
    <SettingSection title="生成默认值">
      <Field label="模型" hint="codex --model；留空用 codex 自身默认">
        <TextInput
          value={model}
          placeholder="如 gpt-5-codex"
          onChange={(e) => setModel(e.target.value)}
          onBlur={() => void settingSet(SETTINGS_KEYS.genModel, model.trim())}
          className="w-44 font-mono text-[12px]"
        />
      </Field>

      <Field label="Reasoning effort" hint="model_reasoning_effort；默认用 codex 推断">
        <div className="w-44">
          <Select
            ariaLabel="Reasoning effort"
            value={settingGet(SETTINGS_KEYS.genEffort)}
            onChange={(v) => void settingSet(SETTINGS_KEYS.genEffort, v)}
            options={[
              { value: '', label: '默认（codex 自身）' },
              ...EFFORTS.map((ef) => ({ value: ef, label: ef }))
            ]}
          />
        </div>
      </Field>

      <Field label="Sandbox 模式" hint="codex 执行沙箱；danger 需先在「安全」开启">
        <div className="w-44">
          <Select
            ariaLabel="Sandbox 模式"
            value={sandboxValue}
            onChange={(v) => void settingSet(SETTINGS_KEYS.genSandbox, v)}
            options={sandboxOptions.map((m) => ({ value: m, label: m }))}
          />
        </div>
      </Field>
    </SettingSection>
  )
}
