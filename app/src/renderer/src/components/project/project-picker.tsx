import { Box, Folder, FolderOpen, FolderPlus } from 'lucide-react'
import type { Project } from '@shared/types'
import { useProjects } from '../../hooks/use-projects'

/** ISO 时间 → 相对时间（设计稿：2 小时前 / 昨天 / 3 天前）。 */
function relativeTime(iso: string | null): string {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const min = 60_000
  const hour = 60 * min
  const day = 24 * hour
  if (diff < hour) return `${Math.max(1, Math.floor(diff / min))} 分钟前`
  if (diff < day) return `${Math.floor(diff / hour)} 小时前`
  if (diff < 2 * day) return '昨天'
  return `${Math.floor(diff / day)} 天前`
}

function RecentCard({
  project,
  onOpen,
  disabled
}: {
  project: Project
  onOpen: () => void
  disabled: boolean
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={disabled}
      className="flex w-full items-center gap-3 rounded-md border border-edge bg-panel p-3 text-left transition-colors hover:border-edge-strong hover:bg-hover disabled:pointer-events-none disabled:opacity-50"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm bg-elevated">
        <Folder className="h-5 w-5 text-accent" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-sm font-medium text-fg">{project.name}</span>
        <span className="truncate font-mono text-[11px] text-fg-dim">{project.absPath}</span>
      </div>
      <span className="shrink-0 text-[11px] text-fg-dim">
        {relativeTime(project.lastOpenedAt ?? project.createdAt)}
      </span>
    </button>
  )
}

/** S10 项目页：启动入口。新建/打开项目 + 最近项目网格。 */
export function ProjectPicker() {
  const { recent, loading, error, busy, pickAndOpen, openRecent } = useProjects()

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-base p-6">
      <div className="flex w-[720px] flex-col gap-6">
        {/* 品牌 */}
        <div className="flex items-center gap-2">
          <Box className="h-[26px] w-[26px] text-accent" />
          <span className="text-xl font-semibold text-fg">Game Asset Forge</span>
        </div>

        <p className="text-sm text-fg-dim">
          选择一个项目开始，或新建一个。生成的资源会保存在项目目录下。
        </p>

        {/* 操作 */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={pickAndOpen}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:pointer-events-none disabled:opacity-50"
          >
            <FolderPlus className="h-4 w-4" />
            新建项目
          </button>
          <button
            type="button"
            onClick={pickAndOpen}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-md border border-edge bg-elevated px-4 py-2 text-sm font-medium text-fg-soft transition-colors hover:bg-hover hover:text-fg disabled:pointer-events-none disabled:opacity-50"
          >
            <FolderOpen className="h-4 w-4" />
            打开文件夹
          </button>
        </div>

        {error && <p className="text-[11px] text-error">{error}</p>}

        {/* 最近项目 */}
        <span className="text-[11px] font-semibold tracking-[0.6px] text-fg-dim">最近项目</span>
        <div className="flex flex-col gap-2">
          {loading ? (
            <p className="text-[11px] text-fg-dim">加载中…</p>
          ) : recent.length === 0 ? (
            <p className="rounded-md border border-dashed border-edge bg-panel/50 p-4 text-center text-[11px] text-fg-dim">
              还没有项目，点上面「新建项目」选一个文件夹开始吧。
            </p>
          ) : (
            recent.map((p) => (
              <RecentCard
                key={p.id}
                project={p}
                onOpen={() => void openRecent(p.id)}
                disabled={busy}
              />
            ))
          )}
        </div>
      </div>
    </div>
  )
}
