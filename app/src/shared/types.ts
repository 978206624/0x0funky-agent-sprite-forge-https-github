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
 * Phase 6 接通参数表单：theme + 资产类型/动作/视角 + 网格/帧尺寸/对齐 + 高级后处理项。
 * 全部 optional 以保前向兼容；缺省值由 prompt-builder / skill 自行推断。
 */
export interface GenParams {
  /** 主题/视觉描述（用户提示词，对应 prompt 的创意部分） */
  theme?: string
  /** 资产类型，如 player/npc/creature/spell（对应 skill asset_type） */
  assetType?: string
  /** 动作，如 walk/run/idle/cast */
  action?: string
  /** 视角，如 side/topdown/3-4 */
  view?: string
  /** 精灵表网格列数 */
  gridCols?: number
  /** 精灵表网格行数 */
  gridRows?: number
  /** 单帧宽 / cell_size（px） */
  frameWidth?: number
  /** 单帧高（px，省略则同宽） */
  frameHeight?: number
  /** 对齐方式：center/bottom/feet */
  alignment?: string
  // ---- 高级后处理参数（对应 pipeline-meta.json，可复现）----
  /** 主体在单元格内的缩放占比，如 0.88 */
  fitScale?: number
  /** 抠图后源裁剪外扩 padding（px） */
  sourcePadding?: number
  /** 触边判定容差（px） */
  edgeTouchMargin?: number
  /** GIF 帧时长（ms） */
  duration?: number
  /** 是否所有帧共享统一缩放 */
  sharedScale?: boolean
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

// ============================================================
// codex exec --json 事件流（Phase 6：生成执行）
// 真实格式由探针实测（见 .tk-meeting 探针 jsonl）：每行一个 JSON，顶层 `type` 判别，
// item.* 事件再由 `item.type` 二级判别。已知变体显式建模；未知类型由解析器归一为
// CodexUnknownEvent 兜底，保证新事件/新 item 类型不会让解析器崩溃（仍可原样进日志）。
// ============================================================

/** codex 输出项的执行状态。 */
export type CodexItemStatus = 'in_progress' | 'completed' | 'failed'

/** agent 文本消息项。 */
export interface CodexAgentMessageItem {
  id: string
  type: 'agent_message'
  text: string
}

/** 命令执行项（含聚合输出与退出码）。 */
export interface CodexCommandExecutionItem {
  id: string
  type: 'command_execution'
  command: string
  aggregated_output: string
  exit_code: number | null
  status: CodexItemStatus
}

/** 单条文件变更。kind 如 add / update / delete。 */
export interface CodexFileChange {
  path: string
  kind: string
}

/** 文件变更项。 */
export interface CodexFileChangeItem {
  id: string
  type: 'file_change'
  changes: CodexFileChange[]
  status: CodexItemStatus
}

/** 推理项（codex 暴露 reasoning 摘要时）。 */
export interface CodexReasoningItem {
  id: string
  type: 'reasoning'
  text?: string
}

/**
 * codex 输出项联合（按 item.type 判别已知变体）。
 * 未知/未来 item 类型（如 image_gen）在格式化层自然落到 default 跳过；
 * 不在此处放开放兜底，避免索引签名污染判别窄化。顶层未知事件由 CodexUnknownEvent 兜底。
 */
export type CodexItem =
  | CodexAgentMessageItem
  | CodexCommandExecutionItem
  | CodexFileChangeItem
  | CodexReasoningItem

/** turn 完成时的 token 用量。 */
export interface CodexUsage {
  input_tokens: number
  cached_input_tokens: number
  output_tokens: number
  reasoning_output_tokens: number
}

/** codex exec --json 顶层事件（按 type 判别）。CodexUnknownEvent 为兜底。 */
export type CodexEvent =
  | { type: 'thread.started'; thread_id: string }
  | { type: 'turn.started' }
  | { type: 'turn.completed'; usage: CodexUsage }
  | { type: 'turn.failed'; error?: { message?: string } }
  | { type: 'item.started'; item: CodexItem }
  | { type: 'item.updated'; item: CodexItem }
  | { type: 'item.completed'; item: CodexItem }
  | { type: 'error'; message: string }
  | CodexUnknownEvent

/** 解析器对未识别顶层事件的归一形式：保留原始 JSON 供日志透传与诊断。 */
export interface CodexUnknownEvent {
  type: 'unknown'
  raw: unknown
}
