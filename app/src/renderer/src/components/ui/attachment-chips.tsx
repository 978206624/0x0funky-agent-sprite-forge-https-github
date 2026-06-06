import { ImageIcon, X } from 'lucide-react'

/** 从绝对路径取文件名（兼容 Windows \ 与 POSIX /）。 */
export function basename(path: string): string {
  const parts = path.split(/[\\/]/)
  return parts[parts.length - 1] || path
}

/**
 * 附件/参考图 chip 列表：图标 + 文件名（截断，hover 看全路径）+ 删除。
 * 参数面板参考图区与对话输入附件区共用，避免两处样式漂移。
 */
export function AttachmentChips({
  paths,
  onRemove,
  disabled
}: {
  paths: string[]
  onRemove: (path: string) => void
  disabled?: boolean
}) {
  if (paths.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1.5">
      {paths.map((p) => (
        <span
          key={p}
          title={p}
          className="flex max-w-[160px] items-center gap-1 rounded-md border border-edge bg-panel py-1 pl-2 pr-1 text-[11px] text-fg-soft"
        >
          <ImageIcon className="h-3 w-3 shrink-0 text-accent" />
          <span className="truncate">{basename(p)}</span>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onRemove(p)}
            title="移除"
            className="flex h-4 w-4 shrink-0 items-center justify-center rounded text-fg-dim transition-colors hover:bg-hover hover:text-fg disabled:pointer-events-none"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
    </div>
  )
}
