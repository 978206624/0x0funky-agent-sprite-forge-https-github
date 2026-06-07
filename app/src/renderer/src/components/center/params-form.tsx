import { ChevronDown, ChevronRight, ImagePlus } from 'lucide-react'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { NumberInput } from '../ui/number-input'
import { Select } from '../ui/select'
import { SectionHeader } from '../ui/section-header'
import { TextArea } from '../ui/text-input'
import { AttachmentChips } from '../ui/attachment-chips'
import {
  THEME_PLACEHOLDER,
  gridOptions,
  gridSelectValue,
  actionChangePatch,
  multiDirChangePatch,
  gridChangePatch,
  type FormState
} from '../../store/param-store'

/** 选参考图：原生多选 → 去重并入表单（生成时经 codex --image 参与）。 */
async function addRefImages(
  current: string[],
  set: (patch: Partial<FormState>) => void
): Promise<void> {
  const picked = await window.api.dialog.pickImages()
  if (picked.length === 0) return
  const merged = Array.from(new Set([...current, ...picked]))
  set({ refImages: merged })
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <label className="text-xs text-fg-soft">{label}</label>
      {children}
    </div>
  )
}

/**
 * 参数表单主体：资源描述 + 参考图 + 生成参数（动作/视角/方向/四方向整表/网格预设/帧尺寸/对齐）+ 高级参数。
 * 下拉一律用自定义 Select；网格用预设下拉（multiDir→每方向帧数 4×N，单方向→预设 + 自定义手填）。
 */
export function ParamsForm({
  form,
  set,
  disabled
}: {
  form: FormState
  set: (patch: Partial<FormState>) => void
  disabled: boolean
}) {
  const [advancedOpen, setAdvancedOpen] = useState(false)
  return (
    <div className="flex flex-1 flex-col gap-5 overflow-auto p-4">
      <section className="flex flex-col gap-2">
        <SectionHeader>资源描述</SectionHeader>
        <TextArea
          rows={3}
          value={form.theme}
          disabled={disabled}
          placeholder={THEME_PLACEHOLDER}
          onChange={(e) => set({ theme: e.target.value })}
        />
      </section>

      <section className="flex flex-col gap-2">
        <SectionHeader>参考图</SectionHeader>
        <p className="text-[11px] leading-relaxed text-fg-dim">
          可选。附图作角色形象/美术风格参照（PNG/JPEG/GIF/WebP）。
        </p>
        <AttachmentChips
          paths={form.refImages}
          disabled={disabled}
          onRemove={(p) => set({ refImages: form.refImages.filter((x) => x !== p) })}
        />
        <button
          type="button"
          disabled={disabled}
          onClick={() => void addRefImages(form.refImages, set)}
          className="inline-flex w-fit items-center gap-2 rounded-md border border-edge bg-elevated px-3 py-1.5 text-xs font-medium text-fg-soft transition-colors hover:bg-hover hover:text-fg disabled:pointer-events-none disabled:opacity-50"
        >
          <ImagePlus className="h-4 w-4" />
          添加参考图
        </button>
      </section>

      <section className="flex flex-col gap-3">
        <SectionHeader>生成参数</SectionHeader>
        <Row label="动作类型">
          <div className="w-40">
            <Select
              ariaLabel="动作类型"
              value={form.action}
              disabled={disabled}
              onChange={(v) => set(actionChangePatch(form, v))}
              options={[
                { value: 'cast', label: 'cast 施法' },
                { value: 'idle', label: 'idle 待机' },
                { value: 'walk', label: 'walk 行走' },
                { value: 'run', label: 'run 奔跑' },
                { value: 'jump', label: 'jump 跳跃' },
                { value: 'attack', label: 'attack 攻击' }
              ]}
            />
          </div>
        </Row>
        <Row label="视角">
          <div className="w-40">
            <Select
              ariaLabel="视角"
              value={form.view}
              disabled={disabled}
              onChange={(v) => set({ view: v })}
              options={[
                { value: 'side', label: 'side 侧视' },
                { value: 'topdown', label: 'topdown 俯视' },
                { value: '3-4', label: '3-4 斜视' }
              ]}
            />
          </div>
        </Row>
        <Row label="四方向整表">
          <input
            type="checkbox"
            checked={form.multiDir}
            disabled={disabled}
            onChange={(e) => set(multiDirChangePatch(form, e.target.checked))}
            className="h-4 w-4 accent-accent"
          />
        </Row>
        {form.multiDir && (
          <p className="text-[11px] leading-relaxed text-fg-dim">
            行=朝向（下/左/右/上），列=动作帧。适合 idle/walk/run 等循环动作；cast/attack
            等一次性动作意义不大。
          </p>
        )}
        {!form.multiDir && (
          <Row label="方向">
            <div className="w-40">
              <Select
                ariaLabel="方向"
                value={form.direction}
                disabled={disabled}
                onChange={(v) => set({ direction: v })}
                options={[
                  { value: 'down', label: '下 (面向镜头)' },
                  { value: 'left', label: '左' },
                  { value: 'right', label: '右' },
                  { value: 'up', label: '上 (背向)' }
                ]}
              />
            </div>
          </Row>
        )}
        <Row label={form.multiDir ? '每方向帧数' : '网格'}>
          <div className="w-40">
            <Select
              ariaLabel="网格"
              value={gridSelectValue(form)}
              disabled={disabled}
              onChange={(v) => set(gridChangePatch(v, form.multiDir))}
              options={gridOptions(form.multiDir)}
            />
          </div>
        </Row>
        {!form.multiDir && form.gridCustom && (
          <Row label="行×列">
            <div className="flex items-center gap-2">
              <NumberInput
                min={1}
                value={form.rows}
                disabled={disabled}
                onChange={(e) => set({ rows: Number(e.target.value) })}
                className="w-16"
              />
              <span className="text-fg-dim">×</span>
              <NumberInput
                min={1}
                value={form.cols}
                disabled={disabled}
                onChange={(e) => set({ cols: Number(e.target.value) })}
                className="w-16"
              />
            </div>
          </Row>
        )}
        <Row label="帧尺寸">
          <div className="flex items-center gap-2">
            <NumberInput
              min={16}
              value={form.cell}
              disabled={disabled}
              onChange={(e) => set({ cell: Number(e.target.value) })}
              className="w-[88px]"
            />
            <span className="text-xs text-fg-dim">px</span>
          </div>
        </Row>
        <Row label="对齐">
          <div className="w-40">
            <Select
              ariaLabel="对齐"
              value={form.align}
              disabled={disabled}
              onChange={(v) => set({ align: v })}
              options={[
                { value: 'bottom', label: 'bottom' },
                { value: 'center', label: 'center' },
                { value: 'feet', label: 'feet' }
              ]}
            />
          </div>
        </Row>
      </section>

      <section className="flex flex-col gap-3">
        <button
          type="button"
          onClick={() => setAdvancedOpen((v) => !v)}
          className="flex items-center gap-2 py-1 text-left"
        >
          {advancedOpen ? (
            <ChevronDown className="h-4 w-4 text-fg-dim" />
          ) : (
            <ChevronRight className="h-4 w-4 text-fg-dim" />
          )}
          <span className="text-xs font-medium text-fg-dim">
            高级参数 (fit_scale, padding, duration…)
          </span>
        </button>
        {advancedOpen && (
          <div className="flex flex-col gap-3">
            <Row label="fit_scale">
              <NumberInput
                step={0.01}
                placeholder="auto"
                value={form.fitScale}
                disabled={disabled}
                onChange={(e) => set({ fitScale: e.target.value })}
                className="w-[88px]"
              />
            </Row>
            <Row label="source_padding">
              <NumberInput
                placeholder="auto"
                value={form.sourcePadding}
                disabled={disabled}
                onChange={(e) => set({ sourcePadding: e.target.value })}
                className="w-[88px]"
              />
            </Row>
            <Row label="duration (ms)">
              <NumberInput
                placeholder="auto"
                value={form.duration}
                disabled={disabled}
                onChange={(e) => set({ duration: e.target.value })}
                className="w-[88px]"
              />
            </Row>
            <Row label="shared_scale">
              <input
                type="checkbox"
                checked={form.sharedScale}
                disabled={disabled}
                onChange={(e) => set({ sharedScale: e.target.checked })}
                className="h-4 w-4 accent-accent"
              />
            </Row>
          </div>
        )}
      </section>
    </div>
  )
}
