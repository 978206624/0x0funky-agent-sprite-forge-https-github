import { ChevronRight, Sparkles, Zap } from 'lucide-react'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { Button } from '../ui/button'
import { NumberInput } from '../ui/number-input'
import { Select } from '../ui/select'
import { SectionHeader } from '../ui/section-header'
import { TextArea } from '../ui/text-input'

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

function ParamsTab() {
  return (
    <div className="flex flex-1 flex-col gap-5 overflow-auto p-4">
      <section className="flex flex-col gap-2">
        <SectionHeader>资源描述</SectionHeader>
        <TextArea
          rows={3}
          defaultValue="火法师，红袍金边，手持法杖，施放火焰魔法，像素风格，面向右侧"
        />
      </section>

      <section className="flex flex-col gap-3">
        <SectionHeader>生成参数</SectionHeader>
        <Row label="动作类型">
          <div className="w-40">
            <Select defaultValue="cast">
              <option value="cast">cast 施法</option>
              <option value="idle">idle 待机</option>
              <option value="walk">walk 行走</option>
              <option value="run">run 奔跑</option>
              <option value="jump">jump 跳跃</option>
            </Select>
          </div>
        </Row>
        <Row label="网格 (行×列)">
          <div className="flex items-center gap-2">
            <NumberInput defaultValue={3} className="w-16" />
            <span className="text-fg-dim">×</span>
            <NumberInput defaultValue={2} className="w-16" />
          </div>
        </Row>
        <Row label="帧尺寸">
          <div className="flex items-center gap-2">
            <NumberInput defaultValue={256} className="w-[88px]" />
            <span className="text-xs text-fg-dim">px</span>
          </div>
        </Row>
        <Row label="对齐">
          <div className="w-40">
            <Select defaultValue="bottom">
              <option value="bottom">bottom</option>
              <option value="center">center</option>
            </Select>
          </div>
        </Row>
      </section>

      <button type="button" className="flex items-center gap-2 py-2 text-left">
        <ChevronRight className="h-4 w-4 text-fg-dim" />
        <span className="text-xs font-medium text-fg-dim">高级参数 (fit_scale, padding, duration…)</span>
      </button>
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

      {tab === 'params' ? <ParamsTab /> : <ChatTab />}

      <div className="shrink-0 border-t border-edge p-4">
        <Button fullWidth disabled={!ready}>
          <Zap className="h-4 w-4" />
          {ready ? '生成' : '生成 (需先配置 Codex)'}
        </Button>
      </div>
    </aside>
  )
}
