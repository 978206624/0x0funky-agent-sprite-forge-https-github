import { PanelRightClose } from 'lucide-react'
import { useEffect, useState } from 'react'
import { ChatPanel } from './chat-panel'
import { LogPanel } from './log-panel'
import { useLayoutStore, type RightTab } from '../../store/layout-store'

const TABS = [
  { key: 'chat', label: '对话' },
  { key: 'log', label: '生成日志' }
] satisfies { key: RightTab; label: string }[]

/**
 * 右栏停靠面板：对话 / 生成日志双 tab 切换。
 * 支持拖拽左缘改宽度（宽度持久化、clamp 到 [300,600]）、点头部按钮收起；
 * 收起后由顶部栏的「展开对话」按钮重新打开。收起态本组件渲染 null。
 * 两 tab 都常挂、用 hidden 切换：保留各自 DOM/滚动态（对话流式、日志滚动都不中断）。
 */
export function RightPanel() {
  const chatOpen = useLayoutStore((s) => s.chatOpen)
  const chatWidth = useLayoutStore((s) => s.chatWidth)
  const setChatWidth = useLayoutStore((s) => s.setChatWidth)
  const toggleChat = useLayoutStore((s) => s.toggleChat)
  const rightTab = useLayoutStore((s) => s.rightTab)
  const setRightTab = useLayoutStore((s) => s.setRightTab)
  const [resizing, setResizing] = useState(false)

  // 拖拽期间挂 window 监听 + 改 body 光标/选区；以 useEffect cleanup 保证
  // 卸载（面板收起返回 null）或拖拽结束时一定清理，不残留监听/全局样式。
  useEffect(() => {
    if (!resizing) return
    const onMove = (ev: MouseEvent): void => setChatWidth(window.innerWidth - ev.clientX)
    const onUp = (): void => setResizing(false)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [resizing, setChatWidth])

  if (!chatOpen) return null

  return (
    <aside
      style={{ width: chatWidth }}
      className="relative flex shrink-0 flex-col border-l border-edge bg-panel"
    >
      {/* 左缘拖拽手柄：悬停/拖拽时高亮。 */}
      <div
        onMouseDown={(e) => {
          e.preventDefault()
          setResizing(true)
        }}
        className="absolute left-0 top-0 z-10 h-full w-1 cursor-col-resize bg-transparent transition-colors hover:bg-accent/50"
      />

      <div className="flex h-12 shrink-0 items-center justify-between border-b border-edge px-2 pl-4">
        <div className="flex items-center gap-4">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setRightTab(key)}
              className={`border-b-2 py-2 text-sm transition-colors ${
                rightTab === key
                  ? 'border-accent font-semibold text-accent'
                  : 'border-transparent font-medium text-fg-soft hover:text-fg'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={toggleChat}
          title="收起面板"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-fg-soft transition-colors hover:bg-hover hover:text-fg"
        >
          <PanelRightClose className="h-4 w-4" />
        </button>
      </div>

      <div className={rightTab === 'chat' ? 'flex min-h-0 flex-1 flex-col' : 'hidden'}>
        <ChatPanel />
      </div>
      <div className={rightTab === 'log' ? 'flex min-h-0 flex-1 flex-col' : 'hidden'}>
        <LogPanel />
      </div>
    </aside>
  )
}
