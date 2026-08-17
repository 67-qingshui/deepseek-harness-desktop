import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import {
  app,
  BrowserWindow,
  dialog,
  Menu,
  nativeImage,
  shell,
  Tray,
} from 'electron'
import { startDshService } from './dsh-service.js'

const APP_NAME = 'DeepSeek Harness'
const STARTUP_PAGE = fileURLToPath(new URL('./startup.html', import.meta.url))
const TRAY_ICON = fileURLToPath(new URL('../assets/tray.png', import.meta.url))
const TRAY_TEMPLATE_ICON = fileURLToPath(new URL('../assets/trayTemplate.png', import.meta.url))

let mainWindow
let service
let serviceUrl
let tray
let trayAvailable = false
let isQuitting = false

// 冒烟模式：仅验证 GUI 壳能启动并渲染加载页，不拉起 dsh（CI / 自动化用）
const SMOKE = !!process.env.DHD_SMOKE

app.setName(APP_NAME)

// 解析内嵌的 dsh 入口（已作为依赖打进 app 的 node_modules / asar）。
// 运行时用应用自带的 Electron 二进制（process.execPath）加 --expose-internals 直接跑 dsh 的
// bin，无需系统安装 Node / npm，也不在首次启动时联网下载。
const requireResolve = createRequire(import.meta.url)
function resolveDshBin() {
  try {
    return requireResolve.resolve('@deepseek-ai/dsh/lib/bin.js')
  } catch {
    return null
  }
}

/** 构造拉起 DeepSeek Harness 的 command + args；找不到内嵌 dsh 时退回系统 npx（需 Node）。 */
function buildDshLaunch() {
  const bin = resolveDshBin()
  if (bin) {
    // 用应用自带的 Electron 二进制直接跑内嵌的 dsh bin（node 运行时由 Electron 提供，
    // 无需系统安装 Node/npm）。用 `web` 子命令形式（--profile web 的别名），避免根命令的
    // 变参 [args...] 把 --host/--port 一并吞掉。
    return {
      command: process.execPath,
      args: [bin, 'web', '--host', '127.0.0.1', '--port', '0'],
    }
  }
  return {
    command: 'npx',
    args: ['@deepseek-ai/dsh', 'web', '--host', '127.0.0.1', '--port', '0'],
  }
}

/** 显示主窗口：缺失则创建并直接载入服务地址；最小化则恢复；最后置顶 */
async function showMainWindow() {
  if (!mainWindow) {
    await createWindow()
    if (serviceUrl) await mainWindow?.loadURL(serviceUrl)
  }
  if (mainWindow?.isMinimized()) mainWindow.restore()
  mainWindow?.show()
  mainWindow?.focus()
}

function createWindow() {
  if (process.platform === 'win32') Menu.setApplicationMenu(null)

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 860,
    minHeight: 600,
    show: false,
    backgroundColor: '#0b1120',
    // macOS：隐藏原生标题栏，用叠加控件呈现干净的工具条
    titleBarStyle: process.platform === 'darwin' ? 'hidden' : undefined,
    titleBarOverlay: process.platform === 'darwin'
      ? { color: 'rgba(11,17,32,0.01)', symbolColor: '#9fb0c8' }
      : undefined,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  })

  if (process.platform === 'win32') {
    mainWindow.setMenu(null)
    mainWindow.setMenuBarVisibility(false)
  }

  // 新窗口 / 跨域跳转一律交给系统浏览器，保持壳内只渲染 Harness
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const currentUrl = mainWindow?.webContents.getURL()
    if (currentUrl && new URL(url).origin !== new URL(currentUrl).origin) {
      event.preventDefault()
      void shell.openExternal(url)
    }
  })

  mainWindow.once('ready-to-show', () => mainWindow?.show())
  mainWindow.on('close', (event) => {
    // 有托盘且非退出时：关闭=最小化到托盘
    if (trayAvailable && !isQuitting) {
      event.preventDefault()
      mainWindow?.hide()
    }
  })
  mainWindow.on('closed', () => {
    mainWindow = undefined
  })

  return mainWindow.loadFile(STARTUP_PAGE)
}

function createTray() {
  const trayIcon = nativeImage.createFromPath(
    process.platform === 'darwin' ? TRAY_TEMPLATE_ICON : TRAY_ICON,
  )
  if (process.platform === 'darwin') trayIcon.setTemplateImage(true)
  tray = new Tray(trayIcon)
  tray.setToolTip(APP_NAME)
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: '显示窗口', click: () => void showMainWindow() },
      { label: '隐藏窗口', click: () => mainWindow?.hide() },
      { type: 'separator' },
      {
        label: '退出',
        click: () => {
          isQuitting = true
          app.quit()
        },
      },
    ]),
  )
  tray.on('click', () => void showMainWindow())
  trayAvailable = true
}

async function launch() {
  const startupReady = createWindow()
  try {
    createTray()
  } catch (error) {
    console.warn(`系统托盘不可用: ${error instanceof Error ? error.message : String(error)}`)
  }

  // 冒烟模式：跳过 dsh，确认窗口与加载页可正常渲染后立即退出
  if (SMOKE) {
    await startupReady
    console.log('[smoke] 窗口与加载页渲染正常，GUI 壳 OK')
    setTimeout(() => app.quit(), 4000)
    return
  }

  const launch = buildDshLaunch()
  service = startDshService({
    command: launch.command,
    args: launch.args,
    environment: { ...process.env, DSH_DESKTOP: '1' },
  })

  try {
    serviceUrl = await service.ready
    await startupReady
    await mainWindow?.loadURL(serviceUrl)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await dialog.showMessageBox({
      type: 'error',
      title: `${APP_NAME} 启动失败`,
      message: 'DeepSeek Harness 无法启动。',
      detail: message,
    })
    app.quit()
  }
}

const hasSingleInstanceLock = app.requestSingleInstanceLock()
if (!hasSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => void showMainWindow())
  app.whenReady().then(launch)
  app.on('activate', () => void showMainWindow())
  app.on('window-all-closed', () => {
    // macOS 有托盘：仅显式退出才关；其它平台无窗口即退出
    if (isQuitting || process.platform !== 'darwin') app.quit()
  })
  app.on('before-quit', () => {
    isQuitting = true
    service?.stop()
  })
}
