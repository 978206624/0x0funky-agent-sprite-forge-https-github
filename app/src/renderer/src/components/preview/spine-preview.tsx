import { useEffect, useRef, useState } from 'react'
import { ImageOff } from 'lucide-react'
import {
  AssetManager,
  SkeletonRenderer,
  AtlasAttachmentLoader,
  SkeletonJson,
  SkeletonBinary,
  AnimationState,
  AnimationStateData,
  Physics,
  Skeleton
} from '@esotericsoftware/spine-canvas'
import type { PreviewData } from '../../hooks/use-preview'
import { buildPreviewPaths } from '../../lib/preview-tabs'

/**
 * Spine 三件套预览（用于多 tab 的 Spine tab）。
 * 集成 spine-canvas 4.3.x 运行时：用 AssetManager + XHR/Fetch 加载 atlas + json/skel，
 * SkeletonRenderer 渲染到 <canvas>，requestAnimationFrame 推进 AnimationState。
 * 资源缺失（404）/ 解析失败 → 占位。
 *
 * 已知限制（spine-canvas 4.3 官方说明）：
 *   - 不支持 mesh / clipping / two-color tint（Spine 编辑器高级特性，需要 spine-webgl）
 *   - 仅对简单骨骼骨架（region + bone + transform）有完整视觉效果
 *   - 复杂 spine 资源（P3 generate2drig 输出的）需要在 Editor 内另用 webgl 预览
 * P1 阶段只要求基础骨架能跑；复杂 spine 在 P3 阶段评估是否升级到 spine-webgl/pixi-v8。
 */

interface SpineLoadResult {
  skeleton: Skeleton
  state: AnimationState
  bounds: { x: number; y: number; width: number; height: number }
}

/**
 * 通过 spine-canvas AssetManager 加载三件套。
 * 用 fetch() 探测 .json/.skel 谁存在（HEAD 探测），再走 AssetManager 异步加载。
 * 直接 await loadTextureAtlasAsync + loadBinaryAsync/loadJsonAsync，避免回调地狱。
 */
async function loadSpine(paths: { jsonOrSkelUrl: string; atlasUrl: string }): Promise<SpineLoadResult> {
  // 探测 json 或 skel 谁可用
  const probeJson = await fetch(paths.jsonOrSkelUrl, { method: 'HEAD' })
  const isJson = probeJson.ok && paths.jsonOrSkelUrl.endsWith('.json')
  const skelOrJsonUrl = isJson ? paths.jsonOrSkelUrl : paths.jsonOrSkelUrl.replace(/\.json$/, '.skel')

  const mgr = new AssetManager('')
  // spine-canvas 内部走 XHR/Fetch，已经能加载 asset://；直接 await 各 loader。
  await mgr.loadTextureAtlasAsync(paths.atlasUrl)
  if (isJson) {
    await mgr.loadJsonAsync(skelOrJsonUrl)
  } else {
    await mgr.loadBinaryAsync(skelOrJsonUrl)
  }
  if (mgr.hasErrors()) {
    throw new Error(`spine 资源加载失败: ${Object.keys(mgr.getErrors()).join(', ')}`)
  }

  const atlas = mgr.require(paths.atlasUrl) as import('@esotericsoftware/spine-core').TextureAtlas
  const atlasLoader = new AtlasAttachmentLoader(atlas)
  // mgr.require() 返回 AssetData 联合；按加载方式二分（json 或 skel）由 require 的实际类型断言。
  const skelData = isJson
    ? new SkeletonJson(atlasLoader).readSkeletonData(
        mgr.require(skelOrJsonUrl) as object
      )
    : new SkeletonBinary(atlasLoader).readSkeletonData(
        mgr.require(skelOrJsonUrl) as Uint8Array
      )

  const skeleton = new Skeleton(skelData)
  skeleton.setupPose()
  skeleton.updateWorldTransform(Physics.update)
  const bounds = skeleton.getBoundsRect()

  const stateData = new AnimationStateData(skelData)
  stateData.defaultMix = 0.2
  const state = new AnimationState(stateData)
  const firstAnim = skelData.animations[0]?.name
  if (firstAnim) state.setAnimation(0, firstAnim, true)

  return { skeleton, state, bounds }
}

export function SpinePreview({ preview }: { preview: PreviewData }) {
  const paths = buildPreviewPaths(preview)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [state, setState] = useState<
    | { kind: 'loading' }
    | { kind: 'error'; reason: string }
    | { kind: 'ok'; result: SpineLoadResult }
  >({ kind: 'loading' })

  useEffect(() => {
    let cancelled = false
    setState({ kind: 'loading' })
    void (async (): Promise<void> => {
      try {
        const result = await loadSpine(paths.spine)
        if (!cancelled) setState({ kind: 'ok', result })
      } catch (e) {
        if (!cancelled) setState({ kind: 'error', reason: e instanceof Error ? e.message : '加载失败' })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [paths.spine.jsonOrSkelUrl, paths.spine.atlasUrl])

  // 渲染循环：state 切到 ok 后挂 RAF；卸载/失败清理。
  useEffect(() => {
    if (state.kind !== 'ok') return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const renderer = new SkeletonRenderer(ctx)
    renderer.triangleRendering = true
    let last = Date.now() / 1000
    let raf = 0
    const { skeleton, state: animState, bounds } = state.result

    const draw = (): void => {
      const now = Date.now() / 1000
      const dt = Math.min(now - last, 0.05) // 防 tab 切回时跳一大帧
      last = now
      if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
        canvas.width = canvas.clientWidth
        canvas.height = canvas.clientHeight
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const scale = Math.min(canvas.width / Math.max(bounds.width, 1), canvas.height / Math.max(bounds.height, 1)) * 0.8
      skeleton.scaleX = scale
      skeleton.scaleY = -scale
      skeleton.x = canvas.width / 2 - bounds.x * scale
      skeleton.y = canvas.height - 60 + bounds.y * scale
      animState.update(dt)
      animState.apply(skeleton)
      skeleton.updateWorldTransform(Physics.update)
      renderer.draw(skeleton)
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [state])

  if (state.kind === 'loading') {
    return (
      <div className="checker-bg flex h-[480px] w-[672px] items-center justify-center rounded-md border border-edge-strong">
        <span className="text-xs text-fg-dim">加载 spine 资源…</span>
      </div>
    )
  }
  if (state.kind === 'error') {
    return (
      <div className="checker-bg flex h-[480px] w-[672px] items-center justify-center rounded-md border border-edge-strong">
        <div className="flex flex-col items-center gap-2 text-fg-dim">
          <ImageOff className="h-8 w-8" />
          <span className="text-xs">spine 预览不可用</span>
          <span className="font-mono text-[11px] text-fg-dim">{state.reason}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <canvas
        ref={canvasRef}
        className="checker-bg h-[480px] w-[672px] rounded-md border border-edge-strong"
        style={{ width: '672px', height: '480px' }}
      />
      <div className="font-mono text-xs text-fg-dim">
        spine · {state.result.skeleton.data.animations.length} 动画 ·
        bounds={state.result.bounds.width.toFixed(0)}×{state.result.bounds.height.toFixed(0)}
      </div>
    </div>
  )
}