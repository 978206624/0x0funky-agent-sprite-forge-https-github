import {
  X,
  FolderOpen,
  CheckCircle,
  AlertCircle,
  Loader2,
  Zap,
  Download,
  Package
} from 'lucide-react'
import { useEffect, useState, useCallback } from 'react'
import type { ExportAdapterInfo, AdapterExportResult, ValidationReport } from '@shared/types'
import { ValidationPreview } from './validation-preview'

interface ExportDialogProps {
  generationId: number
  slug: string
  onClose: () => void
}

/**
 * F4 导出对话框：全屏覆盖 Modal，三段式。
 * Section 1：选择 Adapter（横向卡片列表，disabled 灰显不可选）
 * Section 2：导出目标目录（原生选择器）
 * Section 3：校验预览 + 结果摘要
 */
export function ExportDialog({ generationId, slug, onClose }: ExportDialogProps) {
  const [adapters, setAdapters] = useState<ExportAdapterInfo[]>([])
  const [loadingAdapters, setLoadingAdapters] = useState(true)
  const [adapterError, setAdapterError] = useState<string | null>(null)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [destRoot, setDestRoot] = useState<string | null>(null)

  const [validation, setValidation] = useState<ValidationReport | null>(null)
  const [validating, setValidating] = useState(false)
  const [validateError, setValidateError] = useState<string | null>(null)

  const [exporting, setExporting] = useState(false)
  const [exportResult, setExportResult] = useState<AdapterExportResult | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)

  // ---- 加载 adapter 列表 ----
  useEffect(() => {
    let cancelled = false
    setLoadingAdapters(true)
    setAdapterError(null)
    window.api.export
      .listAdapters()
      .then((list) => {
        if (cancelled) return
        setAdapters(list)
        if (list.length > 0) {
          const firstEnabled = list.find((a) => a.enabled)
          if (firstEnabled) setSelectedId(firstEnabled.id)
        }
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setAdapterError(e instanceof Error ? e.message : '加载适配器失败')
      })
      .finally(() => {
        if (!cancelled) setLoadingAdapters(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // ---- 选 adapter 后自动校验 ----
  const runValidate = useCallback(
    async (adapterId: string) => {
      setValidating(true)
      setValidateError(null)
      setValidation(null)
      try {
        const r = await window.api.export.adapterValidate({ generationId, adapterId })
        setValidation(r)
      } catch (e: unknown) {
        setValidateError(e instanceof Error ? e.message : '校验失败')
      } finally {
        setValidating(false)
      }
    },
    [generationId]
  )

  useEffect(() => {
    if (selectedId) {
      void runValidate(selectedId)
    } else {
      setValidation(null)
      setValidateError(null)
    }
  }, [selectedId, runValidate])

  // ---- 选择目录 ----
  const handlePickDir = async (): Promise<void> => {
    try {
      const dir = await window.api.export.pickDirectory()
      if (dir) setDestRoot(dir)
    } catch {
      // cancelled
    }
  }

  // ---- 导出 ----
  const handleExport = async (): Promise<void> => {
    if (!selectedId || !destRoot || exporting) return
    setExporting(true)
    setExportError(null)
    setExportResult(null)
    try {
      const r = await window.api.export.adapter({ generationId, adapterId: selectedId })
      if (r) setExportResult(r)
    } catch (e: unknown) {
      setExportError(e instanceof Error ? e.message : '导出失败')
    } finally {
      setExporting(false)
    }
  }

  const canExport = selectedId !== null && destRoot !== null && validation?.ok === true && !exporting
  const selectedAdapter = adapters.find((a) => a.id === selectedId)
  const showResult = exportResult && !exportError
  const showExportError = exportError && !exportResult

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center bg-black/50 pt-12" onClick={onClose}>
      <div
        className="flex h-[calc(100vh-8rem)] w-[960px] max-w-[94vw] flex-col rounded-t-lg border border-edge bg-panel shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-edge px-5">
          <div className="flex items-center gap-2 text-sm">
            <Package className="h-4 w-4 text-accent" />
            <span className="font-semibold text-fg">导出资源包</span>
            <span className="text-fg-dim">·</span>
            <span className="font-mono text-xs text-fg-soft">{slug}</span>
          </div>
          <button type="button" onClick={onClose} title="关闭 (Esc)" className="rounded-sm p-1 text-fg-dim hover:bg-hover hover:text-fg">
            <X className="h-4 w-4" />
          </button>
        </header>

        {/* Body */}
        <div className="flex-1 overflow-auto px-5 py-4 space-y-5">
          {/* Section 1: Adapter */}
          <section>
            <span className="text-[11px] font-semibold uppercase tracking-wide text-fg-dim">选择 Adapter</span>
            {loadingAdapters ? (
              <p className="mt-2 flex items-center gap-2 text-xs text-fg-dim">
                <Loader2 className="h-3 w-3 animate-spin" />加载中…
              </p>
            ) : adapterError ? (
              <p className="mt-2 text-xs text-error">{adapterError}</p>
            ) : adapters.length === 0 ? (
              <p className="mt-2 rounded-md border border-dashed border-edge bg-base/50 p-3 text-center text-xs text-fg-dim">
                暂无可用的导出适配器
              </p>
            ) : (
              <div className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-2.5">
                {adapters.map((a) => {
                  const selected = a.id === selectedId
                  const disabled = !a.enabled
                  return (
                    <button
                      key={a.id}
                      type="button"
                      disabled={disabled}
                      onClick={() => !disabled && setSelectedId(a.id)}
                      className={`flex flex-col gap-1 rounded-lg border p-3 text-left transition-colors ${
                        disabled
                          ? 'cursor-not-allowed border-edge bg-base/30 opacity-50'
                          : selected
                            ? 'border-accent bg-accent-soft ring-1 ring-accent'
                            : 'border-edge bg-elevated hover:border-edge-strong'
                      }`}
                    >
                      <span className="flex items-center gap-1.5">
                        <Zap className={`h-3.5 w-3.5 ${disabled ? 'text-fg-dim' : 'text-accent'}`} />
                        <span className={`text-xs font-semibold ${disabled ? 'text-fg-dim' : 'text-fg'}`}>
                          {a.displayName}
                        </span>
                        {disabled && (
                          <span className="rounded border border-edge px-1 py-px text-[10px] text-fg-dim">未启用</span>
                        )}
                      </span>
                      <span className={`text-[11px] ${disabled ? 'text-fg-dim' : 'text-fg-soft'}`}>{a.description}</span>
                      <span className="text-[10px] text-fg-dim">v{a.version}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </section>

          {/* Section 2: 目标路径 */}
          <section>
            <span className="text-[11px] font-semibold uppercase tracking-wide text-fg-dim">导出目标</span>
            <div className="mt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={handlePickDir}
                className="inline-flex items-center gap-1.5 rounded-md border border-edge bg-elevated px-3 py-2 text-xs font-medium text-fg-soft hover:bg-hover hover:text-fg"
              >
                <FolderOpen className="h-3.5 w-3.5" />
                选择目录
              </button>
              <span className="min-w-0 flex-1 truncate font-mono text-xs text-fg-soft">
                {destRoot ?? '尚未选择'}
              </span>
            </div>
          </section>

          {/* Section 3: 校验预览 */}
          <section>
            <span className="text-[11px] font-semibold uppercase tracking-wide text-fg-dim">校验预览</span>
            {!selectedId ? (
              <p className="mt-2 text-xs text-fg-dim">请先选择 Adapter</p>
            ) : (
              <ValidationPreview validation={validation} error={validateError} loading={validating} />
            )}
          </section>

          {/* 结果摘要 */}
          {showResult && exportResult && (
            <section>
              <div className="rounded-md border border-success/30 bg-success/10 px-4 py-3">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-success">
                  <CheckCircle className="h-4 w-4" />导出成功
                </span>
                <div className="mt-2 space-y-1 text-xs text-fg-soft">
                  <p>目标目录：<span className="font-mono text-fg">{exportResult.destRoot}</span></p>
                  <p>生成文件：<span className="font-semibold text-fg">{exportResult.files.length} 个</span></p>
                  {exportResult.warnings.length > 0 && (
                    <p className="text-warning">{exportResult.warnings.length} 条警告</p>
                  )}
                </div>
              </div>
            </section>
          )}

          {showExportError && (
            <div className="flex items-start gap-1.5 rounded-md border border-error/30 bg-error/10 px-3 py-2">
              <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0 text-error" />
              <span className="text-xs text-error">{exportError}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="flex h-12 shrink-0 items-center justify-between border-t border-edge px-5">
          <span className="text-xs text-fg-dim">
            {selectedAdapter ? `${selectedAdapter.displayName} v${selectedAdapter.version}` : '未选择适配器'}
          </span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-edge bg-elevated px-4 py-1.5 text-xs font-medium text-fg-soft hover:bg-hover hover:text-fg"
            >
              取消
            </button>
            <button
              type="button"
              onClick={() => void handleExport()}
              disabled={!canExport}
              className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-1.5 text-xs font-semibold text-white hover:bg-accent-hover disabled:pointer-events-none disabled:opacity-50"
            >
              {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              {exporting ? '导出中…' : '导出'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}
