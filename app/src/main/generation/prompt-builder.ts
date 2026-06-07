import type { GenParams } from '../../shared/types'
import { resolveGrid, resolveCell } from '../../shared/sprite-grid'

export { frameCount } from '../../shared/sprite-grid'

/**
 * 把参数表单 + 主题组装为交给 codex 的自然语言指令。
 * generate2dsprite 是 agent 驱动 skill：codex 自己推断方案、写创意 prompt、调 image_gen、
 * 跑后处理脚本。本指令的职责是把工作台的结构化约束（网格/帧尺寸/对齐/容纳/落盘位置）
 * 显式钉死，让产出可复现、并落到 <项目>/assets/sprites/<slug>/。
 * 对照真实 prompt-used.txt + SKILL.md 参数语义编写。
 * 网格/帧尺寸计算复用 shared/sprite-grid（与渲染层 use-preview 同口径）。
 */

export interface SpritePromptInput {
  /** 产出 slug，决定落盘目录与帧文件名前缀。 */
  slug: string
  params: GenParams
}

/** 单方向朝向 → 自然语言描述（对齐内置 SKILL.md direction 语义）。 */
const DIRECTION_DESC: Record<string, string> = {
  down: 'toward the camera (front view)',
  left: 'to the left (left side profile)',
  right: 'to the right (right side profile)',
  up: 'away from the camera (back view)'
}

/**
 * 单方向时的朝向约束行。
 * - 显式 direction → 钉死该朝向，全表一致。
 * - 无 direction：side 视角默认单一侧面；topdown / 3-4 默认朝下（面向镜头）。
 * 返回 null 表示不附加（未知 view 且无 direction，交给 skill 自行推断）。
 */
function facingLine(view: string, direction: string | undefined): string | null {
  const dir = direction?.toLowerCase()
  if (dir && DIRECTION_DESC[dir]) {
    return `Facing / direction: render the subject facing ${DIRECTION_DESC[dir]} consistently across every frame; do not change facing within the sheet.`
  }
  const v = view.toLowerCase()
  if (v === 'side') return 'Facing: a single consistent side profile across all frames.'
  if (v === 'topdown' || v === '3-4' || v === '3/4') {
    return 'Facing: a single consistent down/front facing (toward the camera) across all frames unless otherwise required.'
  }
  return null
}

/** 四方向整表的布局指令块（行=朝向、列=动作帧），对齐 SKILL.md player_sheet 语义。 */
function multiDirLayoutLines(slug: string, action: string, cols: number, frames: number, cell: number): string[] {
  return [
    'Sheet layout (4-direction sheet, must match exactly):',
    `- grid: 4 rows by ${cols} columns, ${frames} equal cells, read left-to-right top-to-bottom`,
    '- this is ONE action laid out across four facings, NOT four different actions in the rows',
    '- row 1 = DOWN (facing toward the camera / front), row 2 = LEFT (left side profile), row 3 = RIGHT (mirror of left), row 4 = UP (back to camera)',
    `- each row holds the ${cols} frame(s) of the same ${action} action for that facing, in sequence`,
    '- keep the SAME character identity, SAME body height/scale and SAME on-screen size in every cell; only facing and per-frame pose change',
    `- cell size: ${cell}px per frame`,
    `- frame label prefix: ${slug} (frames named ${slug}-1 .. ${slug}-${frames}, row-major: row 1 first)`
  ]
}

/** 单方向的布局指令块。 */
function singleDirLayoutLines(slug: string, rows: number, cols: number, frames: number, cell: number): string[] {
  return [
    'Sheet layout (must match exactly):',
    `- grid: ${rows} rows by ${cols} columns, ${frames} equal cells, read left-to-right top-to-bottom`,
    `- cell size: ${cell}px per frame`,
    `- frame label prefix: ${slug} (frames named ${slug}-1 .. ${slug}-${frames})`
  ]
}

/** 高级后处理参数行（仅输出用户显式给定的项，未给的留给 skill 自行推断）。 */
function advancedLines(p: GenParams): string[] {
  const lines: string[] = []
  if (p.alignment) lines.push(`- anchor/align: ${p.alignment}`)
  if (typeof p.fitScale === 'number') lines.push(`- fit_scale: ${p.fitScale}`)
  if (typeof p.sourcePadding === 'number') lines.push(`- source_padding: ${p.sourcePadding}`)
  if (typeof p.edgeTouchMargin === 'number') lines.push(`- edge_touch_margin: ${p.edgeTouchMargin}`)
  if (typeof p.duration === 'number') lines.push(`- gif frame duration: ${p.duration} ms`)
  if (typeof p.sharedScale === 'boolean') lines.push(`- shared_scale: ${p.sharedScale}`)
  return lines
}

/** 组装一次 sprite 生成的完整 prompt。 */
export function buildSpritePrompt(input: SpritePromptInput): string {
  const { slug, params } = input
  const { rows, cols } = resolveGrid(params)
  const frames = rows * cols
  const cell = resolveCell(params)
  const outDir = `assets/sprites/${slug}`

  const assetType = params.assetType ?? 'character'
  const action = params.action ?? 'idle'
  const view = params.view ?? 'side'
  const multiDir = params.multiDir === true
  const theme = params.theme?.trim() || `a ${assetType} ${action} animation`

  const advanced = advancedLines(params)
  const refCount = params.refImages?.length ?? 0

  // 四方向整表用专属布局块（行=朝向）；单方向用普通布局 + 朝向约束行。
  const layoutLines = multiDir
    ? multiDirLayoutLines(slug, action, cols, frames, cell)
    : singleDirLayoutLines(slug, rows, cols, frames, cell)
  const facing = multiDir ? null : facingLine(view, params.direction)

  return [
    'Use the generate2dsprite skill to produce one 2D game sprite animation sheet.',
    '',
    `Subject / theme: ${theme}`,
    `Asset type: ${assetType}. Action: ${action}. View: ${view}.`,
    ...(facing ? [facing] : []),
    ...(refCount
      ? [
          `Reference images: ${refCount} image(s) are attached to this message. Use them as the primary visual reference for the character's identity, design, color palette and art style; keep the generated sprite faithful to them while still satisfying the layout and constraints below.`
        ]
      : []),
    '',
    ...layoutLines,
    '',
    'Hard constraints (do not relax):',
    '- perfectly flat solid #FF00FF chroma-key background, no gradients/shadows/floor',
    '- same character/asset identity, same bounding box and pixel scale across all frames',
    '- full body inside the central safe area of each cell; nothing crosses cell edges',
    '- consistent feet/bottom anchor line when applicable; generous magenta margin per cell',
    ...(advanced.length ? ['', 'Postprocess parameters:', ...advanced] : []),
    '',
    'Output (write the full processed bundle into the current project working directory):',
    `- put all output files under the relative path: ${outDir}/`,
    `- include: raw-sheet.png, raw-sheet-clean.png, sheet-transparent.png, ${slug}-1.png .. ${slug}-${frames}.png, animation.gif, prompt-used.txt, pipeline-meta.json, phaser-example.js, README.md`,
    '- run the local postprocess script for chroma-key cleanup, frame extraction, alignment, QC, transparent export and GIF; do not hand-place frames',
    `- the sheet must yield exactly ${frames} frames matching the ${rows}x${cols} grid`,
    '',
    'Scope (do not exceed):',
    `- write all generation outputs only inside ${outDir}/; do not create or modify files at the project root`,
    `- inside ${outDir}/, bundle support files such as README.md and phaser-example.js are expected and allowed`,
    '- do NOT create or modify Product-Spec files, changelogs, design docs, git metadata, or unrelated project files',
    '- do not require the working directory to be a git repository'
  ].join('\n')
}
