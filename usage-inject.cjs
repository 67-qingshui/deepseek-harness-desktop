/**
 * Token 用量采集注入脚本（在 Harness 页面的渲染进程执行）
 *
 * 通过 hook fetch 与 XMLHttpRequest，拦截 DeepSeek API 响应中的 usage 字段，
 * 按 DeepSeek 官方计费规则提取：
 *   - prompt_tokens              总输入 token（含缓存命中+未命中）
 *   - completion_tokens          输出 token
 *   - prompt_cache_hit_tokens    缓存命中输入 token（计费更低）
 *   - prompt_cache_miss_tokens   缓存未命中输入 token（正常计费）
 *   - total_tokens               = prompt_tokens + completion_tokens
 *
 * 提取后通过 postMessage 通知主进程（preload 桥接），不在页面暴露 IPC。
 */
;(function () {
  if (window.__dsh_usage_hooked) return
  window.__dsh_usage_hooked = true

  // 上报函数：通过自定义事件把 usage 发给 preload（preload 监听后 invoke IPC）
  function report(usage, model) {
    try {
      const rec = {
        ts: Date.now(),
        model: model || usage.model || 'unknown',
        prompt: usage.prompt_tokens || 0,
        completion: usage.completion_tokens || 0,
        cacheHit: usage.prompt_cache_hit_tokens || 0,
        cacheMiss: usage.prompt_cache_miss_tokens || 0,
        total: usage.total_tokens || (usage.prompt_tokens || 0) + (usage.completion_tokens || 0),
      }
      window.postMessage({ type: '__dsh_usage__', payload: rec }, '*')
    } catch (e) {
      /* ignore */
    }
  }

  // 从响应文本中解析 usage（兼容 JSON 与 SSE 流式）
  function parseUsage(text) {
    if (!text || typeof text !== 'string') return null
    // 1) 普通 JSON 响应
    try {
      const obj = JSON.parse(text)
      if (obj && obj.usage) return { usage: obj.usage, model: obj.model }
    } catch {
      /* 非 JSON，继续尝试 SSE */
    }
    // 2) SSE 流式响应：最后一个 data: chunk 含 usage
    //    形如 data: {"choices":[...],"usage":{"prompt_tokens":...}}
    const lines = text.split('\n')
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim()
      if (line.startsWith('data:')) {
        const payload = line.slice(5).trim()
        if (payload === '[DONE]') continue
        try {
          const obj = JSON.parse(payload)
          if (obj && obj.usage) return { usage: obj.usage, model: obj.model }
        } catch {
          /* ignore */
        }
      }
    }
    return null
  }

  // —— Hook fetch ——
  const origFetch = window.fetch
  window.fetch = async function (...args) {
    const resp = await origFetch.apply(this, args)
    try {
      // 克隆响应以便读取 body（原响应仍可被页面消费）
      const clone = resp.clone()
      clone.text().then((text) => {
        const parsed = parseUsage(text)
        if (parsed) report(parsed.usage, parsed.model)
      }).catch(() => {})
    } catch {
      /* ignore */
    }
    return resp
  }

  // —— Hook XMLHttpRequest ——
  const origOpen = XMLHttpRequest.prototype.open
  const origSend = XMLHttpRequest.prototype.send
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this.__dsh_url = url
    return origOpen.call(this, method, url, ...rest)
  }
  XMLHttpRequest.prototype.send = function (body) {
    this.addEventListener('load', () => {
      try {
        const text = this.responseText
        const parsed = parseUsage(text)
        if (parsed) report(parsed.usage, parsed.model)
      } catch {
        /* ignore */
      }
    })
    return origSend.call(this, body)
  }

  console.log('[dsh-usage] token 用量采集已注入')
})()
