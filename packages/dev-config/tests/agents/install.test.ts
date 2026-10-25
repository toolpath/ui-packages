import { spawnSync, type SpawnSyncReturns } from 'node:child_process'
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'

const packageRoot = fileURLToPath(new URL('../../', import.meta.url))
const installer = join(packageRoot, 'assets/claude-code/install.sh')
const WORKER = 'agents/worker.md'
const STYLE = 'output-styles/orchestrator.md'
const LAUNCH = `claude --model opus --effort xhigh --settings '{"outputStyle":"Orchestrator"}'`

const source = (file: string): string =>
  readFileSync(join(packageRoot, 'assets/claude-code', file), 'utf8')

const temporaryDirectories: Array<string> = []

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

const scratch = (): string => {
  const directory = mkdtempSync(join(tmpdir(), 'toolpath-dev-claude-'))
  temporaryDirectories.push(directory)
  return directory
}

/**
 * Runs the installer with a clean environment: a disposable HOME, and
 * CLAUDE_CONFIG_DIR only when given, so a developer's own configuration is never
 * read or written.
 */
const install = (environment: { home: string; configDir?: string }): SpawnSyncReturns<string> =>
  spawnSync('bash', [installer], {
    encoding: 'utf8',
    env: {
      PATH: process.env.PATH ?? '/usr/bin:/bin',
      HOME: environment.home,
      ...(environment.configDir === undefined ? {} : { CLAUDE_CONFIG_DIR: environment.configDir }),
    },
  })

/** Every file under `directory`, relative to it. */
const listing = (directory: string, prefix = ''): Array<string> =>
  readdirSync(join(directory, prefix), { withFileTypes: true }).flatMap((entry) => {
    const path = prefix === '' ? entry.name : `${prefix}/${entry.name}`
    return entry.isDirectory() ? listing(directory, path) : [path]
  })

describe('assets/claude-code/install.sh', () => {
  it('copies only the worker and the output style into CLAUDE_CONFIG_DIR and prints the launch command', () => {
    const home = scratch()
    const configDir = join(scratch(), 'claude config')
    const result = install({ home, configDir })
    expect(result.status).toBe(0)
    expect(listing(configDir).sort()).toEqual([WORKER, STYLE])
    expect(readFileSync(join(configDir, WORKER), 'utf8')).toBe(source(WORKER))
    expect(readFileSync(join(configDir, STYLE), 'utf8')).toBe(source(STYLE))
    expect(result.stdout).toContain(LAUNCH)
    expect(result.stdout).toContain('CLAUDE_CONFIG_DIR=')
    expect(listing(home)).toEqual([])
  })

  it('installs into ~/.claude when CLAUDE_CONFIG_DIR is unset', () => {
    const home = scratch()
    expect(install({ home }).status).toBe(0)
    expect(listing(join(home, '.claude')).sort()).toEqual([WORKER, STYLE])
  })

  it('keeps identical files untouched on a second run', () => {
    const home = scratch()
    const configDir = scratch()
    expect(install({ home, configDir }).status).toBe(0)
    const before = statSync(join(configDir, WORKER)).mtimeMs
    const again = install({ home, configDir })
    expect(again.status).toBe(0)
    expect(statSync(join(configDir, WORKER)).mtimeMs).toBe(before)
    expect(listing(configDir).sort()).toEqual([WORKER, STYLE])
  })

  it('stops before writing anything when an existing file differs', () => {
    const home = scratch()
    const configDir = scratch()
    mkdirSync(join(configDir, 'output-styles'))
    writeFileSync(join(configDir, STYLE), 'my own orchestrator\n')
    const result = install({ home, configDir })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain(`Existing file differs: ${join(configDir, STYLE)}`)
    expect(result.stderr).toContain('Nothing changed.')
    expect(readFileSync(join(configDir, STYLE), 'utf8')).toBe('my own orchestrator\n')
    expect(existsSync(join(configDir, WORKER))).toBe(false)
  })

  it('treats a symbolic link at a target path as a conflict', () => {
    const home = scratch()
    const configDir = scratch()
    mkdirSync(join(configDir, 'agents'))
    symlinkSync('missing-worker.md', join(configDir, WORKER))
    expect(install({ home, configDir }).status).toBe(1)
    expect(lstatSync(join(configDir, WORKER)).isSymbolicLink()).toBe(true)
    expect(existsSync(join(configDir, STYLE))).toBe(false)
  })

  it('leaves settings and other configuration exactly as they were', () => {
    const home = scratch()
    const configDir = scratch()
    const settings = '{\n  "model": "sonnet",\n  "outputStyle": "Concise"\n}\n'
    writeFileSync(join(configDir, 'settings.json'), settings)
    mkdirSync(join(configDir, 'skills/mine'), { recursive: true })
    writeFileSync(join(configDir, 'skills/mine/SKILL.md'), '---\nname: mine\n---\n')
    expect(install({ home, configDir }).status).toBe(0)
    expect(readFileSync(join(configDir, 'settings.json'), 'utf8')).toBe(settings)
    expect(listing(configDir).sort()).toEqual([
      WORKER,
      STYLE,
      'settings.json',
      'skills/mine/SKILL.md',
    ])
  })
})
