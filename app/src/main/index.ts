import { app, BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { registerCodexIpc } from './ipc/codex'
import { registerDbIpc } from './ipc/db'
import { registerProjectsIpc } from './ipc/projects'
import { initDatabase, closeDatabase } from './db'

// 仅放行本地 dev server（http/https + localhost）。返回解析后的 URL，非法则 null。
function parseLocalDevUrl(raw: string | undefined): URL | null {
  if (!raw) return null
  try {
    const u = new URL(raw)
    const okProtocol = u.protocol === 'http:' || u.protocol === 'https:'
    const okHost = u.hostname === 'localhost' || u.hostname === '127.0.0.1' || u.hostname === '::1'
    return okProtocol && okHost ? u : null
  } catch {
    return null
  }
}

function createWindow(): void {
  const allowedDev = parseLocalDevUrl(process.env.ELECTRON_RENDERER_URL)

  const win = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1100,
    minHeight: 700,
    show: false,
    backgroundColor: '#18181B',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  win.on('ready-to-show', () => win.show())

  // 安全：仅放行与本地 dev server 精确同源的导航（dev HMR 全量重载），其余一律拦截
  win.webContents.on('will-navigate', (event, url) => {
    let sameOrigin = false
    try {
      sameOrigin = allowedDev !== null && new URL(url).origin === allowedDev.origin
    } catch {
      sameOrigin = false
    }
    if (!sameOrigin) event.preventDefault()
  })

  // 安全：拒绝应用内新窗口；仅 https 外链交系统浏览器
  win.webContents.setWindowOpenHandler(({ url }) => {
    try {
      if (new URL(url).protocol === 'https:') shell.openExternal(url)
    } catch {
      // 忽略非法 URL
    }
    return { action: 'deny' }
  })

  if (!app.isPackaged && allowedDev) {
    win.loadURL(allowedDev.href)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  initDatabase()
  registerCodexIpc()
  registerDbIpc()
  registerProjectsIpc()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', () => closeDatabase())

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
