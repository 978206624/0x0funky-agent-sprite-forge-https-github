import { existsSync } from 'fs'
import { join } from 'path'
import { getDb } from '../db'
import { listGenerationsByProject } from '../db/generations-repo'

/**
 * slug 分配（param 生成与对话生成共用，避免双写）。
 * 唯一性以「当前项目已有 generation slug ∪ 磁盘 assets/sprites 子目录」为基准，冲突追加 -2/-3。
 *
 * 并发注意：本函数只读取已落库/已落盘的占用，不预留 slug。多任务并发时需由上层
 * 共享互斥锁（generation/lock.ts）保证一次只有一个 codex 任务，否则两个任务可能算出同一 slug。
 */

/** 把任意文本转成安全的 kebab slug（ascii 小写 + 连字符，至多 5 段 / 60 字符）。 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .split('-')
    .filter(Boolean)
    .slice(0, 5)
    .join('-')
    .slice(0, 60)
    .replace(/-+$/g, '')
}

/** 在当前项目内取唯一 slug：与已有记录及磁盘目录都不冲突，冲突则追加 -2/-3。 */
export function uniqueSlug(projectId: number, projectDir: string, base: string): string {
  const safeBase = base || 'sprite'
  const taken = new Set(listGenerationsByProject(getDb(), projectId).map((g) => g.slug))
  const spritesDir = join(projectDir, 'assets', 'sprites')
  let slug = safeBase
  let n = 2
  while (taken.has(slug) || existsSync(join(spritesDir, slug))) {
    slug = `${safeBase}-${n++}`
  }
  return slug
}
