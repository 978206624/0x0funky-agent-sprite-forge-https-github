// 主进程 ↔ 渲染层共享类型

/** Codex CLI 健康检测结果 */
export interface CodexHealth {
  /** codex 可执行文件是否找到且 `--version` 成功 */
  installed: boolean
  /** 解析到的 codex 可执行文件绝对路径 */
  binPath: string | null
  /** 版本号，如 "0.137.0" */
  version: string | null
  /** 是否已登录（codex login status 成功且输出含 logged in） */
  loggedIn: boolean
  /** 登录方式，如 "ChatGPT" / "API key" */
  loginMethod: string | null
  /** 检测过程中的诊断信息（未安装/未登录/执行失败的原因） */
  error: string | null
}
