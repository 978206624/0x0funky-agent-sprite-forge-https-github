import { useEffect, type RefObject } from 'react'

/**
 * 点击/触摸发生在所有给定元素之外时触发 handler。
 * 支持多个 ref（如下拉的触发按钮 + portal 弹层分处两棵 DOM 子树），任一命中即视为"内部"。
 * enabled=false 时不挂监听（如弹层未打开时无需检测）。
 */
export function useClickOutside(
  refs: ReadonlyArray<RefObject<HTMLElement | null>>,
  handler: () => void,
  enabled = true
): void {
  useEffect(() => {
    if (!enabled) return
    const onPointerDown = (e: PointerEvent): void => {
      const target = e.target as Node | null
      if (!target) return
      for (const ref of refs) {
        if (ref.current && ref.current.contains(target)) return // 命中内部，忽略
      }
      handler()
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => document.removeEventListener('pointerdown', onPointerDown, true)
    // refs 为稳定的 ref 对象数组（调用方用 useRef 创建），handler 由调用方保证稳定/可接受重挂。
  }, [refs, handler, enabled])
}
