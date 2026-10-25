// The few GitHub Actions runtime calls the shared actions need, without
// @actions/core: they must run from a plain source checkout before any
// dependency is installed, on whatever Node the runner provides.
import { randomUUID } from 'node:crypto'
import { appendFileSync, existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseJson } from '../result-policy.mjs'

/**
 * An action input. Composite steps pass inputs as `TOOLPATH_DEV_INPUT_*`
 * environment variables (never interpolated into shell source); JavaScript
 * actions receive the runner's `INPUT_*` variables.
 * @param {string} name e.g. `working-directory`
 * @param {NodeJS.ProcessEnv} [environment]
 * @returns {string}
 */
export const input = (name, environment = process.env) => {
  const composite = `TOOLPATH_DEV_INPUT_${name.replace(/-/g, '_').toUpperCase()}`
  const runner = `INPUT_${name.replace(/ /g, '_').toUpperCase()}`
  return (environment[composite] ?? environment[runner] ?? '').trim()
}

/**
 * Escapes a value for a workflow command (`::error::`), so a message cannot
 * end the command early or inject another one.
 * @param {string} value
 */
export const escapeCommand = (value) =>
  value.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A')

/** @typedef {(text: string) => void} Log */

/** @type {Log} */
export const stdout = (text) => {
  process.stdout.write(text)
}

/**
 * An error annotation; the runner shows it on the job and the run summary.
 * @param {string} message
 * @param {Log} [log]
 */
export const error = (message, log = stdout) => {
  log(`::error::${escapeCommand(message)}\n`)
}

/**
 * @param {string} message
 * @param {Log} [log]
 */
export const notice = (message, log = stdout) => {
  log(`::notice::${escapeCommand(message)}\n`)
}

/**
 * Sets a step output with a random heredoc delimiter, so a value cannot close it.
 * @param {string} name
 * @param {string} value
 * @param {NodeJS.ProcessEnv} [environment]
 */
export const setOutput = (name, value, environment = process.env) => {
  const file = environment.GITHUB_OUTPUT
  if (!file) {
    process.stdout.write(`${name}=${value}\n`)
    return
  }
  let delimiter = `toolpath_dev_${randomUUID()}`
  while (value.includes(delimiter)) {
    delimiter = `toolpath_dev_${randomUUID()}`
  }
  appendFileSync(file, `${name}<<${delimiter}\n${value}\n${delimiter}\n`)
}

/**
 * Appends Markdown to the job summary, when the runner provides one.
 * @param {string} markdown
 * @param {NodeJS.ProcessEnv} [environment]
 */
export const summary = (markdown, environment = process.env) => {
  const file = environment.GITHUB_STEP_SUMMARY
  if (file) {
    appendFileSync(file, markdown)
  }
}

/**
 * Every receipt under a directory (artifact downloads nest one directory per
 * job), keyed by the id each receipt records. An unreadable file or a duplicated
 * id is kept as an entry the policy rejects, never silently resolved.
 * @param {string} directory
 * @returns {Map<string, unknown>}
 */
export const readReceiptDirectory = (directory) => {
  /** @type {Map<string, unknown>} */
  const receipts = new Map()
  /** @param {string} current */
  const visit = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name),
    )) {
      const path = join(current, entry.name)
      if (entry.isDirectory()) {
        visit(path)
        continue
      }
      if (!entry.isFile() || !entry.name.endsWith('.json')) {
        continue
      }
      const parsed = parseJson(readFileSync(path, 'utf8'))
      const value = parsed.ok ? parsed.value : undefined
      const id =
        typeof value === 'object' && value !== null && 'id' in value && typeof value.id === 'string'
          ? value.id
          : entry.name.replace(/\.json$/, '')
      receipts.set(id, receipts.has(id) ? { duplicate: path } : value)
    }
  }
  if (existsSync(directory)) {
    visit(directory)
  }
  return receipts
}
