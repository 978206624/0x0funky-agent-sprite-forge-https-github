import type { ExportAdapterInfo } from '../../../shared/types'
import { SETTING_TRUE } from '../../../shared/settings-keys'
import type { IExportAdapter } from './IExportAdapter'
import { Godot4Adapter } from './godot/Godot4Adapter'

/**
 * 导出适配器注册表。
 * 静态初始化时注册所有内置 adapter；运行期只读。
 */
class AdapterRegistry {
  private readonly byId = new Map<string, IExportAdapter>()

  /** 注册 adapter；同 id 覆盖（后注册胜出）。 */
  register(adapter: IExportAdapter): void {
    this.byId.set(adapter.id, adapter)
  }

  /** 按 id 获取 adapter；不存在返回 null。 */
  get(id: string): IExportAdapter | null {
    return this.byId.get(id) ?? null
  }

  /** 只读快照（供渲染层 listAdapters / 展示用）。
   *  enabled 字段由调用方根据 settings 表解析注入，此处仅提供 id。 */
  list(): ExportAdapterInfo[] {
    return Array.from(this.byId.values()).map((a) => ({
      id: a.id,
      displayName: a.displayName,
      version: a.version,
      description: a.description,
      enabled: true
    }))
  }

  /** 按 settings 解析 enabled 的快照版本（供需要 enabled 的场景）。 */
  listWithSettings(getSetting: (key: string) => string | undefined): ExportAdapterInfo[] {
    return Array.from(this.byId.values()).map((a) => {
      const key = `export.${a.id}_enabled`
      const raw = getSetting(key)
      const enabled = raw === undefined || raw === SETTING_TRUE
      return {
        id: a.id,
        displayName: a.displayName,
        version: a.version,
        description: a.description,
        enabled
      }
    })
  }
}

/** 全局单例 */
export const adapterRegistry = new AdapterRegistry()

// 静态初始化：注册内置 adapter
adapterRegistry.register(new Godot4Adapter())
