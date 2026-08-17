# 版本选择指南

DeepSeek Harness Desktop 提供两个版本，满足不同需求。请根据自身使用场景选择下载。

| 版本 | 定位 | 适合人群 |
|---|---|---|
| **v1.0.0 纯净版** | 极简宿主壳，仅核心功能 | 追求轻量、原汁原味、不需要自定义外观的用户 |
| **v1.1.0 DIY 背景版** | 在纯净版基础上增加自定义背景与字体颜色 | 希望个性化外观、自定义视觉体验的用户 |

---

## 📥 下载链接

### 版本一：纯净版（v1.0.0）

> 极简桌面壳，自动启停本地服务，开箱即用，无任何外观自定义功能。

- **macOS (Apple Silicon)**：[DeepSeek-Harness-Desktop-1.0.0-arm64.dmg](https://github.com/67-qingshui/deepseek-harness-desktop/releases/download/v1.0.0/DeepSeek-Harness-Desktop-1.0.0-arm64.dmg)（约 148 MB）
- **Release 页面**：https://github.com/67-qingshui/deepseek-harness-desktop/releases/tag/v1.0.0

### 版本二：DIY 背景版（v1.1.0）

> 在纯净版全部功能基础上，新增自定义背景图片与字体颜色，通过设置窗口实时调整。

- **macOS (Apple Silicon)**：[DeepSeek-Harness-Desktop-1.1.0-arm64.dmg](https://github.com/67-qingshui/deepseek-harness-desktop/releases/download/v1.1.0/DeepSeek-Harness-Desktop-1.1.0-arm64.dmg)（约 148 MB）
- **Release 页面**：https://github.com/67-qingshui/deepseek-harness-desktop/releases/tag/v1.1.0

> ⚠️ 两个版本均未做 Apple 公证，macOS 首次打开需在「系统设置 → 隐私与安全性」中点击「仍要打开」。
> ⚠️ 两个版本均**无需预装 Node.js**，安装包自带运行时与内嵌 dsh，开箱即用。

---

## 🔍 功能特点对比

### 共有功能（两个版本均具备）

| 功能 | 说明 |
|---|---|
| 自包含运行时 | `@deepseek-ai/dsh` 内嵌进应用，由应用自带 Electron 执行，无需系统 Node/npm，首次启动不联网 |
| 自动启停服务 | 启动拉起本地 Harness（仅监听 `127.0.0.1` 回环），退出 `tree-kill` 回收子进程树 |
| 就绪检测 | 从 stdout 解析服务地址，就绪前显示加载页，无白屏 |
| 单实例窗口 | 重复打开只唤出已有窗口 |
| 关闭到托盘 | 关闭=最小化到托盘，可随时唤出/退出 |
| macOS 原生标题栏 | 隐藏原生标题栏，叠加控件自适应深浅色 |
| 安全沙箱 | `contextIsolation` + `sandbox` + 禁用 Node 集成，跨域跳转走系统浏览器 |
| 跨平台 | macOS arm64 / Windows x64 / Linux x64 |

### v1.0.0 纯净版 — 功能特点

**定位：原汁原味的极简宿主壳**

- ✅ 核心宿主能力齐全（启停 / 托盘 / 单实例 / 安全）
- ✅ 零外观自定义，保持 Harness 原始界面
- ✅ 代码量最小，模块仅 4 个（main / window / tray / dsh-service）
- ✅ 适合「只想要个桌面壳，不想折腾外观」的用户

**不含：**
- ❌ 自定义背景图片
- ❌ 自定义字体颜色
- ❌ 设置窗口

### v1.1.0 DIY 背景版 — 功能特点

**定位：可个性化外观的增强版**

- ✅ 包含 v1.0.0 全部核心功能
- ✅ **自定义背景图片**：
  - 上传本地图片（jpg/png/webp/gif），自动复制到 `userData/backgrounds/` 自包含管理
  - 6 套预设渐变图库（深海 / 极光 / 日落 / 森林 / 墨黑 / 雅紫），纯 CSS 零二进制
  - `background-size: cover` 自动适配任意屏幕分辨率
  - 可调不透明度（0–100%）与模糊（0–40px）
- ✅ **自定义字体颜色**：
  - 原生颜色选择器自由调色（任意 HEX）
  - 7 套预设颜色方案（浅霜白 / 暖白 / 青绿 / 天蓝 / 淡紫 / 琥珀 / 玫红）
- ✅ **快速配色方案**：一键切换协调的「背景 + 字体颜色」组合
- ✅ 独立设置窗口（深色主题、响应式、实时预览）
- ✅ 设置入口：托盘菜单「设置…」+ macOS `⌘ ,` 快捷键
- ✅ 变更实时生效，无需重启
- ✅ 通过 `insertCSS` 叠加，不修改 Harness 代码，不破坏布局

**新增模块**：`store.js` / `skin-manager.js` / `settings-window.js` / `settings/` / `settings-preload.cjs`

---

## 📊 区别一览表

| 特性 | v1.0.0 纯净版 | v1.1.0 DIY 背景版 |
|---|:---:|:---:|
| 核心宿主能力 | ✅ | ✅ |
| 自定义背景图片 | ❌ | ✅ |
| 预设渐变图库（6 套） | ❌ | ✅ |
| 上传本地图片 | ❌ | ✅ |
| 背景不透明度调节 | ❌ | ✅ |
| 背景模糊调节 | ❌ | ✅ |
| 自定义字体颜色 | ❌ | ✅ |
| 预设颜色方案（7 套） | ❌ | ✅ |
| 快速配色方案 | ❌ | ✅ |
| 独立设置窗口 | ❌ | ✅ |
| 实时预览 | ❌ | ✅ |
| macOS `⌘ ,` 设置快捷键 | ❌ | ✅ |
| 模块数量 | 4 个 | 7 个 + 设置界面 |
| 安装包体积 | ~148 MB | ~148 MB |
| 需预装 Node.js | ❌ | ❌ |

---

## 💡 如何选择

| 你的需求 | 推荐版本 |
|---|---|
| 只想要一个能跑的桌面壳，不在意外观 | **v1.0.0 纯净版** |
| 追求极致轻量，代码越少越好 | **v1.0.0 纯净版** |
| 想给 Harness 换个好看的背景 | **v1.1.0 DIY 背景版** |
| 想调整字体颜色以适应背景 | **v1.1.0 DIY 背景版** |
| 喜欢个性化、愿意折腾外观 | **v1.1.0 DIY 背景版** |
| 不确定 / 都想试试 | **v1.1.0 DIY 背景版**（功能是超集，可不用自定义功能） |

> **提示**：v1.1.0 是 v1.0.0 的功能超集。如果你不确定，直接下载 v1.1.0 即可——不开启自定义外观时，它的行为与 v1.0.0 完全一致。

---

## 🔄 从 v1.0.0 升级到 v1.1.0

两个版本相互独立，可直接下载 v1.1.0 安装包覆盖安装：

1. 下载 [v1.1.0 dmg](https://github.com/67-qingshui/deepseek-harness-desktop/releases/download/v1.1.0/DeepSeek-Harness-Desktop-1.1.0-arm64.dmg)
2. 拖入 Applications 覆盖旧版
3. 打开后通过托盘「设置…」或 `⌘ ,` 开始自定义外观

升级后原有使用习惯不变，新增的自定义功能默认关闭，需要时手动开启。

---

## 📝 技术差异说明

两个版本的核心架构（Electron 壳 + 内嵌 dsh + 子进程管理）完全相同，v1.1.0 仅在 UI 层增加了 CSS 注入能力：

| 层面 | v1.0.0 | v1.1.0 |
|---|---|---|
| 主进程入口 | `main.js` | `main.js`（增加皮肤集成与设置入口） |
| 窗口管理 | `window.js` | `window.js`（增加 onPageReady 回调） |
| 托盘 | `tray.js` | `tray.js`（增加「设置…」菜单项） |
| 设置持久化 | 无 | `store.js`（userData/settings.json） |
| 皮肤注入 | 无 | `skin-manager.js`（insertCSS） |
| 设置窗口 | 无 | `settings-window.js` + `settings/` |
| 打包配置 | — | `asarUnpack` dsh + `files` 含 settings/ |

---

## 🔗 相关链接

- 仓库主页：https://github.com/67-qingshui/deepseek-harness-desktop
- 全部 Release：https://github.com/67-qingshui/deepseek-harness-desktop/releases
- DeepSeek Harness：https://github.com/deepseek-ai/deepseek-harness

---

*MIT License · 非官方社区封装，与 DeepSeek 官方无关联*
