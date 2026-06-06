import { create } from 'zustand'

// 右侧对话面板的开关 + 宽度，及左栏活动栏 tab/折叠。均为 renderer-only UI 状态，
// 持久化到 localStorage（非业务数据，不走主进程 settings）；宽度做 clamp 防极端值。
const WIDTH_KEY = 'layout.chatWidth'
const OPEN_KEY = 'layout.chatOpen'
const LEFT_TAB_KEY = 'layout.leftTab'
const RIGHT_TAB_KEY = 'layout.rightTab'
const MIN_WIDTH = 300
const MAX_WIDTH = 600
const DEFAULT_WIDTH = 360

/** 左栏活动栏的可选 tab（切换的是整个中间主区，不是侧栏）。 */
export type LeftTab = 'workbench' | 'history'

/** 右侧停靠面板的可选 tab（对话 / 生成日志）。 */
export type RightTab = 'chat' | 'log'

function loadLeftTab(): LeftTab {
  return localStorage.getItem(LEFT_TAB_KEY) === 'history' ? 'history' : 'workbench'
}

function loadRightTab(): RightTab {
  return localStorage.getItem(RIGHT_TAB_KEY) === 'log' ? 'log' : 'chat'
}

function clampWidth(w: number): number {
  return Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, Math.round(w)))
}

function loadWidth(): number {
  const raw = Number(localStorage.getItem(WIDTH_KEY))
  return Number.isFinite(raw) && raw > 0 ? clampWidth(raw) : DEFAULT_WIDTH
}

function loadOpen(): boolean {
  // 缺省（首次启动）默认打开；显式存过 '0' 才关闭。
  return localStorage.getItem(OPEN_KEY) !== '0'
}

interface LayoutState {
  /** 右侧对话面板是否展开。 */
  chatOpen: boolean
  /** 右侧对话面板宽度（px，已 clamp 到 [300, 600]）。 */
  chatWidth: number
  toggleChat: () => void
  setChatOpen: (open: boolean) => void
  setChatWidth: (w: number) => void

  /** 左栏活动栏当前选中 tab（决定中间主区显示工作台还是产出历史）。 */
  leftTab: LeftTab
  setLeftTab: (tab: LeftTab) => void

  /** 右侧停靠面板当前选中 tab（对话 / 生成日志）。 */
  rightTab: RightTab
  setRightTab: (tab: RightTab) => void
}

export const CHAT_MIN_WIDTH = MIN_WIDTH
export const CHAT_MAX_WIDTH = MAX_WIDTH

export const useLayoutStore = create<LayoutState>((set) => ({
  chatOpen: loadOpen(),
  chatWidth: loadWidth(),
  toggleChat: () =>
    set((s) => {
      const chatOpen = !s.chatOpen
      localStorage.setItem(OPEN_KEY, chatOpen ? '1' : '0')
      return { chatOpen }
    }),
  setChatOpen: (chatOpen) => {
    localStorage.setItem(OPEN_KEY, chatOpen ? '1' : '0')
    set({ chatOpen })
  },
  setChatWidth: (w) => {
    const chatWidth = clampWidth(w)
    localStorage.setItem(WIDTH_KEY, String(chatWidth))
    set({ chatWidth })
  },

  leftTab: loadLeftTab(),
  setLeftTab: (leftTab) => {
    localStorage.setItem(LEFT_TAB_KEY, leftTab)
    set({ leftTab })
  },

  rightTab: loadRightTab(),
  setRightTab: (rightTab) => {
    localStorage.setItem(RIGHT_TAB_KEY, rightTab)
    set({ rightTab })
  }
}))
