import { useEffect } from 'react'
import { useGenerationStore } from '../store/generation-store'

/**
 * 在 App 顶层调用一次：把主进程生成事件流（gen:event / gen:stderr / gen:done）
 * 订阅到 generation-store。组件读 store 状态、调 store.start/cancel，不各自重复订阅，
 * 避免多处挂监听导致日志重复。
 */
export function useGenerationSubscription(): void {
  const pushEvent = useGenerationStore((s) => s.pushEvent)
  const pushStderr = useGenerationStore((s) => s.pushStderr)
  const finish = useGenerationStore((s) => s.finish)

  useEffect(() => {
    const offEvent = window.api.generation.onEvent(pushEvent)
    const offStderr = window.api.generation.onStderr(pushStderr)
    const offDone = window.api.generation.onDone(finish)
    return () => {
      offEvent()
      offStderr()
      offDone()
    }
  }, [pushEvent, pushStderr, finish])
}
