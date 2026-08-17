"""
处理 AI 生成的鲸鱼 logo：
- 去除右下角"AI生成 WORKBUDDY>"水印（用周围背景色覆盖）
- 应用圆角方形 mask
- 缩放到 1024x1024
- 生成托盘图标（template，白色鲸鱼简化版）
"""
import os
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, 'assets')
SRC = os.path.join(ASSETS, 'A_premium_minimalist_macOS_app_2026-08-17T18-22-20.png')
S = 1024


def sample_bg_color(img, points):
    """在多个背景点采样平均色。"""
    px = img.convert('RGB').load()
    rs, gs, bs = [], [], []
    w, h = img.size
    for (x, y) in points:
        if 0 <= x < w and 0 <= y < h:
            r, g, b = px[int(x), int(y)]
            rs.append(r); gs.append(g); bs.append(b)
    return (sum(rs) // len(rs), sum(gs) // len(gs), sum(bs) // len(bs))


def remove_watermark_and_round(src, size=S, radius=220):
    im = Image.open(src).convert('RGB')
    w, h = im.size
    # 缩放到目标
    im = im.resize((size, size), Image.LANCZOS)
    px = im.load()

    # 水印在右下角（约 x: 0.78-0.96, y: 0.92-0.99 区域）
    # 在水印上方/左侧采样背景色（背景是深蓝渐变）
    sample_pts = [
        (size * 0.80, size * 0.88),   # 水印正上方
        (size * 0.75, size * 0.92),   # 水印左上
        (size * 0.90, size * 0.88),   # 水印上方偏右
        (size * 0.70, size * 0.95),   # 水印左方
        (size * 0.95, size * 0.90),   # 水印右上
    ]
    bg = sample_bg_color(im, sample_pts)
    print(f'采样背景色用于覆盖水印: {bg}')

    # 用背景色覆盖右下角水印区域
    d = ImageDraw.Draw(im)
    cover_box = [
        (int(size * 0.75), int(size * 0.88)),
        (int(size * 0.99), int(size * 0.99)),
    ]
    # 用稍大一点的区域 + 柔和过渡（外层向内渐变覆盖避免硬边）
    # 先大区域统一覆盖
    d.rectangle(cover_box, fill=bg)
    # 再轻微模糊边缘：在覆盖区域上方再画一个渐变过渡
    for i in range(20):
        y = int(size * 0.88) - i
        if y < 0:
            break
        # 该行覆盖从 x=0.75 到右边，alpha 渐弱
        alpha = int(255 * (i / 20))
        row_color = tuple(int(bg[c] * (alpha / 255) + px[size // 2, y][c] * (1 - alpha / 255)) for c in range(3))
        d.line([(int(size * 0.75), y), (int(size * 0.99), y)], fill=row_color, width=1)

    # 应用圆角方形 mask
    mask = Image.new('L', (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        [(0, 0), (size - 1, size - 1)], radius=radius, fill=255
    )
    out = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    out.paste(im, (0, 0))
    out.putalpha(mask)
    return out


def make_tray_template():
    """macOS 托盘 template 图标：纯白鲸鱼（系统自动反色）。
    基于处理后的图标，提取鲸鱼区域转为白色单色。
    简化：用椭圆+多边形画一个简洁鲸鱼。
    """
    size = 128
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    f = size / 600.0
    cx, cy = size * 0.55, size * 0.5

    # 身体（大椭圆，倾斜）
    body_w, body_h = 360 * f, 160 * f
    d.ellipse(
        [(cx - body_w, cy - body_h), (cx + body_w, cy + body_h)],
        fill=(255, 255, 255, 255),
    )
    # 头（右侧小椭圆，更圆）
    head_w, head_h = 110 * f, 130 * f
    d.ellipse(
        [(cx + body_w * 0.7, cy - head_h), (cx + body_w * 0.7 + head_w * 2, cy + head_h)],
        fill=(255, 255, 255, 255),
    )
    # 尾鳍（左侧分叉两个三角）
    tail_x = cx - body_w * 0.95
    d.polygon([
        (tail_x, cy - 10),
        (tail_x - 70 * f, cy - 70 * f),
        (tail_x - 50 * f, cy - 20),
    ], fill=(255, 255, 255, 255))
    d.polygon([
        (tail_x, cy + 10),
        (tail_x - 60 * f, cy + 60 * f),
        (tail_x - 40 * f, cy + 20),
    ], fill=(255, 255, 255, 255))
    # 尾鳍连接处（一个小三角填充）
    d.polygon([
        (tail_x, cy - 15),
        (tail_x - 30 * f, cy),
        (tail_x, cy + 15),
    ], fill=(255, 255, 255, 255))
    return img


if __name__ == '__main__':
    icon = remove_watermark_and_round(SRC)
    out = os.path.join(ASSETS, 'icon.png')
    icon.save(out, 'PNG')
    print(f'icon.png saved: {icon.size}')
    tray = make_tray_template()
    tray.save(os.path.join(ASSETS, 'tray.png'), 'PNG')
    tray.save(os.path.join(ASSETS, 'trayTemplate.png'), 'PNG')
    print('tray.png / trayTemplate.png saved (128)')
    # 清理源
    try:
        os.remove(SRC)
        print('cleaned source')
    except Exception:
        pass
