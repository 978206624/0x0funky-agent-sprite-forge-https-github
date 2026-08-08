import type { SpriteAssetSource, AdapterExportResult, ValidationReport } from '../../../shared/types'

/** 导出选项（adapter 各自扩展，泛型 T 约定）。 */
export interface ExportOptions<T = unknown> {
  /** 用户选定的导出根目录（可在项目外）。 */
  destRoot: string
  /** adapter 特有选项。 */
  opts: T
}

/** 导出 adapter 契约：一次产出 → 目标引擎可用的资源包。 */
export interface IExportAdapter<T = unknown> {
  id: string
  displayName: string
  version: string
  description: string
  /** 校验产物可导出性（缺失帧/尺寸错误等）。不写文件。 */
  validate(source: SpriteAssetSource): ValidationReport
  /** 把产物导出到 destRoot（adapter 各自建子目录/文件）。 */
  export(source: SpriteAssetSource, options: ExportOptions<T>): Promise<AdapterExportResult>
}
