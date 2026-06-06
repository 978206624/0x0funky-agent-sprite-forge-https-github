import { Pause, Play, SkipBack, SkipForward } from 'lucide-react'
import type { Playback } from '../../hooks/use-playback'

interface PlaybackBarProps {
  pb: Playback
  frameCount: number
}

/** Aseprite 式播放控件：上一帧 / 播放暂停 / 下一帧 + 帧序号 + 帧率。 */
export function PlaybackBar({ pb, frameCount }: PlaybackBarProps) {
  const iconBtn =
    'flex h-7 w-7 items-center justify-center rounded-sm text-fg-soft hover:bg-hover hover:text-fg disabled:pointer-events-none disabled:opacity-40'
  // 单帧无可播放序列：步进/播放禁用。
  const single = frameCount <= 1

  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={pb.prev} disabled={single} className={iconBtn} title="上一帧">
        <SkipBack className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={pb.toggle}
        disabled={single}
        className="flex h-7 w-7 items-center justify-center rounded-sm bg-accent text-white hover:bg-accent-hover disabled:pointer-events-none disabled:opacity-40"
        title={pb.playing ? '暂停' : '播放'}
      >
        {pb.playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </button>
      <button type="button" onClick={pb.next} disabled={single} className={iconBtn} title="下一帧">
        <SkipForward className="h-4 w-4" />
      </button>

      <span className="ml-1 font-mono text-xs text-fg-soft">
        {Math.min(pb.frame + 1, frameCount)} / {frameCount}
      </span>

      <label className="ml-2 flex items-center gap-1 text-xs text-fg-dim">
        <span>帧率</span>
        <input
          type="number"
          min={1}
          max={60}
          value={pb.fps}
          onChange={(e) => pb.setFps(Math.min(60, Math.max(1, Number(e.target.value) || 1)))}
          className="w-12 rounded-sm border border-edge bg-elevated px-1.5 py-1 text-center font-mono text-[12px] text-fg outline-none focus:border-accent"
        />
        <span>fps</span>
      </label>
    </div>
  )
}
