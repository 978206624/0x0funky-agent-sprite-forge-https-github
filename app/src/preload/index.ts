import { contextBridge, ipcRenderer } from 'electron'
import type {
  CodexHealth,
  Project,
  ProjectInput,
  GenerationRecord,
  GenerationInput,
  GenerationUpdate,
  AppSettings
} from '../shared/types'

// 渲染层可调用的安全 API（只暴露窄方法，不暴露原始 ipcRenderer）。
const api = {
  codex: {
    detect: (): Promise<CodexHealth> => ipcRenderer.invoke('codex:detect')
  },
  projects: {
    list: (): Promise<Project[]> => ipcRenderer.invoke('projects:list'),
    pickDir: (): Promise<string | null> => ipcRenderer.invoke('projects:pickDir'),
    create: (absPath: string, name?: string): Promise<Project> =>
      ipcRenderer.invoke('projects:create', absPath, name),
    open: (id: number): Promise<Project> => ipcRenderer.invoke('projects:open', id),
    setCurrent: (id: number | null): Promise<void> =>
      ipcRenderer.invoke('projects:setCurrent', id)
  },
  db: {
    projects: {
      list: (): Promise<Project[]> => ipcRenderer.invoke('db:projects:list'),
      get: (id: number): Promise<Project | null> => ipcRenderer.invoke('db:projects:get', id),
      create: (input: ProjectInput): Promise<Project> =>
        ipcRenderer.invoke('db:projects:create', input),
      touch: (id: number): Promise<void> => ipcRenderer.invoke('db:projects:touch', id),
      delete: (id: number): Promise<void> => ipcRenderer.invoke('db:projects:delete', id)
    },
    generations: {
      listByProject: (projectId: number): Promise<GenerationRecord[]> =>
        ipcRenderer.invoke('db:generations:listByProject', projectId),
      get: (id: number): Promise<GenerationRecord | null> =>
        ipcRenderer.invoke('db:generations:get', id),
      create: (input: GenerationInput): Promise<GenerationRecord> =>
        ipcRenderer.invoke('db:generations:create', input),
      update: (id: number, patch: GenerationUpdate): Promise<GenerationRecord | null> =>
        ipcRenderer.invoke('db:generations:update', id, patch)
    },
    settings: {
      get: (key: string): Promise<string | null> => ipcRenderer.invoke('db:settings:get', key),
      set: (key: string, value: string): Promise<void> =>
        ipcRenderer.invoke('db:settings:set', key, value),
      getAll: (): Promise<AppSettings> => ipcRenderer.invoke('db:settings:getAll')
    }
  }
}

// contextIsolation 由主进程强制开启；若未隔离则视为配置错误，安全失败，不做不安全回退。
if (!process.contextIsolated) {
  throw new Error('contextIsolation 必须开启，拒绝在非隔离环境暴露 API')
}

contextBridge.exposeInMainWorld('api', api)
