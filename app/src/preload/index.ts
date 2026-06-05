import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type {
  CodexHealth,
  Project,
  CodexEvent,
  GenParams,
  GenerationRecord,
  GenerationInput,
  GenerationUpdate,
  AppSettings
} from '../shared/types'

/** 订阅一个 ipc 频道并返回退订函数（renderer 卸载/刷新时清理监听）。 */
function subscribe<T>(channel: string, cb: (payload: T) => void): () => void {
  const handler = (_e: IpcRendererEvent, payload: T): void => cb(payload)
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}

// 渲染层可调用的安全 API（只暴露窄方法，不暴露原始 ipcRenderer）。
const api = {
  codex: {
    detect: (): Promise<CodexHealth> => ipcRenderer.invoke('codex:detect')
  },
  projects: {
    list: (): Promise<Project[]> => ipcRenderer.invoke('projects:list'),
    pickAndCreate: (name?: string): Promise<Project | null> =>
      ipcRenderer.invoke('projects:pickAndCreate', name),
    open: (id: number): Promise<Project> => ipcRenderer.invoke('projects:open', id),
    setCurrent: (id: number | null): Promise<Project | null> =>
      ipcRenderer.invoke('projects:setCurrent', id),
    getCurrent: (): Promise<Project | null> => ipcRenderer.invoke('projects:getCurrent')
  },
  generation: {
    /** 用当前项目 + 参数发起一次生成；返回记录 id 与 slug（最终记录经 onDone 回传）。 */
    start: (params: GenParams): Promise<{ generationId: number; slug: string }> =>
      ipcRenderer.invoke('gen:start', params),
    /** 取消进行中的生成。 */
    cancel: (): Promise<void> => ipcRenderer.invoke('gen:cancel'),
    /** 订阅 codex 事件流（日志/进度），返回退订函数。 */
    onEvent: (cb: (ev: CodexEvent) => void): (() => void) => subscribe('gen:event', cb),
    /** 订阅 stderr 诊断片段，返回退订函数。 */
    onStderr: (cb: (chunk: string) => void): (() => void) => subscribe('gen:stderr', cb),
    /** 订阅生成结束（最终 generations 记录），返回退订函数。 */
    onDone: (cb: (record: GenerationRecord) => void): (() => void) => subscribe('gen:done', cb)
  },
  db: {
    projects: {
      list: (): Promise<Project[]> => ipcRenderer.invoke('db:projects:list'),
      get: (id: number): Promise<Project | null> => ipcRenderer.invoke('db:projects:get', id)
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
