import { ArrowUp, Paperclip, X, ImageDown, Loader2, User, Sparkles } from 'lucide-react'
import { useState, useRef, useEffect, useCallback } from 'react'
import type { ChangeEvent, KeyboardEvent } from 'react'
import type { ChatMessageWithGen, GenerationRecord } from '@shared/types'
import { useChatStore } from '../../store/chat-store'
import { useSkillStore } from '../../store/skill-store'
import { useHistoryStore } from '../../store/history-store'
import { useParamStore } from '../../store/param-store'
import { AttachmentChips } from '../ui/attachment-chips'
import { MarkdownContent } from './markdown-content'

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

/** 用户消息行：左侧小 avatar + 右侧纯文本。 */
function UserMessage({ content }: { content: string }) {
  return (
    <div className="flex gap-3">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/20">
        <User className="h-3.5 w-3.5 text-accent" />
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed text-fg">{content}</p>
      </div>
    </div>
  )
}

/** 助手消息行：左侧小 avatar + 右侧 Markdown 渲染。 */
function AssistantMessage({ message }: { message: ChatMessageWithGen }) {
  return (
    <div className="flex gap-3">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/10">
        <Sparkles className="h-3.5 w-3.5 text-accent" />
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        <MarkdownContent>{message.content}</MarkdownContent>
        {message.generation && <GenThumb generation={message.generation} />}
      </div>
    </div>
  )
}

/** 流式助手消息：实时 Markdown 渲染。 */
function StreamingMessage({ text }: { text: string }) {
  return (
    <div className="flex gap-3">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/10">
        <Sparkles className="h-3.5 w-3.5 text-accent" />
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        {text ? (
          <MarkdownContent>{text}</MarkdownContent>
        ) : (
          <span className="flex items-center gap-2 text-[13px] text-fg-dim">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Codex 思考中…
          </span>
        )}
      </div>
    </div>
  )
}

/** 自动扩展 textarea：内容变化时自适应高度。 */
function AutoResizeTextArea({
  value,
  onChange,
  onKeyDown,
  placeholder,
  disabled,
  maxRows = 6
}: {
  value: string
  onChange: (e: ChangeEvent<HTMLTextAreaElement>) => void
  onKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void
  placeholder: string
  disabled: boolean
  maxRows?: number
}) {
  const ref = useRef<HTMLTextAreaElement>(null)

  const resize = useCallback(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    const lineHeight = 20 // 13px * leading-relaxed ≈ 20px
    const maxHeight = lineHeight * maxRows
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`
  }, [maxRows])

  useEffect(() => {
    resize()
  }, [value, resize])

  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      disabled={disabled}
      placeholder={placeholder}
      onChange={onChange}
      onKeyDown={onKeyDown}
      className="max-h-32 min-h-[36px] w-full resize-none bg-transparent px-1 text-[13px] leading-relaxed text-fg outline-none placeholder:text-fg-dim"
    />
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
  const skills = useSkillStore((s) => s.result?.skills)
  const setSkill = useSkillStore((s) => s.setCurrent)

  const [draft, setDraft] = useState('')
  // 本轮附件图绝对路径（发送后清空；仅本轮随消息走 codex --image，不持久化）。
  const [attachments, setAttachments] = useState<string[]>([])
  // slash 菜单高亮项下标；query 变化时归零（见下方 useEffect）。
  const [slashHi, setSlashHi] = useState(0)
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

  // slash 命令：输入以「/」开头且无空白时，弹出可调用 Skill 菜单（仅列已适配项）。
  const slashQuery =
    draft.startsWith('/') && !/\s/.test(draft) ? draft.slice(1).toLowerCase() : null
  const slashMatches =
    slashQuery !== null
      ? (skills ?? []).filter(
          (s) =>
            s.adapted &&
            (s.id.toLowerCase().includes(slashQuery) || s.name.toLowerCase().includes(slashQuery))
        )
      : []
  const slashOpen = slashMatches.length > 0
  const hi = Math.min(slashHi, slashMatches.length - 1)

  // query 变化时高亮归零，避免越界或停在旧项。
  useEffect(() => {
    setSlashHi(0)
  }, [slashQuery])

  const pickSkill = (id: string): void => {
    setSkill(id)
    setDraft('')
  }

  const submit = (): void => {
    if (!canSend) return
    void send(draft, attachments)
    setDraft('')
    setAttachments([])
  }

  // 选附件图：原生多选 → 去重并入本轮附件。
  const addAttachments = async (): Promise<void> => {
    const picked = await window.api.dialog.pickImages()
    if (picked.length === 0) return
    setAttachments((prev) => Array.from(new Set([...prev, ...picked])))
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>): void => {
    // slash 菜单打开时，方向键/Enter/Esc 优先操作菜单，不落到发送逻辑。
    if (slashOpen) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSlashHi((i) => (i + 1) % slashMatches.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSlashHi((i) => (i - 1 + slashMatches.length) % slashMatches.length)
        return
      }
      if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
        e.preventDefault()
        pickSkill(slashMatches[hi].id)
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setDraft('')
        return
      }
    }
    // isComposing：输入法组字态按 Enter 是「确认选词」，不可误触发发送（中文/日文输入必备）。
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={scrollRef} onScroll={onScroll} className="flex-1 space-y-4 overflow-auto px-4 py-4">
        {empty ? (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-soft">
              <Sparkles className="h-7 w-7 text-accent" />
            </div>
            <h2 className="mt-5 text-lg text-fg-soft">
              与 <span className="font-semibold text-fg">Codex</span> 对话
            </h2>
            <p className="mt-2 text-[12px] leading-relaxed text-fg-dim">
              用自然语言描述精灵，或迭代上一次产出
            </p>
            <p className="mt-4 max-w-[15rem] text-[11px] leading-relaxed text-fg-dim/80">
              例如：「火法师施法，3×2 网格」「火再大点」「换成蓝色火焰」
            </p>
          </div>
        ) : (
          messages.map((m) =>
            m.role === 'user' ? (
              <UserMessage key={m.id} content={m.content} />
            ) : (
              <AssistantMessage key={m.id} message={m} />
            )
          )
        )}
        {streaming && <StreamingMessage text={streaming.text} />}
      </div>

      <div className="relative flex shrink-0 flex-col gap-2 p-3">
        {error && <span className="px-1 text-[11px] text-error">{error}</span>}
        {!skill && (
          <span className="px-1 text-[11px] text-fg-dim">无可用 Skill，无法发起对话。</span>
        )}
        {/* slash 菜单：贴着输入卡片上沿浮出，列出可调用的 Skill。 */}
        {slashOpen && (
          <div className="absolute bottom-full left-3 right-3 mb-1 overflow-hidden rounded-lg border border-edge bg-elevated py-1 shadow-lg">
            <div className="px-3 py-1 text-[10px] uppercase tracking-wide text-fg-dim">调用 Skill</div>
            {slashMatches.map((s, idx) => (
              <button
                key={s.id}
                type="button"
                onMouseEnter={() => setSlashHi(idx)}
                onClick={() => pickSkill(s.id)}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors ${
                  idx === hi ? 'bg-accent-soft' : 'hover:bg-hover'
                }`}
              >
                <Sparkles className="h-3.5 w-3.5 shrink-0 text-accent" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-mono text-[12px] text-fg">{s.name}</span>
                  {s.description && (
                    <span className="block truncate text-[11px] text-fg-dim">{s.description}</span>
                  )}
                </span>
                {s.id === skill && <span className="shrink-0 text-[10px] text-accent">当前</span>}
              </button>
            ))}
          </div>
        )}
        <div className="flex flex-col gap-2 rounded-xl border border-edge bg-elevated p-2.5 transition-colors focus-within:border-accent">
          {attachments.length > 0 && (
            <AttachmentChips
              paths={attachments}
              disabled={sending}
              onRemove={(p) => setAttachments((prev) => prev.filter((x) => x !== p))}
            />
          )}
          <AutoResizeTextArea
            value={draft}
            disabled={!skill || sending}
            placeholder="描述你想要的精灵，输入 / 调用 Skill…"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
          />
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-1.5">
              <button
                type="button"
                title="添加参考图"
                disabled={!skill || sending}
                onClick={() => void addAttachments()}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-fg-soft transition-colors hover:bg-hover hover:text-fg disabled:pointer-events-none disabled:opacity-40"
              >
                <Paperclip className="h-4 w-4" />
              </button>
              <div className="flex min-w-0 items-center gap-1.5 rounded-md bg-panel px-2 py-1">
                <Sparkles className="h-3 w-3 shrink-0 text-accent" />
                <span className="truncate font-mono text-[11px] text-fg-soft">
                  {skill ?? '无可用 Skill'}
                </span>
              </div>
            </div>
            {sending ? (
              <button
                type="button"
                title="停止生成"
                onClick={() => void cancel()}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-edge bg-panel text-fg-soft transition-colors hover:bg-hover hover:text-fg"
              >
                <X className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                title="发送"
                disabled={!canSend}
                onClick={submit}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ArrowUp className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
