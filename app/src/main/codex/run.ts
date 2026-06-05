import { spawn } from 'child_process'
import { needsShell } from './resolver'

export interface CaptureResult {
  code: number | null
  stdout: string
  stderr: string
  timedOut: boolean
}

// 给 shell 命令分段加引号（含空格/特殊字符的路径与参数安全拼接）。
function quoteArg(a: string): string {
  return `"${a.replace(/"/g, '""')}"`
}

/**
 * 执行一次 codex 子命令并捕获完整输出（用于 --version / login status 等短命令）。
 * Windows 的 .cmd shim 经 shell 执行：拼成单条已加引号的命令字符串、不传 args 数组，
 * 既避开 Node DEP0190（shell:true + args 不转义）警告，又安全处理含空格路径。
 * 非 .cmd（unix）直接 shell:false 传 args。
 */
export function captureCodex(
  binPath: string,
  args: string[],
  timeoutMs = 15000
): Promise<CaptureResult> {
  return new Promise((resolve) => {
    const useShell = needsShell(binPath)
    const child = useShell
      ? spawn([binPath, ...args].map(quoteArg).join(' '), { shell: true, windowsHide: true })
      : spawn(binPath, args, { shell: false, windowsHide: true })

    let stdout = ''
    let stderr = ''
    let timedOut = false

    const timer = setTimeout(() => {
      timedOut = true
      child.kill()
    }, timeoutMs)

    child.stdout?.on('data', (d) => (stdout += d.toString()))
    child.stderr?.on('data', (d) => (stderr += d.toString()))
    child.on('error', (err) => {
      clearTimeout(timer)
      resolve({ code: null, stdout, stderr: `${stderr}${String(err)}`, timedOut })
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      resolve({ code, stdout, stderr, timedOut })
    })
  })
}
