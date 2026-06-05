import { dialog } from 'electron'
import { mkdirSync, statSync, accessSync, constants } from 'fs'
import { join, basename } from 'path'
import { getDb } from '../db'
import { createProject, getProject, touchProject } from '../db/projects-repo'
import type { Project } from '../../shared/types'

/** 主进程内存中的当前项目 id（供 Phase 6 生成时定位 codex -C 工作区）。 */
let currentProjectId: number | null = null

/** 设置当前项目（null=回到无项目态）。 */
export function setCurrentProject(id: number | null): void {
  currentProjectId = id
}

/** 读取当前项目 id。 */
export function getCurrentProjectId(): number | null {
  return currentProjectId
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
 * 在指定目录新建/打开项目：校验目录 → 初始化 assets/ → 写库（abs_path upsert，刷新打开时间）→ 返回。
 * 「新建项目」与「打开文件夹」在本层语义一致（upsert 去重）。
 */
export function openProjectAt(absPath: string, name?: string): Project {
  assertWritableDir(absPath)
  ensureAssetsStructure(absPath)
  return createProject(getDb(), { name: name?.trim() || basename(absPath), absPath })
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
