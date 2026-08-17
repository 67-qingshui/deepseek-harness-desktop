import { BrowserWindow, ipcMain, app } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

/**
 * # 用量统计窗口
 *
 * 独立窗口展示 token 用量累计汇总与可视化图表。
 * - 累计汇总：总输入/输出/缓存命中/调用次数/估算费用
 * - 可视化：折线图（近 N 次调用的 token 数趋势）+ 柱状图（输入 vs 输出占比）
 *
 * 数据来源：usage-tracker 采集的 records（store 持久化）。
 */

const USAGE_PAGE = fileURLToPath(new URL('../usage/usage.html', import.meta.url))
const USAGE_PRELOAD = path.join(app.getAppPath(), 'usage-preload.cjs')

let usageWin = null

/**
 * 创建并打开用量统计窗口（单例）。
 */
export function openUsageWindow() {
  if (usageWin && !usageWin.isDestroyed()) {
    usageWin.show()
    usageWin.focus()
    return
  }

  usageWin = new BrowserWindow({
    width: 900,
    height: 640,
    minWidth: 640,
    minHeight: 480,
    title: '用量统计',
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
      preload: USAGE_PRELOAD,
      spellcheck: false,
    },
  })

  usageWin.once('ready-to-show', () => usageWin.show())
  usageWin.on('closed', () => {
    usageWin = null
  })

  usageWin.loadFile(USAGE_PAGE)
}
