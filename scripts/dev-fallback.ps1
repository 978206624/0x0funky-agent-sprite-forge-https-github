# dev-fallback.ps1 — GameFoundry v3.0 fallback 通道
#
# 目的：当 Codex 客户端的 MCP 工具（mcp__pencil__* / mcp__godot_ai__* /
#       mcp__node_repl__*）不可用时，提供不依赖任何 MCP 的常用操作入口。
#
# 用法（dot-source 后调用函数）：
#   . "$PSScriptRoot/dev-fallback.ps1"
#   Test-PortListening -Port 5173
#   Get-GitStatusShort
#   Write-Utf8File -Path ./out.txt -Content "hello"
#   Invoke-SqliteQuery -DbPath ./app/userdata/state.db -Sql "SELECT 1"
#
# 所有函数输出结构化结果（PSCustomObject），便于管道 + CI 检测。
# 不抛未捕获异常；错误以 { Ok = $false, Error = "..." } 形式返回。
#
# 此文件用 dot-source 加载（不是 .psm1 模块），所以不写 Export-ModuleMember。

$ErrorActionPreference = 'Continue'

# ─── 脚本作用域的 repo root（dot-source 加载时立即固化，避免 $PSScriptRoot 被覆盖）───
# 注：不在 StrictMode 下，dot-source 时 $script: 作用域读未初始化变量会报错。
#     用全局变量兜底，函数 Get-RepoRoot 优先返回。
$scriptPath = $MyInvocation.MyCommand.Path
if (-not $scriptPath) { $scriptPath = $PSCommandPath }
if (-not $scriptPath) {
    # 最后兜底：假设 cwd 在 repo root
    $scriptPath = Join-Path (Get-Location).Provider.Path 'scripts\dev-fallback.ps1'
}
$GAF_REPO_ROOT = Split-Path -Parent (Split-Path -Parent $scriptPath)

# ─── 通用工具 ────────────────────────────────────────────────────────────

function Format-Result {
    param([bool]$Ok, [string]$Message = '', $Data = $null)
    [PSCustomObject]@{ Ok = $Ok; Message = $Message; Data = $Data }
}

function Get-RepoRoot {
    # 全局变量，dot-source 后仍然可读
    $GAF_REPO_ROOT
}

# ─── 端口探测 ────────────────────────────────────────────────────────────

function Test-PortListening {
    <#
    .SYNOPSIS 探测本地端口是否在监听
    .DESCRIPTION 用 Test-NetConnection 探测 TCP 端口（兼容 PowerShell 5/7）。
    .PARAMETER Port 端口号
    .PARAMETER Host 主机名（默认 localhost）
    .EXAMPLE Test-PortListening -Port 5173
    #>
    param(
        [Parameter(Mandatory)][int]$Port,
        [string]$HostName = 'localhost',
        [int]$TimeoutMs = 1000
    )

    try {
        $tcpClient = New-Object System.Net.Sockets.TcpClient
        $iar = $tcpClient.BeginConnect($HostName, $Port, $null, $null)
        $success = $iar.AsyncWaitHandle.WaitOne($TimeoutMs, $false)
        if (-not $success) {
            $tcpClient.Close()
            return Format-Result $false "Port $Port not listening on $HostName (timeout ${TimeoutMs}ms)"
        }
        $tcpClient.EndConnect($iar)
        $tcpClient.Close()
        return Format-Result $true "Port $Port listening on $HostName"
    } catch {
        return Format-Result $false "Port $Port check failed: $($_.Exception.Message)"
    }
}

# ─── git 状态 ────────────────────────────────────────────────────────────

function Get-GitStatusShort {
    <#
    .SYNOPSIS 获取 git 状态简短摘要（--short 格式）
    #>
    try {
        $repoRoot = Get-RepoRoot
        $output = git -C $repoRoot status --short 2>&1
        if ($LASTEXITCODE -ne 0) {
            return Format-Result $false "git status failed: $output"
        }
        $lines = $output -split "`n" | Where-Object { $_.Trim() -ne '' }
        return Format-Result $true "git status: $($lines.Count) entries" ($lines)
    } catch {
        return Format-Result $false "git status threw: $($_.Exception.Message)"
    }
}

function Get-GitCurrentBranch {
    try {
        $repoRoot = Get-RepoRoot
        $branch = git -C $repoRoot branch --show-current 2>&1
        if ($LASTEXITCODE -ne 0) {
            return Format-Result $false "git branch failed: $branch"
        }
        return Format-Result $true "current branch" ($branch.Trim())
    } catch {
        return Format-Result $false "git branch threw: $($_.Exception.Message)"
    }
}

# ─── UTF-8 文件读写 ──────────────────────────────────────────────────────

function Write-Utf8File {
    <#
    .SYNOPSIS 以 UTF-8（无 BOM）写文件
    .PARAMETER Path 文件路径（绝对或相对 repo root）
    .PARAMETER Content 文件内容
    #>
    param(
        [Parameter(Mandatory)][string]$Path,
        [Parameter(Mandatory)][string]$Content
    )

    try {
        if (-not [System.IO.Path]::IsPathRooted($Path)) {
            $Path = Join-Path (Get-RepoRoot) $Path
        }
        $dir = Split-Path -Parent $Path
        if (-not (Test-Path $dir)) {
            New-Item -ItemType Directory -Path $dir -Force | Out-Null
        }
        # UTF-8 without BOM (PowerShell 5/7 兼容)
        $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
        [System.IO.File]::WriteAllText($Path, $Content, $utf8NoBom)
        return Format-Result $true "wrote $((Get-Item $Path).Length) bytes to $Path"
    } catch {
        return Format-Result $false "write failed: $($_.Exception.Message)"
    }
}

function Read-Utf8File {
    <#
    .SYNOPSIS 以 UTF-8 读文件
    .PARAMETER Path 文件路径
    #>
    param([Parameter(Mandatory)][string]$Path)

    try {
        if (-not [System.IO.Path]::IsPathRooted($Path)) {
            $Path = Join-Path (Get-RepoRoot) $Path
        }
        if (-not (Test-Path $Path)) {
            return Format-Result $false "file not found: $Path"
        }
        $content = [System.IO.File]::ReadAllText($Path, [System.Text.Encoding]::UTF8)
        return Format-Result $true "read $((Get-Item $Path).Length) bytes from $Path" $content
    } catch {
        return Format-Result $false "read failed: $($_.Exception.Message)"
    }
}

# ─── SQLite 查询（直接调 better-sqlite3 node 模块）───────────────────────

function Invoke-SqliteQuery {
    <#
    .SYNOPSIS 通过 node + better-sqlite3 执行 SQL 查询（无需启动 Electron）
    .PARAMETER DbPath SQLite 数据库路径
    .PARAMETER Sql SQL 语句
    .DESCRIPTION
        依赖：app/node_modules/better-sqlite3 已安装。
        用法：会临时写一段 .mjs 脚本到 tmp，node 执行后清理。
        只读查询（SELECT）；写入请用主进程 IPC 通道。
    #>
    param(
        [Parameter(Mandatory)][string]$DbPath,
        [Parameter(Mandatory)][string]$Sql
    )

    try {
        if (-not [System.IO.Path]::IsPathRooted($DbPath)) {
            $DbPath = Join-Path (Get-RepoRoot) $DbPath
        }
        if (-not (Test-Path $DbPath)) {
            return Format-Result $false "db not found: $DbPath"
        }

        $appRoot = Join-Path (Get-RepoRoot) 'app'
        if (-not (Test-Path (Join-Path $appRoot 'node_modules/better-sqlite3'))) {
            return Format-Result $false "better-sqlite3 not installed in app/node_modules — run 'npm install' in app/ first"
        }

        $tmp = [System.IO.Path]::GetTempFileName()
        $tmpMjs = "$tmp.mjs"
        Move-Item $tmp $tmpMjs -Force

        $script = @"
import Database from 'better-sqlite3';
const db = new Database(process.env.DB_PATH, { readonly: true });
try {
  const rows = db.prepare(process.env.SQL).all();
  console.log(JSON.stringify({ ok: true, rows }));
} catch (e) {
  console.log(JSON.stringify({ ok: false, error: e.message }));
} finally {
  db.close();
}
"@
        Set-Content -Path $tmpMjs -Value $script -Encoding UTF8

        try {
            $env:DB_PATH = $DbPath
            $env:SQL = $Sql
            Push-Location $appRoot
            try {
                $output = node $tmpMjs 2>&1
            } finally {
                Pop-Location
            }
            $parsed = $output | ConvertFrom-Json -ErrorAction Stop
            return Format-Result $parsed.ok $parsed.error $parsed.rows
        } finally {
            Remove-Item $tmpMjs -ErrorAction SilentlyContinue
            Remove-Item env:DB_PATH -ErrorAction SilentlyContinue
            Remove-Item env:SQL -ErrorAction SilentlyContinue
        }
    } catch {
        return Format-Result $false "sqlite query threw: $($_.Exception.Message)"
    }
}