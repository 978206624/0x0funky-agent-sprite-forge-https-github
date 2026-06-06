import { cp, stat } from 'fs/promises'
import { isAbsolute, relative, resolve } from 'path'

/** 导出一次产出 bundle 的入参。 */
export interface ExportBundleInput {
  /** 源 bundle 目录绝对路径（<项目>/assets/sprites/<slug>/）。 */
  outputDir: string
  /** 产出 slug，决定目标子目录名。 */
  slug: string
  /** 用户选定的导出根目录（可在项目外）。 */
  destRoot: string
}

/**
 * target 是否在 base 之内（含等于）。Windows 大小写不敏感。
 * 用 path.relative 判断而非字符串前缀：前缀法在盘符/UNC 根目录（如 `D:\`）会因尾部分隔符误判，
 * 致用户选盘符根做导出目录时合法路径被拒。relative 法对根目录语义正确。
 */
function isInside(target: string, base: string): boolean {
  const norm = (p: string): string => (process.platform === 'win32' ? p.toLowerCase() : p)
  const rel = relative(norm(base), norm(target))
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
}

/** slug 必须是单层安全目录名：非空、无路径分隔符、非 . / ..（防 destRoot 逃逸）。 */
function assertSafeSlug(slug: string): void {
  if (!slug || slug === '.' || slug === '..' || /[\\/]/.test(slug)) {
    throw new Error(`非法的导出目录名：${JSON.stringify(slug)}`)
  }
}

/**
 * 将一次产出的整套 bundle 复制到导出目录：`<destRoot>/<slug>/`。
 * 复制前：校验 slug 为单层安全目录名、源目录存在且为目录、目标落在 destRoot 内、
 * 且目标不等于/不落在产物目录内（防 cp 自我递归复制，给出清晰错误而非底层异常）。
 * 目标若已存在同名目录则覆盖合并（cp recursive，默认 force）。
 * 保证 Phaser 接入物料齐全（整目录原样复制）。返回最终写入的目标目录绝对路径。
 */
export async function exportBundle(input: ExportBundleInput): Promise<string> {
  const { outputDir, slug, destRoot } = input
  assertSafeSlug(slug)

  let st: Awaited<ReturnType<typeof stat>>
  try {
    st = await stat(outputDir)
  } catch {
    throw new Error(`产物目录不存在：${outputDir}`)
  }
  if (!st.isDirectory()) throw new Error(`产物路径不是目录：${outputDir}`)

  const root = resolve(destRoot)
  const src = resolve(outputDir)
  const dest = resolve(root, slug)

  // 词法越权防护：slug 已校验为单层目录名，dest 必落在 destRoot 内；仍显式断言收口信任边界。
  if (!isInside(dest, root)) {
    throw new Error(`导出目标逃逸所选目录：${dest}`)
  }
  // 防自我递归复制：目标等于产物目录或落在其内部时 cp 会递归/底层报错，提前给出清晰错误。
  if (isInside(dest, src)) {
    throw new Error('不能导出到产物目录自身或其子目录')
  }

  await cp(src, dest, { recursive: true })
  return dest
}
