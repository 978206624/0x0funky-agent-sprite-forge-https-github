import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown } from 'lucide-react'
import { useClickOutside } from '../../hooks/use-click-outside'

/** 弹层最大高度（px），与 max-h-64 一致；用于向下/向上空间估算。 */
const MENU_MAX_H = 256
/** 单项估算高度（px），用于打开方向判断。 */
const OPT_H = 32

/** 下拉选项。sublabel 承载次要信息（如「帧数·R×C」）；disabled 项不可选、键盘跳过。 */
export interface SelectOption {
  value: string
  label: string
  sublabel?: string
  disabled?: boolean
}

interface SelectProps {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  disabled?: boolean
  placeholder?: string
  className?: string
  ariaLabel?: string
}

/**
 * 自定义下拉（非原生 `<select>`）：自绘弹层 + 键盘可达 + 选项副标题/禁用项。
 * 弹层经 createPortal 渲染到 body 并 fixed 定位，避开父容器 overflow 裁切与 z-index 层叠
 * （设置页覆盖层为 z-50，弹层用 z-[60]）。打开时按触发按钮位置定位；滚动/缩放即关闭。
 */
export function Select({
  value,
  onChange,
  options,
  disabled = false,
  placeholder = '请选择',
  className = '',
  ariaLabel
}: SelectProps) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [pos, setPos] = useState<{
    top: number
    left: number
    width: number
    maxHeight: number
  } | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLUListElement>(null)

  const baseId = useId()
  const listboxId = `${baseId}-listbox`
  const optId = (i: number): string => `${baseId}-opt-${i}`

  const selected = options.find((o) => o.value === value)

  const close = useCallback(() => setOpen(false), [])
  const outsideRefs = useMemo(() => [triggerRef, menuRef], [])
  useClickOutside(outsideRefs, close, open)

  const firstEnabled = (): number => options.findIndex((o) => !o.disabled)

  const openMenu = (): void => {
    if (disabled) return
    const rect = triggerRef.current?.getBoundingClientRect()
    if (rect) {
      // 碰撞检测：下方空间不足且上方更宽裕 → 向上弹出（dropup），避免被视口底裁切。
      const estHeight = Math.min(MENU_MAX_H, options.length * OPT_H + 8)
      const below = window.innerHeight - rect.bottom
      const above = rect.top
      const up = below < estHeight && above > below
      const maxHeight = Math.min(MENU_MAX_H, Math.max(below, above) - 8)
      setPos({
        left: rect.left,
        width: rect.width,
        top: up ? Math.max(4, rect.top - estHeight - 4) : rect.bottom + 4,
        maxHeight
      })
    }
    const cur = options.findIndex((o) => o.value === value)
    setActive(cur >= 0 && !options[cur].disabled ? cur : firstEnabled())
    setOpen(true)
  }

  // 打开期间：外部滚动 / 缩放即关闭（fixed 定位不跟随，关闭比错位更稳）。
  // 但**菜单内部滚动**（长列表）要豁免，否则一滚就关。
  useEffect(() => {
    if (!open) return
    const onScroll = (e: Event): void => {
      const t = e.target as Node | null
      if (t && menuRef.current?.contains(t)) return // 菜单内滚动，忽略
      setOpen(false)
    }
    const onResize = (): void => setOpen(false)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onResize)
    }
  }, [open])

  // active 变化时把高亮项滚入可视区（键盘导航长列表反馈）。
  useEffect(() => {
    if (!open || active < 0) return
    document.getElementById(optId(active))?.scrollIntoView({ block: 'nearest' })
    // optId 依赖 baseId（稳定）；active/open 变化时触发即可。
  }, [open, active]) // eslint-disable-line react-hooks/exhaustive-deps

  const commit = (i: number): void => {
    const o = options[i]
    if (!o || o.disabled) return
    onChange(o.value)
    setOpen(false)
    triggerRef.current?.focus()
  }

  const moveActive = (dir: 1 | -1): void => {
    setActive((prev) => {
      const L = options.length
      if (L === 0) return -1
      // 未选态(-1)起步：↓ 落第一个、↑ 落最后一个（避免 (-1-1+L)%L 跳过末项）。
      let i = prev === -1 ? (dir === 1 ? -1 : 0) : prev
      for (let n = 0; n < L; n++) {
        i = (i + dir + L) % L
        if (!options[i]?.disabled) return i
      }
      return prev
    })
  }

  const edgeActive = (toEnd: boolean): void => {
    if (toEnd) {
      for (let i = options.length - 1; i >= 0; i--) {
        if (!options[i].disabled) {
          setActive(i)
          return
        }
      }
    } else {
      const f = firstEnabled()
      if (f >= 0) setActive(f)
    }
  }

  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (disabled) return
    if (!open) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault()
        openMenu()
      }
      return
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        moveActive(1)
        break
      case 'ArrowUp':
        e.preventDefault()
        moveActive(-1)
        break
      case 'Home':
        e.preventDefault()
        edgeActive(false)
        break
      case 'End':
        e.preventDefault()
        edgeActive(true)
        break
      case 'Enter':
      case ' ':
        e.preventDefault()
        commit(active)
        break
      case 'Escape':
        e.preventDefault()
        setOpen(false)
        triggerRef.current?.focus()
        break
      case 'Tab':
        setOpen(false)
        break
    }
  }

  return (
    <div className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-activedescendant={open && active >= 0 ? optId(active) : undefined}
        aria-label={ariaLabel}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={onKeyDown}
        className="flex w-full items-center justify-between gap-2 rounded-sm border border-edge bg-elevated py-2 pl-3 pr-2 text-[13px] text-fg outline-none focus:border-accent disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className="flex min-w-0 items-baseline gap-1.5 truncate">
          {selected ? (
            <>
              <span className="truncate">{selected.label}</span>
              {selected.sublabel && (
                <span className="shrink-0 text-[11px] text-fg-dim">{selected.sublabel}</span>
              )}
            </>
          ) : (
            <span className="text-fg-dim">{placeholder}</span>
          )}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-fg-soft" />
      </button>

      {open &&
        pos &&
        createPortal(
          <ul
            ref={menuRef}
            id={listboxId}
            role="listbox"
            aria-label={ariaLabel}
            style={{
              position: 'fixed',
              top: pos.top,
              left: pos.left,
              width: pos.width,
              maxHeight: pos.maxHeight
            }}
            className="z-[60] overflow-auto rounded-md border border-edge bg-panel py-1 shadow-xl"
          >
            {options.map((o, i) => {
              const isSelected = o.value === value
              const isActive = i === active
              return (
                <li
                  key={o.value}
                  id={optId(i)}
                  role="option"
                  aria-selected={isSelected}
                  aria-disabled={o.disabled}
                  onMouseEnter={() => !o.disabled && setActive(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => commit(i)}
                  className={`flex items-baseline justify-between gap-2 px-3 py-1.5 text-[13px] ${
                    o.disabled
                      ? 'cursor-not-allowed text-fg-dim opacity-50'
                      : isActive
                        ? 'cursor-pointer bg-hover'
                        : 'cursor-pointer'
                  } ${isSelected ? 'text-accent' : o.disabled ? '' : 'text-fg-soft'}`}
                >
                  <span className="truncate">{o.label}</span>
                  {o.sublabel && (
                    <span className="shrink-0 text-[11px] text-fg-dim">{o.sublabel}</span>
                  )}
                </li>
              )
            })}
          </ul>,
          document.body
        )}
    </div>
  )
}
