/* 零依赖生成鲸鱼主题图标：
 *   - assets/icon.png       (512×512，圆角方形渐变 + 白色鲸鱼剪影，应用图标)
 *   - assets/tray.png       (64×64，蓝色鲸鱼剪影)
 *   - assets/trayTemplate.png (64×64，白色剪影，macOS 菜单栏模板图)
 *   - assets/icon.icns      (mac 下用 sips/iconutil 生成)
 *   - assets/icon.ico       (win 用，PNG-in-ICO)
 * 使用 Node 内置 zlib 编码 PNG；矢量形状（椭圆/线段/三角）带抗锯齿。 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import zlib from 'node:zlib'

// ---------- PNG 编码 ----------
const CRC_TABLE = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()
function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function writePNG(file, w, h, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  function chunk(type, data) {
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length, 0)
    const t = Buffer.from(type, 'ascii')
    const crc = Buffer.alloc(4)
    crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0)
    return Buffer.concat([len, t, data, crc])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA
  const raw = Buffer.alloc((w * 4 + 1) * h)
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0 // filter none
    const src = y * w * 4
    const dst = y * (w * 4 + 1) + 1
    for (let i = 0; i < w * 4; i++) raw[dst + i] = rgba[src + i]
  }
  const idat = zlib.deflateSync(raw, { level: 9 })
  fs.writeFileSync(file, Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]))
}

// ---------- 光栅化基元 ----------
function blend(buf, S, x, y, r, g, b, a) {
  if (x < 0 || y < 0 || x >= S || y >= S || a <= 0) return
  const i = (y * S + x) * 4
  const sa = a / 255
  buf[i] = Math.round(buf[i] * (1 - sa) + r * sa)
  buf[i + 1] = Math.round(buf[i + 1] * (1 - sa) + g * sa)
  buf[i + 2] = Math.round(buf[i + 2] * (1 - sa) + b * sa)
  buf[i + 3] = Math.min(255, Math.round(buf[i + 3] * (1 - sa) + a * sa))
}

function fillRoundedRect(buf, S, pad, radius, top, bot) {
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const X = x - pad
      const Y = y - pad
      const W = S - pad * 2
      const H = S - pad * 2
      if (X < 0 || Y < 0 || X > W || Y > H) continue
      const cx = Math.min(Math.max(X, radius), W - radius)
      const cy = Math.min(Math.max(Y, radius), H - radius)
      const d = Math.hypot(X - cx, Y - cy) - radius
      if (d > 1) continue
      const m = d <= 0 ? 1 : 1 + d
      const t = Y / H
      const r = Math.round(top[0] + (bot[0] - top[0]) * t)
      const g = Math.round(top[1] + (bot[1] - top[1]) * t)
      const b = Math.round(top[2] + (bot[2] - top[2]) * t)
      blend(buf, S, x, y, r, g, b, Math.round(m * 255))
    }
  }
}

function fillEllipse(buf, S, cx, cy, rx, ry, rot, color) {
  const minx = Math.floor(cx - rx - 2)
  const maxx = Math.ceil(cx + rx + 2)
  const miny = Math.floor(cy - ry - 2)
  const maxy = Math.ceil(cy + ry + 2)
  const cos = Math.cos(rot)
  const sin = Math.sin(rot)
  for (let y = miny; y <= maxy; y++) {
    for (let x = minx; x <= maxx; x++) {
      const dx = x - cx
      const dy = y - cy
      const lx = (dx * cos + dy * sin) / rx
      const ly = (-dx * sin + dy * cos) / ry
      const v = lx * lx + ly * ly
      let m = 0
      if (v <= 1) m = 1
      else if (v <= 1.06) m = (1.06 - v) / 0.06
      if (m <= 0) continue
      blend(buf, S, x, y, color[0], color[1], color[2], Math.round(m * 255))
    }
  }
}

function fillSegment(buf, S, x1, y1, x2, y2, width, color) {
  const minx = Math.floor(Math.min(x1, x2) - width)
  const maxx = Math.ceil(Math.max(x1, x2) + width)
  const miny = Math.floor(Math.min(y1, y2) - width)
  const maxy = Math.ceil(Math.max(y1, y2) + width)
  const dx = x2 - x1
  const dy = y2 - y1
  const len2 = dx * dx + dy * dy || 1
  for (let y = miny; y <= maxy; y++) {
    for (let x = minx; x <= maxx; x++) {
      let t = ((x - x1) * dx + (y - y1) * dy) / len2
      t = Math.max(0, Math.min(1, t))
      const px = x1 + t * dx
      const py = y1 + t * dy
      const d = Math.hypot(x - px, y - py)
      let m = 0
      if (d <= width) m = 1
      else if (d <= width + 1) m = width + 1 - d
      if (m <= 0) continue
      blend(buf, S, x, y, color[0], color[1], color[2], Math.round(m * 255))
    }
  }
}

function fillTriangle(buf, S, p1, p2, p3, color) {
  const minx = Math.floor(Math.min(p1[0], p2[0], p3[0]))
  const maxx = Math.ceil(Math.max(p1[0], p2[0], p3[0]))
  const miny = Math.floor(Math.min(p1[1], p2[1], p3[1]))
  const maxy = Math.ceil(Math.max(p1[1], p2[1], p3[1]))
  for (let y = miny; y <= maxy; y++) {
    for (let x = minx; x <= maxx; x++) {
      const a = (p2[1] - p3[1]) * (x - p3[0]) + (p3[0] - p2[0]) * (y - p3[1])
      const b = (p3[1] - p1[1]) * (x - p3[0]) + (p1[0] - p3[0]) * (y - p3[1])
      const c = (p1[1] - p2[1]) * (x - p1[0]) + (p2[0] - p1[0]) * (y - p1[1])
      const d = (p2[1] - p3[1]) * (p1[0] - p3[0]) + (p3[0] - p2[0]) * (p1[1] - p3[1])
      if (d === 0) continue
      if ((a >= 0 && b >= 0 && c >= 0) || (a <= 0 && b <= 0 && c <= 0)) {
        blend(buf, S, x, y, color[0], color[1], color[2], 255)
      }
    }
  }
}

// ---------- 画一只简洁的鲸鱼（剪影） ----------
function drawWhale(buf, S, color) {
  const u = S / 512
  const cy = 300 * u
  fillEllipse(buf, S, 280 * u, cy, 150 * u, 90 * u, -0.08, color) // 身体
  fillEllipse(buf, S, 388 * u, cy - 16 * u, 80 * u, 68 * u, 0, color) // 头
  fillTriangle(buf, S, [120 * u, cy - 6 * u], [44 * u, cy - 66 * u], [64 * u, cy + 34 * u], color) // 尾（上）
  fillTriangle(buf, S, [120 * u, cy - 6 * u], [34 * u, cy + 28 * u], [70 * u, cy + 64 * u], color) // 尾（下）
  fillTriangle(buf, S, [250 * u, cy + 70 * u], [300 * u, cy + 96 * u], [230 * u, cy + 40 * u], color) // 胸鳍
  // 独角的细螺旋长矛（narwhal 意象）
  for (let i = 0; i <= 46; i++) {
    const t = i / 46
    const x = 452 * u + t * 20 * u
    const y = cy - 36 * u - t * 64 * u + Math.sin(t * 7) * 2.4 * u
    fillSegment(buf, S, x, y, x + 3 * u, y - 1.4 * u, 4 * u, color)
  }
  // 眼睛（深色小点；浅色鲸身才可见）
  if (color[0] < 200) {
    blend(buf, S, Math.round(396 * u), Math.round(cy - 30 * u), 13, 20, 36, 255)
    blend(buf, S, Math.round(398 * u), Math.round(cy - 32 * u), 255, 255, 255, 210)
  }
}

function makeIcon(size) {
  const buf = new Uint8Array(size * size * 4)
  fillRoundedRect(buf, size, size * 0.06, size * 0.18, [16, 58, 107], [31, 127, 184])
  drawWhale(buf, size, [235, 246, 255])
  return buf
}
function makeTray(size, color) {
  const buf = new Uint8Array(size * size * 4)
  drawWhale(buf, size, color)
  return buf
}

function writeICO(file, pngPath) {
  const png = fs.readFileSync(pngPath)
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(1, 4)
  const entry = Buffer.alloc(16)
  entry.writeUInt8(0, 0) // width (256+ -> 0)
  entry.writeUInt8(0, 1) // height
  entry.writeUInt8(0, 2) // colors
  entry.writeUInt8(0, 3) // reserved
  entry.writeUInt16LE(1, 4) // planes
  entry.writeUInt16LE(32, 6) // bit count
  entry.writeUInt32LE(png.length, 8)
  entry.writeUInt32LE(22, 12)
  fs.writeFileSync(file, Buffer.concat([header, entry, png]))
}

const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets')
fs.mkdirSync(outDir, { recursive: true })
const iconPng = path.join(outDir, 'icon.png')
writePNG(iconPng, 512, 512, makeIcon(512))
writePNG(path.join(outDir, 'tray.png'), 64, 64, makeTray(64, [74, 168, 255]))
writePNG(path.join(outDir, 'trayTemplate.png'), 64, 64, makeTray(64, [255, 255, 255]))
console.log('[gen-icons] PNG 已生成：icon.png / tray.png / trayTemplate.png')

// macOS：png -> icns（用系统 sips + iconutil）
if (process.platform === 'darwin') {
  const iconset = path.join(outDir, 'icon.iconset')
  fs.mkdirSync(iconset, { recursive: true })
  const entries = [
    [16, 'icon_16x16.png'],
    [32, 'icon_16x16@2x.png'],
    [32, 'icon_32x32.png'],
    [64, 'icon_32x32@2x.png'],
    [128, 'icon_128x128.png'],
    [256, 'icon_128x128@2x.png'],
    [256, 'icon_256x256.png'],
    [512, 'icon_256x256@2x.png'],
    [512, 'icon_512x512.png'],
    [1024, 'icon_512x512@2x.png'],
  ]
  for (const [s, name] of entries) {
    spawnSync('sips', ['-z', String(s), String(s), iconPng, '--out', path.join(iconset, name)])
  }
  const r = spawnSync('iconutil', ['-c', 'icns', iconset])
  if (r.status === 0) console.log('[gen-icons] icon.icns 已生成')
  else console.warn('[gen-icons] iconutil 失败，将改用 png 作为 mac 图标')
  fs.rmSync(iconset, { recursive: true, force: true })
}

// Windows：png -> ico（PNG 内嵌 ICO）
writeICO(path.join(outDir, 'icon.ico'), iconPng)
console.log('[gen-icons] icon.ico 已生成')
