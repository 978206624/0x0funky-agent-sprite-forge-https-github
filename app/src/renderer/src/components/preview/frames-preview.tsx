import { useEffect, useState } from 'react'
import { ImageOff, SkipBack, SkipForward } from 'lucide-react'
import type { PreviewData } from '../../hooks/use-preview'

/**
 * 单帧大图 + 帧信息（用于多 tab 的 Frames tab）。
 * 不接管播放控制（tab 偏分析：只看一帧 + 坐标/索引/cell 尺寸元信息）；
 * 提供上下帧箭头便于手动翻看。cell 像素 = frameWidth（来自 GenParams.frameWidth，
 * PreviewData.cell 已统一）。
 */
export function FramesPreview({ preview }: { preview: PreviewData }) {
  const [frame, setFrame] = useState(0)
  const [errored, setErrored] = useState(false)
  const src = preview.frameUrls[frame] ?? preview.frameUrls[0]
  const total = preview.frameCount
  const row = Math.floor(frame / preview.cols)
  const col = frame % preview.cols

  // 换帧或切换预览源时重置错误态，避免一条坏帧把整 tab 锁死
  // （锁死后 <img> 被卸载，onError 不再触发，翻帧也恢复不了）。
  useEffect(() => setErrored(false), [preview.slug, total, frame])

  const goPrev = (): void => setFrame((f) => (f - 1 + total) % total)
  const goNext = (): void => setFrame((f) => (f + 1) % total)

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="checker-bg flex h-[480px] w-[672px] items-center justify-center overflow-hidden rounded-md border border-edge-strong">
        {errored ? (
          <div className="flex flex-col items-center gap-2 text-fg-dim">
            <ImageOff className="h-8 w-8" />
            <span className="text-xs">无法加载帧</span>
          </div>
        ) : (
          <img
            key={src}
            src={src}
            alt={`${preview.slug} · frame ${frame + 1}`}
            draggable={false}
            onError={() => setErrored(true)}
            className="pixelated max-h-full max-w-full object-contain"
          />
        )}
      </div>
      <div className="flex items-center gap-3 text-xs text-fg-soft">
        <button
          type="button"
          onClick={goPrev}
          disabled={total <= 1}
          className="flex h-7 w-7 items-center justify-center rounded-sm text-fg-soft hover:bg-hover hover:text-fg disabled:pointer-events-none disabled:opacity-40"
          title="上一帧"
        >
          <SkipBack className="h-4 w-4" />
        </button>
        <span className="font-mono">
          {frame + 1} / {total}
        </span>
        <button
          type="button"
          onClick={goNext}
          disabled={total <= 1}
          className="flex h-7 w-7 items-center justify-center rounded-sm text-fg-soft hover:bg-hover hover:text-fg disabled:pointer-events-none disabled:opacity-40"
          title="下一帧"
        >
          <SkipForward className="h-4 w-4" />
        </button>
        <span className="ml-3 font-mono text-fg-dim">
          row={row} · col={col} · cell={preview.cell}px · {preview.rows}×{preview.cols}
        </span>
      </div>
    </div>
  )
}