import { useEffect, useState } from 'react'
import { ImageOff } from 'lucide-react'
import type { PreviewData } from '../../hooks/use-preview'

/**
 * GIF 循环播放（用于多 tab 的 GIF tab）。
 * GIF 资源由浏览器原生循环（GIF 格式自带帧间延迟）；仅渲染 + 错误兜底。
 * 切换预览源时重置 errored。
 */
export function GifPreview({ preview }: { preview: PreviewData }) {
  const [errored, setErrored] = useState(false)
  useEffect(() => setErrored(false), [preview.gifUrl])
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="checker-bg flex h-[480px] w-[672px] items-center justify-center overflow-hidden rounded-md border border-edge-strong">
        {errored ? (
          <div className="flex flex-col items-center gap-2 text-fg-dim">
            <ImageOff className="h-8 w-8" />
            <span className="text-xs">GIF 资源缺失</span>
          </div>
        ) : (
          <img
            key={preview.gifUrl}
            src={preview.gifUrl}
            alt={`${preview.slug} · gif`}
            draggable={false}
            onError={() => setErrored(true)}
            className="pixelated max-h-full max-w-full object-contain"
          />
        )}
      </div>
      <div className="font-mono text-xs text-fg-dim">
        {preview.frameCount} 帧 · {preview.cell}px · 循环
      </div>
    </div>
  )
}