import fs from 'node:fs'
import path from 'node:path'
import { app, ipcMain } from 'electron'

/**
 * # Token 用量采集器
 *
 * 在 Harness 页面注入 hook 脚本（usage-inject.cjs），拦截 API 响应中的 usage 字段，
 * 按 DeepSeek 官方计费规则采集 prompt / completion / cacheHit / cacheMiss token 数。
 *
 * 采集流程：
 *  1. 主窗口 did-finish-load 时，通过 executeJavaScript 注入 hook 脚本
 *  2. hook 脚本重写 fetch / XMLHttpRequest，解析响应中的 usage
 *  3. hook 通过 window.postMessage 上报
 *  4. 主窗口 preload 监听 message，invoke IPC 'usage:report' 传给主进程
 *  5. 主进程写入 store.addUsageRecord，通知用量窗口刷新
 *
 * 官方 usage 字段（OpenAI 兼容 + DeepSeek 扩展）：
 *  - prompt_tokens              总输入（= cache_hit + cache_miss）
 *  - completion_tokens          输出
 *  - prompt_cache_hit_tokens    缓存命中输入（计费更低）
 *  - prompt_cache_miss_tokens   缓存未命中输入（正常计费）
 *  - total_tokens               prompt + completion
 */

// DeepSeek 官方计费单价（元/百万 tokens），用于估算费用
// 来源：https://api-docs.deepseek.com/zh-cn/quick_start/pricing
// 注意：价格可能变动，估算仅供参考，以官方账单为准。
export const PRICING = {
  'deepseek-v4-flash': {
    name: 'DeepSeek V4 Flash',
    inputCacheHit: 0.02,   // 元/百万tokens
    inputCacheMiss: 1,     // 元/百万tokens
    output: 2,             // 元/百万tokens
  },
  'deepseek-v4-pro': {
    name: 'DeepSeek V4 Pro',
    inputCacheHit: 0.025,
    inputCacheMiss: 3,
    output: 6,
  },
  // 兼容旧模型名（deepseek-chat / deepseek-reasoner 已弃用，按 flash 价估算）
  'deepseek-chat': { name: 'DeepSeek Chat', inputCacheHit: 0.028, inputCacheMiss: 0.28, output: 0.42 },
  'deepseek-reasoner': { name: 'DeepSeek Reasoner', inputCacheHit: 0.028, inputCacheMiss: 0.28, output: 0.42 },
}

/** 默认价格（未知模型用，取 flash 价） */
const DEFAULT_PRICING = PRICING['deepseek-v4-flash']

/**
 * 根据模型名获取计费单价。
 * @param {string} model
 */
export function getPricing(model) {
  if (!model) return DEFAULT_PRICING
  const key = Object.keys(PRICING).find((k) => model.includes(k) || model === k)
  return key ? PRICING[key] : DEFAULT_PRICING
}

/**
 * 估算单次调用的费用（元）。
 * @param {{prompt:number, completion:number, cacheHit:number, cacheMiss:number}} rec
 * @param {string} model
 */
export function estimateCost(rec, model) {
  const p = getPricing(model)
  const cost =
    (rec.cacheHit || 0) / 1_000_000 * p.inputCacheHit +
    (rec.cacheMiss || 0) / 1_000_000 * p.inputCacheMiss +
    (rec.completion || 0) / 1_000_000 * p.output
  return cost
}

export class UsageTracker {
  /**
   * @param {import('./store.js').Store} store
   */
  constructor(store) {
    this.store = store
    this.injectScript = null
    this.loadInjectScript()
    this.registerIpc()
  }

  /** 加载注入脚本内容 */
  loadInjectScript() {
    try {
      const injectPath = path.join(app.getAppPath(), 'usage-inject.cjs')
      this.injectScript = fs.readFileSync(injectPath, 'utf-8')
    } catch (err) {
      console.warn('[usage] 注入脚本加载失败:', err.message)
    }
  }

  /**
   * 向主窗口注入采集 hook。
   * @param {import('electron').BrowserWindow} win
   */
  inject(win) {
    if (!win || win.isDestroyed() || !this.injectScript) return
    try {
      win.webContents.executeJavaScript(this.injectScript).catch(() => {})
    } catch {
      /* 页面可能未就绪 */
    }
  }

  /** 注册 IPC：接收渲染进程上报的 usage 记录 */
  registerIpc() {
    ipcMain.on('usage:report', (_e, rec) => {
      if (rec && typeof rec.prompt === 'number') {
        this.store.addUsageRecord(rec)
      }
    })

    ipcMain.handle('usage:get-summary', () => {
      const summary = this.store.getUsageSummary()
      const records = this.store.get('usage.records') || []
      // 估算总费用
      let totalCost = 0
      for (const r of records) totalCost += estimateCost(r, r.model)
      return { summary, records: records.slice(-200), totalCost }
    })

    ipcMain.handle('usage:clear', () => {
      this.store.clearUsage()
      return true
    })
  }
}
