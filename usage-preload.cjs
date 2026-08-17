const { contextBridge, ipcRenderer } = require('electron')

/**
 * 用量统计窗口的 preload 桥接。
 */
contextBridge.exposeInMainWorld('usageApi', {
  /** 获取累计汇总 + 近 200 条记录 + 估算费用 */
  getSummary: () => ipcRenderer.invoke('usage:get-summary'),
  /** 清空用量记录 */
  clear: () => ipcRenderer.invoke('usage:clear'),
})
