import { CenterPanel } from './components/layout/center-panel'
import { LeftRail } from './components/layout/left-rail'
import { RightPanel } from './components/layout/right-panel'
import { StatusBar } from './components/layout/status-bar'
import { TopBar } from './components/layout/top-bar'
import { ProjectPicker } from './components/project/project-picker'
import { useCodexHealth } from './hooks/use-codex-health'
import { useProjectStore } from './store/project-store'

export default function App() {
  const current = useProjectStore((s) => s.current)
  const { health, loading, refresh } = useCodexHealth()
  const ready = !!health?.installed && !!health?.loggedIn

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
