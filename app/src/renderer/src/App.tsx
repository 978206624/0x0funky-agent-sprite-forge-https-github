import { useEffect } from 'react'
import { CenterPanel } from './components/layout/center-panel'
import { LeftRail } from './components/layout/left-rail'
import { RightPanel } from './components/layout/right-panel'
import { StatusBar } from './components/layout/status-bar'
import { TopBar } from './components/layout/top-bar'
import { ProjectPicker } from './components/project/project-picker'
import { useCodexHealth } from './hooks/use-codex-health'
import { useGenerationSubscription } from './hooks/use-generation'
import { useProjectStore } from './store/project-store'

export default function App() {
  const current = useProjectStore((s) => s.current)
  const hydrated = useProjectStore((s) => s.hydrated)
  const hydrate = useProjectStore((s) => s.hydrate)
  const { health, loading, refresh } = useCodexHealth()
  const ready = !!health?.installed && !!health?.loggedIn

  // 把主进程生成事件流接到 generation-store（顶层订阅一次）。
  useGenerationSubscription()

  // 启动/刷新时从主进程同步当前项目，避免 renderer 状态与主进程脱节。
  useEffect(() => {
    void hydrate()
  }, [hydrate])

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
