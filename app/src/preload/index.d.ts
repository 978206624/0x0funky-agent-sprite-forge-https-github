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

export interface ForgeApi {
  codex: {
    /** 检测本机 codex 安装与登录状态 */
    detect: () => Promise<CodexHealth>
  }
  projects: {
    /** 最近项目列表（最近打开优先） */
    list: () => Promise<Project[]>
    /** 选目录并新建/打开项目（主进程原子：校验 + canonical + 初始化 assets + upsert；取消返回 null） */
    pickAndCreate: (name?: string) => Promise<Project | null>
    /** 打开最近项目（校验目录仍可访问） */
    open: (id: number) => Promise<Project>
    /** 设置主进程当前项目（null=清空），返回设置后的当前项目 */
    setCurrent: (id: number | null) => Promise<Project | null>
    /** 读取主进程当前项目（renderer 启动/刷新时同步状态；失效自愈清空返回 null） */
    getCurrent: () => Promise<Project | null>
    /** 从最近列表无损隐藏项目（保留行 + 历史）；当前项目会被主进程拒绝 */
    forget: (id: number) => Promise<void>
  }
  generation: {
    /** 用当前项目 + 参数发起一次生成；返回记录 id 与 slug */
    start: (params: GenParams) => Promise<{ generationId: number; slug: string }>
    /** 取消进行中的生成 */
    cancel: () => Promise<void>
    /** 订阅 codex 事件流，返回退订函数 */
    onEvent: (cb: (ev: CodexEvent) => void) => () => void
    /** 订阅 stderr 诊断片段，返回退订函数 */
    onStderr: (cb: (chunk: string) => void) => () => void
    /** 订阅生成结束（最终记录），返回退订函数 */
    onDone: (cb: (record: GenerationRecord) => void) => () => void
  }
  db: {
    projects: {
      /** 只读：最近项目列表 */
      list: () => Promise<Project[]>
      /** 只读：按 id 查项目 */
      get: (id: number) => Promise<Project | null>
    }
    generations: {
      listByProject: (projectId: number) => Promise<GenerationRecord[]>
      get: (id: number) => Promise<GenerationRecord | null>
      create: (input: GenerationInput) => Promise<GenerationRecord>
      update: (id: number, patch: GenerationUpdate) => Promise<GenerationRecord | null>
    }
    settings: {
      get: (key: string) => Promise<string | null>
      set: (key: string, value: string) => Promise<void>
      getAll: () => Promise<AppSettings>
    }
  }
  storage: {
    /** 清空某项目的产出历史（仅删记录，保留磁盘）；任务进行中会被拒绝。返回删除行数 */
    clearHistory: (projectId: number) => Promise<number>
    /** SQLite 库文件路径 */
    dbPath: () => Promise<string>
    /** 在系统文件管理器中定位库文件 */
    revealDb: () => Promise<void>
  }
  export: {
    /** 导出某条产出的整套 bundle 到用户选定目录；返回 null 表示用户取消 */
    bundle: (generationId: number) => Promise<ExportResult | null>
  }
  skills: {
    /** 扫描 skill 目录，返回已安装 skill 列表与元信息 */
    scan: () => Promise<SkillScanResult>
    /** 重新扫描 skill 目录（同 scan） */
    rescan: () => Promise<SkillScanResult>
  }
  chat: {
    /** 发起一轮对话（conversationId=null 时主进程新建会话） */
    send: (input: ChatSendInput) => Promise<ChatSendResult>
    /** 取消进行中的对话轮 */
    cancel: () => Promise<void>
    /** 列出会话消息（join 关联产出） */
    listMessages: (conversationId: number) => Promise<ChatMessageWithGen[]>
    /** 取当前项目最近的会话；无则 null */
    getLatestConversation: () => Promise<Conversation | null>
    /** 订阅 codex 事件流，返回退订函数 */
    onEvent: (cb: (ev: CodexEvent) => void) => () => void
    /** 订阅 stderr 诊断片段，返回退订函数 */
    onStderr: (cb: (chunk: string) => void) => () => void
    /** 订阅对话轮结束（assistant 消息 + 可选产出），返回退订函数 */
    onDone: (cb: (result: ChatTurnResult) => void) => () => void
  }
}

declare global {
  interface Window {
    api: ForgeApi
  }
}
