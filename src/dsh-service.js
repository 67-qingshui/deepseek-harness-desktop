import { spawn } from 'node:child_process'
import treeKill from 'tree-kill'

// DeepSeek Harness 就绪后会在 stdout 打印：dsh web: http://127.0.0.1:<port>
const READY_PATTERN = /^dsh web: (http:\/\/127\.0\.0\.1:\d+)\b/m

const READY_TIMEOUT_MS = 120_000

/**
 * 拉起本地 DeepSeek Harness 服务（子进程），并暴露：
 *  - ready:    Promise<string>，解析为服务地址（http://127.0.0.1:<port>）
 *  - stop():   回收整个子进程树
 *
 * 设计要点（参考 deepseek-harness-desktop）：
 *  - 仅监听 127.0.0.1 回环地址，外部不可达
 *  - 从子进程输出解析就绪地址，无需预知端口
 *  - 退出时 tree-kill 整棵树，避免残留
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

  // 清掉可能污染子进程的 env（例如某些沙箱会误设 ELECTRON_RUN_AS_NODE）
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

  function stop() {
    clearTimeout(timeout)
    if (child?.pid) {
      try {
        treeKill(child.pid, 'SIGTERM', () => {})
      } catch {
        /* ignore */
      }
    }
  }

  return { ready, stop }
}
