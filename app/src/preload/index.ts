import { contextBridge } from 'electron'

// 渲染层可调用的安全 API。后续 Phase 往这里挂 codex / skills / db / generation 等桥接（只暴露窄方法，不暴露原始 ipcRenderer）。
const api = {}

// contextIsolation 由主进程强制开启；若未隔离则视为配置错误，安全失败，不做不安全回退。
if (!process.contextIsolated) {
  throw new Error('contextIsolation 必须开启，拒绝在非隔离环境暴露 API')
}

contextBridge.exposeInMainWorld('api', api)
