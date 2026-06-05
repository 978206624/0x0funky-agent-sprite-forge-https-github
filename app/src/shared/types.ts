// 主进程 ↔ 渲染层共享类型

/** Codex CLI 健康检测结果 */
export interface CodexHealth {
  /** codex 可执行文件是否找到且 `--version` 成功 */
  installed: boolean
  /** 解析到的 codex 可执行文件绝对路径 */
  binPath: string | null
  /** 版本号，如 "0.137.0" */
  version: string | null
  /** 是否已登录（codex login status 成功且输出含 logged in） */
  loggedIn: boolean
  /** 登录方式，如 "ChatGPT" / "API key" */
  loginMethod: string | null
  /** 检测过程中的诊断信息（未安装/未登录/执行失败的原因） */
  error: string | null
}

// ============================================================
// 数据模型（Phase 4：SQLite 存储层）
// ============================================================

/** 项目：用户选定的磁盘目录，资源与历史按项目隔离。 */
export interface Project {
  id: number
  name: string
  /** 项目目录绝对路径（唯一） */
  absPath: string
  createdAt: string
  updatedAt: string
  /** 最近一次打开时间；从未打开为 null */
  lastOpenedAt: string | null
}

/** 新建项目入参。 */
export interface ProjectInput {
  name: string
  absPath: string
}

/**
 * 合法的生成记录状态（单一事实源）。
 * DB 的 CHECK 约束、repo 写入边界的运行时校验、TS 类型都由此派生，三处不漂移。
 */
export const GENERATION_STATUSES = ['pending', 'running', 'success', 'failed', 'canceled'] as const

/** 生成记录状态。 */
export type GenerationStatus = (typeof GENERATION_STATUSES)[number]

/**
 * 生成参数（存为 generations.params 的 JSON）。
 * 核心字段在 Phase 6 接通参数表单时逐步填充，这里定义前向兼容结构。
 */
export interface GenParams {
  /** 动作，如 walk/run/idle */
  action?: string
  /** 精灵表网格列数 */
  gridCols?: number
  /** 精灵表网格行数 */
  gridRows?: number
  /** 单帧宽（px） */
  frameWidth?: number
  /** 单帧高（px） */
  frameHeight?: number
  /** 对齐方式 */
  alignment?: string
  /** codex 模型 */
  model?: string
  /** 推理强度（effort） */
  effort?: string
  /** sandbox 模式 */
  sandbox?: string
  /** 高级/未来参数的前向兼容扩展 */
  extra?: Record<string, unknown>
}

/** 产出记录：一次生成的元数据，绑定所属项目。 */
export interface GenerationRecord {
  id: number
  /** 所属项目 id（外键 projects.id） */
  projectId: number
  /** 产出 slug，对应 <项目>/assets/sprites/<slug>/ */
  slug: string
  /** 使用的 skill，如 generate2dsprite */
  skill: string
  status: GenerationStatus
  /** 缩略图路径或 data URL；无则 null */
  thumbnail: string | null
  /** 生成参数；无则 null */
  params: GenParams | null
  /** 组装后的 prompt；无则 null */
  prompt: string | null
  /** 产物输出目录绝对路径；无则 null */
  outputDir: string | null
  createdAt: string
  updatedAt: string
}

/** 新建产出记录入参。 */
export interface GenerationInput {
  projectId: number
  slug: string
  skill: string
  status?: GenerationStatus
  thumbnail?: string | null
  params?: GenParams | null
  prompt?: string | null
  outputDir?: string | null
}

/** 更新产出记录入参（仅传需要改的字段）。 */
export interface GenerationUpdate {
  status?: GenerationStatus
  thumbnail?: string | null
  outputDir?: string | null
  params?: GenParams | null
}

/** 全局设置：key-value 映射。 */
export type AppSettings = Record<string, string>
