import { useProjectStore } from '../store/project-store'
import { useGenerationStore } from '../store/generation-store'
import { useHistoryStore } from '../store/history-store'
import { useParamStore } from '../store/param-store'
import { useChatStore } from '../store/chat-store'

/**
 * 离开当前项目回到项目页：先请主进程清当前项目（任务进行中会被主进程拒绝，返回 false 不复位），
 * 成功后复位全部项目级状态（生成/历史/参数/对话），保持项目隔离。
 * 状态条「切换项目」与设置页「切换项目」共用，避免复位逻辑两处漂移。
 */
export async function leaveProject(): Promise<boolean> {
  try {
    await window.api.projects.setCurrent(null)
  } catch {
    // 主进程在 busy 时拒绝：保持当前项目，不复位。
    return false
  }
  useGenerationStore.getState().reset()
  useHistoryStore.getState().reset()
  useParamStore.getState().reset()
  useChatStore.getState().reset()
  useProjectStore.getState().setCurrent(null)
  return true
}
