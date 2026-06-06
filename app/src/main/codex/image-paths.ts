import { statSync } from 'fs'
import { isAbsolute, extname } from 'path'

/** codex --image 支持的格式（与 ipc/dialog.ts 选择器过滤器同口径）。 */
const ALLOWED_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp'])
/** 单次最多附图数（防 renderer 传入超大数组撑爆命令行/拖垮 codex）。 */
const MAX_IMAGES = 8
/** 单条路径长度上限（防异常超长串）。 */
const MAX_PATH_LEN = 1024

/**
 * 主进程侧参考图路径白名单校验（信任边界）。
 * refImages/attachments 名义上来自原生文件选择器，但 IPC 入参不可信：renderer 被攻破时
 * 可绕过选择器传任意字符串，最终拼进 `codex --image`（Windows 经 .cmd shell，引号转义并非绝对安全）。
 * 故只放行：字符串 + 绝对路径 + 扩展名白名单 + 真实存在的文件；并去重、限量、限长。
 * 非法项静默丢弃（不抛错，避免单个坏路径阻断整轮生成）。
 */
export function sanitizeImagePaths(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  const out: string[] = []
  for (const item of input) {
    if (out.length >= MAX_IMAGES) break
    if (typeof item !== 'string') continue
    const p = item.trim()
    if (!p || p.length > MAX_PATH_LEN) continue
    if (!isAbsolute(p)) continue
    if (!ALLOWED_EXT.has(extname(p).toLowerCase())) continue
    try {
      if (!statSync(p).isFile()) continue
    } catch {
      continue // 不存在/不可访问
    }
    if (!out.includes(p)) out.push(p)
  }
  return out
}
