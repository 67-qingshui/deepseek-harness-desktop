import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'

/**
 * # 用户设置持久化
 *
 * 将自定义背景、字体颜色等设置保存到 userData/settings.json。
 * 从 main.js 拆出，单一职责，供 skin-manager 与设置窗口共享。
 */

// 默认设置
const DEFAULTS = {
  // 背景图：type = 'none' | 'preset' | 'image'
  background: {
    type: 'none',        // none / preset / image
    preset: 'deep-sea',  // 预设渐变方案名（type=preset 时生效）
    image: '',           // 用户上传图片的绝对路径（type=image 时生效）
    opacity: 0.85,       // 背景不透明度 0~1（控制整体可见度）
    blur: 0,             // 背景模糊半径 px（0=不模糊）
  },
  // 字体颜色
  textColor: {
    enabled: false,       // 是否启用自定义字体颜色
    color: '#e8eef7',     // 主字体颜色
  },
  // 预设配色方案（背景渐变 + 字体颜色的协调组合），供快速切换
  presetScheme: '',
  // Token 用量记录（v2.0.0 新增）
  usage: {
    records: [],   // 每次调用的记录：{ ts, model, prompt, completion, cacheHit, cacheMiss, total }
    // 累计汇总由 records 计算，不单独持久化（避免不一致）
  },
}

// 预设背景渐变方案（纯 CSS 渐变，零二进制依赖）
export const BACKGROUND_PRESETS = {
  'deep-sea': {
    name: '深海',
    css: 'linear-gradient(135deg, #0b1e3f 0%, #123a5e 50%, #0a2540 100%)',
    textColor: '#cfe1f5',
  },
  'aurora': {
    name: '极光',
    css: 'linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)',
    textColor: '#d4f1e0',
  },
  'sunset': {
    name: '日落',
    css: 'linear-gradient(135deg, #2d1b4e 0%, #c33764 50%, #f76b1c 100%)',
    textColor: '#fff3e0',
  },
  'forest': {
    name: '森林',
    css: 'linear-gradient(135deg, #134e5e 0%, #2c5364 40%, #1a3a2e 100%)',
    textColor: '#d6ead4',
  },
  'mono-dark': {
    name: '墨黑',
    css: 'linear-gradient(135deg, #0d0d0d 0%, #1a1a1a 50%, #0d0d0d 100%)',
    textColor: '#e0e0e0',
  },
  'royal': {
    name: '雅紫',
    css: 'linear-gradient(135deg, #1a0a2e 0%, #4a1a4e 50%, #6a1a5e 100%)',
    textColor: '#ead4f0',
  },
}

// 预设字体颜色方案
export const TEXT_COLOR_PRESETS = [
  { name: '浅霜白', color: '#e8eef7' },
  { name: '暖白', color: '#fff3e0' },
  { name: '青绿', color: '#a7f0d4' },
  { name: '天蓝', color: '#a8d4ff' },
  { name: '淡紫', color: '#d4baff' },
  { name: '琥珀', color: '#ffd47a' },
  { name: '玫红', color: '#ff9eb5' },
]

let storeInstance = null

/**
 * 设置存储单例。
 * 在 app.whenReady 之后使用（依赖 app.getPath('userData')）。
 */
export class Store {
  constructor() {
    this.filePath = path.join(app.getPath('userData'), 'settings.json')
    this.data = { ...DEFAULTS }
    this.listeners = new Set()
    this.load()
  }

  /** 读取磁盘设置，合并到默认值 */
  load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8')
        const parsed = JSON.parse(raw)
        // 深度合并（一层）
        this.data = {
          background: { ...DEFAULTS.background, ...(parsed.background || {}) },
          textColor: { ...DEFAULTS.textColor, ...(parsed.textColor || {}) },
          presetScheme: parsed.presetScheme ?? DEFAULTS.presetScheme,
          usage: { records: Array.isArray(parsed.usage?.records) ? parsed.usage.records.slice(-5000) : [] },
        }
      }
    } catch (err) {
      console.warn('设置读取失败，使用默认值:', err.message)
    }
  }

  /** 保存到磁盘 */
  save() {
    try {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true })
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8')
    } catch (err) {
      console.warn('设置保存失败:', err.message)
    }
  }

  /**
   * 获取设置值（支持点路径，如 get('background.opacity')）
   * @param {string} key
   * @returns {any}
   */
  get(key) {
    if (!key) return this.data
    return key.split('.').reduce((obj, k) => (obj == null ? undefined : obj[k]), this.data)
  }

  /**
   * 设置值（支持点路径），保存并通知监听器。
   * @param {string} key
   * @param {any} value
   */
  set(key, value) {
    const parts = key.split('.')
    const last = parts.pop()
    const target = parts.reduce((obj, k) => {
      if (obj[k] == null) obj[k] = {}
      return obj[k]
    }, this.data)
    target[last] = value
    this.save()
    this.notify(key, value)
  }

  /** 直接设置整个 data 对象（设置窗口批量更新用） */
  setAll(data) {
    this.data = {
      background: { ...DEFAULTS.background, ...(data.background || {}) },
      textColor: { ...DEFAULTS.textColor, ...(data.textColor || {}) },
      presetScheme: data.presetScheme ?? '',
      usage: { records: Array.isArray(data.usage?.records) ? data.usage.records.slice(-5000) : this.data.usage?.records || [] },
    }
    this.save()
    this.notify('*', this.data)
  }

  /**
   * 添加一条 token 用量记录（v2.0.0）。
   * 参考 DeepSeek 官方 usage 字段：prompt_tokens / completion_tokens /
   * prompt_cache_hit_tokens / prompt_cache_miss_tokens。
   * @param {Object} rec - { ts, model, prompt, completion, cacheHit, cacheMiss, total }
   */
  addUsageRecord(rec) {
    if (!this.data.usage) this.data.usage = { records: [] }
    this.data.usage.records.push(rec)
    // 限制最多 5000 条，避免无限增长
    if (this.data.usage.records.length > 5000) {
      this.data.usage.records = this.data.usage.records.slice(-5000)
    }
    this.save()
    this.notify('usage.records', this.data.usage.records)
  }

  /**
   * 计算 token 用量累计汇总（基于 records 实时计算，保证与官方一致）。
   * @returns {Object} { callCount, totalPrompt, totalCompletion, totalCacheHit, totalCacheMiss, totalTokens }
   */
  getUsageSummary() {
    const records = this.data.usage?.records || []
    return records.reduce(
      (acc, r) => ({
        callCount: acc.callCount + 1,
        totalPrompt: acc.totalPrompt + (r.prompt || 0),
        totalCompletion: acc.totalCompletion + (r.completion || 0),
        totalCacheHit: acc.totalCacheHit + (r.cacheHit || 0),
        totalCacheMiss: acc.totalCacheMiss + (r.cacheMiss || 0),
        totalTokens: acc.totalTokens + (r.total || 0),
      }),
      { callCount: 0, totalPrompt: 0, totalCompletion: 0, totalCacheHit: 0, totalCacheMiss: 0, totalTokens: 0 },
    )
  }

  /** 清空用量记录 */
  clearUsage() {
    if (this.data.usage) this.data.usage.records = []
    this.save()
    this.notify('usage.records', [])
  }

  /** 获取全部设置（给设置窗口用） */
  getAll() {
    return JSON.parse(JSON.stringify(this.data))
  }

  /** 订阅设置变更 */
  onChange(fn) {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  /** 通知监听器 */
  notify(key, value) {
    for (const fn of this.listeners) {
      try {
        fn(key, value, this.data)
      } catch {
        /* 监听器异常不影响主流程 */
      }
    }
  }
}

/** 获取单例（需在 app ready 后调用） */
export function getStore() {
  if (!storeInstance) storeInstance = new Store()
  return storeInstance
}
