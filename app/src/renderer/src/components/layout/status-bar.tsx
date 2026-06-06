import type { CodexHealth } from '@shared/types'
import { StatusLight, type LightStatus } from '../ui/status-light'
import { useProjectStore } from '../../store/project-store'
import { useGenerationStore } from '../../store/generation-store'
import { useHistoryStore } from '../../store/history-store'
import { useParamStore } from '../../store/param-store'
import { useChatStore } from '../../store/chat-store'
import { useSkillStore } from '../../store/skill-store'

/** 目标 skill：状态条第三灯以它是否被扫描到且已适配为准。 */
const TARGET_SKILL = 'generate2dsprite'

interface StatusBarProps {
  health: CodexHealth | null
  loading: boolean
}

export function StatusBar({ health, loading }: StatusBarProps) {
  const current = useProjectStore((s) => s.current)
  const setCurrent = useProjectStore((s) => s.setCurrent)
  // 生成或对话进行中禁止切换项目：否则 codex 仍跑在旧项目、产物落旧目录，UI 却已切走。
  const generating = useGenerationStore((s) => s.status === 'running')
  const chatSending = useChatStore((s) => s.sending)
  const busy = generating || chatSending

  const switchProject = async (): Promise<void> => {
    try {
      await window.api.projects.setCurrent(null)
    } catch {
      // 主进程在 busy 时拒绝切项目（renderer 守卫因刷新/HMR 失效时的兜底）：保持当前项目，不复位。
      return
    }
    // 回项目页前清空生成状态 + 历史/选中 + 参数表单 + 对话，保持项目隔离，下个项目不带旧状态。
    useGenerationStore.getState().reset()
    useHistoryStore.getState().reset()
    useParamStore.getState().reset()
    useChatStore.getState().reset()
    setCurrent(null)
  }

  const installedStatus: LightStatus = loading ? 'muted' : health?.installed ? 'success' : 'error'
  const installedLabel = loading
    ? 'Codex 检测中…'
    : health?.installed
      ? `Codex ${health.version ?? ''} 已安装`.replace(/\s+/g, ' ').trim()
      : 'Codex 未检测到'

  const loginStatus: LightStatus = loading || !health?.installed
    ? 'muted'
    : health.loggedIn
      ? 'success'
      : 'error'
  const loginLabel = health?.installed && health.loggedIn
    ? health.loginMethod
      ? `已登录 · ${health.loginMethod}`
      : '已登录'
    : '未登录'

  // 第三灯：目标 skill 是否已挂载（扫描到且已适配）。
  // 结果到达前一律 muted（含启动初帧），不依赖 loading 标志，避免初次启动闪红。
  const skillResult = useSkillStore((s) => s.result)
  const skillMounted = !!skillResult?.skills.some((s) => s.id === TARGET_SKILL && s.adapted)
  const skillStatus: LightStatus = !skillResult ? 'muted' : skillMounted ? 'success' : 'error'
  // 文案精简：成功态去掉冗余 "skill " 前缀，避免长文案在窄窗口挤压右侧项目名。
  const skillLabel = !skillResult
    ? 'skill 扫描中…'
    : skillMounted
      ? `${TARGET_SKILL} 已挂载`
      : 'skill 未挂载'

  return (
    <footer className="flex h-[30px] shrink-0 items-center justify-between border-t border-edge bg-panel px-3">
      <div className="flex items-center gap-2">
        <StatusLight status={installedStatus} label={installedLabel} />
        <StatusLight status={loginStatus} label={loginLabel} />
        <StatusLight status={skillStatus} label={skillLabel} />
      </div>
      {current ? (
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 text-[11px] font-medium text-fg-soft">{current.name}</span>
          <span className="truncate font-mono text-[11px] text-fg-dim">{current.absPath}</span>
          <button
            type="button"
            onClick={() => void switchProject()}
            disabled={busy}
            title={busy ? '生成或对话进行中，请先取消或等待完成' : undefined}
            className="shrink-0 rounded-sm px-1.5 py-0.5 text-[11px] text-fg-dim transition-colors hover:bg-hover hover:text-fg disabled:pointer-events-none disabled:opacity-40"
          >
            切换项目
          </button>
        </div>
      ) : (
        <span className="font-mono text-[11px] text-fg-dim">workspace: 未选择</span>
      )}
    </footer>
  )
}
