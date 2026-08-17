import fs from 'node:fs'
import path from 'node:path'
import { BACKGROUND_PRESETS } from './store.js'

/**
 * # 皮肤管理器
 *
 * 向主窗口（DeepSeek Harness Web UI）注入自定义背景图片与字体颜色 CSS。
 * 通过 Electron 的 webContents.insertCSS 实现，不修改 Harness 本身代码，
 * 与现有界面无缝集成。
 *
 * 设计要点：
 *  - 背景用 body::before 叠加（position:fixed; inset:0; z-index:-1），
 *    background-size:cover 自动适配任意分辨率
 *  - 用户上传图片转 file:// URL；预设渐变直接用 CSS linear-gradient
 *  - 字体颜色覆盖 body 及常见文本元素，保留可读性
 *  - 每次 apply 先移除旧注入再插入新的，避免叠加
 */

const INJECT_KEY = '__dsh_skin_css__'

export class SkinManager {
  /**
   * @param {import('./store.js').Store} store
   */
  constructor(store) {
    this.store = store
  }

  /**
   * 根据当前设置生成注入的 CSS 文本。
   * @returns {string} CSS 文本（空字符串表示无需注入）
   */
  buildCss() {
    const bg = this.store.get('background')
    const tc = this.store.get('textColor')
    const rules = []

    // —— 背景层 ——
    if (bg && bg.type !== 'none') {
      let bgValue = ''
      if (bg.type === 'preset' && BACKGROUND_PRESETS[bg.preset]) {
        bgValue = BACKGROUND_PRESETS[bg.preset].css
      } else if (bg.type === 'image' && bg.image) {
        // 本地图片转 file:// URL（兼容空格/中文路径）
        let imgPath = bg.image
        try {
          if (fs.existsSync(imgPath)) {
            imgPath = 'file://' + encodeURI(imgPath.replace(/\\/g, '/'))
            bgValue = `url("${imgPath}")`
          }
        } catch {
          /* 图片不存在则跳过 */
        }
      }

      if (bgValue) {
        const opacity = Math.max(0, Math.min(1, Number(bg.opacity) || 0.85))
        const blur = Math.max(0, Math.min(40, Number(bg.blur) || 0))
        const blurRule = blur > 0 ? `filter: blur(${blur}px);` : ''
        rules.push(`
          body::before {
            content: "";
            position: fixed;
            inset: 0;
            z-index: -1;
            background: ${bgValue};
            background-size: cover;
            background-position: center;
            background-repeat: no-repeat;
            opacity: ${opacity};
            ${blurRule}
            pointer-events: none;
          }
        `)
      }
    }

    // —— 字体颜色层 ——
    if (tc && tc.enabled && tc.color) {
      const color = String(tc.color)
      rules.push(`
        body, body *:not(svg):not(path):not(.icon) {
          color: ${color} !important;
        }
        /* 输入框/按钮背景保持可读，仅调文字色 */
        input, textarea, select, button {
          color: ${color} !important;
        }
      `)
    }

    return rules.join('\n')
  }

  /**
   * 向指定窗口应用当前皮肤（注入 CSS）。
   * 先移除上次注入的 CSS，再插入新的。
   * @param {import('electron').BrowserWindow} win
   */
  async apply(win) {
    if (!win || win.isDestroyed()) return
    const css = this.buildCss()
    try {
      // 移除旧注入
      const old = win[INJECT_KEY]
      if (old) {
        await win.webContents.removeInsertedCSS(old).catch(() => {})
      }
      if (css) {
        const key = await win.webContents.insertCSS(css)
        win[INJECT_KEY] = key
      } else {
        win[INJECT_KEY] = null
      }
    } catch (err) {
      // 页面可能尚未加载完成，忽略
    }
  }

  /**
   * 移除窗口上的皮肤注入。
   * @param {import('electron').BrowserWindow} win
   */
  async clear(win) {
    if (!win || win.isDestroyed()) return
    const old = win[INJECT_KEY]
    if (old) {
      try {
        await win.webContents.removeInsertedCSS(old)
      } catch {
        /* ignore */
      }
      win[INJECT_KEY] = null
    }
  }
}
