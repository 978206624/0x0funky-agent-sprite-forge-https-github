import type {
  CodexHealth,
  Project,
  ProjectInput,
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
    /** 弹目录选择对话框，取消返回 null */
    pickDir: () => Promise<string | null>
    /** 在目录新建/打开项目（校验 + 初始化 assets + upsert） */
    create: (absPath: string, name?: string) => Promise<Project>
    /** 打开最近项目（校验目录仍可访问） */
    open: (id: number) => Promise<Project>
    /** 设置主进程当前项目（null=清空） */
    setCurrent: (id: number | null) => Promise<void>
  }
  db: {
    projects: {
      list: () => Promise<Project[]>
      get: (id: number) => Promise<Project | null>
      create: (input: ProjectInput) => Promise<Project>
      touch: (id: number) => Promise<void>
      delete: (id: number) => Promise<void>
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
