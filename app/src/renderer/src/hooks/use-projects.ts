import { useCallback, useEffect, useState } from 'react'
import type { Project } from '@shared/types'
import { useProjectStore } from '../store/project-store'

export interface UseProjects {
  recent: Project[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  /** 新建项目 / 打开文件夹：选目录 → 创建/打开 → 进入工作台。 */
  pickAndOpen: () => Promise<void>
  /** 从最近列表打开项目（按 id）。 */
  openRecent: (id: number) => Promise<void>
}

/** 最近项目列表 + 新建/打开/进入项目。进入项目会同步通知主进程当前项目。 */
export function useProjects(): UseProjects {
  const [recent, setRecent] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const setCurrent = useProjectStore((s) => s.setCurrent)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setRecent(await window.api.projects.list())
    } catch {
      setError('读取项目列表失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const enter = useCallback(
    async (p: Project) => {
      await window.api.projects.setCurrent(p.id)
      setCurrent(p)
    },
    [setCurrent]
  )

  const pickAndOpen = useCallback(async () => {
    setError(null)
    try {
      const dir = await window.api.projects.pickDir()
      if (!dir) return
      await enter(await window.api.projects.create(dir))
    } catch {
      setError('创建项目失败：目录可能不可读写')
    }
  }, [enter])

  const openRecent = useCallback(
    async (id: number) => {
      setError(null)
      try {
        await enter(await window.api.projects.open(id))
      } catch {
        setError('打开项目失败：目录可能已被移动或删除')
        await refresh()
      }
    },
    [enter, refresh]
  )

  return { recent, loading, error, refresh, pickAndOpen, openRecent }
}
