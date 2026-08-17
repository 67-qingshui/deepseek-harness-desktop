/**
 * 用量统计窗口逻辑
 * 汇总展示 + canvas 可视化（折线图趋势 + 柱状图占比）+ 明细列表
 */

const api = window.usageApi

function fmt(n) {
  return (n || 0).toLocaleString('zh-CN')
}
function fmtTime(ts) {
  const d = new Date(ts)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

async function refresh() {
  const data = await api.getSummary()
  const { summary, records, totalCost } = data
  // 汇总
  document.getElementById('stat-calls').textContent = fmt(summary.callCount)
  document.getElementById('stat-prompt').textContent = fmt(summary.totalPrompt)
  document.getElementById('stat-completion').textContent = fmt(summary.totalCompletion)
  document.getElementById('stat-cache-hit').textContent = fmt(summary.totalCacheHit)
  const hitRate = summary.totalPrompt > 0 ? Math.round((summary.totalCacheHit / summary.totalPrompt) * 100) : 0
  document.getElementById('stat-cache-rate').textContent = `命中率 ${hitRate}%`
  document.getElementById('stat-cost').textContent = `¥${totalCost.toFixed(4)}`

  // 图表
  drawTrend(records)
  drawBar(summary)
  renderRecords(records)
}

// 折线图：近 50 次调用的 prompt / completion 趋势
function drawTrend(records) {
  const canvas = document.getElementById('chart-trend')
  const ctx = canvas.getContext('2d')
  const W = canvas.width, H = canvas.height
  ctx.clearRect(0, 0, W, H)

  const recent = records.slice(-50)
  if (recent.length === 0) {
    drawEmpty(ctx, W, H, '暂无数据')
    return
  }

  const maxVal = Math.max(1, ...recent.map((r) => Math.max(r.prompt, r.completion)))
  const padL = 50, padR = 10, padT = 16, padB = 28
  const cw = W - padL - padR, ch = H - padT - padB

  // 网格 + Y 轴
  ctx.strokeStyle = '#243049'
  ctx.fillStyle = '#8a99b5'
  ctx.font = '11px sans-serif'
  ctx.lineWidth = 1
  for (let i = 0; i <= 4; i++) {
    const y = padT + (ch / 4) * i
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke()
    const val = Math.round(maxVal * (1 - i / 4))
    ctx.fillText(fmt(val), 4, y + 4)
  }

  const step = recent.length > 1 ? cw / (recent.length - 1) : cw
  // prompt 折线（蓝）
  ctx.strokeStyle = '#4a9eff'; ctx.lineWidth = 2; ctx.beginPath()
  recent.forEach((r, i) => {
    const x = padL + i * step
    const y = padT + ch - (r.prompt / maxVal) * ch
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
  })
  ctx.stroke()
  // completion 折线（绿）
  ctx.strokeStyle = '#4ade80'; ctx.lineWidth = 2; ctx.beginPath()
  recent.forEach((r, i) => {
    const x = padL + i * step
    const y = padT + ch - (r.completion / maxVal) * ch
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
  })
  ctx.stroke()

  // 图例
  ctx.font = '12px sans-serif'
  ctx.fillStyle = '#4a9eff'; ctx.fillRect(padL, H - 14, 10, 10); ctx.fillStyle = '#e8eef7'; ctx.fillText('输入', padL + 14, H - 5)
  ctx.fillStyle = '#4ade80'; ctx.fillRect(padL + 60, H - 14, 10, 10); ctx.fillStyle = '#e8eef7'; ctx.fillText('输出', padL + 74, H - 5)
}

// 柱状图：输入（缓存命中/未命中）vs 输出
function drawBar(summary) {
  const canvas = document.getElementById('chart-bar')
  const ctx = canvas.getContext('2d')
  const W = canvas.width, H = canvas.height
  ctx.clearRect(0, 0, W, H)

  const data = [
    { label: '缓存命中输入', val: summary.totalCacheHit, color: '#4a9eff' },
    { label: '缓存未命中输入', val: summary.totalCacheMiss, color: '#3b82f6' },
    { label: '输出', val: summary.totalCompletion, color: '#4ade80' },
  ]
  const maxVal = Math.max(1, ...data.map((d) => d.val))
  const padL = 110, padR = 30, padT = 10, padB = 10
  const cw = W - padL - padR, ch = H - padT - padB
  const barH = ch / data.length - 12

  ctx.font = '12px sans-serif'
  data.forEach((d, i) => {
    const y = padT + i * (barH + 12)
    const w = (d.val / maxVal) * cw
    ctx.fillStyle = '#8a99b5'; ctx.textAlign = 'right'
    ctx.fillText(d.label, padL - 8, y + barH / 2 + 4)
    ctx.fillStyle = d.color
    ctx.fillRect(padL, y, Math.max(2, w), barH)
    ctx.fillStyle = '#e8eef7'; ctx.textAlign = 'left'
    ctx.fillText(fmt(d.val), padL + w + 6, y + barH / 2 + 4)
  })
}

// 明细列表
function renderRecords(records) {
  const list = document.getElementById('record-list')
  const recent = records.slice(-20).reverse()
  if (recent.length === 0) {
    list.innerHTML = '<div class="empty">暂无用量数据，进行 API 调用后将自动统计</div>'
    return
  }
  list.innerHTML = recent.map((r) => `
    <div class="record-item">
      <span class="col-time">${fmtTime(r.ts)}</span>
      <span class="col-model">${r.model || '-'}</span>
      <span class="col-num">输入 ${fmt(r.prompt)}</span>
      <span class="col-num">输出 ${fmt(r.completion)}</span>
      <span class="col-num">合计 ${fmt(r.total)}</span>
    </div>
  `).join('')
}

function drawEmpty(ctx, W, H, text) {
  ctx.fillStyle = '#8a99b5'; ctx.font = '13px sans-serif'; ctx.textAlign = 'center'
  ctx.fillText(text, W / 2, H / 2)
}

// 清空
document.getElementById('btn-clear').onclick = async () => {
  if (confirm('确定清空所有用量记录？此操作不可撤销。')) {
    await api.clear()
    refresh()
  }
}

// 定价链接
document.getElementById('link-pricing').onclick = (e) => {
  e.preventDefault()
  window.open('https://api-docs.deepseek.com/zh-cn/quick_start/pricing', '_blank')
}

// 启动 + 定时刷新（捕获实时调用）
refresh()
setInterval(refresh, 5000)
