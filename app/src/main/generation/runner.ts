import { mkdirSync } from 'fs'
import { join } from 'path'
import { getDb } from '../db'
import { createGeneration, updateGeneration } from '../db/generations-repo'
import { runCodexExec, type CodexExecHandle, type CodexSandbox } from '../codex/exec'
import { buildSpritePrompt } from './prompt-builder'
import { resolveGrid } from '../../shared/sprite-grid'
import { slugify, uniqueSlug } from './slug'
import { validateBundleStrict } from './bundle'
import { syncSkillToProject, cleanupSkillInProject } from '../skills/sync'
import type { CodexEvent, GenParams, GenerationRecord } from '../../shared/types'

const SKILL = 'generate2dsprite'
/** 单次生成默认超时：image_gen + 后处理通常数分钟，给 20 分钟上限防 codex 挂死后记录长期 running。 */
const DEFAULT_TIMEOUT_MS = 20 * 60 * 1000

export interface RunGenerationInput {
  projectId: number
  /** 当前项目目录绝对路径（codex -C 工作区）。 */
  projectDir: string
  /** 已解析的 codex 可执行文件路径。 */
  binPath: string
  params: GenParams
  /** 生效的 sandbox 模式（IPC 层经 getEffectiveSandbox clamp 后传入）。省略=workspace-write。 */
  sandbox?: CodexSandbox
  /** 生成默认模型（--model）；省略=codex 自身默认。 */
  model?: string
  /** reasoning effort；省略=codex 默认。 */
  effort?: string
  /** 超时（毫秒），省略用默认 20 分钟。 */
  timeoutMs?: number
  /** 转发 codex 事件流（上层经 IPC 推渲染层日志/进度）。 */
  onEvent: (event: CodexEvent) => void
  onStderr?: (chunk: string) => void
}

export interface RunGenerationHandle {
  readonly generationId: number
  readonly slug: string
  cancel: () => void
  /** 结束 Promise：返回最终的 generations 记录（成功/失败/取消均落库）。 */
  readonly done: Promise<GenerationRecord>
}

/** 从参数推导 slug 基名；空则回退 sprite。 */
function baseSlug(params: GenParams): string {
  const parts = [params.theme, params.assetType, params.action].filter(Boolean).join(' ')
  return slugify(parts) || 'sprite'
}

/**
 * 编排一次 sprite 生成：建目录 + 入库(running) → 组 prompt → 跑 codex exec →
 * 转发事件 → 结束后校验 bundle/帧数 → 更新状态(success/failed/canceled)并落库。
 * 立即返回句柄（含 generationId/slug/cancel/done），不阻塞调用方。
 */
export function runGeneration(input: RunGenerationInput): RunGenerationHandle {
  const db = getDb()
  const slug = uniqueSlug(input.projectId, input.projectDir, baseSlug(input.params))
  const outputDir = join(input.projectDir, 'assets', 'sprites', slug)
  mkdirSync(outputDir, { recursive: true })

  const prompt = buildSpritePrompt({ slug, params: input.params })
  // 期望网格：multiDir 时 resolveGrid 已锁行 4、列=每方向帧数（帧数 = 4×列）。
  const { rows, cols } = resolveGrid(input.params)
  const expected = { rows, cols, multiDir: input.params.multiDir === true }

  const record = createGeneration(db, {
    projectId: input.projectId,
    slug,
    skill: SKILL,
    status: 'running',
    params: input.params,
    prompt,
    outputDir
  })

  const markFailed = (): GenerationRecord =>
    updateGeneration(db, record.id, { status: 'failed' }) ?? record

  // 生成前把 skill 从自管库同步到项目 .codex/skills/ 供 codex 挂载；失败则中止本次生成。
  try {
    syncSkillToProject(SKILL, input.projectDir)
  } catch (err) {
    input.onStderr?.(`同步 skill 失败：${String(err)}\n`)
    cleanupSkillInProject(SKILL, input.projectDir) // 清掉同步中途失败可能留下的半拷贝
    return { generationId: record.id, slug, cancel: () => {}, done: Promise.resolve(markFailed()) }
  }

  // spawn 同步失败（参数非法等）也要把已入库的 running 记录落到 failed，不留悬挂状态。
  let exec: CodexExecHandle
  try {
    exec = runCodexExec({
      binPath: input.binPath,
      projectDir: input.projectDir,
      prompt,
      sandbox: input.sandbox ?? 'workspace-write',
      model: input.model,
      effort: input.effort,
      images: input.params.refImages,
      timeoutMs: input.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      onEvent: input.onEvent,
      onStderr: input.onStderr
    })
  } catch (err) {
    input.onStderr?.(`启动 codex 失败：${String(err)}\n`)
    cleanupSkillInProject(SKILL, input.projectDir)
    return { generationId: record.id, slug, cancel: () => {}, done: Promise.resolve(markFailed()) }
  }

  const done = exec.done
    .then((outcome): GenerationRecord => {
    if (outcome.result === 'canceled') {
      return updateGeneration(db, record.id, { status: 'canceled' }) ?? record
    }
    if (outcome.result === 'timeout' || outcome.result === 'error') {
      return markFailed()
    }
    // completed：先看退出码，非 0 视为 CLI 失败（不进 bundle 校验，避免误判 success）。
    if (outcome.code !== 0) {
      input.onStderr?.(`codex 退出码非 0：${outcome.code}\n`)
      return markFailed()
    }
    const v = validateBundleStrict(outputDir, slug, expected)
    if (!v.ok) {
      input.onStderr?.(`产物校验失败：${v.reason}\n`)
      return markFailed()
    }
    return (
      updateGeneration(db, record.id, { status: 'success', thumbnail: v.thumbnail }) ?? record
    )
    })
    // 无论成功/失败/取消/超时，都清理项目内临时 skill 副本。
    .finally(() => cleanupSkillInProject(SKILL, input.projectDir))

  return { generationId: record.id, slug, cancel: exec.cancel, done }
}
