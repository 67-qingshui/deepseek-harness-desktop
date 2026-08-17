import { fileURLToPath } from 'node:url'
import { app, dialog } from 'electron'
import {
  createMainWindow,
  showMainWindow,
  loadServiceUrl,
  hideMainWindow,
  setCloseToTray,
  setIsQuitting,
} from './window.js'
import { createTray } from './tray.js'
import { buildDshLaunch, startDshService } from './dsh-service.js'

/**
 * # DeepSeek Harness Desktop — 主进程入口
 *
 * 极简桌面壳：把 DeepSeek Harness 的 Web UI 装进原生窗口，自动启停本地服务。
 *
 * 职责：
 *  - 单实例锁：重复打开只唤出已有窗口
 *  - 生命周期：whenReady → 创建窗口+托盘 → 拉起 dsh → 载入服务地址
 *  - 退出回收：before-quit 时停止 dsh 子进程树
 *
 * 模块划分：
 *  - window.js       主窗口创建/选项/显示/外部链接拦截/关闭到托盘
 *  - tray.js         系统托盘创建与菜单
 *  - dsh-service.js  dsh 子进程管理 + 启动配置
 *  - main.js         本文件：入口、单实例、生命周期、组装
 */

const APP_NAME = 'DeepSeek Harness'
const STARTUP_PAGE = fileURLToPath(new URL('./startup.html', import.meta.url))
const TRAY_ICON = fileURLToPath(new URL('../assets/tray.png', import.meta.url))
const TRAY_TEMPLATE_ICON = fileURLToPath(new URL('../assets/trayTemplate.png', import.meta.url))

// 冒烟模式：仅验证 GUI 壳能启动并渲染加载页，不拉起 dsh（CI / 自动化用）
const SMOKE = !!process.env.DHD_SMOKE

app.setName(APP_NAME)

let service
let hasTray = false

/**
 * 应用启动主流程：创建窗口+托盘 → 拉起 dsh → 载入服务地址。
 */
async function launch() {
  // 先创建窗口并显示加载页（dsh 在后台拉起）
  const startupReady = createMainWindow({ startupPage: STARTUP_PAGE })

  // 创建系统托盘（失败不阻断启动）
  try {
    createTray({
      appName: APP_NAME,
      trayIcon: TRAY_ICON,
      trayTemplate: TRAY_TEMPLATE_ICON,
      onShow: () => void showMainWindow({ startupPage: STARTUP_PAGE, serviceUrl: service?.url }),
      onHide: () => hideMainWindow(),
      onQuit: () => {
        setIsQuitting(true)
        app.quit()
      },
    })
    setCloseToTray(true)
    hasTray = true
  } catch (error) {
    console.warn(`系统托盘不可用: ${error instanceof Error ? error.message : String(error)}`)
  }

  // 冒烟模式：跳过 dsh，确认窗口与加载页可正常渲染后退出
  if (SMOKE) {
    await startupReady
    console.log('[smoke] 窗口与加载页渲染正常，GUI 壳 OK')
    setTimeout(() => app.quit(), 4000)
    return
  }

  // 拉起内嵌 dsh（用应用自带 Electron，无需系统 Node）
  const launchCfg = buildDshLaunch()
  service = startDshService({
    command: launchCfg.command,
    args: launchCfg.args,
    environment: { ...process.env, DSH_DESKTOP: '1' },
  })

  try {
    const url = await service.ready
    service.url = url
    await startupReady
    await loadServiceUrl(url)
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

// 单实例锁：重复打开只唤出已有窗口
const hasSingleInstanceLock = app.requestSingleInstanceLock()
if (!hasSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () =>
    void showMainWindow({ startupPage: STARTUP_PAGE, serviceUrl: service?.url }),
  )
  app.whenReady().then(launch)
  app.on('activate', () =>
    void showMainWindow({ startupPage: STARTUP_PAGE, serviceUrl: service?.url }),
  )
  app.on('window-all-closed', () => {
    // macOS 有托盘：保留在后台（靠托盘唤出）；无托盘或非 macOS 则退出
    if (process.platform === 'darwin' && hasTray) return
    app.quit()
  })
  app.on('before-quit', () => {
    setIsQuitting(true)
    service?.stop()
  })
}
