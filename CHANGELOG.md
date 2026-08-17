# 更新日志

所有重要变更记录于此文件。版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [2.0.0] — 2026-08-18

### 🎉 大版本更新：Token 用量统计

新增**自动计算 Token 用量**功能，参考 [DeepSeek API 官方计费规则](https://api-docs.deepseek.com/zh-cn/quick_start/pricing)，确保统计与官方标准一致。

#### 新增功能

- **每次 API 调用 Token 统计**：自动采集输入 Token 数（`prompt_tokens`）与输出 Token 数（`completion_tokens`），区分缓存命中（`prompt_cache_hit_tokens`）与缓存未命中（`prompt_cache_miss_tokens`）
- **累计用量汇总**：调用次数、总输入/输出 Tokens、缓存命中率、估算费用（按官方单价计算）
- **用量可视化**：
  - 折线图：近 50 次调用的输入/输出 Token 趋势
  - 柱状图：缓存命中输入 / 缓存未命中输入 / 输出 占比
  - 最近调用明细列表
- **实时采集**：通过注入 hook 拦截 API 响应中的 `usage` 字段，自动统计，无需手动操作
- **独立用量窗口**：托盘菜单「用量统计…」打开，5 秒自动刷新

#### 计费规则（参考官方）

| 计费项 | 单价（元/百万 Tokens） |
|---|---|
| 输入（缓存命中） | 0.02（flash）/ 0.025（pro） |
| 输入（缓存未命中） | 1（flash）/ 3（pro） |
| 输出 | 2（flash）/ 6（pro） |

> 估算费用仅供参考，以官方账单为准。价格可能变动，详见官方定价页。

#### 技术实现

- `src/usage-tracker.js`：用量采集管理器 + 费用估算（PRICING 表）
- `usage-inject.cjs`：注入 Harness 页面的 hook 脚本（重写 fetch/XMLHttpRequest，解析 JSON 与 SSE 流式响应中的 usage）
- `main-preload.cjs`：主窗口 preload，转发 usage 上报（contextIsolation 下跨世界 postMessage → IPC）
- `src/usage-window.js` + `usage/`：用量统计窗口 + canvas 可视化界面
- `store.js` 扩展：用量记录持久化（userData/settings.json，最多 5000 条）

#### 变更类型

- **重大版本号升级**：1.x → 2.0.0（major version bump，新增核心计费统计能力）

---

## [1.1.0] — 2026-08-18

### 自定义背景图片与字体颜色

- 自定义背景图片：上传本地图片（jpg/png/webp/gif）/ 6 套预设渐变图库，可调不透明度与模糊
- 自定义字体颜色：颜色选择器自由调色 / 7 套预设方案
- 快速配色方案：一键切换协调的「背景 + 字体颜色」组合
- 独立设置窗口，实时生效

---

## [1.0.0] — 2026-08-18

### 首个正式版

- 极简桌面壳，自动启停本地 DeepSeek Harness 服务
- 自包含运行时（内嵌 dsh，无需系统 Node.js）
- 单实例窗口、关闭到托盘、安全沙箱、跨平台
