# DeepSeek Harness Desktop

把 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的 Web UI 装进原生桌面窗口——自动启停本地服务，**开箱即用，无需预装 Node.js**。支持自定义背景与字体颜色、Token 用量统计。

---

## 下载

三个版本均可**独立使用**，任选其一。高版本包含低版本全部功能。

| 版本 | 特色 | 下载 |
|---|---|---|
| **v1.0.0 纯净版** | 极简宿主壳，零自定义 | [⬇ dmg](https://github.com/67-qingshui/deepseek-harness-desktop/releases/download/v1.0.0/DeepSeek-Harness-Desktop-1.0.0-arm64.dmg) |
| **v1.1.0 DIY 背景版** | 自定义背景图片与字体颜色 | [⬇ dmg](https://github.com/67-qingshui/deepseek-harness-desktop/releases/download/v1.1.0/DeepSeek-Harness-Desktop-1.1.0-arm64.dmg) |
| **v2.0.0 用量统计版** | 在 v1.1.0 基础上增加 Token 用量统计 | [⬇ dmg](https://github.com/67-qingshui/deepseek-harness-desktop/releases/download/v2.0.0/DeepSeek-Harness-Desktop-2.0.0-arm64.dmg) |

> macOS 未公证，首次打开需在「系统设置 → 隐私与安全性」点击「仍要打开」。不确定选哪个就下 **v2.0.0**。

---

## 核心功能

**所有版本共有**
- **自包含运行时**——dsh 内嵌进应用，由自带 Electron 运行，无需系统 Node，离线可用
- **自动启停**——启动拉起 dsh（仅 `127.0.0.1`），退出 tree-kill 回收子进程树
- **单实例 + 关闭到托盘**——重复打开只唤出已有窗口；关窗缩到托盘不退出
- **安全沙箱**——contextIsolation + sandbox，跨域跳转走系统浏览器

**v1.1.0+ 新增**
- **自定义背景**——上传本地图片 / 6 套预设渐变，可调不透明度与模糊，自动适配分辨率
- **自定义字体颜色**——颜色选择器自由调色 / 7 套预设方案
- **快速配色**——一键切换协调的背景+字体组合
- 入口：托盘「设置…」或 `⌘ ,`，实时生效

**v2.0.0 新增**
- **Token 用量统计**——自动采集 API 响应 `usage` 字段（参考[官方计费规则](https://api-docs.deepseek.com/zh-cn/quick_start/pricing)）
- 统计输入/输出/缓存命中 Token、调用次数、缓存命中率、估算费用
- 可视化：折线图趋势 + 柱状图占比 + 明细列表，5 秒自动刷新
- 入口：托盘「用量统计…」

---

## 快速开始

### 安装

下载 dmg → 拖入 Applications → 打开。无需任何环境。

从源码开发：`git clone` → `npm install` → `npm start`（需 Node.js ≥ 18）。

### 首次使用（必读）

**需先配置 API Key 才能调用模型功能：**

1. 在 [DeepSeek 开放平台](https://platform.deepseek.com) 创建 API Key（`sk-` 开头，仅创建时单次展示，立即保存）
2. 打开本应用，在 Harness Web UI 的**设置页**填入 API Key

> **安全说明**：API Key 由 dsh 在本地管理，本客户端**不收集、不存储、不上传** Key 内容，对开发者不可见。
>
> **多客户端**：同一账号的 Key 可在多个客户端直接使用，无需重复添加。建议按客户端分别创建 Key 并标记名称（如 `desktop-mac`），方便官方后台按渠道统计用量。

---

## 配置

用户设置持久化于 `userData/settings.json`，通过设置窗口配置。

| 配置项 | 默认值 | 说明 |
|---|---|---|
| `background.type` | `none` | 背景类型：`none`/`preset`/`image` |
| `background.opacity` | `0.85` | 不透明度 0–1 |
| `background.blur` | `0` | 模糊 0–40px |
| `textColor.enabled` | `false` | 是否启用自定义字体颜色 |
| `usage.records` | `[]` | Token 用量记录（最多 5000 条） |

dsh 启动命令（`src/dsh-service.js` 的 `buildDshLaunch()`）：默认用应用自带 Electron 跑内嵌 dsh，无需系统 Node。

---

## 版本日志

| 版本 | 日期 | 变更 |
|---|---|---|
| **v2.0.0** | 2026-08-18 | Token 用量统计（大版本号升级） |
| **v1.1.0** | 2026-08-18 | 自定义背景图片与字体颜色 |
| **v1.0.0** | 2026-08-18 | 首个正式版，极简宿主壳 |

完整变更见 [CHANGELOG.md](CHANGELOG.md)。

---

## 已知限制

- macOS 预编译包仅 arm64；Windows/Linux 需从源码打包
- 未做 Apple 公证，首次打开需手动放行
- 用量费用为估算，以官方账单为准
- 内嵌 dsh 为预发布版（`0.1.0-rc.7`），可能随上游演进

---

## 模块结构

```
src/        main.js · window.js · tray.js · dsh-service.js
            store.js · skin-manager.js · settings-window.js
            usage-tracker.js · usage-window.js
settings/   设置窗口界面
usage/      用量统计界面
*.cjs       preload 桥接（settings/main/usage-inject/usage）
```

---

*MIT License · 非官方社区封装，与 DeepSeek 官方无关联*

*本文档随官方更新与功能迭代持续同步，如有过时请[反馈](https://github.com/67-qingshui/deepseek-harness-desktop/issues)。*
