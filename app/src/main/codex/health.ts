import type { CodexHealth } from '../../shared/types'
import { resolveCodexPath } from './resolver'
import { captureCodex } from './run'

function parseVersion(text: string): string | null {
  const m = text.match(/(\d+\.\d+\.\d+)/)
  return m ? m[1] : null
}

// "Logged in using ChatGPT" → "ChatGPT"
function parseLoginMethod(text: string): string | null {
  const m = text.match(/using\s+(.+?)\s*$/im)
  return m ? m[1].trim() : null
}

/**
 * 检测本机 codex 安装与登录状态。
 * - installed/version：`codex --version`
 * - loggedIn/loginMethod：`codex login status`
 */
export async function detectCodex(): Promise<CodexHealth> {
  const binPath = await resolveCodexPath()
  if (!binPath) {
    return {
      installed: false,
      binPath: null,
      version: null,
      loggedIn: false,
      loginMethod: null,
      error: '未在 CODEX_BIN 或 PATH 中找到 codex 可执行文件'
    }
  }

  const ver = await captureCodex(binPath, ['--version'])
  const versionText = `${ver.stdout}${ver.stderr}`
  const version = parseVersion(versionText)
  if (ver.code !== 0) {
    return {
      installed: false,
      binPath,
      version,
      loggedIn: false,
      loginMethod: null,
      error: ver.timedOut ? 'codex --version 超时' : versionText.trim() || 'codex --version 执行失败'
    }
  }

  const login = await captureCodex(binPath, ['login', 'status'])
  const loginText = `${login.stdout}${login.stderr}`.trim()
  const loggedIn = login.code === 0 && /logged in/i.test(loginText)

  return {
    installed: true,
    binPath,
    version,
    loggedIn,
    loginMethod: loggedIn ? parseLoginMethod(loginText) : null,
    error: loggedIn ? null : loginText || '未登录'
  }
}
