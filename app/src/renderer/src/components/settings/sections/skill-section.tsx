import { useEffect, useState } from 'react'
import { FolderInput, FileArchive, Plus, Pencil } from 'lucide-react'
import { useSkillStore } from '../../../store/skill-store'
import { SettingSection } from './field'
import { Button } from '../../ui/button'
import { ConfirmButton } from '../../ui/confirm-button'
import { Badge } from '../../ui/badge'
import { TextInput } from '../../ui/text-input'
import { SkillEditor } from './skill-editor'

/**
 * ③Skill：app 自管 skill 库管理。
 * 内置（不可删、可编辑、无恢复默认）+ 导入（文件夹 / zip）+ 新建 + 删除（仅导入/新建项）+ 编辑。
 * 点已适配项切换为当前 skill（与右栏徽标、状态条第三灯联动）。
 */
export function SkillSection() {
  const result = useSkillStore((s) => s.result)
  const currentId = useSkillStore((s) => s.currentId)
  const actionError = useSkillStore((s) => s.actionError)
  const list = useSkillStore((s) => s.list)
  const setCurrent = useSkillStore((s) => s.setCurrent)
  const importFolder = useSkillStore((s) => s.importFolder)
  const importZip = useSkillStore((s) => s.importZip)
  const create = useSkillStore((s) => s.create)
  const remove = useSkillStore((s) => s.remove)

  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)

  useEffect(() => {
    if (!result) void list()
  }, [result, list])

  const onCreate = (): void => {
    const name = newName.trim()
    if (!name) return
    void create(name).then(() => setNewName(''))
  }

  const skills = result?.skills ?? []

  return (
    <SettingSection title="Skill">
      {/* 操作区：导入 / 新建 */}
      <div className="flex flex-col gap-2 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={() => void importFolder()}>
            <FolderInput className="h-4 w-4" />
            导入文件夹
          </Button>
          <Button variant="secondary" onClick={() => void importZip()}>
            <FileArchive className="h-4 w-4" />
            导入 zip
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <TextInput
            value={newName}
            placeholder="新建 skill 名称"
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onCreate()}
            className="max-w-[240px]"
          />
          <Button variant="secondary" onClick={onCreate} disabled={!newName.trim()}>
            <Plus className="h-4 w-4" />
            新建
          </Button>
        </div>
        {actionError && <span className="text-[11px] text-error">{actionError}</span>}
      </div>

      {/* skill 列表 */}
      <div className="mt-1 flex flex-col gap-0.5">
        <span className="pb-1 text-[11px] text-fg-dim">受管 skill</span>
        {skills.length === 0 ? (
          <span className="py-1 text-[12px] text-fg-dim">{result?.error ?? '库内无 skill'}</span>
        ) : (
          skills.map((s) => {
            const isCurrent = s.id === currentId
            return (
              <div
                key={s.id}
                className="flex items-center justify-between gap-2 rounded-sm px-2 py-1.5 hover:bg-hover"
              >
                <button
                  type="button"
                  onClick={() => s.adapted && setCurrent(s.id)}
                  disabled={!s.adapted}
                  title={s.adapted ? '设为当前 skill' : '未适配，暂不可选用'}
                  className="flex min-w-0 flex-col items-start gap-0.5 text-left disabled:cursor-default"
                >
                  <span className={`truncate text-[13px] ${s.adapted ? 'text-fg' : 'text-fg-dim'}`}>
                    {s.name}
                  </span>
                  {s.description && (
                    <span className="line-clamp-1 text-[11px] text-fg-dim">{s.description}</span>
                  )}
                </button>
                <div className="flex shrink-0 items-center gap-1.5">
                  {isCurrent && <Badge tone="accent">当前</Badge>}
                  {s.builtin && <span className="text-[10px] text-fg-dim">内置</span>}
                  <span className={`text-[10px] ${s.adapted ? 'text-success' : 'text-fg-dim'}`}>
                    {s.adapted ? '已适配' : '未适配'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setEditingId(s.id)}
                    title="编辑 SKILL.md"
                    className="rounded-sm p-1 text-fg-dim hover:bg-hover hover:text-fg"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  {!s.builtin && (
                    <ConfirmButton
                      tone="danger"
                      confirmLabel="删除?"
                      onConfirm={() => {
                        if (editingId === s.id) setEditingId(null)
                        void remove(s.id)
                      }}
                    >
                      删除
                    </ConfirmButton>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {editingId && <SkillEditor skillId={editingId} onClose={() => setEditingId(null)} />}
    </SettingSection>
  )
}
