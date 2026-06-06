import { useEffect } from 'react'
import { CenterPanel } from './components/layout/center-panel'
import { LeftRail } from './components/layout/left-rail'
import { RightPanel } from './components/layout/right-panel'
import { StatusBar } from './components/layout/status-bar'
import { TopBar } from './components/layout/top-bar'
import { ProjectPicker } from './components/project/project-picker'
import { useCodexHealth } from './hooks/use-codex-health'
import { useGenerationSubscription } from './hooks/use-generation'
import { useChatSubscription } from './hooks/use-chat'
import { useProjectStore } from './store/project-store'
import { useSkillStore } from './store/skill-store'

export default function App() {
  const current = useProjectStore((s) => s.current)
  const hydrated = useProjectStore((s) => s.hydrated)
  const hydrate = useProjectStore((s) => s.hydrate)
  const { health, loading, refresh } = useCodexHealth()
  const ready = !!health?.installed && !!health?.loggedIn

  // 把主进程生成事件流接到 generation-store（顶层订阅一次）。
  useGenerationSubscription()
  // 把主进程对话事件流接到 chat-store（顶层订阅一次；不挂 panel，切 Tab 不丢流式）。
  useChatSubscription()

  // 启动/刷新时从主进程同步当前项目，避免 renderer 状态与主进程脱节。
  useEffect(() => {
    void hydrate()
  }, [hydrate])

  // 启动时扫描一次 skill 目录（左栏 Skill 库 + 状态条第三灯据此点亮）。
  useEffect(() => {
    void useSkillStore.getState().scan()
  }, [])

  // 水合完成前不渲染，避免在恢复当前项目前闪一下项目页。
  if (!hydrated) return null

  // 启动路由：无当前项目 → 项目页；有 → 三栏工作台。
  if (!current) return <ProjectPicker />

  return (
    <div className="flex h-screen flex-col bg-base text-fg">
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        <LeftRail />
        <CenterPanel ready={ready} health={health} loading={loading} onRetry={refresh} />
        <RightPanel ready={ready} />
      </div>
      <StatusBar health={health} loading={loading} />
    </div>
  )
}
