import { BrowserWindow, Menu, shell } from 'electron'

/**
 * # 主窗口管理
 *
 * 负责主窗口的创建、选项配置、显示/恢复、外部链接拦截与关闭到托盘行为。
 * 从 main.js 拆出，保持单一职责，便于维护与跨平台适配。
 *
 * 安全策略：
 *  - contextIsolation: true   渲染进程与 Node 隔离
 *  - nodeIntegration: false   渲染进程不暴露 Node API
 *  - sandbox: true            启用 Chromium 沙箱
 *  - 跨域跳转一律交给系统浏览器，壳内只渲染 Harness
 */

// 模块级状态：主窗口实例 + 行为开关
let mainWindow = null
let closeToTray = false   // 关闭窗口时是否最小化到托盘（有托盘时启用）
let isQuitting = false    // 是否正在退出应用（退出时不再拦截 close）

/**
 * 设置「关闭到托盘」开关。main.js 在托盘创建成功后调用。
 * @param {boolean} value
 */
export function setCloseToTray(value) {
  closeToTray = value
}

/**
 * 设置退出标志。main.js 在 before-quit 时调用，
 * 使窗口 close 不再被拦截为「最小化到托盘」。
 * @param {boolean} value
 */
export function setIsQuitting(value) {
  isQuitting = value
}

/**
 * 创建主窗口并加载启动页。
 *
 * 窗口选项：
 *  - 1280×820 默认尺寸，860×600 最小尺寸
 *  - macOS 隐藏原生标题栏（hidden），用叠加控件呈现干净工具条
 *  - Windows 隐藏菜单栏
 *  - show:false + ready-to-show，避免白屏闪烁
 *
 * @param {Object} opts
 * @param {string} opts.startupPage - 加载页 HTML 路径
 * @param {(win: BrowserWindow) => void} [opts.onPageReady] - 页面加载完成回调（did-finish-load）
 * @returns {Promise<void>} 加载页加载完成的 Promise
 */
export function createMainWindow({ startupPage, onPageReady }) {
  // Windows：移除应用菜单栏
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
    titleBarOverlay:
      process.platform === 'darwin'
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

  // 新窗口（window.open）/ 跨域跳转一律交给系统浏览器，壳内只渲染 Harness
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

  // 首次渲染就绪后再显示，避免白屏
  mainWindow.once('ready-to-show', () => mainWindow?.show())

  // 页面加载完成：触发回调（skin-manager 注入皮肤）
  mainWindow.webContents.on('did-finish-load', () => {
    if (mainWindow && !mainWindow.isDestroyed()) onPageReady?.(mainWindow)
  })

  // 关闭窗口：有托盘且非退出时，最小化到托盘而非真正关闭
  mainWindow.on('close', (event) => {
    if (closeToTray && !isQuitting) {
      event.preventDefault()
      mainWindow?.hide()
    }
  })
  mainWindow.on('closed', () => {
    mainWindow = null
  })

  return mainWindow.loadFile(startupPage)
}

/**
 * 显示主窗口：缺失则创建；最小化则恢复；最后置顶。
 *
 * @param {Object} opts
 * @param {string} [opts.startupPage] - 若需新建窗口，传入加载页路径
 * @param {string} [opts.serviceUrl]  - 若需新建窗口且服务已就绪，直接载入服务地址
 * @returns {Promise<void>}
 */
export async function showMainWindow({ startupPage, serviceUrl } = {}) {
  if (!mainWindow) {
    await createMainWindow({ startupPage })
    if (serviceUrl) await mainWindow?.loadURL(serviceUrl)
  }
  if (mainWindow?.isMinimized()) mainWindow.restore()
  mainWindow?.show()
  mainWindow?.focus()
}

/**
 * 在主窗口载入 DeepSeek Harness 服务地址。
 * @param {string} url - http://127.0.0.1:<port>
 * @returns {Promise<void>}
 */
export async function loadServiceUrl(url) {
  await mainWindow?.loadURL(url)
}

/**
 * 隐藏主窗口（托盘「隐藏窗口」用）。
 */
export function hideMainWindow() {
  mainWindow?.hide()
}

/**
 * 获取主窗口实例（可能为 null）。
 * @returns {BrowserWindow | null}
 */
export function getMainWindow() {
  return mainWindow
}
