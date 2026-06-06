import { ipcMain, type IpcMainInvokeEvent, type WebContents } from 'electron'
import { resolveCodexPath } from '../codex/resolver'
import { getCurrentProject } from '../projects/manager'
import { getDb } from '../db'
import {
  createConversation,
  getConversation,
  getLatestConversationByProject,
  createMessage,
  listMessages
} from '../db/conversations-repo'
import { runChatTurn, type RunChatTurnHandle } from '../generation/chat-runner'
import { tryAcquire, release } from '../generation/lock'
import { getGenDefaults, getEffectiveSandbox } from '../settings/service'
import { maskSecrets, maskEvent } from '../../shared/mask'
import type {
  CodexEvent,
  Conversation,
  ChatMessageWithGen,
  ChatSendInput,
  ChatSendResult
} from '../../shared/types'

/** 当前进行中的对话轮（MVP 单并发，与生成共享 lock）。 */
let active: RunChatTurnHandle | null = null

/** 仅在目标 webContents 仍存活时推送，避免向已销毁窗口发送。 */
function safeSend(wc: WebContents, channel: string, payload: unknown): void {
  if (!wc.isDestroyed()) wc.send(channel, payload)
}

/** 注册对话相关 IPC。须在 app ready 且 initDatabase() 之后调用一次。 */
export function registerChatIpc(): void {
  ipcMain.handle(
    'chat:send',
    async (e: IpcMainInvokeEvent, input: ChatSendInput): Promise<ChatSendResult> => {
      // 与 gen:start 共用同一把锁：一次只放行一个 codex 任务（slug 竞态 + 双进程重负防护）。
      if (!tryAcquire()) throw new Error('已有任务进行中，请先取消或等待完成')
      try {
        const text = (input?.text ?? '').trim()
        if (!text) throw new Error('消息不能为空')
        const skill = (input?.skill ?? '').trim()
        if (!skill) throw new Error('未选择 skill')
        const project = getCurrentProject()
        if (!project) throw new Error('未选择当前项目')
        const binPath = await resolveCodexPath()
        if (!binPath) throw new Error('未找到 codex 可执行文件（检查安装或 CODEX_BIN）')

        const db = getDb()
        // 复用既有会话或新建（首版单活跃会话/项目）。
        let conversation: Conversation
        if (input.conversationId !== null) {
          conversation = resolveConversation(db, input.conversationId, project.id, skill)
        } else {
          conversation = createConversation(db, { projectId: project.id, skill })
        }

        // 先取本轮之前的历史（不含本轮），再持久化用户消息——保证 prompt 历史窗口与 DB 一致。
        const history = listMessages(db, conversation.id)
        const userMsg = createMessage(db, {
          conversationId: conversation.id,
          role: 'user',
          content: text
        })

        const wc = e.sender
        // 对话无 GenParams，生成默认值只能从 settings 进 IPC seam（与 gen:start 一致）。
        const defaults = getGenDefaults()
        const { sandbox, downgraded } = getEffectiveSandbox(defaults.sandbox)
        if (downgraded) {
          safeSend(wc, 'chat:stderr', '已按安全设置将 sandbox 降级为 workspace-write（danger-full-access 未授权）\n')
        }
        const handle = runChatTurn({
          conversationId: conversation.id,
          projectId: project.id,
          projectDir: project.absPath,
          binPath,
          skill,
          userText: text,
          history,
          sandbox,
          model: defaults.model,
          effort: defaults.effort,
          // 事件流与 stderr 推渲染层前都脱敏，防凭据上屏/进日志/进 devtools。
          onEvent: (ev: CodexEvent) => safeSend(wc, 'chat:event', maskEvent(ev)),
          onStderr: (chunk: string) => safeSend(wc, 'chat:stderr', maskSecrets(chunk))
        })
        active = handle

        // runChatTurn 保证 done 不 reject；仍防御 DB/IO 异常，finally 必清 active + 释放锁。
        void handle.done
          .then((result) => safeSend(wc, 'chat:done', result))
          .catch((err: unknown) => safeSend(wc, 'chat:stderr', `对话结束异常：${String(err)}\n`))
          .finally(() => {
            if (active === handle) active = null
            release()
          })

        return { conversationId: conversation.id, userMessageId: userMsg.id }
      } catch (err) {
        // 启动阶段（未进入 handle.done.finally）失败：必须就地释放锁，否则后续任务永久被挡。
        release()
        throw err
      }
    }
  )

  ipcMain.handle('chat:cancel', (): void => {
    active?.cancel()
  })

  ipcMain.handle(
    'chat:listMessages',
    (_e: IpcMainInvokeEvent, conversationId: number): ChatMessageWithGen[] =>
      listMessages(getDb(), conversationId)
  )

  ipcMain.handle('chat:getLatestConversation', (): Conversation | null => {
    const project = getCurrentProject()
    if (!project) return null
    return getLatestConversationByProject(getDb(), project.id)
  })
}

/**
 * 复用传入的 conversationId（须存在且属当前项目），否则在当前项目新建。
 * 按 id 查询 + 校验 projectId（而非"必须是最近会话"），既挡跨项目/已删的陈旧 id，
 * 也对未来同项目多会话前向兼容（继续非最近会话不会被强制开新会话）。
 */
function resolveConversation(
  db: ReturnType<typeof getDb>,
  conversationId: number,
  projectId: number,
  skill: string
): Conversation {
  const existing = getConversation(db, conversationId)
  if (existing && existing.projectId === projectId) return existing
  // 传入 id 不存在或跨项目：安全起见在当前项目开新会话。
  return createConversation(db, { projectId, skill })
}
