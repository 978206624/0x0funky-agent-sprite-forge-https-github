import { dialog } from 'electron'
import { mkdirSync, statSync, accessSync, realpathSync, constants } from 'fs'
import { join, basename } from 'path'
import { getDb } from '../db'
import { createProject, getProject, touchProject } from '../db/projects-repo'
import type { Project } from '../../shared/types'

/** 主进程内存中的当前项目 id（供 Phase 6 生成时定位 codex -C 工作区）。 */
let currentProjectId: number | null = null

/**
 * 设置当前项目（null=回到无项目态）。非空 id 须先校验项目存在且其目录仍可访问，
 * 避免把当前项目设成无效态——Phase 6 会据此定位 codex -C 工作区。
 * 返回设置后的当前项目（null 表示清空）。
 */
export function setCurrentProject(id: number | null): Project | null {
  if (id === null) {
    currentProjectId = null
    return null
  }
  const proj = getProject(getDb(), id)
  if (!proj) throw new Error(`项目不存在：id=${id}`)
  assertWritableDir(proj.absPath)
  currentProjectId = id
  return proj
}

/** 读取当前项目 id。 */
export function getCurrentProjectId(): number | null {
  return currentProjectId
}

/**
 * 读取当前项目完整记录（供 renderer 启动/刷新时与主进程同步状态）。
 * 复用 setCurrentProject 的不变量：若 row 已被删除或目录已不可访问，
 * 自愈清空 currentProjectId 并返回 null，避免 rehydrate 到不可用项目、
 * 保持 getCurrentProjectId() 与本函数状态一致。
 */
export function getCurrentProject(): Project | null {
  if (currentProjectId === null) return null
  const proj = getProject(getDb(), currentProjectId)
  if (!proj) {
    currentProjectId = null
    return null
  }
  try {
    assertWritableDir(proj.absPath)
  } catch {
    currentProjectId = null
    return null
  }
  return proj
}

/** 弹目录选择对话框，返回选中的绝对路径；用户取消返回 null。 */
export async function pickDirectory(): Promise<string | null> {
  const res = await dialog.showOpenDialog({
    title: '选择项目目录',
    properties: ['openDirectory', 'createDirectory']
  })
  if (res.canceled || res.filePaths.length === 0) return null
  return res.filePaths[0]
}

/** 校验路径是目录且可读写，否则抛出明确错误。 */
function assertWritableDir(absPath: string): void {
  let isDir = false
  try {
    isDir = statSync(absPath).isDirectory()
  } catch {
    throw new Error(`目录不存在或无法访问：${absPath}`)
  }
  if (!isDir) throw new Error(`所选路径不是目录：${absPath}`)
  try {
    accessSync(absPath, constants.R_OK | constants.W_OK)
  } catch {
    throw new Error(`目录不可读写：${absPath}`)
  }
}

/** 在项目目录下确保 assets/sprites/ 结构存在。 */
function ensureAssetsStructure(absPath: string): void {
  mkdirSync(join(absPath, 'assets', 'sprites'), { recursive: true })
}

/**
 * 规范化为磁盘真实路径：解析 symlink/junction、折叠 Windows 大小写与 8.3 短路径，
 * 使「同一目录的不同写法」收敛到唯一字符串，是 abs_path 去重的事实基准。
 * 仅对已存在的目录调用（realpathSync.native 要求路径存在）。
 * 兑现 projects-repo.ts 注释中推迟到 Phase 5 边界的 canonical 化约定。
 */
function canonicalDir(absPath: string): string {
  return realpathSync.native(absPath)
}

/**
 * 在指定目录新建/打开项目：校验目录 → canonical 化 → 初始化 assets/ →
 * 写库（abs_path upsert，刷新打开时间）→ 返回。
 * 「新建项目」与「打开文件夹」在本层语义一致（upsert 去重）。
 */
export function openProjectAt(absPath: string, name?: string): Project {
  assertWritableDir(absPath)
  const canonical = canonicalDir(absPath)
  ensureAssetsStructure(canonical)
  return createProject(getDb(), { name: name?.trim() || basename(canonical), absPath: canonical })
}

/**
 * 选目录并新建/打开项目的原子操作：目录选择全程在主进程内完成，
 * renderer 无从注入任意路径——收口「项目路径必须来自原生目录选择器」的信任边界。
 * 用户取消选择返回 null。
 */
export async function pickAndCreateProject(name?: string): Promise<Project | null> {
  const dir = await pickDirectory()
  if (!dir) return null
  return openProjectAt(dir, name)
}

/**
 * 打开最近项目（按 id）：校验其磁盘目录仍可访问 → 补齐 assets/ → 刷新打开时间 → 返回。
 * 目录已被移动/删除时抛错，由上层提示用户。
 */
export function openExistingProject(id: number): Project {
  const db = getDb()
  const existing = getProject(db, id)
  if (!existing) throw new Error(`项目不存在：id=${id}`)
  assertWritableDir(existing.absPath)
  ensureAssetsStructure(existing.absPath)
  touchProject(db, id)
  return getProject(db, id) as Project
}
