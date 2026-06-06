import { useEffect, useState } from 'react'
import { FolderOpen, Trash2 } from 'lucide-react'
import { useProjectStore } from '../../../store/project-store'
import { useGenerationStore } from '../../../store/generation-store'
import { useChatStore } from '../../../store/chat-store'
import { useHistoryStore } from '../../../store/history-store'
import { ConfirmButton } from '../../ui/confirm-button'
import { SettingSection, Field } from './field'

/** ⑤存储：assets 位置 + SQLite 库路径 + 清空当前项目历史。 */
export function StorageSection() {
  const current = useProjectStore((s) => s.current)
  const busy = useGenerationStore((s) => s.status === 'running') || useChatStore((s) => s.sending)
  const [dbPath, setDbPath] = useState('')
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    void window.api.storage.dbPath().then(setDbPath).catch(() => setDbPath('（读取失败）'))
  }, [])

  const clearHistory = async (): Promise<void> => {
    if (!current) return
    setMsg(null)
    try {
      const n = await window.api.storage.clearHistory(current.id)
      // reset 清空记录 + 选中预览（loadSeq++ 作废在途），再 load 重新拉（现为空）。
      useHistoryStore.getState().reset()
      await useHistoryStore.getState().load(current.id)
      setMsg(`已清空 ${n} 条历史记录（磁盘文件保留）`)
    } catch (e) {
      setMsg(e instanceof Error ? e.message : '清空失败')
    }
  }

  return (
    <SettingSection title="存储">
      <Field label="资源位置" hint="生成产物落在当前项目目录下">
        <span className="font-mono text-[11px] text-fg-dim">
          {current ? `${current.absPath}\\assets\\` : '<项目>\\assets\\'}
        </span>
      </Field>

      <Field label="SQLite 库" hint={dbPath}>
        <button
          type="button"
          onClick={() => void window.api.storage.revealDb()}
          className="inline-flex items-center gap-1.5 rounded-md border border-edge bg-elevated px-3 py-1.5 text-xs font-medium text-fg-soft hover:bg-hover hover:text-fg"
        >
          <FolderOpen className="h-3.5 w-3.5" />
          在文件夹中显示
        </button>
      </Field>

      <Field
        label="清空当前项目历史"
        hint={busy ? '任务进行中，无法清空' : '仅清除历史记录，磁盘上的 assets 文件保留'}
      >
        <div className="flex items-center gap-3">
          {msg && <span className="text-[11px] text-fg-dim">{msg}</span>}
          <ConfirmButton
            tone="danger"
            disabled={!current || busy}
            confirmLabel="确认清空?"
            onConfirm={() => void clearHistory()}
          >
            <Trash2 className="h-3.5 w-3.5" />
            清空历史
          </ConfirmButton>
        </div>
      </Field>
    </SettingSection>
  )
}
