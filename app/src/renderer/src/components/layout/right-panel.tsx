import { ChevronDown, ChevronRight, Sparkles, X, Zap } from 'lucide-react'
import { useState } from 'react'
import type { ReactNode } from 'react'
import type { GenParams } from '@shared/types'
import { Button } from '../ui/button'
import { NumberInput } from '../ui/number-input'
import { Select } from '../ui/select'
import { SectionHeader } from '../ui/section-header'
import { TextArea } from '../ui/text-input'
import { useGenerationStore } from '../../store/generation-store'

type RightTab = 'params' | 'chat'

const TABS = [
  { key: 'params', label: '参数' },
  { key: 'chat', label: '对话' }
] satisfies { key: RightTab; label: string }[]

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <label className="text-xs text-fg-soft">{label}</label>
      {children}
    </div>
  )
}

/** 参数表单的受控状态。空字符串的高级数值项表示「交给 skill 推断」。 */
interface FormState {
  theme: string
  action: string
  rows: number
  cols: number
  cell: number
  align: string
  fitScale: string
  sourcePadding: string
  duration: string
  sharedScale: boolean
}

const INITIAL_FORM: FormState = {
  theme: '火法师，红袍金边，手持法杖，施放火焰魔法，像素风格，面向右侧',
  action: 'cast',
  rows: 3,
  cols: 2,
  cell: 256,
  align: 'bottom',
  fitScale: '',
  sourcePadding: '',
  duration: '',
  sharedScale: true
}

/** 正整数兜底：清空/非法输入（NaN/0/负）回退到 fallback，避免把 0 或 NaN 传给后端。 */
function posInt(v: number, fallback: number): number {
  const n = Math.floor(v)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

/** 受控表单 → GenParams（仅带上有效字段，数值做正整数兜底）。 */
function toParams(f: FormState): GenParams {
  const p: GenParams = {
    theme: f.theme.trim() || undefined,
    assetType: 'player',
    action: f.action,
    view: 'side',
    gridRows: posInt(f.rows, 1),
    gridCols: posInt(f.cols, 1),
    frameWidth: posInt(f.cell, 256),
    alignment: f.align,
    sharedScale: f.sharedScale
  }
  // 高级数值：仅在填了且为有限数时带上，否则交给 skill 推断。
  const fit = Number(f.fitScale)
  if (f.fitScale !== '' && Number.isFinite(fit)) p.fitScale = fit
  const pad = Number(f.sourcePadding)
  if (f.sourcePadding !== '' && Number.isFinite(pad)) p.sourcePadding = pad
  const dur = Number(f.duration)
  if (f.duration !== '' && Number.isFinite(dur)) p.duration = dur
  return p
}

function ParamsTab({
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
          onChange={(e) => set({ theme: e.target.value })}
        />
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

function ChatTab() {
  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <span className="text-sm text-fg-dim">对话区 · Phase 8 实现</span>
    </div>
  )
}

interface RightPanelProps {
  ready: boolean
}

export function RightPanel({ ready }: RightPanelProps) {
  const [tab, setTab] = useState<RightTab>('params')
  const [form, setForm] = useState<FormState>(INITIAL_FORM)
  const set = (patch: Partial<FormState>): void => setForm((f) => ({ ...f, ...patch }))

  const status = useGenerationStore((s) => s.status)
  const error = useGenerationStore((s) => s.error)
  const startGen = useGenerationStore((s) => s.start)
  const cancelGen = useGenerationStore((s) => s.cancel)
  const running = status === 'running'

  return (
    <aside className="flex w-80 shrink-0 flex-col border-l border-edge bg-panel">
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-edge px-4">
        <div className="flex items-center gap-4">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`border-b-2 py-2 text-sm transition-colors ${
                tab === key
                  ? 'border-accent font-semibold text-accent'
                  : 'border-transparent font-medium text-fg-soft hover:text-fg'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 rounded-sm bg-accent-soft px-2 py-1">
          <Sparkles className="h-3 w-3 text-accent" />
          <span className="font-mono text-[11px] text-accent">generate2dsprite</span>
        </div>
      </div>

      {tab === 'params' ? (
        <ParamsTab form={form} set={set} disabled={running} />
      ) : (
        <ChatTab />
      )}

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
    </aside>
  )
}
