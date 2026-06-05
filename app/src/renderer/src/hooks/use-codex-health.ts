import { useCallback, useEffect, useState } from 'react'
import type { CodexHealth } from '@shared/types'

export interface UseCodexHealth {
  health: CodexHealth | null
  loading: boolean
  refresh: () => Promise<void>
}

const IPC_ERROR: CodexHealth = {
  installed: false,
  binPath: null,
  version: null,
  loggedIn: false,
  loginMethod: null,
  error: 'IPC 调用失败，主进程未响应 codex:detect'
}

/** 挂载时检测 codex 健康状态，并提供手动刷新。 */
export function useCodexHealth(): UseCodexHealth {
  const [health, setHealth] = useState<CodexHealth | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      setHealth(await window.api.codex.detect())
    } catch {
      setHealth(IPC_ERROR)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { health, loading, refresh }
}
