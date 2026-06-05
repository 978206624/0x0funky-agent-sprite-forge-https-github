import type { CodexHealth } from '../shared/types'

export interface ForgeApi {
  codex: {
    /** 检测本机 codex 安装与登录状态 */
    detect: () => Promise<CodexHealth>
  }
  // 后续 Phase 扩展：skills、db、generation、chat、settings
}

declare global {
  interface Window {
    api: ForgeApi
  }
}
