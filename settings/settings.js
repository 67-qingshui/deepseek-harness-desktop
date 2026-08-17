/**
 * 设置窗口逻辑
 *
 * 通过 window.settingsApi（preload 桥接）与主进程通信。
 * 所有变更实时调用 settingsApi.set 触发主窗口皮肤更新。
 */

const api = window.settingsApi

let state = {
  background: { type: 'none', preset: 'deep-sea', image: '', opacity: 0.85, blur: 0 },
  textColor: { enabled: false, color: '#e8eef7' },
  presetScheme: '',
}
let presets = []
let textPresets = []

// —— 初始化 ——
async function init() {
  const data = await api.getAll()
  state = data.settings
  presets = data.backgroundPresets
  textPresets = data.textColorPresets
  render()
}

// —— 渲染 ——
function render() {
  renderBgType()
  renderPresets()
  renderImagePreview()
  renderSliders()
  renderTextColor()
  renderSchemes()
}

// 背景类型切换
function renderBgType() {
  const type = state.background.type
  document.querySelectorAll('#bg-type .seg-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.type === type)
  })
  document.getElementById('block-preset').hidden = type !== 'preset'
  document.getElementById('block-image').hidden = type !== 'image'
  document.getElementById('block-adjust').hidden = type === 'none'
}

// 预设图库
function renderPresets() {
  const grid = document.getElementById('preset-grid')
  grid.innerHTML = ''
  for (const p of presets) {
    const item = document.createElement('div')
    item.className = 'preset-item' + (state.background.preset === p.id ? ' active' : '')
    item.style.background = p.css
    item.innerHTML = `<span class="label">${p.name}</span>`
    item.onclick = () => {
      state.background.preset = p.id
      state.background.type = 'preset'
      api.set('background.preset', p.id)
      api.set('background.type', 'preset')
      render()
    }
    grid.appendChild(item)
  }
}

// 本地图片预览
async function renderImagePreview() {
  const preview = document.getElementById('image-preview')
  if (state.background.image) {
    const dataUri = await api.readImage(state.background.image)
    if (dataUri) {
      preview.style.backgroundImage = `url("${dataUri}")`
      preview.querySelector('.placeholder').textContent = ''
    } else {
      preview.style.backgroundImage = ''
      preview.querySelector('.placeholder').textContent = '图片加载失败'
    }
  } else {
    preview.style.backgroundImage = ''
    preview.querySelector('.placeholder').textContent = '未选择图片'
  }
}

// 滑块
function renderSliders() {
  const opacity = Math.round((state.background.opacity || 0.85) * 100)
  const blur = state.background.blur || 0
  document.getElementById('slider-opacity').value = opacity
  document.getElementById('val-opacity').textContent = `${opacity}%`
  document.getElementById('slider-blur').value = blur
  document.getElementById('val-blur').textContent = `${blur}px`
}

// 字体颜色
function renderTextColor() {
  const enabled = state.textColor.enabled
  document.getElementById('switch-textcolor').checked = enabled
  document.getElementById('block-textcolor').style.opacity = enabled ? '1' : '0.5'
  document.getElementById('block-textcolor').style.pointerEvents = enabled ? 'auto' : 'none'

  const color = state.textColor.color || '#e8eef7'
  document.getElementById('color-picker').value = color
  document.getElementById('color-val').textContent = color.toUpperCase()

  const grid = document.getElementById('textcolor-grid')
  grid.innerHTML = ''
  for (const tp of textPresets) {
    const item = document.createElement('div')
    item.className = 'color-preset-item' + (state.textColor.color === tp.color ? ' active' : '')
    item.innerHTML = `<span class="color-swatch" style="background:${tp.color}"></span><span>${tp.name}</span>`
    item.onclick = () => {
      state.textColor.color = tp.color
      api.set('textColor.color', tp.color)
      render()
    }
    grid.appendChild(item)
  }
}

// 快速配色方案（背景预设 + 对应字体色组合）
function renderSchemes() {
  const grid = document.getElementById('scheme-grid')
  grid.innerHTML = ''
  // 方案 = 预设背景 + 其推荐字体色 + "无背景+默认色"
  const schemes = [
    { id: '', name: '默认（无）', css: 'linear-gradient(135deg,#0b1120,#141c2e)', textColor: '#e8eef7' },
    ...presets.map((p) => ({ id: p.id, name: p.name, css: p.css, textColor: p.textColor })),
  ]
  for (const s of schemes) {
    const item = document.createElement('div')
    item.className = 'scheme-item' + (state.presetScheme === s.id ? ' active' : '')
    item.innerHTML = `
      <div class="scheme-preview" style="background:${s.css};color:${s.textColor}">Aa 文字</div>
      <div class="scheme-name">${s.name}</div>
    `
    item.onclick = () => {
      state.presetScheme = s.id
      if (s.id === '') {
        state.background.type = 'none'
        state.textColor.enabled = false
        api.set('background.type', 'none')
        api.set('textColor.enabled', false)
      } else {
        state.background.type = 'preset'
        state.background.preset = s.id
        state.textColor.enabled = true
        state.textColor.color = s.textColor
        api.set('background.type', 'preset')
        api.set('background.preset', s.id)
        api.set('textColor.enabled', true)
        api.set('textColor.color', s.textColor)
      }
      api.set('presetScheme', s.id)
      render()
    }
    grid.appendChild(item)
  }
}

// —— 事件绑定 ——

// 背景类型
document.getElementById('bg-type').addEventListener('click', (e) => {
  const btn = e.target.closest('.seg-btn')
  if (!btn) return
  state.background.type = btn.dataset.type
  api.set('background.type', btn.dataset.type)
  render()
})

// 选择图片
document.getElementById('btn-pick').onclick = async () => {
  const filePath = await api.pickImage()
  if (filePath) {
    state.background.image = filePath
    state.background.type = 'image'
    api.set('background.image', filePath)
    api.set('background.type', 'image')
    render()
  }
}

// 清除图片
document.getElementById('btn-clear-image').onclick = () => {
  state.background.image = ''
  api.set('background.image', '')
  render()
}

// 不透明度
document.getElementById('slider-opacity').oninput = (e) => {
  const v = e.target.value / 100
  state.background.opacity = v
  document.getElementById('val-opacity').textContent = `${e.target.value}%`
  api.set('background.opacity', v)
}

// 模糊
document.getElementById('slider-blur').oninput = (e) => {
  const v = Number(e.target.value)
  state.background.blur = v
  document.getElementById('val-blur').textContent = `${v}px`
  api.set('background.blur', v)
}

// 字体颜色开关
document.getElementById('switch-textcolor').onchange = (e) => {
  state.textColor.enabled = e.target.checked
  api.set('textColor.enabled', e.target.checked)
  render()
}

// 颜色选择器
document.getElementById('color-picker').oninput = (e) => {
  const v = e.target.value
  state.textColor.color = v
  document.getElementById('color-val').textContent = v.toUpperCase()
  api.set('textColor.color', v)
}

// 启动
init()
