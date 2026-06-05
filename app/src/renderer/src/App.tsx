import { CenterPanel } from './components/layout/center-panel'
import { LeftRail } from './components/layout/left-rail'
import { RightPanel } from './components/layout/right-panel'
import { StatusBar } from './components/layout/status-bar'
import { TopBar } from './components/layout/top-bar'
import { useCodexHealth } from './hooks/use-codex-health'

export default function App() {
  const { health, loading, refresh } = useCodexHealth()
  const ready = !!health?.installed && !!health?.loggedIn

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
