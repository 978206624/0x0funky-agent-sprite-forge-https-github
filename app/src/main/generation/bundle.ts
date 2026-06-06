import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

/**
 * sprite bundle 校验（param 生成与对话生成共用，避免「何为一个完整 bundle」两处漂移）。
 * - validateBundleStrict：param 模式，按预期帧数严格断言（缺任一文件/帧数不符即失败）。
 * - inspectBundleLenient：对话模式，bundle 可选，帧数由 pipeline-meta 推导（无目录/无 meta = 未产出）。
 *
 * 仅 gate 核心可运行产物；include 清单里的 README.md / phaser-example.js 是辅助文件，缺失不判失败。
 */
export const REQUIRED_BUNDLE_FILES = [
  'raw-sheet.png',
  'raw-sheet-clean.png',
  'sheet-transparent.png',
  'animation.gif',
  'prompt-used.txt',
  'pipeline-meta.json'
] as const

/** pipeline-meta.json 中我们关心的字段（容错读取）。 */
interface PipelineMeta {
  rows?: unknown
  cols?: unknown
  cell_size?: unknown
  frames?: unknown[]
}

/** 读取并 parse pipeline-meta.json；不存在/parse 失败返回 null。 */
function readMeta(outputDir: string): PipelineMeta | null {
  try {
    return JSON.parse(
      readFileSync(join(outputDir, 'pipeline-meta.json'), 'utf8')
    ) as PipelineMeta
  } catch {
    return null
  }
}

/** 核心文件是否齐全；缺失返回缺的文件名，齐全返回 null。 */
function missingCoreFile(outputDir: string): string | null {
  for (const f of REQUIRED_BUNDLE_FILES) {
    if (!existsSync(join(outputDir, f))) return f
  }
  return null
}

/** 帧 PNG（slug-1..count）是否齐全；缺失返回缺的帧名，齐全返回 null。 */
function missingFramePng(outputDir: string, slug: string, count: number): string | null {
  for (let i = 1; i <= count; i++) {
    if (!existsSync(join(outputDir, `${slug}-${i}.png`))) return `${slug}-${i}.png`
  }
  return null
}

/**
 * 严格校验落盘 bundle 是否齐全且帧数匹配网格（param 模式）。
 * 返回 { ok, thumbnail, reason }；失败时保留 raw-sheet 供排查（不删任何文件）。
 */
export function validateBundleStrict(
  outputDir: string,
  slug: string,
  expectedFrames: number
): { ok: boolean; thumbnail: string | null; reason: string | null } {
  const missCore = missingCoreFile(outputDir)
  if (missCore) return { ok: false, thumbnail: null, reason: `缺少产物文件：${missCore}` }

  const missFrame = missingFramePng(outputDir, slug, expectedFrames)
  if (missFrame) return { ok: false, thumbnail: null, reason: `缺少帧文件：${missFrame}` }

  // 帧数校验（以 pipeline-meta 为准）。
  const meta = readMeta(outputDir)
  if (!meta) return { ok: false, thumbnail: null, reason: 'pipeline-meta.json 解析失败' }
  const actual = Array.isArray(meta.frames) ? meta.frames.length : -1
  if (actual !== expectedFrames) {
    return {
      ok: false,
      thumbnail: null,
      reason: `帧数不符：期望 ${expectedFrames}，pipeline-meta 实得 ${actual}`
    }
  }
  return { ok: true, thumbnail: join(outputDir, `${slug}-1.png`), reason: null }
}

/** 正整数兜底（从 meta 读 rows/cols/cell 时用）。 */
function posIntOrNull(v: unknown): number | null {
  const n = typeof v === 'number' ? Math.floor(v) : NaN
  return Number.isFinite(n) && n > 0 ? n : null
}

/** 对话模式 bundle 探测结果。present=false 表示本轮纯聊天未产 sprite。 */
export interface BundleInspection {
  present: boolean
  /** 帧数（来自 meta.frames 长度）；未产出为 0。 */
  frames: number
  /** 缩略图（第 1 帧）绝对路径；未产出为 null。 */
  thumbnail: string | null
  /** 网格行（来自 meta）；缺省 null。 */
  rows: number | null
  /** 网格列（来自 meta）；缺省 null。 */
  cols: number | null
  /** 单帧尺寸（来自 meta.cell_size）；缺省 null。 */
  cell: number | null
}

const ABSENT: BundleInspection = {
  present: false,
  frames: 0,
  thumbnail: null,
  rows: null,
  cols: null,
  cell: null
}

/**
 * 宽松探测落盘 bundle（对话模式）：帧数由 meta 推导而非预期断言，bundle 可选。
 * 目录不存在 / 核心文件缺失 / meta 缺失或 parse 失败 / frames 非正 / 帧 PNG 不齐 → present:false（视为纯聊天轮）。
 * 全部满足 → present:true，并回带 meta 的真实 grid，供上层写入 generation.params。
 */
export function inspectBundleLenient(outputDir: string, slug: string): BundleInspection {
  if (!existsSync(outputDir)) return ABSENT
  if (missingCoreFile(outputDir)) return ABSENT

  const meta = readMeta(outputDir)
  if (!meta) return ABSENT
  const frames = Array.isArray(meta.frames) ? meta.frames.length : 0
  if (frames <= 0) return ABSENT
  if (missingFramePng(outputDir, slug, frames)) return ABSENT

  return {
    present: true,
    frames,
    thumbnail: join(outputDir, `${slug}-1.png`),
    rows: posIntOrNull(meta.rows),
    cols: posIntOrNull(meta.cols),
    cell: posIntOrNull(meta.cell_size)
  }
}
