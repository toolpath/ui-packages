import { spawn, type SpawnOptions } from 'node:child_process'
import { appendFileSync } from 'node:fs'
import { availableParallelism } from 'node:os'

export interface RunResult {
  /** Exit code; `null` when a signal ended the process. */
  code: number | null
  signal: NodeJS.Signals | null
  stdout: string
  stderr: string
  durationMs: number
}

export interface RunOptions {
  cwd: string
  env?: NodeJS.ProcessEnv
  /** Stream output to this process instead of capturing it (watch mode, interactive tools). */
  inherit?: boolean
  timeoutMs?: number
}

const running = new Set<ReturnType<typeof spawn>>()
let interrupted: NodeJS.Signals | undefined

/** The signal that interrupted this CLI, if any; commands must not report success after one. */
export const interruption = (): NodeJS.Signals | undefined => interrupted

let deferExit = false

/**
 * For in-process work that must clean up after an interruption itself: the
 * pre-commit hook lets lint-staged abort and restore the index and work tree
 * instead of exiting under it. A second signal still exits at once.
 */
export const deferInterruptExit = (): void => {
  deferExit = true
}

/** Forwards SIGINT/SIGTERM to children and remembers the interruption. */
export const installSignalHandlers = (): void => {
  const forward = (signal: NodeJS.Signals): void => {
    const repeated = interrupted !== undefined
    interrupted = signal
    for (const child of running) {
      child.kill(signal)
    }
    if (repeated || (running.size === 0 && !deferExit)) {
      process.exit(signal === 'SIGINT' ? 130 : 143)
    }
  }
  process.on('SIGINT', forward)
  process.on('SIGTERM', forward)
}

/** Runs a command without a shell; arguments are passed through verbatim. */
export const run = (
  command: string,
  args: ReadonlyArray<string>,
  options: RunOptions,
): Promise<RunResult> =>
  new Promise((resolvePromise, reject) => {
    const started = performance.now()
    const spawnOptions: SpawnOptions = {
      cwd: options.cwd,
      env: options.env ?? process.env,
      stdio: options.inherit ? 'inherit' : ['ignore', 'pipe', 'pipe'],
      shell: false,
    }
    // The benchmark counts the processes a command starts.
    const spawnLog = process.env.TOOLPATH_DEV_SPAWN_LOG
    if (spawnLog) {
      appendFileSync(spawnLog, `${JSON.stringify([command, ...args.slice(0, 2)])}\n`)
    }
    const child = spawn(command, [...args], spawnOptions)
    running.add(child)
    let stdout = ''
    let stderr = ''
    child.stdout?.setEncoding('utf8').on('data', (chunk: string) => {
      stdout += chunk
    })
    child.stderr?.setEncoding('utf8').on('data', (chunk: string) => {
      stderr += chunk
    })
    const timer =
      options.timeoutMs === undefined
        ? undefined
        : setTimeout(() => {
            stderr += `\nTimed out after ${Math.round((options.timeoutMs ?? 0) / 1000)}s; stopping.\n`
            child.kill('SIGTERM')
          }, options.timeoutMs)
    child.on('error', (error) => {
      running.delete(child)
      if (timer) {
        clearTimeout(timer)
      }
      reject(error)
    })
    child.on('close', (code, signal) => {
      running.delete(child)
      if (timer) {
        clearTimeout(timer)
      }
      resolvePromise({ code, signal, stdout, stderr, durationMs: performance.now() - started })
    })
  })

/** A single process-wide ceiling, so focused and full runs never multiply worker pools. */
export const processConcurrency = (): number =>
  Math.max(1, Math.min(4, Math.floor(availableParallelism() / 2)))

/** Runs tasks with at most `limit` in flight, preserving result order. */
export const mapLimit = async <T, R>(
  items: ReadonlyArray<T>,
  limit: number,
  task: (item: T) => Promise<R>,
): Promise<Array<R>> => {
  const results: Array<{ index: number; value: R }> = []
  let next = 0
  const worker = async (): Promise<void> => {
    // After an interruption, nothing new starts; what finished is returned.
    while (next < items.length && interrupted === undefined) {
      const index = next
      next += 1
      results.push({ index, value: await task(items[index] as T) })
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results.sort((a, b) => a.index - b.index).map((entry) => entry.value)
}
