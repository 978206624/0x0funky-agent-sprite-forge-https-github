import { join } from 'path'
import { getDb } from '../db'
import { createGeneration } from '../db/generations-repo'
import { createMessage, getConversation } from '../db/conversations-repo'
import { runCodexExec, type CodexExecHandle, type CodexSandbox } from '../codex/exec'
import { slugify, uniqueSlug } from './slug'
import { inspectBundleLenient } from './bundle'
import { maskSecrets } from '../../shared/mask'
import type {
  CodexEvent,
  ChatMessage,
  ChatMessageWithGen,
  ChatTurnResult,
  GenParams,
  GenerationRecord
} from '../../shared/types'

const SKILL_FALLBACK = 'generate2dsprite'
/** 与 param 生成同口径：image_gen + 后处理通常数分钟，给 20 分钟上限防挂死。 */
const DEFAULT_TIMEOUT_MS = 20 * 60 * 1000
/** 携带的历史转录窗口：末 K 条（首版不做模型摘要 / 长会话 resume）。 */
const HISTORY_WINDOW = 8
/** 单条历史转录截断，防 prompt 过长。 */
const MSG_TRUNCATE = 500

export interface RunChatTurnInput {
  conversationId: number
  projectId: number
  /** 当前项目目录绝对路径（codex -C 工作区）。 */
  projectDir: string
  /** 已解析的 codex 可执行文件路径。 */
  binPath: string
  /** 当前会话 skill（如 generate2dsprite）。 */
  skill: string
  /** 本轮用户输入。 */
  userText: string
  /** 本轮附件图绝对路径列表（经 codex --image 附给本轮消息）。 */
  attachments?: string[]
  /** 本轮之前的历史消息（不含本轮 user 消息），按时间正序。 */
  history: ChatMessage[]
  /** 生效 sandbox（IPC 层 clamp 后传入）。省略=workspace-write。 */
  sandbox?: CodexSandbox
  /** 生成默认模型；省略=codex 默认。 */
  model?: string
  /** reasoning effort；省略=codex 默认。 */
  effort?: string
  timeoutMs?: number
  onEvent: (event: CodexEvent) => void
  onStderr?: (chunk: string) => void
}

export interface RunChatTurnHandle {
  cancel: () => void
  /** 结束 Promise：返回本轮结果（assistant 消息 + 可选产出）。永不 reject。 */
  readonly done: Promise<ChatTurnResult>
}

function truncate(text: string, max: number): string {
  const t = text.trim()
  return t.length > max ? `${t.slice(0, max)}…` : t
}

/** 组对话 prompt：framing + skill + 历史转录窗口 + 当前输入 + slug/bundle 指令（不预建目录）。 */
function buildChatPrompt(args: {
  slug: string
  skill: string
  history: ChatMessage[]
  userText: string
  attachmentCount: number
}): string {
  const { slug, skill, history, userText, attachmentCount } = args
  const outDir = `assets/sprites/${slug}`
  const recent = history.slice(-HISTORY_WINDOW)
  const transcript = recent.length
    ? recent
        .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${truncate(m.content, MSG_TRUNCATE)}`)
        .join('\n')
    : '(no prior messages)'

  return [
    `You are an interactive 2D game sprite assistant, driving the ${skill} skill to generate and iteratively refine sprite animations through conversation.`,
    '',
    'Conversation so far (most recent last):',
    transcript,
    '',
    `User (current request): ${userText.trim()}`,
    ...(attachmentCount
      ? [
          `The user attached ${attachmentCount} reference image(s) to this message. If you generate or revise a sprite this turn, use them as the primary visual reference for the character's identity, design, color palette and art style.`
        ]
      : []),
    '',
    'How to respond:',
    '- Reply conversationally in the user\'s language, briefly stating what you did or asking a clarifying question.',
    `- ONLY if this request calls for producing or revising a sprite, use the ${skill} skill to generate the full processed bundle.`,
    '- If the user is just chatting or asking a question that needs no new sprite, answer in text and do NOT generate files.',
    '',
    'If (and only if) you produce a sprite this turn, obey these hard constraints:',
    `- write the COMPLETE processed bundle under the relative path ${outDir}/ (create the directory yourself)`,
    `- frame label prefix MUST be ${slug} (frames named ${slug}-1 .. ${slug}-N)`,
    `- include: raw-sheet.png, raw-sheet-clean.png, sheet-transparent.png, ${slug}-1.png .. ${slug}-N.png, animation.gif, prompt-used.txt, pipeline-meta.json, phaser-example.js, README.md`,
    '- run the local postprocess script for chroma-key cleanup, frame extraction, alignment, QC, transparent export and GIF; do not hand-place frames',
    '- flat solid #FF00FF chroma-key background; consistent identity/bounding-box/scale across frames; full body inside each cell with generous margin',
    '- pipeline-meta.json must record the true rows, cols, cell_size and a frames array',
    '',
    'Scope (do not exceed):',
    `- write generation outputs only inside ${outDir}/; do not create or modify files at the project root`,
    '- do NOT touch Product-Spec files, changelogs, design docs, git metadata, or unrelated project files',
    '- do not require the working directory to be a git repository'
  ].join('\n')
}

/** 从 meta 探测 + 用户输入推导对话产物的 GenParams（grid 以 meta 真实值为准，保证预览/回填正确）。 */
function chatParams(
  userText: string,
  inspection: { rows: number | null; cols: number | null; cell: number | null },
  attachments: string[]
): GenParams {
  const p: GenParams = { theme: userText.trim() || undefined, extra: { source: 'chat' } }
  if (inspection.rows !== null) p.gridRows = inspection.rows
  if (inspection.cols !== null) p.gridCols = inspection.cols
  if (inspection.cell !== null) p.frameWidth = inspection.cell
  // 本轮参考图也落进记录，使历史「应用到工作台」回填时不丢参考图（与参数面板生成口径一致）。
  if (attachments.length) p.refImages = attachments
  return p
}

/**
 * 编排一轮对话：组 prompt → 跑 codex exec → 流式转发事件 → 轮末宽松探测 bundle，
 * 若产出 sprite 则落 generations（绑 project_id）并关联到 assistant 消息 → 持久化 assistant 消息。
 * 立即返回句柄（cancel/done），不阻塞调用方。done 永不 reject。
 */
export function runChatTurn(input: RunChatTurnInput): RunChatTurnHandle {
  const db = getDb()
  const skill = input.skill || SKILL_FALLBACK
  const slug = uniqueSlug(input.projectId, input.projectDir, slugify(input.userText) || 'chat')
  const outputDir = join(input.projectDir, 'assets', 'sprites', slug)
  const attachments = input.attachments ?? []
  const prompt = buildChatPrompt({
    slug,
    skill,
    history: input.history,
    userText: input.userText,
    attachmentCount: attachments.length
  })

  // 累积本轮 agent 文本：只取 item.completed 的 agent_message 终文（不含 item.updated 流式增量），
  // 防 updated+completed 重复拼接。多条 completed 按序拼接。
  const agentTexts: string[] = []
  const onEvent = (ev: CodexEvent): void => {
    if (ev.type === 'item.completed' && ev.item.type === 'agent_message') {
      const t = ev.item.text.trim()
      if (t) agentTexts.push(t)
    }
    input.onEvent(ev)
  }

  /** 落 assistant 消息并组装 join 形态返回。 */
  const finalize = (generation: GenerationRecord | null): ChatTurnResult => {
    // 落库前脱敏：assistant 文本来自累积的 agent_message 原文（早于 IPC 层 maskEvent），
    // 持久化/重载都经此，杜绝凭据进库。
    const text = maskSecrets(agentTexts.join('\n\n').trim())
    const content = text || (generation ? `已生成 ${generation.slug}` : '（本轮无回复）')
    const msg = createMessage(db, {
      conversationId: input.conversationId,
      role: 'assistant',
      content,
      generationId: generation?.id ?? null
    })
    const assistantMessage: ChatMessageWithGen = { ...msg, generation }
    return {
      projectId: input.projectId,
      conversationId: input.conversationId,
      assistantMessage,
      generation
    }
  }

  let exec: CodexExecHandle
  try {
    exec = runCodexExec({
      binPath: input.binPath,
      projectDir: input.projectDir,
      prompt,
      sandbox: input.sandbox ?? 'workspace-write',
      model: input.model,
      effort: input.effort,
      images: attachments,
      timeoutMs: input.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      onEvent,
      onStderr: input.onStderr
    })
  } catch (err) {
    input.onStderr?.(`启动 codex 失败：${String(err)}\n`)
    return { cancel: () => {}, done: Promise.resolve(finalize(null)) }
  }

  const done = exec.done.then((outcome): ChatTurnResult => {
    // 仅正常完成（退出码 0）才探测 bundle；超时/错误/取消一律按无产出文本轮处理。
    if (outcome.result !== 'completed' || outcome.code !== 0) {
      if (outcome.result === 'completed') {
        input.onStderr?.(`codex 退出码非 0：${outcome.code}\n`)
      }
      return finalize(null)
    }
    const found = inspectBundleLenient(outputDir, slug)
    if (!found.present) return finalize(null)

    // 本轮确实产出了 sprite：落 generations（绑当前项目），grid 取 meta 真实值。
    const conv = getConversation(db, input.conversationId)
    const projectId = conv?.projectId ?? input.projectId
    const record = createGeneration(db, {
      projectId,
      slug,
      skill,
      status: 'success',
      params: chatParams(input.userText, found, attachments),
      prompt,
      outputDir,
      thumbnail: found.thumbnail
    })
    return finalize(record)
  })

  return { cancel: exec.cancel, done }
}
