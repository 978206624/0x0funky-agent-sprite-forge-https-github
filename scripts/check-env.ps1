# check-env.ps1 — GameFoundry v3.0 启动环境自检
#
# 目的：在启动 dev/build 之前确认关键依赖就位。
#
# 用法：
#   pwsh -File scripts/check-env.ps1
#   exit code: 0 = 全部 PASS, 1 = 有 FAIL
#
# 检查项（按 P0 范围）：
#   1. app/ 目录存在（项目代码）
#   2. app/node_modules/better-sqlite3 已安装（SQLite fallback 依赖）
#   3. app/.env.local 存在（MCP 状态记录）
#   4. codex CLI 可用（项目跑通依赖）
#   5. git 仓库在 repo root（commit / 状态查询基础）
#   6. 当前 plan 状态：dev-plans/v3-imr-and-adapters.md = active
#
# 注：plan 里写了「8000 端口」检查，但 Electron 主进程不开 HTTP server，
#     故已删除该检查（实际架构是 contextBridge IPC）。

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Continue'

. "$PSScriptRoot/dev-fallback.ps1"

$repoRoot = Get-RepoRoot
$appRoot = Join-Path $repoRoot 'app'
$failCount = 0

function Test-Check {
    param(
        [string]$Name,
        [scriptblock]$Check
    )
    Write-Host "── $Name ──" -ForegroundColor Cyan
    $result = & $Check
    if ($result.Ok) {
        Write-Host "  ✅ PASS" -ForegroundColor Green -NoNewline
        Write-Host " $($result.Message)"
    } else {
        Write-Host "  ❌ FAIL" -ForegroundColor Red -NoNewline
        Write-Host " $($result.Message)"
        $script:failCount++
    }
}

Test-Check 'app/ 目录存在' {
    if (Test-Path $appRoot) {
        Format-Result $true "found: $appRoot"
    } else {
        Format-Result $false "missing: $appRoot"
    }
}

Test-Check 'better-sqlite3 已安装' {
    $mod = Join-Path $appRoot 'node_modules/better-sqlite3'
    if (Test-Path $mod) {
        Format-Result $true "found: $mod"
    } else {
        Format-Result $false "missing: $mod — run 'npm install' in app/"
    }
}

Test-Check '.env.local 存在' {
    $envFile = Join-Path $appRoot '.env.local'
    if (Test-Path $envFile) {
        Format-Result $true "found: $envFile"
    } else {
        Format-Result $false "missing: $envFile — run 'pwsh -File scripts/init-env.ps1' or create from .env.example"
    }
}

Test-Check 'codex CLI 可用' {
    $codex = Get-Command codex -ErrorAction SilentlyContinue
    if ($codex) {
        Format-Result $true "found: $($codex.Source)"
    } else {
        Format-Result $false "codex not in PATH — install Codex CLI or update PATH"
    }
}

Test-Check 'git 仓库在 repo root' {
    $top = (git -C $repoRoot rev-parse --show-toplevel 2>&1).Trim()
    if ($LASTEXITCODE -eq 0) {
        Format-Result $true "toplevel: $top"
    } else {
        Format-Result $false "git rev-parse failed: $top"
    }
}

Test-Check 'v3.0 plan active' {
    $plan = Join-Path $repoRoot 'dev-plans/v3-imr-and-adapters.md'
    if (-not (Test-Path $plan)) {
        return Format-Result $false "missing: $plan"
    }
    $content = Get-Content $plan -Raw
    if ($content -match 'status:\s*active') {
        Format-Result $true "v3.0 plan is active"
    } else {
        Format-Result $true "v3.0 plan archived — Phase 1+ may be ready" 'info'
    }
}

Write-Host ''
if ($failCount -eq 0) {
    Write-Host '✅ 全部 PASS — 可以启动 dev / build' -ForegroundColor Green
    exit 0
} else {
    Write-Host "❌ $failCount 项 FAIL — 修复后再启动" -ForegroundColor Red
    exit 1
}