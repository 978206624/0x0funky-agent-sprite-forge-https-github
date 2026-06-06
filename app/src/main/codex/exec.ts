import { spawn } from 'child_process'
import { StringDecoder } from 'string_decoder'
import { needsShell } from './resolver'
import type { CodexEvent } from '../../shared/types'
import type { CodexSandbox } from '../../shared/settings-keys'

export type { CodexSandbox }

export interface CodexExecOptions {
  binPath: string
  /** codex 工作区（-C），即当前项目目录，生成与后处理都在此进行。 */
  projectDir: string
  /** 经 stdin 传入的完整 prompt（避开命令行长度/转义问题）。 */
  prompt: string
  sandbox?: CodexSandbox
  /** codex 模型（--model）；省略=用 codex 自身默认。 */
  model?: string
  /** reasoning effort；省略=用 codex 默认。经 -c model_reasoning_effort=<v> 注入。 */
  effort?: string
  /** 参考图绝对路径列表；经 codex `--image <path>` 逐个附给首条消息。空/省略=不附图。 */
  images?: string[]
  /** 超时（毫秒）；超时按进程树终结。0/省略=不超时。 */
  timeoutMs?: number
  /** 每条解析成功的 JSONL 事件回调（含未知兜底）。 */
  onEvent: (event: CodexEvent) => void
  /** 非 JSON 的原始 stdout 行（诊断用）。 */
  onRawLine?: (line: string) => void
  /** stderr 文本片段（诊断日志）。 */
  onStderr?: (chunk: string) => void
}

export type CodexExecOutcome =
  | { result: 'completed'; code: number | null }
  | { result: 'canceled' }
  | { result: 'timeout' }
  | { result: 'error'; error: string }

export interface CodexExecHandle {
  /** 子进程 pid（shell 场景为 cmd.exe 的 pid，取消按树终结）。 */
  readonly pid: number | undefined
  /** 主动取消：终结整个进程树。 */
  cancel: () => void
  /** 结束 Promise，永不 reject，以 outcome 区分结束原因。 */
  readonly done: Promise<CodexExecOutcome>
}

/** 已知顶层事件类型；不在此集合内的归一为 CodexUnknownEvent。 */
const KNOWN_EVENT_TYPES = new Set([
  'thread.started',
  'turn.started',
  'turn.completed',
  'turn.failed',
  'item.started',
  'item.updated',
  'item.completed',
  'error'
])

/** 把一行 JSON 文本解析为 CodexEvent；非 JSON 返回 null（交 onRawLine）。 */
export function parseCodexLine(line: string): CodexEvent | null {
  const trimmed = line.trim()
  if (!trimmed) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null) return null
  const type = (parsed as { type?: unknown }).type
  if (typeof type !== 'string') return { type: 'unknown', raw: parsed }
  if (KNOWN_EVENT_TYPES.has(type)) return parsed as CodexEvent
  return { type: 'unknown', raw: parsed }
}

/** 给 shell 命令分段加引号（含空格/特殊字符的路径安全拼接）。 */
function quoteArg(a: string): string {
  return `"${a.replace(/"/g, '""')}"`
}

/**
 * 终结进程树。Windows shell 场景下 child 是 cmd.exe，child.kill() 只杀 shell 留下
 * codex(node) 孤儿——必须用 taskkill /T 按 pid 终结整棵树（承接 Phase 2 backlog）。
 */
function killTree(pid: number | undefined): void {
  if (pid === undefined) return
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(pid), '/T', '/F'], { windowsHide: true }).on('error', () => {
      /* taskkill 不可用时静默：进程可能已退出 */
    })
  } else {
    try {
      process.kill(pid, 'SIGKILL')
    } catch {
      /* 进程可能已退出 */
    }
  }
}

/**
 * 执行 codex exec --json 并把 stdout 的 JSONL 逐行解析为事件回调。
 * 立即返回句柄（pid / cancel / done），不阻塞调用方。
 */
export function runCodexExec(opts: CodexExecOptions): CodexExecHandle {
  const sandbox = opts.sandbox ?? 'workspace-write'
  const args = [
    'exec',
    '--json',
    '--skip-git-repo-check',
    '--sandbox',
    sandbox,
    '-C',
    opts.projectDir
  ]
  // 模型：codex 0.137 `-m/--model <MODEL>`（探针确认）。
  if (opts.model) args.push('--model', opts.model)
  // reasoning effort：无专用 flag，经 `-c model_reasoning_effort='<v>'` TOML 覆盖注入。
  // 值加单引号成合法 TOML 字符串（不依赖"裸词回退字面量"行为，抗 codex 后续版本变化）。
  // effort 已在 IPC seam 经 EFFORTS 白名单（service.coerceEffort），值仅小写字母、无注入面。
  if (opts.effort) args.push('-c', `model_reasoning_effort='${opts.effort}'`)
  // 参考图：codex `--image <path>` 可重复，附给首条消息（stdin prompt）作视觉参照。
  // 路径来自渲染层原生文件选择器（用户显式选取），shell 场景由 quoteArg 安全引用。
  if (opts.images?.length) {
    for (const img of opts.images) args.push('--image', img)
  }

  const useShell = needsShell(opts.binPath)
  const child = useShell
    ? spawn([opts.binPath, ...args].map(quoteArg).join(' '), { shell: true, windowsHide: true })
    : spawn(opts.binPath, args, { shell: false, windowsHide: true })

  let canceled = false
  let timedOut = false
  let settled = false
  let stdoutBuffer = ''
  // 按 UTF-8 解码累积：避免多字节字符（中文等）刚好跨 data chunk 时被替换字符破坏，导致整行 JSON parse 失败。
  const stdoutDecoder = new StringDecoder('utf8')
  const stderrDecoder = new StringDecoder('utf8')
  let timer: ReturnType<typeof setTimeout> | null = null
  const clearTimer = (): void => {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }

  function consumeLine(line: string): void {
    const event = parseCodexLine(line)
    if (event) opts.onEvent(event)
    else if (line.trim()) opts.onRawLine?.(line)
  }

  child.stdout?.on('data', (d: Buffer) => {
    stdoutBuffer += stdoutDecoder.write(d)
    let nl = stdoutBuffer.indexOf('\n')
    while (nl !== -1) {
      consumeLine(stdoutBuffer.slice(0, nl))
      stdoutBuffer = stdoutBuffer.slice(nl + 1)
      nl = stdoutBuffer.indexOf('\n')
    }
  })

  child.stderr?.on('data', (d: Buffer) => opts.onStderr?.(stderrDecoder.write(d)))

  const done = new Promise<CodexExecOutcome>((resolve) => {
    const finish = (outcome: CodexExecOutcome): void => {
      if (settled) return
      settled = true
      clearTimer()
      resolve(outcome)
    }

    // 先注册 error，再写 stdin：spawn 失败 / EPIPE 不会变成未捕获异常。
    child.on('error', (err) => finish({ result: 'error', error: String(err) }))

    child.on('close', (code) => {
      // 冲洗解码器与残留的最后一行（无换行结尾）。
      stdoutBuffer += stdoutDecoder.end()
      if (stdoutBuffer.trim()) consumeLine(stdoutBuffer)
      stdoutBuffer = ''
      const tail = stderrDecoder.end()
      if (tail) opts.onStderr?.(tail)
      if (canceled) finish({ result: 'canceled' })
      else if (timedOut) finish({ result: 'timeout' })
      else finish({ result: 'completed', code })
    })

    if (opts.timeoutMs && opts.timeoutMs > 0) {
      timer = setTimeout(() => {
        timedOut = true
        killTree(child.pid)
      }, opts.timeoutMs)
    }

    // stdin 传 prompt 后关闭，触发 codex 开始这一轮。stdin 错误（EPIPE 等）仅记诊断，
    // 进程的 error/close 会负责结束 done。
    child.stdin?.on('error', (err) => opts.onStderr?.(`stdin error: ${String(err)}\n`))
    child.stdin?.write(opts.prompt)
    child.stdin?.end()
  })

  return {
    pid: child.pid,
    cancel: () => {
      canceled = true
      clearTimer() // 取消后不让 timer 把 canceled 误落成 timeout
      killTree(child.pid)
    },
    done
  }
}
