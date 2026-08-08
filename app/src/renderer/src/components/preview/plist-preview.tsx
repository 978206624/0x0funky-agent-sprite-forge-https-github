import { useEffect, useState } from 'react'
import { ImageOff } from 'lucide-react'
import type { PreviewData } from '../../hooks/use-preview'
import { buildPreviewPaths } from '../../lib/preview-tabs'

/**
 * Cocos2d-x plist 帧索引表（TexturePacker XML 格式）。
 * 约定资源布局：<项目>/assets/sprites/<slug>/<slug>.plist + 大图（复用 sheet-transparent.png）。
 * 预览策略：DOMParser 解析 plist → 提取 frames[].frame ({{x,y,w,h}}) → 在棋格背景上
 * 用 <img> sprite 定位裁切显示第一个 frame + 帧数 overlay。
 * 注意：单帧示意是 P1 阶段的可视化目标，不是 1:1 Cocos2d-x 渲染（实际引擎按 plist
 * 索引切帧播放动画；这里仅给「能否正确解析 + 切到正确位置」的视觉验证）。
 */

interface PlistFrame {
  name: string
  /** 矩形 {{x, y, w, h}}。 */
  x: number
  y: number
  w: number
  h: number
}

interface ParsedPlist {
  textureWidth: number
  textureHeight: number
  frames: PlistFrame[]
}

/**
 * 在 <dict> 的直接子节点序列里，找与 <key>name</key> 配对的 value 元素。
 * 返回首个匹配的兄弟节点（Cocos2d-x plist 的 key 元素 textContent 是字符串 key，
 * 后一个 element 是其值；值的类型由 value 元素的 tagName 反映）。
 */
function findValueForKey(dict: Element, key: string): Element | null {
  const children = Array.from(dict.children)
  for (let i = 0; i < children.length - 1; i += 1) {
    const c = children[i]
    if (c.tagName === 'key' && c.textContent === key) return children[i + 1]
  }
  return null
}

/** 提取 "{w,h}" 中的两个整数（TexturePacker metadata.size 格式 "{512,512}"）。 */
function parseSizePair(s: string | null | undefined): { w: number; h: number } {
  if (!s) return { w: 0, h: 0 }
  const m = /\{\s*(\d+)\s*,\s*(\d+)\s*\}/.exec(s)
  return m ? { w: Number(m[1]), h: Number(m[2]) } : { w: 0, h: 0 }
}

/** 提取 "{{x,y},{w,h}}" 中的四个整数。 */
function parseFrameRect(s: string | null | undefined): { x: number; y: number; w: number; h: number } | null {
  if (!s) return null
  const m = /\{\s*\{?\s*(-?\d+)\s*,\s*(-?\d+)\s*\}?\s*,\s*\{\s*(\d+)\s*,\s*(\d+)\s*\}\s*\}/.exec(s)
  return m ? { x: Number(m[1]), y: Number(m[2]), w: Number(m[3]), h: Number(m[4]) } : null
}

/** 浏览器原生 XML 解析（容错：parsererror / 缺字段都返 null）。 */
function parsePlist(xml: string): ParsedPlist | null {
  try {
    const doc = new DOMParser().parseFromString(xml, 'text/xml')
    if (doc.querySelector('parsererror')) return null
    const root = doc.documentElement
    if (root.tagName !== 'plist') return null
    const topDict = root.querySelector(':scope > dict')
    if (!topDict) return null
    const framesDict = findValueForKey(topDict, 'frames')
    if (!framesDict || framesDict.tagName !== 'dict') return null
    const metadata = findValueForKey(topDict, 'metadata')
    const { w: textureWidth, h: textureHeight } = metadata
      ? parseSizePair(findValueForKey(metadata, 'size')?.textContent)
      : { w: 0, h: 0 }
    const frames: PlistFrame[] = []
    for (const child of Array.from(framesDict.children)) {
      if (child.tagName !== 'key') continue
      const name = child.textContent ?? ''
      const frameDict = child.nextElementSibling
      if (!frameDict || frameDict.tagName !== 'dict') continue
      const rect = parseFrameRect(findValueForKey(frameDict, 'frame')?.textContent)
      if (!rect) continue
      frames.push({ name, ...rect })
    }
    if (frames.length === 0) return null
    return { textureWidth, textureHeight, frames }
  } catch {
    return null
  }
}

export function PlistPreview({ preview }: { preview: PreviewData }) {
  const paths = buildPreviewPaths(preview)
  const [state, setState] = useState<
    { kind: 'loading' } | { kind: 'error'; reason: string } | { kind: 'ok'; data: ParsedPlist }
  >({ kind: 'loading' })
  const [imgError, setImgError] = useState(false)

  useEffect(() => {
    let cancelled = false
    setState({ kind: 'loading' })
    setImgError(false)
    void (async (): Promise<void> => {
      try {
        const res = await fetch(paths.plist.plistUrl)
        if (!res.ok) {
          if (!cancelled) setState({ kind: 'error', reason: `plist 资源缺失 (${res.status})` })
          return
        }
        const text = await res.text()
        const parsed = parsePlist(text)
        if (!parsed) {
          if (!cancelled) setState({ kind: 'error', reason: 'plist 解析失败或不含帧' })
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
  }, [paths.plist.plistUrl])

  if (state.kind === 'loading') {
    return (
      <div className="checker-bg flex h-[480px] w-[672px] items-center justify-center rounded-md border border-edge-strong">
        <span className="text-xs text-fg-dim">解析 plist…</span>
      </div>
    )
  }
  if (state.kind === 'error') {
    return (
      <div className="checker-bg flex h-[480px] w-[672px] items-center justify-center rounded-md border border-edge-strong">
        <div className="flex flex-col items-center gap-2 text-fg-dim">
          <ImageOff className="h-8 w-8" />
          <span className="text-xs">Cocos plist 预览不可用</span>
          <span className="font-mono text-[11px] text-fg-dim">{state.reason}</span>
        </div>
      </div>
    )
  }

  const { data } = state
  const first = data.frames[0]
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="checker-bg relative flex h-[480px] w-[672px] items-center justify-center overflow-hidden rounded-md border border-edge-strong">
        {imgError ? (
          <div className="flex flex-col items-center gap-2 text-fg-dim">
            <ImageOff className="h-8 w-8" />
            <span className="text-xs">大图资源缺失</span>
          </div>
        ) : (
          <div
            className="relative"
            style={{
              width: `${first.w}px`,
              height: `${first.h}px`,
              maxWidth: '640px',
              maxHeight: '448px'
            }}
          >
            <img
              src={paths.plist.pngUrl}
              alt={`${preview.slug} · plist sprite`}
              draggable={false}
              onError={() => setImgError(true)}
              style={{
                position: 'absolute',
                left: `-${first.x}px`,
                top: `-${first.y}px`,
                width: `${data.textureWidth || first.w}px`,
                height: `${data.textureHeight || first.h}px`
              }}
            />
            <span className="absolute right-1 bottom-1 rounded bg-black/60 px-1.5 py-0.5 font-mono text-[10px] text-fg-soft">
              frame {first.name}
            </span>
          </div>
        )}
      </div>
      <div className="font-mono text-xs text-fg-dim">
        {data.frames.length} 帧 · {data.textureWidth || '?'}×{data.textureHeight || '?'} · 大图={paths.plist.pngUrl.split('/').pop()}
      </div>
    </div>
  )
}