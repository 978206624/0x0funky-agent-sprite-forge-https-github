import { useEffect } from 'react'
import { useGenerationStore } from '../store/generation-store'
import { useHistoryStore } from '../store/history-store'

/**
 * 在 App 顶层调用一次：把主进程生成事件流（gen:event / gen:stderr / gen:done）
 * 订阅到 generation-store。组件读 store 状态、调 store.start/cancel，不各自重复订阅，
 * 避免多处挂监听导致日志重复。
 * 生成结束（gen:done）除了落 generation-store 的状态/日志，还通知 history-store：
 * 刷新当前项目历史列表，成功则自动选中新记录到中栏预览。
 */
export function useGenerationSubscription(): void {
  const pushEvent = useGenerationStore((s) => s.pushEvent)
  const pushStderr = useGenerationStore((s) => s.pushStderr)
  const finish = useGenerationStore((s) => s.finish)

  useEffect(() => {
    const offEvent = window.api.generation.onEvent(pushEvent)
    const offStderr = window.api.generation.onStderr(pushStderr)
    const offDone = window.api.generation.onDone((record) => {
      finish(record)
      void useHistoryStore.getState().onDone(record)
    })
    return () => {
      offEvent()
      offStderr()
      offDone()
    }
  }, [pushEvent, pushStderr, finish])
}
