import { CenterPanel } from './components/layout/center-panel'
import { LeftRail } from './components/layout/left-rail'
import { RightPanel } from './components/layout/right-panel'
import { StatusBar } from './components/layout/status-bar'
import { TopBar } from './components/layout/top-bar'

export default function App() {
  return (
    <div className="flex h-screen flex-col bg-base text-fg">
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        <LeftRail />
        <CenterPanel />
        <RightPanel />
      </div>
      <StatusBar />
    </div>
  )
}
