const { ipcRenderer } = require('electron')

/**
 * 主窗口 preload 桥接（仅用于 token 用量上报）。
 *
 * 注入脚本（usage-inject.cjs）在主世界运行，通过 window.postMessage 上报 usage；
 * 本 preload 在隔离世界监听 message，转发给主进程 IPC。
 *
 * contextIsolation 下，主世界与隔离世界共享同一 DOM window，
 * postMessage 可跨世界传递。
 */
window.addEventListener('message', (event) => {
  const data = event.data
  if (data && data.type === '__dsh_usage__' && data.payload) {
    ipcRenderer.send('usage:report', data.payload)
  }
})
