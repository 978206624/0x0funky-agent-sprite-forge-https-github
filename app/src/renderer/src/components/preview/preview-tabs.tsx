import { useEffect, useState } from 'react'
import { SegmentedControl } from '../ui/segmented-control'
import { usePreview } from '../../hooks/use-preview'
import { PREVIEW_TABS, PREVIEW_ACTIVE_TAB_KEY, toPreviewTabId } from '../../lib/preview-tabs'
import type { PreviewTabId } from '../../lib/preview-tabs'
import { SheetPreview } from './sheet-preview'
import { FramesPreview } from './frames-preview'
import { GifPreview } from './gif-preview'
import { PlistPreview } from './plist-preview'
import { SpinePreview } from './spine-preview'
import { TscnPreview } from './tscn-preview'

/**
 * 多 tab 预览器容器（v3.0 P1）：6 个 tab 切换，激活 tab 高亮（accent 紫），
 * 切换时懒挂载预览器（已访问过的 tab 保留 component instance，未访问的不渲染 → 真正懒加载）。
 * 当前激活 tab 写 settings KV（key: preview:activeTab），下次启动恢复。
 *
 * 设计决策：
 *   - 沿用 SegmentedControl 而不是新建 tab UI 组件（避免重复实现同一组件）
 *   - tab 内容用条件渲染而不是 router（无路由需求，6 个固定 tab）
 *   - 懒加载：useState 缓存「是否访问过」，已访问的 tab 始终挂载（canvas RAF / 解析结果不丢），
 *     未访问的 tab 根本不渲染（useEffect 都不会跑，避免 spine canvas 一启动就 fetch 资源）。
 */
export function PreviewTabs() {
  const preview = usePreview()
  const [active, setActive] = useState<PreviewTabId>('sheet')
  // 已挂载的 tab 集合：用于切换时不卸载已访问的，保留其内部 state（canvas ref / RAF / 解析结果）。
  const [mounted, setMounted] = useState<Set<PreviewTabId>>(new Set(['sheet']))
  // settings 恢复闸门：仅在启动时执行一次；恢复完成前 slug-reset 静默，避免覆盖。
  const [restored, setRestored] = useState(false)

  // 启动时从 settings 恢复上次激活 tab（settings KV 唯一来源：window.api.db.settings）。
  useEffect(() => {
    void window.api.db.settings
      .get(PREVIEW_ACTIVE_TAB_KEY)
      .then((v) => {
        if (v !== null) {
          const next = toPreviewTabId(v)
          setActive(next)
          setMounted((prev) => {
            if (prev.has(next)) return prev
            const s = new Set(prev)
            s.add(next)
            return s
          })
        }
      })
      .catch(() => {
        // settings 不可用 → 保持默认 'sheet'，不阻塞 UI
      })
      .finally(() => setRestored(true))
  }, [])

  // 切换选中产出（历史卡片 F2 点击 → 应用到工作台）：plan 验收要求默认进 Sheet tab。
  // 仅响应用户触发的选中切换（preview.slug 变化），不响应启动恢复流程——
  // settings 恢复的激活 tab 由上面恢复 effect 独占写入，避免相互覆盖（恢复完成后 slug 未变，
  // 本 effect 不触发；真正切换产出时 slug 变化才回 Sheet）。
  useEffect(() => {
    if (!restored) return
    setActive('sheet')
    setMounted(new Set(['sheet']))
    void window.api.db.settings.set(PREVIEW_ACTIVE_TAB_KEY, 'sheet').catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview?.slug])

  // 切换 tab 时挂载 + 持久化。失败也不回滚（settings IO 偶尔失败可容忍）。
  const onChange = (next: PreviewTabId): void => {
    setActive(next)
    setMounted((prev) => {
      if (prev.has(next)) return prev
      const s = new Set(prev)
      s.add(next)
      return s
    })
    void window.api.db.settings.set(PREVIEW_ACTIVE_TAB_KEY, next).catch(() => {})
  }

  if (!preview) return null

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-edge bg-base px-4">
        <SegmentedControl
          options={PREVIEW_TABS.map((t) => ({ value: t.id, label: t.label }))}
          value={active}
          onChange={onChange}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-6">
        <TabBody active={active} mounted={mounted} preview={preview} />
      </div>
    </div>
  )
}

/**
 * tab 内容区。已 mounted 的 tab 都渲染在 DOM（React 保留 component instance，不卸载 →
 * 不丢 canvas RAF / 解析结果），非 active 用 inline `display: none` 视觉隐藏。
 * 未 mounted 的 tab 完全不渲染（首次切到该 tab 时才走 fetch/parse/canvas 初始化 → 真正懒加载）。
 *
 * 不卸载已 mounted tab 是 plan 验收项「切换 tab 不重新拉取资源」的关键：spine canvas 的 RAF、
 * plist/tscn 的 fetch + 解析结果都依赖组件实例持续挂载；unmount 会触发 cleanup → 再切换时
 * 重新跑一遍 init。
 */
function TabBody({
  active,
  mounted,
  preview
}: {
  active: PreviewTabId
  mounted: Set<PreviewTabId>
  preview: NonNullable<ReturnType<typeof usePreview>>
}) {
  const cellStyle = (id: PreviewTabId): React.CSSProperties =>
    active === id ? {} : { display: 'none' }
  return (
    <div className="flex flex-col items-center">
      {mounted.has('sheet') && (
        <div style={cellStyle('sheet')}>
          <SheetPreview preview={preview} />
        </div>
      )}
      {mounted.has('frames') && (
        <div style={cellStyle('frames')}>
          <FramesPreview preview={preview} />
        </div>
      )}
      {mounted.has('gif') && (
        <div style={cellStyle('gif')}>
          <GifPreview preview={preview} />
        </div>
      )}
      {mounted.has('spine') && (
        <div style={cellStyle('spine')}>
          <SpinePreview preview={preview} />
        </div>
      )}
      {mounted.has('plist') && (
        <div style={cellStyle('plist')}>
          <PlistPreview preview={preview} />
        </div>
      )}
      {mounted.has('tscn') && (
        <div style={cellStyle('tscn')}>
          <TscnPreview preview={preview} />
        </div>
      )}
    </div>
  )
}