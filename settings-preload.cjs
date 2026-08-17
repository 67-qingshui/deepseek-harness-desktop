const { contextBridge, ipcRenderer } = require('electron')

/**
 * 设置窗口的 preload 桥接。
 * 暴露安全的 IPC 调用给设置界面，不直接暴露 ipcRenderer。
 */
contextBridge.exposeInMainWorld('settingsApi', {
  /** 获取全部设置 + 预设方案 */
  getAll: () => ipcRenderer.invoke('settings:get-all'),
  /** 批量保存设置 */
  setAll: (data) => ipcRenderer.invoke('settings:set-all', data),
  /** 单项设置变更（实时预览） */
  set: (key, value) => ipcRenderer.invoke('settings:set', key, value),
  /** 选择本地背景图片（复制到 userData），返回路径 */
  pickImage: () => ipcRenderer.invoke('settings:pick-image'),
  /** 读取图片为 base64 data URI（预览用） */
  readImage: (filePath) => ipcRenderer.invoke('settings:read-image', filePath),
})
