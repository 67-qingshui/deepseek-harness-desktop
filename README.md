# DeepSeek Harness Desktop

> 极简桌面壳：把 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的 Web UI 装进原生窗口，**自动启停本地服务，开箱即用**。

非官方的社区封装。设计理念：**简单、轻量、好用**——不改写 Harness 本身代码，通过 CSS 注入提供「宿主能力 + 个性化」。DeepSeek Harness（`@deepseek-ai/dsh`）已作为依赖内嵌进应用，由应用自带的 Electron 运行，**最终用户无需预装 Node.js，下载安装包后即可直接使用**。

> **v1.1.0 新增**：自定义背景图片（上传本地图片 / 预设图库）与自定义字体颜色（自由调色 / 预设方案），通过独立设置窗口配置，实时生效。

---

## 目录

- [功能特性](#功能特性)
- [自定义外观](#自定义外观)
- [环境要求](#环境要求)
- [项目依赖](#项目依赖)
- [目录结构](#目录结构)
- [安装步骤](#安装步骤)
- [使用说明](#使用说明)
- [配置参数说明](#配置参数说明)
- [构建部署](#构建部署)
- [常见问题](#常见问题)
- [License](#license)

---

## 功能特性

- **自包含运行时**：`@deepseek-ai/dsh` 作为依赖打包进应用，由应用自带 Electron 直接执行，无需系统 Node/npm，首次启动也不联网下载。
- **自动启停服务**：启动时拉起本地 Harness 服务（仅监听 `127.0.0.1` 回环），退出时 `tree-kill` 回收整棵子进程树，无残留。
- **就绪检测**：从子进程 stdout 解析 `dsh web: http://127.0.0.1:<port>`，服务就绪后自动载入；就绪前显示干净加载页，无白屏。
- **单实例窗口**：重复打开只会唤出已有窗口，不会启动多份。
- **关闭到托盘**：关闭窗口 = 最小化到系统托盘；从托盘可随时唤出或退出（macOS 常见交互）。
- **macOS 原生标题栏**：隐藏原生标题栏，用叠加控件呈现干净工具条，与系统深浅色自适应。
- **安全沙箱**：渲染进程 `contextIsolation` + `sandbox` + 禁用 Node 集成，跨域跳转一律交给系统浏览器。
- **零构建步骤**：纯 ESM（`type: module`），`electron .` 直接运行源码，无需 TypeScript 编译或打包。
- **跨平台**：支持 macOS（arm64）、Windows（x64）、Linux（x64）。
- **自定义背景图片**（v1.1.0）：上传本地图片或从 6 套预设渐变图库中选择，自动适配屏幕分辨率（`cover`），可调不透明度与模糊。
- **自定义字体颜色**（v1.1.0）：颜色选择器自由调色 + 7 套预设颜色方案，实时生效。
- **快速配色方案**（v1.1.0）：一键切换协调的「背景 + 字体颜色」组合。

## 自定义外观

v1.1.0 起支持自定义背景图片与字体颜色，通过独立设置窗口配置，**变更实时生效**，不破坏 Harness 原有布局。

### 打开设置

- **托盘菜单** → 「设置…」
- **macOS 快捷键** `⌘ ,`（系统惯例）

### 背景图片

| 类型 | 说明 |
|---|---|
| 无 | 不使用背景（默认） |
| 预设图库 | 6 套纯 CSS 渐变（深海 / 极光 / 日落 / 森林 / 墨黑 / 雅紫），零二进制依赖 |
| 本地图片 | 上传 jpg/png/webp/gif，自动复制到 `userData/backgrounds/` 自包含管理 |

- 背景以 `body::before` 叠加（`position:fixed; inset:0; z-index:-1`），`background-size:cover` 自动适配任意分辨率
- 可调**不透明度**（0–100%）与**模糊**（0–40px）

### 字体颜色

- **自由调色**：原生颜色选择器（`input[type=color]`），任意 HEX 值
- **预设方案**：浅霜白 / 暖白 / 青绿 / 天蓝 / 淡紫 / 琥珀 / 玫红
- 通过 `insertCSS` 覆盖 `body` 及常见文本元素颜色

### 设置存储

设置持久化在 `userData/settings.json`，包含：

```json
{
  "background": { "type": "preset", "preset": "deep-sea", "image": "", "opacity": 0.85, "blur": 0 },
  "textColor": { "enabled": true, "color": "#cfe1f5" },
  "presetScheme": "deep-sea"
}
```

## 环境要求

| 场景 | 要求 |
|---|---|
| **运行已安装的应用** | 无需任何环境。安装包自带运行时，开箱即用。 |
| **开发 / 打包** | Node.js ≥ 18、npm（用于 `npm install` 与 `electron-builder`） |
| **macOS 构建** | Apple Silicon Mac（产出 arm64 dmg） |
| **Windows / Linux 构建** | 对应平台 x64 环境 |

> 说明：仅开发与打包时需要本机 Node.js；打包后的安装包自带 Electron 运行时与内嵌 dsh，最终用户无需预装 Node.js。

## 项目依赖

**运行时依赖（`dependencies`）**——会打包进安装包：

| 依赖 | 版本 | 用途 |
|---|---|---|
| `@deepseek-ai/dsh` | `^0.1.0-rc.7` | DeepSeek Harness 核心，作为子进程运行 |
| `tree-kill` | `^1.2.2` | 退出时回收整棵子进程树 |

**开发依赖（`devDependencies`）**——不打包进安装包：

| 依赖 | 版本 | 用途 |
|---|---|---|
| `electron` | `43.4.0` | 桌面应用框架（自带 Node 运行时） |
| `electron-builder` | `26.0.12` | 跨平台打包工具 |

## 目录结构

```
deepseek-harness-desktop/
├── package.json            # ESM 项目配置，无构建步骤
├── electron-builder.yml    # 打包配置（dmg / nsis / AppImage+deb）
├── settings-preload.cjs    # 设置窗口的 preload 桥接（CJS）
├── README.md               # 本文档
├── src/
│   ├── main.js             # 主进程入口：单实例锁 / 生命周期 / 组装 / 皮肤集成
│   ├── window.js           # 主窗口：创建 / 选项 / 显示 / 链接拦截 / 关闭到托盘
│   ├── tray.js             # 系统托盘：图标 / 右键菜单（含设置入口）/ 点击唤出
│   ├── dsh-service.js      # dsh 子进程：启动配置 / 就绪检测 / 退出回收
│   ├── store.js            # 用户设置持久化（背景/字体颜色/预设方案）
│   ├── skin-manager.js     # 背景与字体颜色 CSS 注入（insertCSS）
│   ├── settings-window.js  # 独立设置窗口 + IPC 处理
│   └── startup.html        # 干净的加载页（服务就绪前显示）
├── settings/               # 设置窗口界面
│   ├── settings.html       # 设置页（背景图库 / 颜色选择器 / 配色方案）
│   ├── settings.css        # 设置页样式（深色主题，响应式）
│   └── settings.js         # 设置页逻辑（实时预览 + IPC 通信）
├── assets/                 # 图标资源
│   ├── icon.png            # 应用图标（512×512）
│   ├── icon.icns           # macOS 图标
│   ├── icon.ico            # Windows 图标
│   ├── tray.png            # 托盘图标（普通）
│   └── trayTemplate.png    # 托盘图标（macOS template，自适应深浅色）
└── scripts/
    └── gen-icons.js         # 零依赖生成鲸鱼主题图标
```

**模块划分说明**：参考 `steven-kid/deepseek-harness-desktop` 的结构，按职责拆分——`window.js` 管窗口、`tray.js` 管托盘、`dsh-service.js` 管 dsh 子进程、`store.js` 管设置持久化、`skin-manager.js` 管 CSS 注入、`settings-window.js` 管设置窗口、`main.js` 只做入口与组装，各模块单一职责、互不耦合。

## 安装步骤

### 方式一：直接使用安装包（推荐，最终用户）

1. 前往 [Releases](https://github.com/67-qingshui/deepseek-harness-desktop/releases) 下载对应平台的安装包：
   - macOS：`DeepSeek-Harness-Desktop-1.0.0-arm64.dmg`
   - Windows：`DeepSeek-Harness-Desktop-1.0.0-setup.exe`
   - Linux：`DeepSeek-Harness-Desktop-1.0.0.AppImage`
2. 安装并打开即可，无需任何额外环境。

> macOS 未做 Apple 公证，首次打开需在「系统设置 → 隐私与安全性」中点击「仍要打开」。

### 方式二：从源码运行（开发者）

```bash
# 1. 克隆仓库
git clone https://github.com/67-qingshui/deepseek-harness-desktop.git
cd deepseek-harness-desktop

# 2. 安装依赖（electron 与 dsh 体积较大，请耐心等待）
npm install

# 3.（可选）生成图标（assets/ 下已附带，可跳过）
npm run icons

# 4. 启动应用
npm start
```

## 使用说明

启动后会先显示加载页，几秒内 DeepSeek Harness 服务就绪后自动载入 Web UI。

| 操作 | 行为 |
|---|---|
| 关闭窗口 | 最小化到系统托盘（不退出） |
| 点击托盘图标 | 唤出主窗口 |
| 右键托盘 → 显示窗口 | 唤出主窗口 |
| 右键托盘 → 隐藏窗口 | 隐藏主窗口 |
| 右键托盘 → 设置… | 打开自定义外观设置（背景 / 字体颜色） |
| `⌘ ,`（macOS） | 打开自定义外观设置 |
| 右键托盘 → 退出 | 退出应用（回收 dsh 子进程） |
| 再次打开应用 | 唤出已有窗口（单实例） |
| macOS Dock 点击 | 唤出主窗口 |

应用仅监听 `127.0.0.1` 回环地址，外部网络不可达；所有跨域跳转会交给系统浏览器打开，壳内只渲染 Harness。

## 配置参数说明

### 环境变量

| 变量 | 说明 | 默认 |
|---|---|---|
| `DHD_SMOKE` | 设为 `1` 时进入冒烟模式：仅验证 GUI 壳（窗口+加载页）能启动，不拉起 dsh，4 秒后自动退出。用于 CI / 自动化验证。 | 未设置 |
| `DSH_DESKTOP` | 传给 dsh 子进程的标记变量，标识运行于桌面壳环境。 | `1` |

### 可调整的源码常量

| 文件 | 常量 | 说明 | 默认值 |
|---|---|---|---|
| `src/main.js` | `APP_NAME` | 应用名称（托盘 tooltip、对话框标题） | `'DeepSeek Harness'` |
| `src/window.js` | `width` / `height` | 主窗口默认尺寸 | `1280` × `820` |
| `src/window.js` | `minWidth` / `minHeight` | 主窗口最小尺寸 | `860` × `600` |
| `src/dsh-service.js` | `READY_TIMEOUT_MS` | dsh 就绪等待超时 | `120000`（120s） |

### dsh 启动命令

dsh 的启动命令由 `src/dsh-service.js` 的 `buildDshLaunch()` 构造：

- **默认（内嵌模式）**：`process.execPath <dsh/bin.js> web --host 127.0.0.1 --port 0`
  - 用应用自带 Electron 跑内嵌 dsh，无需系统 Node。
- **回退（系统模式）**：`npx @deepseek-ai/dsh web --host 127.0.0.1 --port 0`
  - 仅当内嵌 dsh 缺失时使用，需系统 Node + 首次联网。

如需改用本机已安装的 dsh，编辑 `buildDshLaunch()` 返回值即可，例如：
```js
return { command: 'dsh', args: ['web', '--host', '127.0.0.1'] }
```

## 构建部署

### 前置检查

```bash
# 语法检查所有源文件
npm run check
```

### 各平台打包

```bash
# macOS（Apple Silicon，产出 dmg + zip）
npm run dist:mac

# Windows（x64，nsis 安装包）
npm run dist:win

# Linux（x64，AppImage + deb）
npm run dist:linux

# 当前平台（自动检测）
npm run dist
```

产物输出到 `release/` 目录。打包配置见 `electron-builder.yml`。

### 关键打包配置

- `asar: true`：应用代码打包为 asar，提升加载速度。
- `asarUnpack: node_modules/@deepseek-ai/dsh/**/*`：dsh 解包到 `app.asar.unpacked`，因其作为子进程入口被 `spawn` 执行，需在真实文件系统上（规避 asar 边界问题）。
- `hardenedRuntime: false` / 未公证：无 Apple 开发者证书时跳过签名，首次打开需手动放行。

### 冒烟测试（CI 集成用）

```bash
# 验证 GUI 壳能启动并渲染加载页，不依赖 dsh
npm run smoke
```

## 常见问题

**Q：应用真的完全不需要系统 Node 吗？**
A：是的。运行时由应用自带的 Electron 二进制直接执行内嵌的 `dsh`（`@deepseek-ai/dsh/lib/bin.js`），不调用系统的 `node` / `npx`。仅在你从源码开发或打包时才需要本机 Node.js ≥ 18。

**Q：启动时提示「DeepSeek Harness 无法启动」？**
A：可能是内嵌 dsh 初始化失败（端口被占用、权限受限等）。对话框会显示 dsh 的最近输出，据此定位；也可检查 `src/dsh-service.js` 的 `buildDshLaunch()` 与就绪超时 `READY_TIMEOUT_MS`。

**Q：macOS 提示「无法验证开发者」？**
A：这是未公证所致。前往「系统设置 → 隐私与安全性」，在拦截条目下点击「仍要打开」，通常只需一次。

**Q：关闭窗口后应用还在运行吗？**
A：是的。关闭窗口会最小化到系统托盘，应用与 dsh 服务继续在后台运行。从托盘「退出」才会真正退出。如不希望驻留，可右键托盘 → 退出。

**Q：如何改用本机已安装的 dsh 而非内嵌版本？**
A：编辑 `src/dsh-service.js` 的 `buildDshLaunch()` 返回值，例如改为 `{ command: 'dsh', args: ['web', '--host', '127.0.0.1'] }`（需系统已 `npm i -g @deepseek-ai/dsh`）。

**Q：支持哪些平台？**
A：macOS（arm64，Apple Silicon）、Windows（x64）、Linux（x64）。其他架构需自行调整 `electron-builder.yml` 的 `arch`。

## License

MIT
