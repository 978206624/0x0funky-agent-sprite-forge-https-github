import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type {
  CodexHealth,
  Project,
  CodexEvent,
  GenParams,
  GenerationRecord,
  GenerationInput,
  GenerationUpdate,
  AppSettings,
  ExportResult,
  SkillScanResult,
  Conversation,
  ChatMessageWithGen,
  ChatSendInput,
  ChatSendResult,
  ChatTurnResult
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
  dialog: {
    /** 原生多选图片对话框，返回所选参考图绝对路径数组（取消=空数组）。 */
    pickImages: (): Promise<string[]> => ipcRenderer.invoke('dialog:pickImages')
  },
  projects: {
    list: (): Promise<Project[]> => ipcRenderer.invoke('projects:list'),
    pickAndCreate: (name?: string): Promise<Project | null> =>
      ipcRenderer.invoke('projects:pickAndCreate', name),
    open: (id: number): Promise<Project> => ipcRenderer.invoke('projects:open', id),
    setCurrent: (id: number | null): Promise<Project | null> =>
      ipcRenderer.invoke('projects:setCurrent', id),
    getCurrent: (): Promise<Project | null> => ipcRenderer.invoke('projects:getCurrent'),
    /** 从最近列表无损隐藏项目（保留行 + 历史）；当前项目会被主进程拒绝。 */
    forget: (id: number): Promise<void> => ipcRenderer.invoke('projects:forget', id)
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
  },
  storage: {
    /** 清空某项目的产出历史（仅删记录，保留磁盘）；任务进行中会被拒绝。返回删除行数。 */
    clearHistory: (projectId: number): Promise<number> =>
      ipcRenderer.invoke('settings:clearHistory', projectId),
    /** SQLite 库文件路径。 */
    dbPath: (): Promise<string> => ipcRenderer.invoke('storage:dbPath'),
    /** 在系统文件管理器中定位库文件。 */
    revealDb: (): Promise<void> => ipcRenderer.invoke('storage:revealDb')
  },
  export: {
    /** 导出某条产出的整套 bundle 到用户选定目录；返回 null 表示用户取消。 */
    bundle: (generationId: number): Promise<ExportResult | null> =>
      ipcRenderer.invoke('export:bundle', generationId)
  },
  skills: {
    /** 扫描 skill 目录，返回已安装 skill 列表与元信息。 */
    scan: (): Promise<SkillScanResult> => ipcRenderer.invoke('skills:scan'),
    /** 重新扫描 skill 目录（同 scan）。 */
    rescan: (): Promise<SkillScanResult> => ipcRenderer.invoke('skills:rescan')
  },
  chat: {
    /** 发起一轮对话：携会话 id（null=新建）+ 文本 + 当前 skill；返回会话 id 与用户消息 id。 */
    send: (input: ChatSendInput): Promise<ChatSendResult> => ipcRenderer.invoke('chat:send', input),
    /** 取消进行中的对话轮。 */
    cancel: (): Promise<void> => ipcRenderer.invoke('chat:cancel'),
    /** 列出会话消息（join 关联产出）。 */
    listMessages: (conversationId: number): Promise<ChatMessageWithGen[]> =>
      ipcRenderer.invoke('chat:listMessages', conversationId),
    /** 取当前项目最近的会话；无则 null。 */
    getLatestConversation: (): Promise<Conversation | null> =>
      ipcRenderer.invoke('chat:getLatestConversation'),
    /** 订阅 codex 事件流（流式文本/进度），返回退订函数。 */
    onEvent: (cb: (ev: CodexEvent) => void): (() => void) => subscribe('chat:event', cb),
    /** 订阅 stderr 诊断片段，返回退订函数。 */
    onStderr: (cb: (chunk: string) => void): (() => void) => subscribe('chat:stderr', cb),
    /** 订阅对话轮结束（assistant 消息 + 可选产出），返回退订函数。 */
    onDone: (cb: (result: ChatTurnResult) => void): (() => void) => subscribe('chat:done', cb)
  }
}

// contextIsolation 由主进程强制开启；若未隔离则视为配置错误，安全失败，不做不安全回退。
if (!process.contextIsolated) {
  throw new Error('contextIsolation 必须开启，拒绝在非隔离环境暴露 API')
}

contextBridge.exposeInMainWorld('api', api)
