import { X, Zap } from 'lucide-react'
import { Button } from '../ui/button'
import { useGenerationStore } from '../../store/generation-store'
import { useParamStore, toParams } from '../../store/param-store'
import { ParamsForm } from './params-form'

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
 * 表单主体拆到 params-form.tsx（控件多，单文件控行）。
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
