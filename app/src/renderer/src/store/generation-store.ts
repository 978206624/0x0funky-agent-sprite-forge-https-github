import { create } from 'zustand'
import type { CodexEvent, GenParams, GenerationRecord } from '@shared/types'

export type GenStatus = 'idle' | 'running' | 'success' | 'failed' | 'canceled'

export type LogTone = 'dim' | 'soft' | 'error' | 'success'

export interface LogLine {
  id: number
  time: string
  text: string
  tone: LogTone
}

interface GenerationState {
  status: GenStatus
  /** 进行中/最近一次生成的 slug 与记录 id。 */
  slug: string | null
  generationId: number | null
  logs: LogLine[]
  /** 最近一次生成的最终记录（成功/失败/取消）。 */
  lastRecord: GenerationRecord | null
  /** 启动错误（如未选项目、未装 codex）。 */
  error: string | null

  /** 发起一次生成：清空日志、置 running，并调主进程。失败时置 error 回 idle。 */
  start: (params: GenParams) => Promise<void>
  /** 取消进行中的生成。 */
  cancel: () => Promise<void>
  /** 消费一条 codex 事件（格式化进日志）。 */
  pushEvent: (ev: CodexEvent) => void
  /** 消费一段 stderr 诊断。 */
  pushStderr: (chunk: string) => void
  /** 生成结束：落最终记录并据 status 置态。 */
  finish: (record: GenerationRecord) => void
  /** 清空到初始态（切换/进入项目时调用，避免把上一个项目的日志/产物带过去）。 */
  reset: () => void
}

let logSeq = 0
function makeLine(text: string, tone: LogTone): LogLine {
  const now = new Date()
  const time = now.toTimeString().slice(0, 8)
  return { id: ++logSeq, time, text, tone }
}

/** 命令文本压成单行短串，避免日志过宽。 */
function shortCmd(cmd: string): string {
  const oneLine = cmd.replace(/\s+/g, ' ').trim()
  return oneLine.length > 80 ? `${oneLine.slice(0, 80)}…` : oneLine
}

/** 把一条 codex 事件格式化为日志行；返回 null 表示跳过（降噪）。 */
function formatEvent(ev: CodexEvent): { text: string; tone: LogTone } | null {
  switch (ev.type) {
    case 'thread.started':
      return { text: '会话已建立', tone: 'dim' }
    case 'turn.started':
      return { text: '开始执行…', tone: 'dim' }
    case 'item.started':
      if (ev.item.type === 'command_execution') {
        return { text: `$ ${shortCmd(ev.item.command)}`, tone: 'dim' }
      }
      return null
    case 'item.completed': {
      const item = ev.item
      if (item.type === 'agent_message') return { text: item.text, tone: 'soft' }
      if (item.type === 'command_execution') {
        const tone: LogTone = item.exit_code === 0 ? 'dim' : 'error'
        return { text: `↳ exit ${item.exit_code ?? '?'}`, tone }
      }
      if (item.type === 'file_change') {
        const names = item.changes.map((c) => `${c.kind} ${c.path.split(/[\\/]/).pop()}`).join(', ')
        return { text: `✎ ${names}`, tone: 'soft' }
      }
      if (item.type === 'reasoning' && item.text) return { text: item.text, tone: 'dim' }
      return null
    }
    case 'turn.completed': {
      const u = ev.usage
      return { text: `本轮完成 · tokens ${u.input_tokens}/${u.output_tokens}`, tone: 'dim' }
    }
    case 'turn.failed':
      return { text: `执行失败：${ev.error?.message ?? '未知错误'}`, tone: 'error' }
    case 'error':
      return { text: `错误：${ev.message}`, tone: 'error' }
    default:
      return null
  }
}

/** 生成上下文（参数表单 + 中栏日志/状态共享的单一来源）。 */
export const useGenerationStore = create<GenerationState>((set, get) => ({
  status: 'idle',
  slug: null,
  generationId: null,
  logs: [],
  lastRecord: null,
  error: null,

  start: async (params) => {
    if (get().status === 'running') return
    set({ status: 'running', logs: [], lastRecord: null, error: null, slug: null, generationId: null })
    try {
      const { generationId, slug } = await window.api.generation.start(params)
      set({ generationId, slug, logs: [makeLine(`开始生成 ${slug}`, 'soft')] })
    } catch (e) {
      set({ status: 'failed', error: e instanceof Error ? e.message : '发起生成失败' })
    }
  },

  cancel: async () => {
    if (get().status !== 'running') return
    set((s) => ({ logs: [...s.logs, makeLine('正在取消…', 'dim')] }))
    await window.api.generation.cancel()
  },

  pushEvent: (ev) => {
    const formatted = formatEvent(ev)
    if (!formatted) return
    set((s) => ({ logs: [...s.logs, makeLine(formatted.text, formatted.tone)] }))
  },

  pushStderr: (chunk) => {
    const text = chunk.trim()
    if (!text) return
    set((s) => ({ logs: [...s.logs, makeLine(text, 'error')] }))
  },

  finish: (record) => {
    set({ status: record.status as GenStatus, lastRecord: record, slug: record.slug })
  },

  reset: () => {
    set({ status: 'idle', slug: null, generationId: null, logs: [], lastRecord: null, error: null })
  }
}))
