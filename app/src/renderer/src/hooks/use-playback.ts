import { useCallback, useEffect, useState } from 'react'

export interface Playback {
  /** 当前帧索引（0-based）。 */
  frame: number
  playing: boolean
  fps: number
  setFps: (n: number) => void
  /** 播放/暂停切换。 */
  toggle: () => void
  /** 下一帧（并暂停）。 */
  next: () => void
  /** 上一帧（并暂停）。 */
  prev: () => void
}

/**
 * 逐帧播放状态机：按 fps 用 setInterval 推进帧索引，循环播放。
 * frameCount 变化（切换产出）时把越界帧夹回 0。组件卸载/依赖变化清理定时器。
 * active=false（如当前不在单帧视图）时暂停计时，省去后台空转。
 */
export function usePlayback(frameCount: number, active = true): Playback {
  const [frame, setFrame] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [fps, setFps] = useState(8)

  // 产出切换导致帧数变化时，越界帧夹回 0。
  useEffect(() => {
    setFrame((f) => (f >= frameCount ? 0 : f))
  }, [frameCount])

  useEffect(() => {
    if (!active || !playing || frameCount <= 1) return
    const period = Math.max(1, Math.round(1000 / Math.max(1, fps)))
    const id = setInterval(() => setFrame((f) => (f + 1) % frameCount), period)
    return () => clearInterval(id)
  }, [active, playing, fps, frameCount])

  const next = useCallback(() => {
    setPlaying(false)
    setFrame((f) => (frameCount > 0 ? (f + 1) % frameCount : 0))
  }, [frameCount])

  const prev = useCallback(() => {
    setPlaying(false)
    setFrame((f) => (frameCount > 0 ? (f - 1 + frameCount) % frameCount : 0))
  }, [frameCount])

  const toggle = useCallback(() => setPlaying((p) => !p), [])

  return { frame, playing, fps, setFps, toggle, next, prev }
}
