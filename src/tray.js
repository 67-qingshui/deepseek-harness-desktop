import { Menu, nativeImage, Tray } from 'electron'

/**
 * # 系统托盘
 *
 * 创建托盘图标与右键菜单，提供「显示/隐藏/退出」入口。
 * macOS 使用 template 图标（自动适配深浅色）；其他平台使用普通 PNG。
 *
 * 从 main.js 拆出，保持单一职责。
 */

/**
 * 创建系统托盘。
 *
 * @param {Object} opts
 * @param {string} opts.appName       - 托盘 tooltip
 * @param {string} opts.trayIcon      - 普通 PNG 图标路径（Windows/Linux）
 * @param {string} opts.trayTemplate  - template PNG 图标路径（macOS）
 * @param {() => void} opts.onShow    - 点击托盘/「显示窗口」
 * @param {() => void} opts.onHide    - 「隐藏窗口」
 * @param {() => void} opts.onQuit    - 「退出」
 * @returns {Tray} 托盘实例
 */
export function createTray({ appName, trayIcon, trayTemplate, onShow, onHide, onQuit }) {
  // macOS 用 template 图标（自动适配深浅色菜单栏），其他平台用普通 PNG
  const icon = nativeImage.createFromPath(
    process.platform === 'darwin' ? trayTemplate : trayIcon,
  )
  if (process.platform === 'darwin') icon.setTemplateImage(true)

  const tray = new Tray(icon)
  tray.setToolTip(appName)
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: '显示窗口', click: () => onShow?.() },
      { label: '隐藏窗口', click: () => onHide?.() },
      { type: 'separator' },
      { label: '退出', click: () => onQuit?.() },
    ]),
  )
  // 单击托盘图标 = 显示窗口（macOS 常见交互）
  tray.on('click', () => onShow?.())

  return tray
}
