import { contextBridge, ipcRenderer } from 'electron'
import type { CodexHealth } from '../shared/types'

// 渲染层可调用的安全 API（只暴露窄方法，不暴露原始 ipcRenderer）。
const api = {
  codex: {
    detect: (): Promise<CodexHealth> => ipcRenderer.invoke('codex:detect')
  }
}

// contextIsolation 由主进程强制开启；若未隔离则视为配置错误，安全失败，不做不安全回退。
if (!process.contextIsolated) {
  throw new Error('contextIsolation 必须开启，拒绝在非隔离环境暴露 API')
}

contextBridge.exposeInMainWorld('api', api)
