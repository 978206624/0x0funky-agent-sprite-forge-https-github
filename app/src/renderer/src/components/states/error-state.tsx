import { useEffect, useState } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'
import { useGenerationStore } from '../../store/generation-store'
import { useHistoryStore } from '../../store/history-store'

/** 失败记录的 raw-sheet asset:// URL（早期失败可能不存在，<img> onError 容错隐藏）。 */
function rawSheetUrl(slug: string): string {
  return `asset://sprites/${encodeURIComponent(slug)}/raw-sheet.png`
}

/**
 * 错误态（S6）：选中记录为失败态时中栏展示。数据源为 history-store.selected（单一事实源），
 * 故点不同失败历史卡会切换显示对应记录的错误/raw-sheet/重生参数。
 * 详细 stderr/红日志在底部日志区已展示，这里聚焦"失败概览 + 排查物 + 重试"。
 */
export function ErrorState() {
  const selected = useHistoryStore((s) => s.selected)
  const start = useGenerationStore((s) => s.start)
  const slug = selected?.slug ?? null

  const [rawErrored, setRawErrored] = useState(false)
  useEffect(() => setRawErrored(false), [slug])

  // 重生：复用所选失败记录的参数（已落库）。
  const regenerate = (): void => {
    if (selected?.params) void start(selected.params)
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-base p-6">
      <div className="flex h-[88px] w-[88px] items-center justify-center rounded-lg border border-error/25 bg-error/10">
        <AlertTriangle className="h-9 w-9 text-error" />
      </div>
      <p className="text-xl font-semibold text-fg-soft">生成失败</p>
      <p className="max-w-md text-center text-sm leading-relaxed text-fg-dim">
        模型或后处理出错。原始 raw-sheet 已保留供排查，可在下方日志查看详细错误，或调整参数后重试。
      </p>

      {slug && !rawErrored && (
        <div className="flex flex-col items-center gap-1.5">
          <span className="text-[11px] text-fg-dim">raw-sheet（抠图前原图，供排查）</span>
          <div className="checker-bg h-40 w-40 overflow-hidden rounded-md border border-edge">
            <img
              src={rawSheetUrl(slug)}
              alt="raw-sheet"
              draggable={false}
              onError={() => setRawErrored(true)}
              className="pixelated h-full w-full object-contain"
            />
          </div>
        </div>
      )}
      {slug && rawErrored && (
        <span className="font-mono text-[11px] text-fg-dim">无 raw-sheet（本次未产出图像）</span>
      )}

      {selected?.params && (
        <button
          type="button"
          onClick={regenerate}
          className="mt-1 inline-flex items-center gap-2 rounded-md bg-accent px-3.5 py-2 text-sm font-medium text-white hover:bg-accent-hover"
        >
          <RotateCcw className="h-4 w-4" />
          重生
        </button>
      )}
    </div>
  )
}
