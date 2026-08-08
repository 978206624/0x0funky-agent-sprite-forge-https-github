import * as fs from 'node:fs'
import * as path from 'node:path'
import { randomUUID } from 'node:crypto'
import type { IExportAdapter, ExportOptions } from '../IExportAdapter'
import type { SpriteAssetSource, AdapterExportResult, ValidationReport } from '../../../../shared/types'
import tplProject from './templates/project.godot.tpl?raw'
import tplScene from './templates/sprite.tscn.tpl?raw'
import tplSpriteFrames from './templates/sprite_frames.tres.tpl?raw'
import tplManifest from './templates/manifest.json.tpl?raw'

/** Godot 4.x 适配器专用选项。 */
export interface Godot4Options {
  /** 是否在产物中附带一张子目录预览图（首版预留）。 */
  includePreview?: boolean
}

function isPNG(filePath: string): boolean {
  try {
    const fd = fs.openSync(filePath, 'r')
    const buf = Buffer.alloc(8)
    fs.readSync(fd, buf, 0, 8, 0)
    fs.closeSync(fd)
    return buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47
  } catch {
    return false
  }
}

function genUID(): string {
  const hex = randomUUID().replace(/-/g, '')
  return `uid://d${hex.slice(0, 12)}`
}

/** 简单的占位符替换。不支持循环/条件，仅 `{{KEY}}` → 值。 */
function render(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_m, key: string) => vars[key] ?? _m)
}

/** 生成 AtlasTexture 块列表 */
function buildAtlasTextures(
  frameCount: number,
  cols: number,
  fw: number,
  fh: number
): { blocks: string; refs: string } {
  const parts: string[] = []
  const refs: string[] = []
  for (let i = 0; i < frameCount; i++) {
    const col = i % cols
    const row = Math.floor(i / cols)
    parts.push(
      `[sub_resource type="AtlasTexture" id="AtlasTexture_${i}"]\n` +
        `atlas = ExtResource("1_sheet")\n` +
        `region = Rect2(${col * fw}, ${row * fh}, ${fw}, ${fh})\n`
    )
    refs.push(`SubResource("AtlasTexture_${i}")`)
  }
  return { blocks: parts.join('\n'), refs: `[${refs.join(', ')}]` }
}

export class Godot4Adapter implements IExportAdapter<Godot4Options> {
  id = 'godot'
  displayName = 'Godot 4.x'
  version = '0.1.0'
  description = '将精灵序列帧导出为 Godot 4.x 可用的 .tscn + .tres 资源包，含 SpriteFrames 动画配置。'

  validate(source: SpriteAssetSource): ValidationReport {
    const errors: string[] = []
    const warnings: string[] = []

    if (source.frames.length === 0) {
      errors.push('frames 为空')
    }

    for (const f of source.frames) {
      if (!fs.existsSync(f)) {
        errors.push(`帧文件不存在: ${f}`)
        continue
      }
      if (!isPNG(f)) {
        errors.push(`帧文件不是 PNG: ${f}`)
      }
    }

    if (!fs.existsSync(source.sheet)) {
      errors.push(`精灵表文件不存在: ${source.sheet}`)
    } else if (!isPNG(source.sheet)) {
      errors.push(`精灵表不是 PNG: ${source.sheet}`)
    }

    if (source.gridCols < 1) {
      errors.push(`gridCols 必须 ≥ 1，当前 ${source.gridCols}`)
    }
    if (source.gridRows < 1) {
      errors.push(`gridRows 必须 ≥ 1，当前 ${source.gridRows}`)
    }
    if (source.frameCount !== source.gridRows * source.gridCols) {
      warnings.push(
        `frameCount (${source.frameCount}) ≠ gridRows × gridCols (${source.gridRows} × ${source.gridCols} = ${source.gridRows * source.gridCols})`
      )
    }

    return { ok: errors.length === 0, errors, warnings }
  }

  async export(
    source: SpriteAssetSource,
    options: ExportOptions<Godot4Options>
  ): Promise<AdapterExportResult> {
    const report = this.validate(source)
    if (!report.ok) {
      throw new Error(`校验失败: ${report.errors.join('; ')}`)
    }

    const { slug, frames, sheet, gridCols, gridRows, frameWidth, frameHeight, frameCount } = source
    const destDir = path.join(options.destRoot, `godot-${slug}`)
    const texDir = path.join(destDir, 'textures')

    fs.mkdirSync(texDir, { recursive: true })

    const resultFiles: { targetPath: string; sizeBytes: number }[] = []
    const warnings: string[] = [...report.warnings]

    // 复制单帧 PNG
    fs.mkdirSync(texDir, { recursive: true })
    for (let i = 0; i < frames.length; i++) {
      const dstName = `${slug}-${i}.png`
      const dstPath = path.join(texDir, dstName)
      fs.copyFileSync(frames[i], dstPath)
      resultFiles.push({ targetPath: path.join('textures', dstName), sizeBytes: fs.statSync(dstPath).size })
    }

    // 复制 sheet
    const sheetDstName = `${slug}-sheet.png`
    const sheetDstPath = path.join(texDir, sheetDstName)
    fs.copyFileSync(sheet, sheetDstPath)
    resultFiles.push({ targetPath: path.join('textures', sheetDstName), sizeBytes: fs.statSync(sheetDstPath).size })

    // 构建 AtlasTexture 块
    const { blocks: atlasBlocks, refs: frameRefs } = buildAtlasTextures(
      frameCount,
      gridCols,
      frameWidth,
      frameHeight
    )

    // 模板变量
    const tplVars: Record<string, string> = {
      SLUG: slug,
      FRAME_COUNT: String(frameCount),
      COLUMNS: String(gridCols),
      ROWS: String(gridRows),
      FRAME_W: String(frameWidth),
      FRAME_H: String(frameHeight),
      HALF_W: String(Math.round(frameWidth / 2)),
      HALF_H: String(Math.round(frameHeight / 2)),
      LOAD_STEPS: String(frameCount + 2), // ext_resource + N atlas textures + resource
      UID_SCENE: genUID(),
      UID_TRES: genUID(),
      ATLAS_TEXTURES: atlasBlocks,
      FRAME_REFS: frameRefs,
      FRAME_LIST: Array.from({ length: frameCount }, (_, i) => {
        const col = i % gridCols
        const row = Math.floor(i / gridCols)
        return `Rect2(${col * frameWidth}, ${row * frameHeight}, ${frameWidth}, ${frameHeight})`
      }).join(', '),
      FRAME_PATHS: Array.from({ length: frameCount }, (_, i) => `"res://textures/${slug}-${i}.png"`).join(', '),
      FILES_JSON: '[]' // 占位，后面替换
    }

    // 渲染模板并写入
    function writeRendered(
      tpl: string,
      vars: Record<string, string>,
      relPath: string
    ): void {
      const absPath = path.join(destDir, relPath)
      const content = render(tpl, vars)
      fs.writeFileSync(absPath, content, 'utf-8')
      resultFiles.push({ targetPath: relPath, sizeBytes: Buffer.byteLength(content, 'utf-8') })
    }

    writeRendered(tplProject, tplVars, 'project.godot')

    // .tres 模板使用 UID_TRES
    const tresVars = { ...tplVars, UID: tplVars.UID_TRES }
    writeRendered(tplSpriteFrames, tresVars, `${slug}.tres`)

    // .tscn 模板使用 UID_SCENE
    const sceneVars = { ...tplVars, UID: tplVars.UID_SCENE }
    writeRendered(tplScene, sceneVars, `${slug}.tscn`)

    // manifest.json
    const filesJson = JSON.stringify(
      resultFiles.map((f) => ({ targetPath: f.targetPath, sizeBytes: f.sizeBytes }))
    )
    const manifestVars = { ...tplVars, FILES_JSON: filesJson }
    writeRendered(tplManifest, manifestVars, 'manifest.json')

    return {
      ok: true,
      adapterId: this.id,
      files: resultFiles,
      destRoot: destDir,
      warnings,
      errors: []
    }
  }
}
