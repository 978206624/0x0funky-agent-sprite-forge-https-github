import { create } from 'zustand'
import type { ChatMessageWithGen, CodexEvent, ChatTurnResult } from '@shared/types'
import { useProjectStore } from './project-store'
import { useSkillStore } from './skill-store'
import { useHistoryStore } from './history-store'

interface ChatState {
  /** 当前会话 id；null=尚无会话（首条消息时主进程新建）。 */
  conversationId: number | null
  /** 已持久化的消息（join 关联产出），时间正序。 */
  messages: ChatMessageWithGen[]
  /** 进行中一轮的 assistant 实时气泡（流式文本）；null=无进行中轮。 */
  streaming: { text: string } | null
  /** 是否有一轮对话发送中（禁用输入 / 显示取消）。 */
  sending: boolean
  error: string | null

  /** 按项目冷加载最近会话 + 其消息（进入/切换/刷新项目时调用，不动进行中状态）。 */
  load: (projectId: number) => Promise<void>
  /** 发送一轮：乐观插入用户气泡 → 调主进程 → 流式回填。attachments=本轮参考图绝对路径。 */
  send: (text: string, attachments?: string[]) => Promise<void>
  /** 取消进行中的一轮。 */
  cancel: () => Promise<void>
  /** 消费 codex 事件（流式更新 assistant 实时气泡）。 */
  pushEvent: (ev: CodexEvent) => void
  /** 一轮结束：append 持久化的 assistant 消息（信任载荷，不整列表 reload）。 */
  onDone: (result: ChatTurnResult) => void
  /** 清空到初始态（切换/进入项目时调用，保持项目隔离）。 */
  reset: () => void
}

/** 乐观消息的临时负 id（避免与 DB 自增正 id 冲突）；发送成功后替换为真实 id。 */
let tempSeq = -1

/**
 * 在途加载序号：防陈旧请求覆盖（快速切项目时旧 listMessages 晚返回）。
 * 与当前项目双校验，过期结果丢弃；reset() 递增让在途请求失效。
 */
let loadSeq = 0

/** 当前项目是否仍为 projectId（写入前校验）。 */
function stillCurrent(projectId: number): boolean {
  return useProjectStore.getState().current?.id === projectId
}

/** 取 codex 事件里的 agent 文本（流式 updated/completed 均为累积全文，取最新覆盖即可）。 */
function agentText(ev: CodexEvent): string | null {
  if (
    (ev.type === 'item.updated' || ev.type === 'item.completed') &&
    ev.item.type === 'agent_message'
  ) {
    return ev.item.text
  }
  return null
}

/** 对话状态（右栏对话 Tab 的单一来源，独立于参数表单，切 Tab 不丢）。 */
export const useChatStore = create<ChatState>((set, get) => ({
  conversationId: null,
  messages: [],
  streaming: null,
  sending: false,
  error: null,

  load: async (projectId) => {
    const seq = ++loadSeq
    try {
      const conversation = await window.api.chat.getLatestConversation()
      if (seq !== loadSeq || !stillCurrent(projectId)) return
      if (!conversation) {
        set({ conversationId: null, messages: [] })
        return
      }
      const messages = await window.api.chat.listMessages(conversation.id)
      if (seq !== loadSeq || !stillCurrent(projectId)) return
      set({ conversationId: conversation.id, messages })
    } catch {
      if (seq !== loadSeq || !stillCurrent(projectId)) return
      set({ conversationId: null, messages: [] })
    }
  },

  send: async (text, attachments = []) => {
    const trimmed = text.trim()
    if (!trimmed || get().sending) return
    const skill = useSkillStore.getState().currentId
    if (!skill) {
      set({ error: '无可用 Skill，无法发起对话' })
      return
    }
    const now = new Date().toISOString()
    const optimisticId = tempSeq--
    const optimistic: ChatMessageWithGen = {
      id: optimisticId,
      conversationId: get().conversationId ?? -1,
      role: 'user',
      content: trimmed,
      generationId: null,
      createdAt: now,
      updatedAt: now,
      generation: null
    }
    set((s) => ({
      messages: [...s.messages, optimistic],
      streaming: { text: '' },
      sending: true,
      error: null
    }))
    try {
      const { conversationId } = await window.api.chat.send({
        conversationId: get().conversationId,
        text: trimmed,
        skill,
        attachments
      })
      // 只记录会话 id；乐观用户气泡保留临时 id 作为稳定 React key（不替换，避免 remount 闪烁）。
      // 冷加载 load() 是整列表 set 替换（reset 后才发生、非 append），无重复渲染之虞。
      set({ conversationId })
    } catch (e) {
      // 发起失败：撤回乐观气泡，清进行中态。
      set((s) => ({
        messages: s.messages.filter((m) => m.id !== optimisticId),
        streaming: null,
        sending: false,
        error: e instanceof Error ? e.message : '发起对话失败'
      }))
    }
  },

  cancel: async () => {
    if (!get().sending) return
    await window.api.chat.cancel()
  },

  pushEvent: (ev) => {
    if (!get().sending) return
    const text = agentText(ev)
    if (text === null) return
    set({ streaming: { text } })
  },

  onDone: (result) => {
    // 防御性校验：本轮若不属当前项目（窗口刷新/切项目后旧轮迟到），丢弃，不把旧消息/产物灌进新项目。
    // 主进程 setCurrentProject 已在 busy 时拒绝切项目，此处为渲染层二道防线。
    const current = useProjectStore.getState().current?.id
    if (current === undefined || current !== result.projectId) {
      set((s) => (s.sending ? { streaming: null, sending: false } : {}))
      return
    }
    set((s) => ({
      conversationId: result.conversationId,
      messages: [...s.messages, result.assistantMessage],
      streaming: null,
      sending: false
    }))
    // 产出了 sprite：刷新左栏历史网格（不抢中栏预览——由用户在气泡点「应用为产出」）。
    if (result.generation) {
      void useHistoryStore.getState().load(result.projectId)
    }
  },

  reset: () => {
    loadSeq += 1
    set({ conversationId: null, messages: [], streaming: null, sending: false, error: null })
  }
}))
