import type { GenParams } from '../../shared/types'

/**
 * 把参数表单 + 主题组装为交给 codex 的自然语言指令。
 * generate2dsprite 是 agent 驱动 skill：codex 自己推断方案、写创意 prompt、调 image_gen、
 * 跑后处理脚本。本指令的职责是把工作台的结构化约束（网格/帧尺寸/对齐/容纳/落盘位置）
 * 显式钉死，让产出可复现、并落到 <项目>/assets/sprites/<slug>/。
 * 对照真实 prompt-used.txt + SKILL.md 参数语义编写。
 */

/** 解析有效网格（rows×cols）。未指定时按动作给保守默认（参照 SKILL.md Defaults）。 */
export function resolveGrid(params: GenParams): { rows: number; cols: number } {
  if (params.gridRows && params.gridCols && params.gridRows > 0 && params.gridCols > 0) {
    return { rows: Math.floor(params.gridRows), cols: Math.floor(params.gridCols) }
  }
  // SKILL.md 默认：cast→2x3，其余短动作→2x2。
  const action = (params.action ?? '').toLowerCase()
  if (action === 'cast' || action === 'attack' || action === 'run' || action === 'charge') {
    return { rows: 3, cols: 2 }
  }
  return { rows: 2, cols: 2 }
}

/** 总帧数 = rows × cols。 */
export function frameCount(params: GenParams): number {
  const { rows, cols } = resolveGrid(params)
  return rows * cols
}

export interface SpritePromptInput {
  /** 产出 slug，决定落盘目录与帧文件名前缀。 */
  slug: string
  params: GenParams
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
  const cell = params.frameWidth ?? 256
  const outDir = `assets/sprites/${slug}`

  const assetType = params.assetType ?? 'character'
  const action = params.action ?? 'idle'
  const view = params.view ?? 'side'
  const theme = params.theme?.trim() || `a ${assetType} ${action} animation`

  const advanced = advancedLines(params)

  return [
    'Use the generate2dsprite skill to produce one 2D game sprite animation sheet.',
    '',
    `Subject / theme: ${theme}`,
    `Asset type: ${assetType}. Action: ${action}. View: ${view}.`,
    '',
    'Sheet layout (must match exactly):',
    `- grid: ${rows} rows by ${cols} columns, ${frames} equal cells, read left-to-right top-to-bottom`,
    `- cell size: ${cell}px per frame`,
    `- frame label prefix: ${slug} (frames named ${slug}-1 .. ${slug}-${frames})`,
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
    `- include: raw-sheet.png, raw-sheet-clean.png, sheet-transparent.png, ${slug}-1.png .. ${slug}-${frames}.png, animation.gif, prompt-used.txt, pipeline-meta.json`,
    '- run the local postprocess script for chroma-key cleanup, frame extraction, alignment, QC, transparent export and GIF; do not hand-place frames',
    `- the sheet must yield exactly ${frames} frames matching the ${rows}x${cols} grid`
  ].join('\n')
}
