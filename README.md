# DeepSeek Harness Desktop

极简桌面壳：把 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的 Web UI 装进原生窗口，**自动启停本地服务、开箱即用**。

设计理念：**简单、轻量、好用**。不做任何 UI 注入、不改写 Harness，只提供「宿主能力」——

- 自动启动 / 停止本地 Harness 服务（`npx @deepseek-ai/dsh web`）
- 服务就绪前显示干净的加载页，就绪后自动载入
- 单实例窗口（重复打开只会唤出已有窗口）
- 关闭窗口 = 最小化到系统托盘；从托盘可随时唤出 / 退出
- 仅监听 `127.0.0.1` 回环地址，外部不可达
- 渲染进程禁用 Node 集成 + 开启沙箱 + `contextIsolation`，跨域跳转一律交给系统浏览器
- 退出时回收整个 Harness 子进程树，无残留

> 这是非官方的社区封装，依赖快速演进的 `@deepseek-ai/dsh`。macOS 构建未做 Apple 公证，首次打开需在「系统设置 → 隐私与安全性」中点击「仍要打开」。

## 目录结构

```
deepseek-harness-desktop/
├── package.json            # ESM，无构建步骤（electron 直接运行 src/main.js）
├── electron-builder.yml    # 打包配置（dmg / nsis / AppImage+deb）
├── src/
│   ├── main.js             # 主进程：单实例 / 窗口 / 托盘 / 生命周期
│   ├── dsh-service.js       # 子进程生命周期：拉起 dsh、解析就绪地址、退出回收
│   └── startup.html         # 干净的加载页
├── assets/                 # 图标（icon.png / icon.icns / icon.ico / tray*.png）
└── scripts/
    └── gen-icons.js         # 零依赖生成鲸鱼主题图标
```

## 环境要求

- **Node.js ≥ 18**（开发 / 打包用）
- **Apple Silicon Mac**（构建 arm64 dmg）；也支持 Windows x64 / Linux x64
- 首次启动需联网：`npx @deepseek-ai/dsh web` 会自动拉取 `@deepseek-ai/dsh`
  （若已全局安装 `npm i -g @deepseek-ai/dsh`，可直接离线启动）

## 安装与运行

```bash
# 1. 安装依赖（electron 体积较大，请耐心等待）
npm install

# 2.（可选）生成图标（assets/ 下已附带，可跳过）
npm run icons

# 3. 开发模式：直接启动桌面应用
npm start
```

启动后会出现加载页，几秒后自动载入 DeepSeek Harness 的 Web UI。
关闭窗口会缩到托盘；右键托盘或点击托盘图标可唤出 / 退出。

## 打包发布

```bash
# macOS（Apple Silicon，产出 dmg + zip）
npm run dist:mac

# Windows（x64，nsis 安装包）
npm run dist:win

# Linux（x64，AppImage + deb）
npm run dist:linux
```

产物位于 `release/` 目录。

## 常见问题

**Q：启动时提示「DeepSeek Harness 无法启动」？**
A：多半是首次联网拉取 `@deepseek-ai/dsh` 较慢或失败。可先手动 `npm i -g @deepseek-ai/dsh` 再启动；或检查网络 / 代理。

**Q：想用本机已安装的 dsh，而不是 npx 拉取？**
A：编辑 `src/main.js` 中 `startDshService` 的 `command` / `args` 即可，例如改为
`command: 'dsh', args: ['web', '--host', '127.0.0.1']`。

**Q：macOS 提示「无法验证开发者」？**
A：这是未公证所致。前往「系统设置 → 隐私与安全性」，在拦截条目下点击「仍要打开」，通常只需一次。

## License

MIT
