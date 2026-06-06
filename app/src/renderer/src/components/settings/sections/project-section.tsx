import { useEffect } from 'react'
import { FolderInput, X } from 'lucide-react'
import { useProjectStore } from '../../../store/project-store'
import { useGenerationStore } from '../../../store/generation-store'
import { useChatStore } from '../../../store/chat-store'
import { useSettingsStore } from '../../../store/settings-store'
import { useProjects } from '../../../hooks/use-projects'
import { leaveProject } from '../../../lib/leave-project'
import { Button } from '../../ui/button'
import { SettingSection, Field } from './field'

/** ①项目：当前项目 + 切换 + 最近项目管理（无损移除）。 */
export function ProjectSection() {
  const current = useProjectStore((s) => s.current)
  const close = useSettingsStore((s) => s.close)
  const busy = useGenerationStore((s) => s.status === 'running') || useChatStore((s) => s.sending)
  const { recent, refresh } = useProjects()

  // 打开设置时刷新一次最近列表（forget 后即时反映）。
  useEffect(() => {
    void refresh()
  }, [refresh])

  const switchProject = async (): Promise<void> => {
    const ok = await leaveProject()
    if (ok) close()
  }

  const forget = async (id: number): Promise<void> => {
    try {
      await window.api.projects.forget(id)
      await refresh()
    } catch {
      // 当前项目会被主进程拒绝；忽略，列表项已对当前项目禁用移除。
    }
  }

  return (
    <SettingSection title="项目">
      <Field label="当前项目" hint={current?.absPath ?? '未选择'}>
        <Button
          variant="secondary"
          disabled={!current || busy}
          onClick={() => void switchProject()}
        >
          <FolderInput className="h-4 w-4" />
          切换项目
        </Button>
      </Field>

      <div className="flex flex-col gap-1 pt-1">
        <span className="text-[11px] text-fg-dim">最近项目（移除仅从列表隐藏，不删磁盘文件与历史）</span>
        <div className="mt-1 flex flex-col gap-1">
          {recent.length === 0 ? (
            <span className="py-2 text-[12px] text-fg-dim">暂无最近项目</span>
          ) : (
            recent.map((p) => {
              const isCurrent = p.id === current?.id
              return (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-3 rounded-sm px-2 py-1.5 hover:bg-hover"
                >
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-[12px] text-fg-soft">
                      {p.name}
                      {isCurrent && <span className="ml-1.5 text-[10px] text-accent">当前</span>}
                    </span>
                    <span className="truncate font-mono text-[10px] text-fg-dim">{p.absPath}</span>
                  </div>
                  <button
                    type="button"
                    disabled={isCurrent}
                    title={isCurrent ? '当前项目不可从最近移除' : '从最近移除'}
                    onClick={() => void forget(p.id)}
                    className="shrink-0 rounded p-1 text-fg-dim hover:bg-base hover:text-error disabled:pointer-events-none disabled:opacity-30"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )
            })
          )}
        </div>
      </div>
    </SettingSection>
  )
}
