import { RotateCw } from 'lucide-react'
import { useSkillStore } from '../../../store/skill-store'
import { SettingSection, Field } from './field'

/**
 * ③Skill：app 自管 skill 库列表。
 * Phase 2 最小态——展示受管 skill（内置 / 已适配标记）+ 重新加载。
 * 导入 / 新建 / 编辑 / 删除等完整管理 UI 在 Phase 5 接入。
 */
export function SkillSection() {
  const result = useSkillStore((s) => s.result)
  const loading = useSkillStore((s) => s.loading)
  const list = useSkillStore((s) => s.list)

  return (
    <SettingSection title="Skill">
      <Field label="Skill 库" hint="内置 + 导入/新建（管理操作 Phase 5 接入）">
        <button
          type="button"
          onClick={() => void list()}
          className="inline-flex items-center gap-1.5 rounded-md border border-edge bg-elevated px-3 py-1.5 text-xs font-medium text-fg-soft hover:bg-hover hover:text-fg"
        >
          <RotateCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          重新加载
        </button>
      </Field>

      <div className="flex flex-col gap-1 pt-1">
        <span className="text-[11px] text-fg-dim">受管 skill</span>
        <div className="mt-1 flex flex-col gap-1">
          {!result || result.skills.length === 0 ? (
            <span className="py-1 text-[12px] text-fg-dim">{result?.error ?? '库内无 skill'}</span>
          ) : (
            result.skills.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-2 px-1 py-0.5">
                <span
                  className={`truncate text-[12px] ${s.adapted ? 'text-fg-soft' : 'text-fg-dim'}`}
                >
                  {s.name}
                </span>
                <span className="flex shrink-0 items-center gap-1.5 text-[10px]">
                  {s.builtin && <span className="text-fg-dim">内置</span>}
                  <span className={s.adapted ? 'text-success' : 'text-fg-dim'}>
                    {s.adapted ? '已适配' : '未适配'}
                  </span>
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </SettingSection>
  )
}
