import { useEffect, useState } from 'react'
import { RotateCw } from 'lucide-react'
import { useSkillStore } from '../../../store/skill-store'
import { useSettingsStore, SETTINGS_KEYS } from '../../../store/settings-store'
import { TextInput } from '../../ui/text-input'
import { SettingSection, Field } from './field'

/** ③Skill：目录配置 + 重新扫描 + 已识别列表。 */
export function SkillSection() {
  const result = useSkillStore((s) => s.result)
  const loading = useSkillStore((s) => s.loading)
  const scan = useSkillStore((s) => s.scan)
  const settingSet = useSettingsStore((s) => s.set)
  const stored = useSettingsStore((s) => s.values?.[SETTINGS_KEYS.skillsDirOverride] ?? '')
  const [dir, setDir] = useState(stored)
  useEffect(() => setDir(stored), [stored])

  // 改目录后立即持久化并重新扫描（扫描即时反映新目录）。
  const persistDir = (): void => {
    void settingSet(SETTINGS_KEYS.skillsDirOverride, dir.trim()).then(() => scan())
  }

  return (
    <SettingSection title="Skill">
      <Field label="扫描目录" hint={result?.root ?? '~/.codex/skills'}>
        <button
          type="button"
          onClick={() => void scan()}
          className="inline-flex items-center gap-1.5 rounded-md border border-edge bg-elevated px-3 py-1.5 text-xs font-medium text-fg-soft hover:bg-hover hover:text-fg"
        >
          <RotateCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          重新扫描
        </button>
      </Field>

      <Field label="自定义 skill 目录" hint="覆盖 CODEX_SKILLS_DIR / 默认；留空用默认。改后自动重扫">
        <TextInput
          value={dir}
          placeholder="如 C:\\Users\\me\\.codex\\skills"
          onChange={(e) => setDir(e.target.value)}
          onBlur={persistDir}
          className="w-[260px] font-mono text-[11px]"
        />
      </Field>

      <div className="flex flex-col gap-1 pt-1">
        <span className="text-[11px] text-fg-dim">已识别 skill</span>
        <div className="mt-1 flex flex-col gap-1">
          {!result || result.skills.length === 0 ? (
            <span className="py-1 text-[12px] text-fg-dim">
              {result?.error ?? '未发现 skill'}
            </span>
          ) : (
            result.skills.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-2 px-1 py-0.5">
                <span className={`truncate text-[12px] ${s.adapted ? 'text-fg-soft' : 'text-fg-dim'}`}>
                  {s.name}
                </span>
                <span className={`shrink-0 text-[10px] ${s.adapted ? 'text-success' : 'text-fg-dim'}`}>
                  {s.adapted ? '已适配' : '未适配'}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </SettingSection>
  )
}
