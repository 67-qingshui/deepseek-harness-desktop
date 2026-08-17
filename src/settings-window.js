import { BrowserWindow, ipcMain, dialog, app } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import { getStore, BACKGROUND_PRESETS, TEXT_COLOR_PRESETS } from './store.js'

/**
 * # 设置窗口
 *
 * 独立的设置窗口（不注入到 Harness 页面，避免版本耦合）。
 * 提供自定义背景图片与字体颜色的配置入口，变更实时通过 IPC 应用到主窗口。
 *
 * 设计要点：
 *  - 独立窗口，尺寸适中（760×640），居中显示
 *  - 设置变更即时保存 + 通知主进程重新 apply skin
 *  - 上传的背景图复制到 userData/backgrounds/ 自包含管理
 */

const SETTINGS_PAGE = fileURLToPath(new URL('../settings/settings.html', import.meta.url))
const SETTINGS_PRELOAD = path.join(app.getAppPath(), 'settings-preload.cjs')

let settingsWin = null

/**
 * 创建并打开设置窗口（单例：已存在则聚焦）。
 * @param {Object} opts
 * @param {() => void} [opts.onChanged] - 设置变更后回调（主进程据此对主窗口 apply skin）
 */
export function openSettingsWindow({ onChanged } = {}) {
  if (settingsWin && !settingsWin.isDestroyed()) {
    settingsWin.show()
    settingsWin.focus()
    return
  }

  settingsWin = new BrowserWindow({
    width: 760,
    height: 640,
    minWidth: 560,
    minHeight: 480,
    title: '设置',
    show: false,
    backgroundColor: '#0b1120',
    titleBarStyle: process.platform === 'darwin' ? 'hidden' : undefined,
    titleBarOverlay:
      process.platform === 'darwin'
        ? { color: 'rgba(11,17,32,0.01)', symbolColor: '#9fb0c8' }
        : undefined,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      preload: SETTINGS_PRELOAD,
      spellcheck: false,
    },
  })

  settingsWin.once('ready-to-show', () => settingsWin.show())
  settingsWin.on('closed', () => {
    settingsWin = null
  })

  // 注册 IPC（仅注册一次）
  registerSettingsIpc({ onChanged })

  settingsWin.loadFile(SETTINGS_PAGE)
}

/**
 * 注册设置窗口的 IPC 处理。
 * @param {Object} opts
 * @param {() => void} [opts.onChanged]
 */
function registerSettingsIpc({ onChanged }) {
  // 获取当前全部设置 + 预设方案
  ipcMain.handle('settings:get-all', () => {
    const store = getStore()
    return {
      settings: store.getAll(),
      backgroundPresets: Object.entries(BACKGROUND_PRESETS).map(([id, v]) => ({
        id,
        name: v.name,
        css: v.css,
        textColor: v.textColor,
      })),
      textColorPresets: TEXT_COLOR_PRESETS,
    }
  })

  // 保存全部设置（设置窗口批量提交）
  ipcMain.handle('settings:set-all', (_e, data) => {
    const store = getStore()
    store.setAll(data)
    onChanged?.()
    return true
  })

  // 单项设置变更（实时预览）
  ipcMain.handle('settings:set', (_e, key, value) => {
    const store = getStore()
    store.set(key, value)
    onChanged?.()
    return true
  })

  // 选择本地背景图片：复制到 userData/backgrounds/
  ipcMain.handle('settings:pick-image', async () => {
    const result = await dialog.showOpenDialog(settingsWin, {
      title: '选择背景图片',
      filters: [{ name: '图片', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'] }],
      properties: ['openFile'],
    })
    if (result.canceled || result.filePaths.length === 0) return null

    const src = result.filePaths[0]
    const destDir = path.join(app.getPath('userData'), 'backgrounds')
    fs.mkdirSync(destDir, { recursive: true })
    const ext = path.extname(src) || '.png'
    const dest = path.join(destDir, `bg-${Date.now()}${ext}`)
    fs.copyFileSync(src, dest)
    return dest
  })

  // 读取背景图片为 base64（供设置窗口预览本地图片）
  ipcMain.handle('settings:read-image', (_e, filePath) => {
    try {
      if (filePath && fs.existsSync(filePath)) {
        const buf = fs.readFileSync(filePath)
        const ext = path.extname(filePath).slice(1).toLowerCase()
        const mime = ext === 'jpg' ? 'jpeg' : ext || 'png'
        return `data:image/${mime};base64,${buf.toString('base64')}`
      }
    } catch {
      /* ignore */
    }
    return null
  })
}
