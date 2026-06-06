import { useEffect } from 'react'
import { useChatStore } from '../store/chat-store'
import { useProjectStore } from '../store/project-store'

/**
 * 在 App 顶层调用一次：把主进程对话事件流（chat:event / chat:stderr / chat:done）订阅到 chat-store，
 * 并在当前项目变化时冷加载该项目最近会话。
 *
 * 订阅必须在 App 层（不在 chat-panel）：对话 Tab 切走时 panel 卸载，若订阅挂在 panel 会丢流式事件；
 * chat-store 持有状态、本 hook 持有订阅生命周期，切 Tab 回来从 store rehydrate。
 */
export function useChatSubscription(): void {
  const pushEvent = useChatStore((s) => s.pushEvent)
  const onDone = useChatStore((s) => s.onDone)
  const load = useChatStore((s) => s.load)
  const currentId = useProjectStore((s) => s.current?.id ?? null)

  useEffect(() => {
    const offEvent = window.api.chat.onEvent(pushEvent)
    // stderr 仅诊断；对话结果以 chat:done 的 assistant 消息为准，这里不强行打断 UI。
    const offStderr = window.api.chat.onStderr(() => {})
    const offDone = window.api.chat.onDone(onDone)
    return () => {
      offEvent()
      offStderr()
      offDone()
    }
  }, [pushEvent, onDone])

  useEffect(() => {
    if (currentId !== null) void load(currentId)
  }, [currentId, load])
}
