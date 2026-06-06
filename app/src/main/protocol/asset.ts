import { protocol } from 'electron'
import { readFile, realpath } from 'fs/promises'
import { resolve, sep, extname } from 'path'
import { getCurrentProject } from '../projects/manager'

/**
 * asset:// 自定义安全协议：让渲染层用 <img src="asset://sprites/<slug>/x.png"> 读取
 * 当前项目 assets/ 内的产物图，而无需放开 file:// 或走 base64 IPC。
 * 安全约束：请求路径必须规范化后仍落在「当前项目 absPath/assets/」内，否则 403；
 * 无当前项目则 404。防 ../ 越权读任意文件。
 */

const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.json': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8'
}

/** 必须在 app ready 之前调用（注册 scheme 权限）。 */
export function registerAssetSchemePrivileges(): void {
  protocol.registerSchemesAsPrivileged([
    // 仅服务 <img> 预览，不放 supportFetchAPI（不需要 renderer fetch('asset://')），缩小能力面。
    { scheme: 'asset', privileges: { standard: true, secure: true, stream: true } }
  ])
}

/** 路径是否在 base 之内（含等于）。Windows 大小写不敏感。 */
function isInside(target: string, base: string): boolean {
  const norm = (p: string): string => (process.platform === 'win32' ? p.toLowerCase() : p)
  const t = norm(target)
  const b = norm(base)
  return t === b || t.startsWith(b + sep)
}

/** 把 asset://<host><path> 还原为 assets/ 下的相对路径（去首斜杠）。 */
function toRelPath(rawUrl: string): string | null {
  try {
    const u = new URL(rawUrl)
    const rel = decodeURIComponent(`${u.host}${u.pathname}`).replace(/^\/+/, '')
    return rel || null
  } catch {
    return null
  }
}

/** 须在 app ready 之后调用一次，注册 asset:// 的处理器。 */
export function registerAssetProtocol(): void {
  protocol.handle('asset', async (request) => {
    const project = getCurrentProject()
    if (!project) return new Response('no current project', { status: 404 })

    const rel = toRelPath(request.url)
    if (!rel) return new Response('bad asset url', { status: 400 })

    const base = resolve(project.absPath, 'assets')
    const target = resolve(base, rel)
    // ① 词法越权防护：规范化后的目标必须等于 base 或在 base/ 之内（挡 ../、绝对路径）。
    if (!isInside(target, base)) {
      return new Response('forbidden', { status: 403 })
    }

    // ② realpath 越权防护：readFile 会跟随 symlink/junction，需校验真实目标仍在 assets 真实目录内
    //    （挡 assets 内指向项目外的链接逃逸）。realpath 不存在的路径会抛错 → 当作 404。
    let baseReal: string
    let targetReal: string
    try {
      baseReal = await realpath(base)
      targetReal = await realpath(target)
    } catch {
      return new Response('not found', { status: 404 })
    }
    if (!isInside(targetReal, baseReal)) {
      return new Response('forbidden', { status: 403 })
    }

    try {
      const data = await readFile(targetReal)
      const type = MIME[extname(targetReal).toLowerCase()] ?? 'application/octet-stream'
      return new Response(new Uint8Array(data), { headers: { 'content-type': type } })
    } catch {
      return new Response('not found', { status: 404 })
    }
  })
}
