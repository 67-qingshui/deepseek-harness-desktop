import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import treeKill from 'tree-kill'

/**
 * # DeepSeek Harness 服务管理
 *
 * 负责拉起本地 DeepSeek Harness（dsh）子进程、检测就绪、退出回收。
 *
 * 设计要点（参考 steven-kid/deepseek-harness-desktop）：
 *  - 仅监听 127.0.0.1 回环地址，外部不可达
 *  - 从子进程 stdout 解析就绪地址，无需预知端口（--port 0 由系统分配）
 *  - 退出时 tree-kill 整棵子进程树，避免残留
 *
 * 运行时使用应用自带的 Electron 二进制（process.execPath）执行内嵌的 dsh，
 * 无需系统安装 Node/npm，首次启动也不联网下载。
 */

// dsh 就绪后在 stdout 打印：dsh web: http://127.0.0.1:<port>
const READY_PATTERN = /^dsh web: (http:\/\/127\.0\.0\.1:\d+)\b/m

// 就绪等待超时（毫秒）。dsh 首次初始化可能较慢，给足 120s。
const READY_TIMEOUT_MS = 120_000

const requireResolve = createRequire(import.meta.url)

/**
 * 解析内嵌 dsh 的 bin 入口路径。
 * dsh 已作为生产依赖打进 app 的 node_modules（打包后位于 app.asar.unpacked）。
 * @returns {string|null} bin.js 绝对路径；找不到时返回 null
 */
export function resolveDshBin() {
  try {
    return requireResolve.resolve('@deepseek-ai/dsh/lib/bin.js')
  } catch {
    return null
  }
}

/**
 * 构造拉起 DeepSeek Harness 的 command + args。
 *
 * 优先用应用自带 Electron（process.execPath）直接跑内嵌 dsh 的 bin.js，
 * 实现开箱即用、无需系统 Node。仅在内嵌 dsh 缺失时退回系统 npx（需 Node）。
 *
 * 注意命令形式：
 *  - 不能用 `--expose-internals <bin>`：那是某些 app 自定义选项，会让 dsh 的
 *    commander 把后续参数当透传，报 `--profile required`。
 *  - 不能用 `--profile web`：根命令的变参 `[args...]` 会吞掉 --host/--port。
 *  - 正确用法是 `web` 子命令（--profile web 的别名），独立子命令不触发变参吞噬。
 *
 * @returns {{command: string, args: string[]}}
 */
export function buildDshLaunch() {
  const bin = resolveDshBin()
  if (bin) {
    return {
      command: process.execPath,
      args: [bin, 'web', '--host', '127.0.0.1', '--port', '0'],
    }
  }
  // 回退：依赖系统 Node + 首次联网下载（仅开发态兜底）
  return {
    command: 'npx',
    args: ['@deepseek-ai/dsh', 'web', '--host', '127.0.0.1', '--port', '0'],
  }
}

/**
 * 拉起本地 DeepSeek Harness 服务（子进程）。
 *
 * @param {Object} opts
 * @param {string} opts.command  - 可执行文件（process.execPath 或 npx）
 * @param {string[]} opts.args   - 命令参数
 * @param {Object} [opts.environment] - 子进程环境变量
 * @returns {{ready: Promise<string>, stop: () => void}}
 *   - ready: 解析为服务地址（http://127.0.0.1:<port>）
 *   - stop:  回收整个子进程树
 */
export function startDshService({ command, args = [], environment = {} } = {}) {
  let child
  let settled = false
  let resolveReady
  let rejectReady
  const ready = new Promise((resolve, reject) => {
    resolveReady = resolve
    rejectReady = reject
  })

  // 收集子进程输出：用于就绪检测 + 失败时诊断
  const outputChunks = []
  const scan = (text) => {
    outputChunks.push(text)
    if (settled) return
    const match = READY_PATTERN.exec(text)
    if (match) {
      settled = true
      resolveReady(match[1])
    }
  }

  // 清掉可能污染子进程的 env（某些沙箱会误设 ELECTRON_RUN_AS_NODE，
  // 导致 Electron 以纯 Node 模式运行而无法加载 dsh）
  const spawnEnv = { ...environment }
  if (spawnEnv.ELECTRON_RUN_AS_NODE) delete spawnEnv.ELECTRON_RUN_AS_NODE

  try {
    child = spawn(command, args, {
      env: spawnEnv,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })
  } catch (err) {
    rejectReady(err)
    return { ready, stop: () => {} }
  }

  child.stdout?.on('data', scan)
  child.stderr?.on('data', scan)
  child.on('error', (err) => {
    if (!settled) {
      settled = true
      rejectReady(err)
    }
  })

  // 就绪超时：dsh 启动过久则判定失败
  const timeout = setTimeout(() => {
    if (!settled) {
      settled = true
      rejectReady(
        new Error(
          `等待 DeepSeek Harness 就绪超时（${READY_TIMEOUT_MS / 1000}s）。\n最近输出：\n${outputChunks
            .join('')
            .slice(-2000)}`,
        ),
      )
    }
  }, READY_TIMEOUT_MS)

  // 子进程提前退出：通常是启动失败（缺依赖 / 端口冲突）
  child.on('exit', (code, signal) => {
    if (!settled) {
      settled = true
      rejectReady(
        new Error(
          `DeepSeek Harness 进程已退出（code=${code ?? 'null'}, signal=${signal ?? 'null'}）。\n输出：\n${outputChunks
            .join('')
            .slice(-2000)}`,
        ),
      )
    }
  })

  /**
   * 回收子进程树：SIGTERM 整棵树，避免 dsh 衍生的子进程残留。
   */
  function stop() {
    clearTimeout(timeout)
    if (child?.pid) {
      try {
        treeKill(child.pid, 'SIGTERM', () => {})
      } catch {
        /* 进程可能已退出，忽略 */
      }
    }
  }

  return { ready, stop }
}
