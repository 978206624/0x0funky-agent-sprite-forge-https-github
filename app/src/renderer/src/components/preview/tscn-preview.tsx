import { useEffect, useState } from 'react'
import { ImageOff } from 'lucide-react'
import type { PreviewData } from '../../hooks/use-preview'
import { buildPreviewPaths } from '../../lib/preview-tabs'

/**
 * Godot .tscn 场景预览（用于多 tab 的 Godot .tscn tab）。
 * 解析策略：极简的 INI-like 解析器（split by [section]），只关心
 *   - [node ... type="Sprite2D"|"SpriteFrames"] 的 position/scale
 *   - [ext_resource type="Texture2D" path="..."] 与 ExtResource("id_xxx") 关联
 * 然后在 canvas 上绘制 sprite 边界框 + label（PNG 资源若在项目 assets/ 内则尝试叠加显示）。
 *
 * P1 目标是「可视证明 tscn 描述正确解析」而非真实 Godot 渲染——不做动画 playback、不做粒子/光照。
 * 真正的 .tscn 渲染器是 Godot 引擎自身的职责（P2 adapter 输出 .tscn → 用户在 Godot 内打开运行）。
 */

interface TscnNode {
  name: string
  type: string
  parent: string | null
  position?: { x: number; y: number }
  scale?: { x: number; y: number }
  textureResourceId: string | null
}

interface TscnExtResource {
  id: string
  type: string
  path: string
}

interface ParsedTscn {
  extResources: TscnExtResource[]
  nodes: TscnNode[]
}

/** 解析 "Vector2(10, 20)" / "Vector2(10.5, -3)" → { x, y }。 */
function parseVector2(s: string | null): { x: number; y: number } | null {
  if (!s) return null
  const m = /Vector2\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)/.exec(s)
  return m ? { x: Number(m[1]), y: Number(m[2]) } : null
}

/** 解析 ExtResource("1_abcde") → "1_abcde"。 */
function parseExtResourceRef(s: string | null): string | null {
  if (!s) return null
  const m = /ExtResource\(\s*"([^"]+)"\s*\)/.exec(s)
  return m ? m[1] : null
}

/** 极简行式 .tscn 解析。注释以 ; 开头；[section] 切分；key = value 一行一项。 */
function parseTscn(text: string): ParsedTscn | null {
  try {
    const lines = text.split(/\r?\n/)
    const extResources: TscnExtResource[] = []
    const nodes: TscnNode[] = []
    let currentNode: TscnNode | null = null
    for (const raw of lines) {
      const line = raw.trim()
      if (!line || line.startsWith(';')) continue
      if (line.startsWith('[ext_resource')) {
        const id = /id="([^"]+)"/.exec(line)?.[1] ?? ''
        const type = /type="([^"]+)"/.exec(line)?.[1] ?? ''
        const path = /path="([^"]+)"/.exec(line)?.[1] ?? ''
        extResources.push({ id, type, path })
        continue
      }
      if (line.startsWith('[node ')) {
        if (currentNode) nodes.push(currentNode)
        const name = /name="([^"]+)"/.exec(line)?.[1] ?? ''
        const type = /type="([^"]+)"/.exec(line)?.[1] ?? ''
        const parent = /parent="([^"]+)"/.exec(line)?.[1] ?? null
        currentNode = { name, type, parent, textureResourceId: null }
        continue
      }
      if (line.startsWith('[') && line.endsWith(']')) {
        // 其它段（sub_resource / gd_scene 等）：结束当前 node，不展开
        if (currentNode) {
          nodes.push(currentNode)
          currentNode = null
        }
        continue
      }
      if (currentNode && line.includes('=')) {
        const [k, ...rest] = line.split('=')
        const key = k.trim()
        const value = rest.join('=').trim()
        if (key === 'position') currentNode.position = parseVector2(value) ?? undefined
        else if (key === 'scale') currentNode.scale = parseVector2(value) ?? undefined
        else if (key === 'texture') currentNode.textureResourceId = parseExtResourceRef(value)
      }
    }
    if (currentNode) nodes.push(currentNode)
    if (nodes.length === 0 && extResources.length === 0) return null
    return { extResources, nodes }
  } catch {
    return null
  }
}

/**
 * 把 ext_resource path（res://icon.svg / res://art/foo.png）映射到 asset:// URL。
 * 约定：P2 adapter 写出的 .tscn 里 texture path 为相对路径 assets/sprites/<slug>/<file>.png
 * 或裸文件名 <file>.png。
 * P1 阶段先用 sprite 的大图（sheet-transparent.png）作为占位：保证「tscn 中引用的资源可视化」，
 * 避免 404。P2 真正落地时按 extPath → 同目录 PNG 的规则再细化。
 */
function guessTextureAssetUrl(extPath: string, spritePngUrl: string): string {
  // 暂不展开 extPath 解析（见函数头注释）；P2 阶段实现。
  void extPath
  return spritePngUrl
}

export function TscnPreview({ preview }: { preview: PreviewData }) {
  const paths = buildPreviewPaths(preview)
  const [state, setState] = useState<
    { kind: 'loading' } | { kind: 'error'; reason: string } | { kind: 'ok'; data: ParsedTscn }
  >({ kind: 'loading' })
  const [imgError, setImgError] = useState(false)

  useEffect(() => {
    let cancelled = false
    setState({ kind: 'loading' })
    setImgError(false)
    void (async (): Promise<void> => {
      try {
        const res = await fetch(paths.tscn.tscnUrl)
        if (!res.ok) {
          if (!cancelled) setState({ kind: 'error', reason: `tscn 资源缺失 (${res.status})` })
          return
        }
        const text = await res.text()
        const parsed = parseTscn(text)
        if (!parsed) {
          if (!cancelled) setState({ kind: 'error', reason: 'tscn 解析失败或空文件' })
          return
        }
        if (!cancelled) setState({ kind: 'ok', data: parsed })
      } catch (e) {
        if (!cancelled) setState({ kind: 'error', reason: e instanceof Error ? e.message : '加载失败' })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [paths.tscn.tscnUrl])

  if (state.kind === 'loading') {
    return (
      <div className="checker-bg flex h-[480px] w-[672px] items-center justify-center rounded-md border border-edge-strong">
        <span className="text-xs text-fg-dim">解析 .tscn…</span>
      </div>
    )
  }
  if (state.kind === 'error') {
    return (
      <div className="checker-bg flex h-[480px] w-[672px] items-center justify-center rounded-md border border-edge-strong">
        <div className="flex flex-col items-center gap-2 text-fg-dim">
          <ImageOff className="h-8 w-8" />
          <span className="text-xs">Godot .tscn 预览不可用</span>
          <span className="font-mono text-[11px] text-fg-dim">{state.reason}</span>
        </div>
      </div>
    )
  }

  const { data } = state
  const spriteNodes = data.nodes.filter(
    (n) => n.type === 'Sprite2D' || n.type === 'Sprite3D' || n.type === 'TextureRect'
  )

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="checker-bg relative flex h-[480px] w-[672px] items-center justify-center overflow-hidden rounded-md border border-edge-strong">
        {imgError || spriteNodes.length === 0 ? (
          <div className="flex flex-col items-center gap-2 text-fg-dim">
            <ImageOff className="h-8 w-8" />
            <span className="text-xs">
              {spriteNodes.length === 0 ? 'tscn 中无 Sprite2D/TextureRect 节点' : '大图资源缺失'}
            </span>
          </div>
        ) : (
          <div className="relative h-[448px] w-[640px] overflow-hidden rounded-sm border border-edge">
            {spriteNodes.map((node) => {
              const res = node.textureResourceId
                ? data.extResources.find((r) => r.id === node.textureResourceId)
                : null
              const url = res ? guessTextureAssetUrl(res.path, paths.tscn.pngUrl) : paths.tscn.pngUrl
              const x = node.position?.x ?? 0
              const y = node.position?.y ?? 0
              const sx = node.scale?.x ?? 1
              const sy = node.scale?.y ?? 1
              return (
                <div
                  key={node.name}
                  className="absolute"
                  style={{ left: x, top: y, transform: `scale(${sx}, ${sy})`, transformOrigin: '0 0' }}
                  title={`${node.type} "${node.name}" @ (${x}, ${y}) ×(${sx}, ${sy})`}
                >
                  <img
                    src={url}
                    alt={node.name}
                    draggable={false}
                    onError={() => setImgError(true)}
                    className="pixelated max-h-[200px] max-w-[200px] object-contain"
                  />
                </div>
              )
            })}
          </div>
        )}
      </div>
      <div className="font-mono text-xs text-fg-dim">
        {data.nodes.length} 节点 · {data.extResources.length} ext_resource · sprite={spriteNodes.length}
      </div>
    </div>
  )
}