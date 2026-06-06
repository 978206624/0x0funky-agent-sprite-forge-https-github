import { Send, X, ImageDown, Loader2 } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import type { KeyboardEvent } from 'react'
import type { ChatMessageWithGen, GenerationRecord } from '@shared/types'
import { useChatStore } from '../../store/chat-store'
import { useSkillStore } from '../../store/skill-store'
import { useHistoryStore } from '../../store/history-store'
import { useParamStore } from '../../store/param-store'
import { TextArea } from '../ui/text-input'
import { Button } from '../ui/button'

/** 产出第 1 帧的 asset:// 缩略图 URL（与 history-grid thumbUrl 同款编码）。 */
function thumbUrl(slug: string): string {
  return `asset://sprites/${encodeURIComponent(slug)}/${encodeURIComponent(`${slug}-1`)}.png`
}

/** 「应用为产出」：选中该产出到中栏预览 + 回填右栏参数表单（与点击历史卡片一致）。 */
function applyAsOutput(record: GenerationRecord): void {
  useHistoryStore.getState().select(record)
  useParamStore.getState().backfill(record.params)
}

function GenThumb({ generation }: { generation: GenerationRecord }) {
  const [errored, setErrored] = useState(false)
  useEffect(() => setErrored(false), [generation.slug])
  return (
    <div className="mt-2 flex flex-col gap-1.5">
      <div className="checker-bg h-24 w-24 overflow-hidden rounded-md border border-edge">
        {!errored ? (
          <img
            src={thumbUrl(generation.slug)}
            alt={generation.slug}
            draggable={false}
            onError={() => setErrored(true)}
            className="pixelated h-full w-full object-contain"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-[10px] text-fg-dim">
            无缩略图
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={() => applyAsOutput(generation)}
        className="flex w-fit items-center gap-1 rounded-sm px-1.5 py-0.5 text-[11px] text-accent transition-colors hover:bg-accent-soft"
      >
        <ImageDown className="h-3 w-3" />
        应用为产出
      </button>
    </div>
  )
}

function MessageBubble({ message }: { message: ChatMessageWithGen }) {
  const isUser = message.role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-lg px-3 py-2 text-[13px] leading-relaxed ${
          isUser ? 'bg-accent text-black' : 'bg-base text-fg'
        }`}
      >
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
        {!isUser && message.generation && <GenThumb generation={message.generation} />}
      </div>
    </div>
  )
}

function StreamingBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] rounded-lg bg-base px-3 py-2 text-[13px] leading-relaxed text-fg">
        {text ? (
          <p className="whitespace-pre-wrap break-words">{text}</p>
        ) : (
          <span className="flex items-center gap-2 text-fg-dim">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Codex 思考中…
          </span>
        )}
      </div>
    </div>
  )
}

export function ChatPanel() {
  const messages = useChatStore((s) => s.messages)
  const streaming = useChatStore((s) => s.streaming)
  const sending = useChatStore((s) => s.sending)
  const error = useChatStore((s) => s.error)
  const send = useChatStore((s) => s.send)
  const cancel = useChatStore((s) => s.cancel)
  const skill = useSkillStore((s) => s.currentId)

  const [draft, setDraft] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  // 是否贴底：仅当用户原本就在底部附近才自动跟随流式输出，避免上滚阅读时被强制拉回。
  const atBottomRef = useRef(true)
  const empty = messages.length === 0 && !streaming

  const onScroll = (): void => {
    const el = scrollRef.current
    if (el) atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60
  }

  // 新消息/流式更新时，仅在贴底时滚到底。
  useEffect(() => {
    const el = scrollRef.current
    if (el && atBottomRef.current) el.scrollTop = el.scrollHeight
  }, [messages, streaming])

  const canSend = !!skill && !sending && draft.trim().length > 0

  const submit = (): void => {
    if (!canSend) return
    void send(draft)
    setDraft('')
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>): void => {
    // isComposing：输入法组字态按 Enter 是「确认选词」，不可误触发发送（中文/日文输入必备）。
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={scrollRef} onScroll={onScroll} className="flex-1 space-y-3 overflow-auto p-4">
        {empty ? (
          <div className="rounded-md border border-dashed border-edge bg-base/50 p-4 text-center text-[12px] leading-relaxed text-fg-dim">
            用自然语言与 Codex 对话生成精灵。
            <br />
            例如：「火法师施法，3×2 网格」「火再大点」「换成蓝色火焰」。
          </div>
        ) : (
          messages.map((m) => <MessageBubble key={m.id} message={m} />)
        )}
        {streaming && <StreamingBubble text={streaming.text} />}
      </div>

      <div className="flex shrink-0 flex-col gap-2 border-t border-edge p-3">
        {error && <span className="text-[11px] text-error">{error}</span>}
        {!skill && (
          <span className="text-[11px] text-fg-dim">无可用 Skill，无法发起对话。</span>
        )}
        <TextArea
          rows={2}
          value={draft}
          disabled={!skill || sending}
          placeholder="描述你想要的精灵，或迭代上一次产出…（Enter 发送 / Shift+Enter 换行）"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
        />
        {sending ? (
          <Button fullWidth variant="secondary" onClick={() => void cancel()}>
            <X className="h-4 w-4" />
            取消
          </Button>
        ) : (
          <Button fullWidth disabled={!canSend} onClick={submit}>
            <Send className="h-4 w-4" />
            发送
          </Button>
        )}
      </div>
    </div>
  )
}
