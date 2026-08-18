import { app, dialog, shell } from 'electron'
import https from 'node:https'

/**
 * # 版本更新检查
 *
 * 应用启动时检查 GitHub 上是否有新版本，有则弹出提示。
 * 仅在应用内提示，不自动下载、不在应用内更新——更新动作跳转到 GitHub Release 页面。
 *
 * 提示选项：
 *  - 「更新」        打开 GitHub Release 页面
 *  - 「稍后更新」     本次忽略，下次启动再提示
 *  - 「不更新」       弹出确认框，确认后永久不再提示（后续自行前往 GitHub 下载）
 */

const REPO = '67-qingshui/deepseek-harness-desktop'
const GITHUB_RELEASES_URL = `https://github.com/${REPO}/releases`

/**
 * 语义化版本比较：a > b 返回 1，a < b 返回 -1，相等返回 0。
 */
function compareVersions(a, b) {
  const pa = String(a).replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0)
  const pb = String(b).replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0)
  for (let i = 0; i < 3; i++) {
    if (pa[i] > pb[i]) return 1
    if (pa[i] < pb[i]) return -1
  }
  return 0
}

/**
 * 从 GitHub 获取最新 Release 的版本号与页面地址。
 * @returns {Promise<{tag: string, url: string} | null>} 失败返回 null
 */
function fetchLatestRelease() {
  return new Promise((resolve) => {
    const req = https.get(
      {
        hostname: 'api.github.com',
        path: `/repos/${REPO}/releases/latest`,
        headers: {
          'User-Agent': 'DeepSeek-Harness-Desktop',
          Accept: 'application/vnd.github+json',
        },
      },
      (res) => {
        let data = ''
        res.on('data', (chunk) => {
          data += chunk
        })
        res.on('end', () => {
          try {
            const json = JSON.parse(data)
            if (json && json.tag_name) {
              resolve({ tag: json.tag_name, url: json.html_url })
            } else {
              resolve(null)
            }
          } catch {
            resolve(null)
          }
        })
      },
    )
    req.on('error', () => resolve(null))
    req.setTimeout(8000, () => {
      req.destroy()
      resolve(null)
    })
  })
}

/**
 * 检查更新，若有新版本则弹窗提示。
 * @param {Object} opts
 * @param {() => boolean} opts.shouldSkip - 返回 true 则跳过本次检查（用户已选「不更新」）
 * @param {(v: string) => void} opts.onSkipForever - 用户确认「不更新」后回调（持久化标记）
 */
export async function checkForUpdates({ shouldSkip, onSkipForever } = {}) {
  if (shouldSkip?.()) return

  const current = app.getVersion()
  const latest = await fetchLatestRelease()
  if (!latest) return

  // 仅当 GitHub 版本严格高于当前版本时才提示
  if (compareVersions(latest.tag, current) <= 0) return

  const { response } = await dialog.showMessageBox({
    type: 'info',
    title: '发现新版本',
    message: `DeepSeek Harness Desktop 有新版本 ${latest.tag}`,
    detail: `当前版本：${current}\n最新版本：${latest.tag}\n\n可在 GitHub Release 页面查看更新内容并下载。`,
    buttons: ['更新', '稍后更新', '不更新'],
    defaultId: 0,
    cancelId: 1,
  })

  if (response === 0) {
    // 更新：跳转到 GitHub Release 页面
    shell.openExternal(latest.url || GITHUB_RELEASES_URL)
  } else if (response === 2) {
    // 不更新：弹出确认框，确认后永久不再提示
    const confirm = await dialog.showMessageBox({
      type: 'warning',
      title: '确认不更新',
      message: '确认不再提示更新？',
      detail: '确认后本应用将不再提示更新，后续如有新版本，请自行前往 GitHub 下载。',
      buttons: ['确认不更新', '取消'],
      defaultId: 1,
      cancelId: 1,
    })
    if (confirm.response === 0) {
      onSkipForever?.(latest.tag)
    }
  }
  // 稍后更新：什么都不做，下次启动再提示
}
