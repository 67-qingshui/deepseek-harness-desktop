# DeepSeek Harness Desktop

> 一个把 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的 Web UI 装进原生桌面窗口的极简客户端——自动启停本地服务、开箱即用，支持自定义背景与字体颜色、Token 用量统计。

**当前版本**：v2.0.0 · **License**：MIT · **平台**：macOS (Apple Silicon) / Windows x64 / Linux x64

**仓库**：https://github.com/67-qingshui/deepseek-harness-desktop

---

## 目录

1. [项目概述与背景说明](#1-项目概述与背景说明)
2. [核心功能与特性描述](#2-核心功能与特性描述)
3. [安装与使用方法](#3-安装与使用方法)
4. [配置说明](#4-配置说明)
5. [版本更新日志](#5-版本更新日志)
6. [已知问题与限制](#6-已知问题与限制)
7. [后续开发计划](#7-后续开发计划)

---

## 1. 项目概述与背景说明

### 1.1 创建背景

[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（`dsh`）是 DeepSeek 官方提供的本地 AI 编码辅助服务，通过命令行 `dsh web` 启动一个运行在 `127.0.0.1` 的 Web UI。然而，原生使用方式存在若干不便：

- **依赖命令行**：用户需要打开终端、手动执行 `npx @deepseek-ai/dsh web`，并保持终端窗口开启，关闭终端即服务停止。
- **浏览器标签页混杂**：Harness 的 Web UI 运行在普通浏览器标签页中，容易与其他网页混淆，难以快速切换。
- **环境配置门槛**：首次使用需确保系统已安装 Node.js 与 npm，并通过 `npx` 联网下载 `dsh` 包，对非开发者用户不友好。
- **缺乏个性化与用量感知**：原生 Web UI 无法自定义外观，也无法直观了解 Token 消耗与费用情况。

### 1.2 目标定位

DeepSeek Harness Desktop 旨在解决上述痛点，定位为**极简、轻量、好用的桌面宿主壳**：

- 把 Harness Web UI 装进原生桌面窗口，提供独立、专注的使用体验。
- 自动管理 dsh 子进程的生命周期（启动、就绪检测、退出回收），用户无需触碰命令行。
- 将 `@deepseek-ai/dsh` 作为依赖**内嵌**进应用，由应用自带的 Electron 运行时执行——**最终用户无需预装 Node.js**，下载安装包后开箱即用。
- 在不改写 Harness 本身代码的前提下，通过 CSS 注入提供背景与字体颜色自定义能力。
- 自动采集 API 响应中的 Token 用量，参考官方计费规则统计与可视化。

### 1.3 解决的痛点

| 痛点 | 本项目的解决方案 |
|---|---|
| 依赖命令行启动 | 双击应用图标即自动拉起 dsh 服务，关闭窗口缩到托盘而非退出 |
| 浏览器标签混杂 | 独立原生窗口，单实例，随时从托盘唤出 |
| 需预装 Node.js | dsh 内嵌进应用，由 Electron 自带 Node 运行，零环境依赖 |
| 首次需联网下载 | 安装包已含 dsh，离线可用 |
| 无法自定义外观 | 独立设置窗口，自定义背景图片与字体颜色，实时生效 |
| 不了解 Token 消耗 | 自动统计输入/输出 Token、缓存命中率、估算费用，可视化图表 |

### 1.4 设计理念

- **简单**：不堆砌功能，聚焦核心宿主能力与必要的个性化、统计能力。
- **轻量**：纯 ESM，零构建步骤，依赖极少（仅 `tree-kill` + 内嵌 `dsh`）。
- **好用**：开箱即用、交互直观、设置实时生效、用量自动采集。
- **不侵入**：不修改 Harness 本身代码，所有自定义通过 CSS 注入叠加，可随时关闭恢复原样。

### 1.5 参考与致谢

项目架构参考了 [steven-kid/deepseek-harness-desktop](https://github.com/steven-kid/deepseek-harness-desktop) 的整体结构与实现思路（子进程生命周期、就绪检测、单实例窗口、托盘交互），在此基础上做了自包含 dsh、模块化拆分、外观自定义与用量统计的扩展。

---

## 2. 核心功能与特性描述

### 2.1 自包含运行时

`@deepseek-ai/dsh` 作为生产依赖打包进应用，运行时由应用自带的 Electron 二进制（`process.execPath`）直接执行 dsh 的 `lib/bin.js`，无需调用系统 `node` / `npx`，首次启动也不联网下载。

- dsh 通过 `asarUnpack` 解包到 `app.asar.unpacked`，规避 asar 内脚本被 `spawn` 执行的边界问题。
- 启动命令：`<electron> <dsh/bin.js> web --host 127.0.0.1 --port 0`（`web` 子命令形式，避免根命令变参吞噬参数）。

### 2.2 自动启停服务

- **启动**：应用启动时以子进程方式拉起 dsh，仅监听 `127.0.0.1` 回环地址，外部网络不可达。
- **就绪检测**：从子进程 stdout 解析 `dsh web: http://127.0.0.1:<port>`，服务就绪后自动载入 Web UI；就绪前显示干净加载页，无白屏闪烁。
- **退出回收**：退出时通过 `tree-kill` 以 SIGTERM 回收整棵子进程树，避免 dsh 衍生的子进程残留。
- **超时保护**：等待就绪超过 120 秒判定失败，弹出含 dsh 输出的诊断对话框。

### 2.3 窗口与交互

- **单实例窗口**：重复打开应用只会唤出已有窗口，不会启动多份。
- **关闭到托盘**：关闭窗口 = 最小化到系统托盘（不退出），从托盘可随时唤出或退出。
- **macOS 原生标题栏**：隐藏原生标题栏，用叠加控件呈现干净工具条，与系统深浅色自适应。
- **安全沙箱**：渲染进程 `contextIsolation: true` + `sandbox: true` + 禁用 Node 集成；新窗口与跨域跳转一律交给系统浏览器，壳内只渲染 Harness。
- **外部链接拦截**：`will-navigate` 与 `setWindowOpenHandler` 拦截跨域导航，交给系统浏览器打开。

### 2.4 自定义背景图片（v1.1.0+）

通过独立设置窗口配置，**变更实时生效**，不破坏 Harness 原有布局。

| 能力 | 说明 |
|---|---|
| 上传本地图片 | 支持 jpg/png/webp/gif/bmp，自动复制到 `userData/backgrounds/` 自包含管理 |
| 预设渐变图库 | 6 套纯 CSS 渐变（深海/极光/日落/森林/墨黑/雅紫），零二进制依赖 |
| 自动适配分辨率 | `background-size: cover` + `background-position: center`，任意屏幕均正确显示 |
| 不透明度调节 | 0–100%，控制背景可见度 |
| 模糊调节 | 0–40px，背景高斯模糊 |

技术实现：通过 `webContents.insertCSS` 注入 `body::before` 伪元素作为背景层（`position:fixed; inset:0; z-index:-1`），不遮挡内容。每次注入前先移除旧注入，避免叠加。

### 2.5 自定义字体颜色（v1.1.0+）

| 能力 | 说明 |
|---|---|
| 自由调色 | 原生颜色选择器（`input[type=color]`），任意 HEX 值 |
| 预设颜色方案 | 7 套（浅霜白/暖白/青绿/天蓝/淡紫/琥珀/玫红） |
| 快速配色方案 | 一键切换协调的「背景渐变 + 字体颜色」组合 |

技术实现：`insertCSS` 覆盖 `body` 及常见文本元素颜色。

### 2.6 Token 用量统计（v2.0.0）

参考 [DeepSeek API 官方计费规则](https://api-docs.deepseek.com/zh-cn/quick_start/pricing)，自动采集 API 响应中的 `usage` 字段，确保统计与官方标准一致。

**采集字段**（OpenAI 兼容 + DeepSeek 扩展）：

| 字段 | 说明 |
|---|---|
| `prompt_tokens` | 总输入 Token（= 缓存命中 + 缓存未命中） |
| `completion_tokens` | 输出 Token |
| `prompt_cache_hit_tokens` | 缓存命中输入 Token（计费更低） |
| `prompt_cache_miss_tokens` | 缓存未命中输入 Token（正常计费） |
| `total_tokens` | = prompt_tokens + completion_tokens |

**计费单价**（元/百万 Tokens，用于估算）：

| 模型 | 输入(缓存命中) | 输入(缓存未命中) | 输出 |
|---|---|---|---|
| deepseek-v4-flash | 0.02 | 1 | 2 |
| deepseek-v4-pro | 0.025 | 3 | 6 |

**展示能力**：

- **累计汇总**：调用次数、总输入/输出 Tokens、缓存命中率、估算费用
- **折线图**：近 50 次调用的输入/输出 Token 趋势
- **柱状图**：缓存命中输入 / 缓存未命中输入 / 输出 占比
- **明细列表**：最近 20 次调用的详细记录
- **实时刷新**：每 5 秒自动刷新

技术实现：注入 `usage-inject.cjs` 到 Harness 页面，重写 `fetch` 与 `XMLHttpRequest`，解析响应中的 `usage`（兼容 JSON 与 SSE 流式），通过 `postMessage` → `main-preload.cjs` → IPC 上报主进程，写入 `store`，用量窗口读取展示。

### 2.7 跨平台与零构建

- **跨平台**：macOS arm64 / Windows x64 / Linux x64，同一套代码。
- **零构建步骤**：纯 ESM（`type: module`），`electron .` 直接运行源码，无需 TypeScript 编译或打包。
- **模块化**：8 个主进程模块 + 4 个 preload + 3 个界面目录，单一职责、互不耦合。

---

## 3. 安装与使用方法

### 3.1 环境依赖

| 场景 | 要求 |
|---|---|
| **运行已安装的应用** | 无需任何环境。安装包自带 Electron 运行时与内嵌 dsh，开箱即用。 |
| **开发 / 打包** | Node.js ≥ 18、npm（用于 `npm install` 与 `electron-builder`） |
| **macOS 构建** | Apple Silicon Mac（产出 arm64 dmg） |
| **Windows / Linux 构建** | 对应平台 x64 环境 |

> 说明：仅开发与打包时需要本机 Node.js；打包后的安装包自带运行时，最终用户无需预装 Node.js。

### 3.2 安装步骤

#### 方式一：使用预编译安装包（推荐，最终用户）

1. 前往 [Releases](https://github.com/67-qingshui/deepseek-harness-desktop/releases) 下载对应平台安装包：
   - macOS：`DeepSeek-Harness-Desktop-2.0.0-arm64.dmg`
   - Windows：`DeepSeek-Harness-Desktop-2.0.0-setup.exe`（需自行打包）
   - Linux：`DeepSeek-Harness-Desktop-2.0.0.AppImage`（需自行打包）
2. macOS：双击 dmg 挂载，拖入 Applications；Windows：运行 exe 安装；Linux：赋予执行权限后运行 AppImage。
3. 打开应用即可，无需任何额外环境。

> macOS 未做 Apple 公证，首次打开需在「系统设置 → 隐私与安全性」中点击「仍要打开」。

#### 方式二：从源码运行（开发者）

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

### 3.3 基础使用流程

1. **启动**：打开应用，先显示加载页，几秒内 dsh 服务就绪后自动载入 Harness Web UI。
2. **使用**：在 Harness Web UI 中正常进行 AI 编码辅助操作。
3. **自定义外观**（可选）：托盘右键 → 「设置…」，或 macOS 按 `⌘ ,`，选择背景图片与字体颜色，实时生效。
4. **查看用量**（可选）：托盘右键 → 「用量统计…」，查看 Token 累计汇总与图表。
5. **关闭**：关闭窗口会最小化到托盘（不退出）；从托盘「退出」才会真正退出并回收 dsh 子进程。

### 3.4 操作速查

| 操作 | 行为 |
|---|---|
| 关闭窗口 | 最小化到系统托盘（不退出） |
| 点击托盘图标 | 唤出主窗口 |
| 右键托盘 → 显示窗口 | 唤出主窗口 |
| 右键托盘 → 隐藏窗口 | 隐藏主窗口 |
| 右键托盘 → 设置… | 打开自定义外观设置 |
| 右键托盘 → 用量统计… | 打开 Token 用量统计 |
| `⌘ ,`（macOS） | 打开自定义外观设置 |
| 右键托盘 → 退出 | 退出应用（回收 dsh 子进程） |
| 再次打开应用 | 唤出已有窗口（单实例） |

---

## 4. 配置说明

### 4.1 环境变量

| 变量 | 作用 | 默认值 | 使用示例 |
|---|---|---|---|
| `DHD_SMOKE` | 设为 `1` 进入冒烟模式：仅验证 GUI 壳能启动，不拉起 dsh，4 秒后自动退出。用于 CI/自动化。 | 未设置 | `DHD_SMOKE=1 npm start` |
| `DSH_DESKTOP` | 传给 dsh 子进程的标记变量，标识运行于桌面壳环境。 | `1` | — |
| `ELECTRON_DISABLE_SANDBOX` | 禁用 Chromium 沙箱（仅沙箱受限环境用，正常无需设置）。 | 未设置 | — |

### 4.2 用户设置（持久化于 `userData/settings.json`）

设置通过设置窗口配置，持久化在 `userData/settings.json`（macOS：`~/Library/Application Support/DeepSeek Harness/settings.json`）。

```json
{
  "background": {
    "type": "preset",
    "preset": "deep-sea",
    "image": "",
    "opacity": 0.85,
    "blur": 0
  },
  "textColor": {
    "enabled": true,
    "color": "#cfe1f5"
  },
  "presetScheme": "deep-sea",
  "usage": {
    "records": [
      { "ts": 1723836800000, "model": "deepseek-v4-flash", "prompt": 120, "completion": 80, "cacheHit": 60, "cacheMiss": 60, "total": 200 }
    ]
  }
}
```

| 配置项 | 作用范围 | 默认值 | 说明 |
|---|---|---|---|
| `background.type` | 背景类型 | `"none"` | `none` / `preset` / `image` |
| `background.preset` | 预设渐变方案 | `"deep-sea"` | `deep-sea`/`aurora`/`sunset`/`forest`/`mono-dark`/`royal` |
| `background.image` | 本地图片路径 | `""` | type=image 时生效，指向 `userData/backgrounds/` 内文件 |
| `background.opacity` | 背景不透明度 | `0.85` | 0–1 |
| `background.blur` | 背景模糊半径 | `0` | 0–40 px |
| `textColor.enabled` | 是否启用自定义字体颜色 | `false` | boolean |
| `textColor.color` | 字体颜色 | `"#e8eef7"` | HEX 值 |
| `presetScheme` | 快速配色方案标识 | `""` | 空字符串=默认，否则为预设 id |
| `usage.records` | Token 用量记录数组 | `[]` | 每条含 ts/model/prompt/completion/cacheHit/cacheMiss/total，最多 5000 条 |

### 4.3 源码常量（可调整）

| 文件 | 常量 | 默认值 | 说明 |
|---|---|---|---|
| `src/main.js` | `APP_NAME` | `'DeepSeek Harness'` | 应用名称（托盘 tooltip、对话框标题） |
| `src/window.js` | `width` / `height` | `1280` × `820` | 主窗口默认尺寸 |
| `src/window.js` | `minWidth` / `minHeight` | `860` × `600` | 主窗口最小尺寸 |
| `src/dsh-service.js` | `READY_TIMEOUT_MS` | `120000` | dsh 就绪等待超时（毫秒） |
| `src/usage-tracker.js` | `PRICING` | 见 2.6 节 | 各模型计费单价表（元/百万 Tokens） |
| `src/store.js` | records 上限 | `5000` | 用量记录最大条数，超出自动裁剪 |

### 4.4 dsh 启动命令

dsh 的启动命令由 `src/dsh-service.js` 的 `buildDshLaunch()` 构造：

- **默认（内嵌模式）**：`process.execPath <dsh/bin.js> web --host 127.0.0.1 --port 0`
  - 用应用自带 Electron 跑内嵌 dsh，无需系统 Node。
- **回退（系统模式）**：`npx @deepseek-ai/dsh web --host 127.0.0.1 --port 0`
  - 仅当内嵌 dsh 缺失时使用，需系统 Node + 首次联网。

如需改用本机已安装的 dsh，编辑 `buildDshLaunch()` 返回值：
```js
return { command: 'dsh', args: ['web', '--host', '127.0.0.1'] }
```

### 4.5 打包配置（`electron-builder.yml`）

| 配置项 | 值 | 说明 |
|---|---|---|
| `appId` | `com.deepseekharness.desktop` | 应用唯一标识 |
| `productName` | `DeepSeek Harness Desktop` | 显示名称 |
| `asar` | `true` | 代码打包为 asar |
| `asarUnpack` | `node_modules/@deepseek-ai/dsh/**/*` | dsh 解包到 app.asar.unpacked（供 spawn 执行） |
| `files` | src/ settings/ usage/ assets/ *.cjs package.json | 打包内容 |
| `mac.target` | dmg + zip (arm64) | macOS 产物 |
| `win.target` | nsis | Windows 安装包 |
| `linux.target` | AppImage + deb | Linux 产物 |
| `hardenedRuntime` | `false` | 未签名，跳过 hardened runtime |

---

## 5. 版本更新日志

按时间倒序排列。完整记录另见 [CHANGELOG.md](CHANGELOG.md)。

### v2.0.0 — 2026-08-18（大版本更新）

**🎉 新增：Token 用量统计**

- 自动采集 DeepSeek API 响应中的 `usage` 字段，参考官方计费规则统计
- 采集 `prompt_tokens` / `completion_tokens` / `prompt_cache_hit_tokens` / `prompt_cache_miss_tokens`
- 累计汇总：调用次数、总输入/输出、缓存命中率、估算费用
- 可视化：折线图（趋势）、柱状图（占比）、明细列表
- 实时采集（hook fetch/XHR）+ 5 秒自动刷新
- **BREAKING CHANGE**：主版本号 1.x → 2.0.0

新增模块：`usage-tracker.js` / `usage-inject.cjs` / `main-preload.cjs` / `usage-window.js` / `usage/` / `usage-preload.cjs`

### v1.1.0 — 2026-08-18

**新增：自定义背景图片与字体颜色**

- 自定义背景图片：上传本地图片 / 6 套预设渐变图库，可调不透明度与模糊
- 自定义字体颜色：颜色选择器自由调色 / 7 套预设方案
- 快速配色方案：一键切换协调组合
- 独立设置窗口，实时生效

新增模块：`store.js` / `skin-manager.js` / `settings-window.js` / `settings/` / `settings-preload.cjs`

### v1.0.0 — 2026-08-18

**首个正式版**

- 极简桌面壳，自动启停本地 DeepSeek Harness 服务
- 自包含运行时（内嵌 dsh，无需系统 Node.js）
- 单实例窗口、关闭到托盘、安全沙箱、跨平台
- 模块：`main.js` / `window.js` / `tray.js` / `dsh-service.js`

---

## 6. 已知问题与限制

### 6.1 兼容性限制

- **macOS 预编译包仅 arm64**：当前 Release 仅提供 Apple Silicon (arm64) 的 dmg。Intel Mac 及 Windows/Linux 用户需从源码自行打包（`npm run dist:mac -- --x64` / `dist:win` / `dist:linux`）。
- **Node.js 版本**：开发/打包需 Node.js ≥ 18；运行已安装的应用无此要求。
- **dsh 版本依赖**：内嵌 `@deepseek-ai/dsh@0.1.0-rc.7` 为预发布版本，dsh 自身可能快速演进，偶发兼容性问题需关注上游更新。

### 6.2 使用约束

- **未做 Apple 公证**：macOS 安装包未签名未公证，首次打开需在「系统设置 → 隐私与安全性」手动放行「仍要打开」。后续不再提示。
- **仅监听回环地址**：dsh 服务绑定 `127.0.0.1`，外部网络不可达，无法作为远程服务使用。
- **用量统计为估算**：Token 费用估算基于文档记载的官方单价，实际计费以 DeepSeek 官方账单为准；价格可能变动。
- **用量采集依赖 API 响应格式**：若 dsh 代理层改变了响应结构或未透传 `usage` 字段，采集可能失效。
- **背景字体颜色为全局覆盖**：字体颜色通过 `insertCSS` 覆盖 `body` 及文本元素，可能影响部分 Harness UI 元素的可读性，可随时关闭恢复。

### 6.3 已知缺陷

- **路径含空格时原生模块构建警告**：项目路径含空格（如 `DeepSeek Harness`）时，`node-pty` 原生模块构建会打印警告，但不影响最终打包结果。
- **沙箱环境限制**：在无显示器或 Chromium 沙箱受限的 CI 环境中，需用 `--no-sandbox` 或 `ELECTRON_DISABLE_SANDBOX=1` 才能启动；真实桌面环境无此问题。
- **单实例锁残留**：异常退出后偶发单实例锁残留，需结束遗留 Electron 进程后重启。

---

## 7. 后续开发计划

### 7.1 近期计划

- **多平台预编译包**：在 Release 中提供 Windows x64 与 Linux x64 的预编译安装包，免去用户自行打包。
- **用量数据导出**：支持将 Token 用量记录导出为 CSV/JSON，便于进一步分析或对账。
- **用量按模型分组**：统计图表支持按模型（flash/pro）分组展示，细化费用构成。
- **背景图片管理**：设置窗口中管理已上传的背景图片列表（查看、删除、切换）。

### 7.2 中期计划

- **Apple 公证**：接入 Apple Developer ID 签名与公证，消除首次打开的拦截提示。
- **自动更新**：集成 `electron-updater`，支持应用自更新检查与后台下载安装。
- **快捷键自定义**：允许用户自定义打开设置、用量统计等功能的快捷键。
- **多语言支持**：界面国际化（中/英），适配更多用户。

### 7.3 长期方向

- **用量预算与告警**：设定 Token 用量或费用阈值，超出时桌面通知提醒。
- **会话级用量分析**：按会话/项目维度统计 Token 消耗，辅助成本归因。
- **主题市场**：内置更多预设背景与配色方案，支持导入/导出主题包。
- **插件机制**：开放 CSS 注入接口，允许第三方扩展外观与行为。

### 7.4 持续维护

- 跟踪 `@deepseek-ai/dsh` 上游版本，及时升级内嵌依赖。
- 跟踪 DeepSeek API 计费规则变动，同步更新 `PRICING` 表。
- 跟踪 Electron 版本，保持与最新稳定版兼容。

---

## 相关文档

- [版本选择指南](VERSIONS.md)：v1.0.0 纯净版 vs v1.1.0 DIY 背景版的对比与下载
- [更新日志](CHANGELOG.md)：完整的版本变更记录
- [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)：上游项目
- [DeepSeek API 定价](https://api-docs.deepseek.com/zh-cn/quick_start/pricing)：官方计费规则

---

*MIT License · 非官方社区封装，与 DeepSeek 官方无关联*
