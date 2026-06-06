import { create } from 'zustand'
import type { AppSettings } from '@shared/types'
import { SETTINGS_KEYS, SETTINGS_DEFAULTS, type SettingsKey } from '@shared/settings-keys'

interface SettingsState {
  /** 设置页覆盖层是否打开。 */
  open: boolean
  /** 已加载的全部设置（key-value）；未加载为 null。 */
  values: AppSettings | null
  loading: boolean

  /** 从主进程加载全部设置（打开设置页/启动时调用）。 */
  load: () => Promise<void>
  /** 读单个设置值，回退默认（同步，基于已加载 values）。 */
  get: (key: SettingsKey) => string
  /** 写单个设置：乐观更新 + 持久化到 settings 表。 */
  set: (key: SettingsKey, value: string) => Promise<void>
  openSettings: () => void
  close: () => void
}

/**
 * 设置状态（全局，不随切项目 reset）。`open` 驱动设置页覆盖层导航；
 * values 缓存全部设置，read 回退 SETTINGS_DEFAULTS，与主进程 service 同口径。
 */
export const useSettingsStore = create<SettingsState>((set, get) => ({
  open: false,
  values: null,
  loading: false,

  load: async () => {
    set({ loading: true })
    try {
      const values = await window.api.db.settings.getAll()
      set({ values, loading: false })
    } catch {
      set({ values: {}, loading: false })
    }
  },

  get: (key) => {
    const v = get().values?.[key]
    return v !== undefined ? v : SETTINGS_DEFAULTS[key]
  },

  set: async (key, value) => {
    // 乐观更新本地缓存，失败仅回滚该 key（函数式更新，避免回滚整快照抹掉并发成功写入的其它字段）。
    const prevForKey = get().values?.[key]
    set((s) => ({ values: { ...s.values, [key]: value } }))
    try {
      await window.api.db.settings.set(key, value)
    } catch {
      set((s) => {
        const next = { ...s.values }
        if (prevForKey === undefined) delete next[key]
        else next[key] = prevForKey
        return { values: next }
      })
    }
  },

  openSettings: () => {
    void get().load()
    set({ open: true })
  },
  close: () => set({ open: false })
}))

export { SETTINGS_KEYS }
