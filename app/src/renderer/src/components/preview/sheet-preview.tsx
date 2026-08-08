import { usePlayback } from '../../hooks/use-playback'
import { PreviewStage } from '../center/preview-stage'
import { PlaybackBar } from '../center/playback-bar'
import type { PreviewData } from '../../hooks/use-preview'

/**
 * Sheet 整表预览 + 帧播放控件（用于多 tab 的 Sheet tab）。
 * 直接复用 PreviewStage 的 'sheet' 视图（自带棋格底+容器），外面接 PlaybackBar。
 */
export function SheetPreview({ preview }: { preview: PreviewData }) {
  const pb = usePlayback(preview.frameCount, true)
  return (
    <div className="flex flex-col items-center gap-3">
      <PreviewStage preview={preview} view="sheet" frameIndex={pb.frame} />
      <PlaybackBar pb={pb} frameCount={preview.frameCount} />
    </div>
  )
}