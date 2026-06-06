import { ChevronDown, ChevronRight, ImagePlus, X, Zap } from 'lucide-react'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { Button } from '../ui/button'
import { NumberInput } from '../ui/number-input'
import { Select } from '../ui/select'
import { SectionHeader } from '../ui/section-header'
import { TextArea } from '../ui/text-input'
import { AttachmentChips } from '../ui/attachment-chips'
import { useGenerationStore } from '../../store/generation-store'
import { useParamStore, toParams, THEME_PLACEHOLDER, type FormState } from '../../store/param-store'

/** 选参考图：原生多选 → 去重并入表单（生成时经 codex --image 参与）。 */
async function addRefImages(current: string[], set: (patch: Partial<FormState>) => void): Promise<void> {
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

function ParamsForm({
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
              value={form.action}
              disabled={disabled}
              onChange={(e) => set({ action: e.target.value })}
            >
              <option value="cast">cast 施法</option>
              <option value="idle">idle 待机</option>
              <option value="walk">walk 行走</option>
              <option value="run">run 奔跑</option>
              <option value="jump">jump 跳跃</option>
              <option value="attack">attack 攻击</option>
            </Select>
          </div>
        </Row>
        <Row label="网格 (行×列)">
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
              value={form.align}
              disabled={disabled}
              onChange={(e) => set({ align: e.target.value })}
            >
              <option value="bottom">bottom</option>
              <option value="center">center</option>
              <option value="feet">feet</option>
            </Select>
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

/** 参数底部生成/取消按钮。 */
function ParamsFooter({ ready }: { ready: boolean }) {
  const form = useParamStore((s) => s.form)
  const status = useGenerationStore((s) => s.status)
  const error = useGenerationStore((s) => s.error)
  const startGen = useGenerationStore((s) => s.start)
  const cancelGen = useGenerationStore((s) => s.cancel)
  const running = status === 'running'

  return (
    <div className="flex shrink-0 flex-col gap-2 border-t border-edge p-4">
      {error && <span className="text-[11px] text-error">{error}</span>}
      {running ? (
        <Button fullWidth variant="secondary" onClick={() => void cancelGen()}>
          <X className="h-4 w-4" />
          取消生成
        </Button>
      ) : (
        <Button fullWidth disabled={!ready} onClick={() => void startGen(toParams(form))}>
          <Zap className="h-4 w-4" />
          {ready ? '生成' : '生成 (需先配置 Codex)'}
        </Button>
      )}
    </div>
  )
}

/**
 * 中间区域左侧的参数面板：资源描述 + 生成参数 + 高级参数 + 底部生成按钮。
 * 由右栏迁入中间区（与预览/日志同处主工作区，调参→生成→看预览动线更顺）。
 */
export function ParamsPanel({ ready }: { ready: boolean }) {
  const form = useParamStore((s) => s.form)
  const set = useParamStore((s) => s.set)
  const running = useGenerationStore((s) => s.status === 'running')

  return (
    <aside className="flex w-72 shrink-0 flex-col border-r border-edge bg-panel">
      <div className="flex h-12 shrink-0 items-center border-b border-edge px-4">
        <span className="text-sm font-semibold text-fg">参数</span>
      </div>
      <ParamsForm form={form} set={set} disabled={running} />
      <ParamsFooter ready={ready} />
    </aside>
  )
}
