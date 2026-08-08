import { useEffect, useState } from 'react'
import { useSettingsStore, SETTINGS_KEYS } from '../../../store/settings-store'
import { SETTING_TRUE } from '@shared/settings-keys'
import { Toggle } from '../../ui/toggle'
import { TextInput } from '../../ui/text-input'
import { SettingSection, Field } from './field'
import type { ExportAdapterInfo } from '@shared/types'

/** 设置页 Export tab：已安装 adapter 列表 + 全局导出选项（F6 设计稿）。 */
export function ExportSection() {
  const settingGet = useSettingsStore((s) => s.get)
  const settingSet = useSettingsStore((s) => s.set)

  // ---- adapter 列表 ----
  const [adapters, setAdapters] = useState<ExportAdapterInfo[]>([])
  const [listLoading, setListLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setListLoading(true)
      setListError(null)
      try {
        const list = await window.api.export.listAdapters()
        if (!cancelled) setAdapters(list)
      } catch (e) {
        if (!cancelled) setListError(e instanceof Error ? e.message : '加载 adapter 失败')
      } finally {
        if (!cancelled) setListLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // ---- 全局选项 ----
  const destPath = settingGet(SETTINGS_KEYS.exportDefaultDest)
  const includePreview = settingGet(SETTINGS_KEYS.exportIncludePreview) === SETTING_TRUE

  return (
    <div className="flex flex-col gap-4">
      {/* ======== Adapter 列表 ======== */}
      <SettingSection title="已安装 Adapter">
        {listLoading && (
          <p className="py-2 text-[13px] text-fg-dim">加载中...</p>
        )}

        {listError && (
          <p className="py-2 text-[13px] text-error">{listError}</p>
        )}

        {!listLoading && !listError && adapters.length === 0 && (
          <p className="py-2 text-[13px] text-fg-dim">暂无可用 Adapter</p>
        )}

        {!listLoading &&
          !listError &&
          adapters.map((adapter) => {
            const enabled =
              settingGet(SETTINGS_KEYS.exportGodotEnabled) === SETTING_TRUE

            return (
              <div
                key={adapter.id}
                className="flex items-center gap-4 rounded-md border border-edge bg-elevated px-4 py-3"
              >
                {/* logo 占位 */}
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-sm bg-accent text-[13px] font-bold text-white">
                  {adapter.displayName.charAt(0).toUpperCase()}
                </div>

                {/* info */}
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-[14px] font-semibold text-fg">
                    {adapter.displayName}
                  </span>
                  <span className="text-[12px] text-fg-dim">
                    {adapter.description}
                  </span>
                  <span className="inline-flex items-center gap-1.5 pt-0.5">
                    <span className="font-mono text-[11px] text-fg-soft">
                      {adapter.version}
                    </span>
                    {enabled && (
                      <span className="rounded-[3px] bg-accent px-1.5 py-px font-mono text-[9px] font-semibold text-white">
                        ENABLED
                      </span>
                    )}
                  </span>
                </div>

                {/* ctrl */}
                <div className="flex shrink-0 items-center gap-3">
                  <Toggle
                    checked={enabled}
                    onChange={(next) =>
                      void settingSet(
                        SETTINGS_KEYS.exportGodotEnabled,
                        next ? SETTING_TRUE : 'false'
                      )
                    }
                  />
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-sm bg-elevated px-3 py-1.5 text-[12px] text-fg-dim hover:bg-hover hover:text-fg"
                  >
                    <svg
                      className="h-3 w-3"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" />
                      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
                    </svg>
                    配置
                  </button>
                </div>
              </div>
            )
          })}
      </SettingSection>

      {/* ======== 全局导出选项 ======== */}
      <SettingSection title="全局导出选项">
        <Field label="默认输出路径" hint="导出文件的目标目录，留空则每次导出时选择">
          <TextInput
            value={destPath}
            placeholder="~/Documents/GameFoundry/exports/"
            onChange={(e) =>
              void settingSet(SETTINGS_KEYS.exportDefaultDest, e.target.value)
            }
            className="w-56 font-mono text-[12px]"
          />
        </Field>

        <Field label="包含预览图" hint="导出时是否附带预览缩略图">
          <Toggle
            checked={includePreview}
            onChange={(next) =>
              void settingSet(
                SETTINGS_KEYS.exportIncludePreview,
                next ? SETTING_TRUE : 'false'
              )
            }
          />
        </Field>
      </SettingSection>
    </div>
  )
}
