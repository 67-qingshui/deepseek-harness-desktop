# DeepSeek Harness Desktop

极简桌面壳：把 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的 Web UI 装进原生窗口，**自动启停本地服务、开箱即用**。

设计理念：**简单、轻量、好用**。不做任何 UI 注入、不改写 Harness，只提供「宿主能力」——

- 自动启动 / 停止本地 Harness 服务（**内嵌** `@deepseek-ai/dsh`，用应用自带的 Electron 运行，**无需系统安装 Node/npm**）
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

- **运行已安装的应用：无需任何环境**。DeepSeek Harness（`@deepseek-ai/dsh`）已作为依赖打包进应用，
  由应用自带的 Electron 运行；下载 dmg 后开箱即用，首次启动也**不联网下载**任何东西。
- **仅开发 / 打包时需要 Node.js ≥ 18**：用于 `npm install` 与 `electron-builder`。
- **Apple Silicon Mac** 构建 arm64 dmg；也支持 Windows x64 / Linux x64。

## 安装与运行

```bash
# 1. 安装依赖（electron / dsh 体积较大，请耐心等待）
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

**Q：应用真的完全不需要系统 Node 吗？**
A：是的。运行时由应用自带的 Electron 二进制直接执行内嵌的 `dsh`（`@deepseek-ai/dsh/lib/bin.js`），
不调用系统的 `node` / `npx`。仅在你**从源码构建**时才需要本机装 Node.js。

**Q：启动时提示「DeepSeek Harness 无法启动」？**
A：多半是内嵌 dsh 初始化失败（如端口被占用、权限受限）。查看弹窗中的详细输出定位；
若你改过启动方式，可检查 `src/main.js` 的 `buildDshLaunch()`。

**Q：想改用本机已安装的 dsh，而不是内嵌版本？**
A：编辑 `src/main.js` 中 `buildDshLaunch()` 的返回值即可，例如改为
`{ command: 'dsh', args: ['web', '--host', '127.0.0.1'] }`（需系统已 `npm i -g @deepseek-ai/dsh`）。

**Q：macOS 提示「无法验证开发者」？**
A：这是未公证所致。前往「系统设置 → 隐私与安全性」，在拦截条目下点击「仍要打开」，通常只需一次。

## License

MIT
