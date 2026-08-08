import type { PreviewData } from '../hooks/use-preview'

/** 多 tab 预览器 tab id 联合类型（v3.0 P1）。单一事实源：渲染层 UI、PreviewTabs 路由、settings 持久化都引用这里。 */
export type PreviewTabId = 'sheet' | 'frames' | 'gif' | 'spine' | 'plist' | 'tscn'

/** tab 列表配置（顺序 = UI 展示顺序）。label 给 SegmentedControl，description 给 placeholder。 */
export interface PreviewTabDef {
  id: PreviewTabId
  label: string
  /** 占位文案（资源缺失时显示）。 */
  placeholder: string
}

export const PREVIEW_TABS: readonly PreviewTabDef[] = [
  { id: 'sheet', label: 'Sheet', placeholder: '暂无可用 sheet 资源' },
  { id: 'frames', label: 'Frames', placeholder: '暂无可用帧资源' },
  { id: 'gif', label: 'GIF', placeholder: '暂无可用 GIF 资源' },
  { id: 'spine', label: 'Spine', placeholder: '暂无可用 spine 资源（需 .json/.skel + .atlas）' },
  { id: 'plist', label: 'Cocos plist', placeholder: '暂无可用 plist 资源（需 .plist + 大图）' },
  { id: 'tscn', label: 'Godot .tscn', placeholder: '暂无可用 .tscn 资源（需 .tscn + texture）' }
] as const

/** settings KV 键（v3.0 P1 持久化当前激活 tab）。 */
export const PREVIEW_ACTIVE_TAB_KEY = 'preview:activeTab'

/**
 * 防御性类型守卫：外部输入（settings 反序列化、URL hash、未来 query string）收敛到合法 tab id。
 * 非合法值回退到 'sheet'。供 IPC 边界 + Zustand 初始化用。
 */
export function toPreviewTabId(v: unknown): PreviewTabId {
  return PREVIEW_TABS.some((t) => t.id === v) ? (v as PreviewTabId) : 'sheet'
}

/**
 * 把 PreviewData 拼成对应 tab 需要的资源路径。
 * sheet/frames/gif 由 PreviewData 给出；spine/plist/tscn 按约定 slug 文件名规则拼接。
 * 约定：spine → <slug>.json 或 <slug>.skel + <slug>.atlas + <slug>.png
 *      plist → <slug>.plist + <slug>.png（同大图）
 *      tscn  → <slug>.tscn + <slug>.png
 * 实际资源是否存在由各自预览器按需 fetch 探测（404 → placeholder）。
 */
export interface PreviewPaths {
  sheetUrl: string
  frameUrls: string[]
  gifUrl: string
  spine: { jsonOrSkelUrl: string; atlasUrl: string; pngUrl: string }
  plist: { plistUrl: string; pngUrl: string }
  tscn: { tscnUrl: string; pngUrl: string }
}

function enc(s: string): string {
  return encodeURIComponent(s)
}

export function buildPreviewPaths(preview: PreviewData): PreviewPaths {
  const base = `asset://sprites/${enc(preview.slug)}`
  return {
    sheetUrl: preview.sheetUrl,
    frameUrls: preview.frameUrls,
    gifUrl: preview.gifUrl,
    spine: {
      jsonOrSkelUrl: `${base}/${enc(preview.slug)}.json`,
      atlasUrl: `${base}/${enc(preview.slug)}.atlas`,
      pngUrl: `${base}/${enc(preview.slug)}.png`
    },
    plist: {
      plistUrl: `${base}/${enc(preview.slug)}.plist`,
      pngUrl: preview.sheetUrl // plist 大图复用 sheet
    },
    tscn: {
      tscnUrl: `${base}/${enc(preview.slug)}.tscn`,
      pngUrl: preview.sheetUrl
    }
  }
}