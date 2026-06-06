import { ImageOff } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { PreviewData } from '../../hooks/use-preview'

export type PreviewView = 'sheet' | 'frame' | 'gif'

interface PreviewStageProps {
  preview: PreviewData
  view: PreviewView
  /** 单帧视图下当前帧索引（0-based）。 */
  frameIndex: number
}

/**
 * 棋格透明底舞台 + 三视图渲染（整表 / 单帧 / GIF）。
 * 像素图禁用模糊插值（.pixelated）。图片经 asset:// 协议从当前项目 assets/ 读取。
 */
export function PreviewStage({ preview, view, frameIndex }: PreviewStageProps) {
  const src =
    view === 'sheet'
      ? preview.sheetUrl
      : view === 'gif'
        ? preview.gifUrl
        : (preview.frameUrls[frameIndex] ?? preview.frameUrls[0])

  // 加载失败兜底（磁盘 IO 异常 / 文件缺失）。换 src 时重置。
  const [errored, setErrored] = useState(false)
  useEffect(() => setErrored(false), [src])

  return (
    <div className="checker-bg flex h-[480px] w-[672px] items-center justify-center overflow-hidden rounded-md border border-edge-strong">
      {errored ? (
        <div className="flex flex-col items-center gap-2 text-fg-dim">
          <ImageOff className="h-8 w-8" />
          <span className="text-xs">无法加载图片</span>
        </div>
      ) : (
        <img
          key={src}
          src={src}
          alt={`${preview.slug} · ${view}`}
          draggable={false}
          onError={() => setErrored(true)}
          className="pixelated max-h-full max-w-full object-contain"
        />
      )}
    </div>
  )
}
