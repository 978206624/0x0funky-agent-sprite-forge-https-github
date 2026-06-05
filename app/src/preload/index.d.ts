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
  // 后续 Phase 扩展：skills、generation（事件流）、chat
}

declare global {
  interface Window {
    api: ForgeApi
  }
}
