import { useCallback, useEffect, useRef, useState } from 'react'
import type { Project } from '@shared/types'
import { useProjectStore } from '../store/project-store'
import { useGenerationStore } from '../store/generation-store'
import { useHistoryStore } from '../store/history-store'
import { useParamStore } from '../store/param-store'

export interface UseProjects {
  recent: Project[]
  loading: boolean
  error: string | null
  /** 是否有进入项目的操作进行中（用于禁用按钮，防连点触发多次 IPC）。 */
  busy: boolean
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
  const [busy, setBusy] = useState(false)
  // 同步重入守卫：state 在闭包里会滞后，用 ref 即时拦截连点。
  const busyRef = useRef(false)
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
      // 进入新项目前清空生成状态 + 历史/选中 + 参数表单，保持项目隔离，不带上一个项目的状态。
      useGenerationStore.getState().reset()
      useHistoryStore.getState().reset()
      useParamStore.getState().reset()
      setCurrent(p)
    },
    [setCurrent]
  )

  const pickAndOpen = useCallback(async () => {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    setError(null)
    try {
      const project = await window.api.projects.pickAndCreate()
      if (!project) return // 用户取消选择
      await enter(project)
    } catch {
      setError('创建项目失败：目录可能不可读写')
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }, [enter])

  const openRecent = useCallback(
    async (id: number) => {
      if (busyRef.current) return
      busyRef.current = true
      setBusy(true)
      setError(null)
      try {
        await enter(await window.api.projects.open(id))
      } catch {
        setError('打开项目失败：目录可能已被移动或删除')
        await refresh()
      } finally {
        busyRef.current = false
        setBusy(false)
      }
    },
    [enter, refresh]
  )

  return { recent, loading, error, busy, refresh, pickAndOpen, openRecent }
}
