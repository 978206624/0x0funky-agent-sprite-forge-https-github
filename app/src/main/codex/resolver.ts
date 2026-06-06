import { access, constants } from 'fs/promises'
import { delimiter, join } from 'path'
import { getCodexBinOverride } from '../settings/service'

// Windows 上 codex 由 npm 安装为 .cmd shim（无原生 .exe），需按扩展名优先级查找。
const WIN_EXTS = ['.cmd', '.exe', '.bat', '']
const UNIX_EXTS = ['']

async function fileExists(p: string): Promise<boolean> {
  try {
    await access(p, constants.F_OK)
    return true
  } catch {
    return false
  }
}

/**
 * 解析本机 codex 可执行文件路径。
 * 优先级：设置页自定义路径（codex.bin_override）→ CODEX_BIN 环境变量 → PATH 中按扩展名查找。
 * 找不到返回 null。不缓存：改设置后「重新检测」即时生效。
 */
export async function resolveCodexPath(): Promise<string | null> {
  const override = getCodexBinOverride()
  if (override && (await fileExists(override))) {
    return override
  }

  const fromEnv = process.env.CODEX_BIN
  if (fromEnv && (await fileExists(fromEnv))) {
    return fromEnv
  }

  const exts = process.platform === 'win32' ? WIN_EXTS : UNIX_EXTS
  const dirs = (process.env.PATH ?? '').split(delimiter).filter(Boolean)
  for (const dir of dirs) {
    for (const ext of exts) {
      const candidate = join(dir, `codex${ext}`)
      if (await fileExists(candidate)) {
        return candidate
      }
    }
  }
  return null
}

/** .cmd / .bat / .ps1 shim 需要经 shell 执行 */
export function needsShell(binPath: string): boolean {
  return /\.(cmd|bat|ps1)$/i.test(binPath)
}
