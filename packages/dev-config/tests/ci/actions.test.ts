import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { selectWork } from '../../src/ci/actions/check.mjs'
import { run as runResult } from '../../src/ci/actions/result.mjs'
import {
  escapeCommand,
  input,
  readReceiptDirectory,
  setOutput,
} from '../../src/ci/actions/runtime.mjs'
import {
  cacheKey,
  locateCli,
  parseBrowsers,
  parseConfigPath,
  readToolchain,
  resolvePackageManager,
  resolveWorkingDirectory,
} from '../../src/ci/actions/setup.mjs'
import { createSummary, RECEIPT_KIND } from '../../src/ci/result-policy.mjs'
import { toolchain } from '../../src/policy/toolchain.js'
import { createRepository, removeRepositories } from './fixture.js'

afterAll(removeRepositories)

const manifest = (packageManager?: string): string =>
  `${JSON.stringify({ name: 'consumer', private: true, ...(packageManager ? { packageManager } : {}) })}\n`

describe('the setup bootstrap', () => {
  it('reads the committed toolchain manifest from its own checkout', () => {
    expect(readToolchain().runtime).toEqual(toolchain.runtime)
  })

  it('selects the declared package manager when it matches its lockfile and the tested line', () => {
    const pnpm = createRepository({
      'package.json': manifest(`pnpm@${toolchain.runtime.pnpm}`),
      'pnpm-lock.yaml': '',
    })
    expect(resolvePackageManager(pnpm, readToolchain())).toEqual({
      name: 'pnpm',
      version: toolchain.runtime.pnpm,
      lockfile: 'pnpm-lock.yaml',
    })
    const npm = createRepository({ 'package.json': manifest(), 'package-lock.json': '{}' })
    expect(resolvePackageManager(npm, readToolchain())).toEqual({
      name: 'npm',
      version: toolchain.runtime.npm,
      lockfile: 'package-lock.json',
    })
  })

  it('stops on conflicting or missing install metadata instead of guessing', () => {
    const both = createRepository({
      'package.json': manifest(),
      'pnpm-lock.yaml': '',
      'package-lock.json': '{}',
    })
    expect(() => resolvePackageManager(both, readToolchain())).toThrow(
      /Both pnpm-lock.yaml and an npm lockfile/,
    )
    const none = createRepository({ 'package.json': manifest() })
    expect(() => resolvePackageManager(none, readToolchain())).toThrow(/No lockfile is committed/)
    const mismatch = createRepository({
      'package.json': manifest('npm@10.0.0'),
      'package-lock.json': '{}',
    })
    expect(() => resolvePackageManager(mismatch, readToolchain())).toThrow(/tested with npm@/)
    const wrongLock = createRepository({
      'package.json': manifest(`pnpm@${toolchain.runtime.pnpm}`),
      'package-lock.json': '{}',
    })
    expect(() => resolvePackageManager(wrongLock, readToolchain())).toThrow(
      /its lockfile is not committed/,
    )
    const yarn = createRepository({ 'package.json': manifest('yarn@4.0.0'), 'yarn.lock': '' })
    expect(() => resolvePackageManager(yarn, readToolchain())).toThrow(/is not npm or pnpm/)
  })

  it('validates browsers and config paths', () => {
    expect(parseBrowsers('chromium firefox chromium')).toEqual(['chromium', 'firefox'])
    expect(parseBrowsers('')).toEqual([])
    expect(() => parseBrowsers('chromium; curl evil')).toThrow(/is not chromium, firefox or webkit/)
    expect(parseConfigPath('')).toBeUndefined()
    expect(parseConfigPath('config/dev.config.mjs')).toBe('config/dev.config.mjs')
    expect(() => parseConfigPath('../elsewhere.mjs')).toThrow(/inside the working directory/)
    expect(() => parseConfigPath('/etc/passwd')).toThrow(/inside the working directory/)
  })

  it('keys the store cache by OS, Node, package manager and the lockfile bytes', () => {
    const directory = createRepository({ 'pnpm-lock.yaml': 'lockfileVersion: 9.0\n' })
    const parts = {
      os: 'Linux',
      arch: 'X64',
      node: '24.18.0',
      packageManager: 'pnpm',
      version: '10.6.5',
      lockfile: join(directory, 'pnpm-lock.yaml'),
    }
    const first = cacheKey(parts)
    expect(first.prefix).toBe('toolpath-dev-Linux-X64-node24.18.0-pnpm10.6.5-')
    expect(first.key).toMatch(/^toolpath-dev-Linux-X64-node24\.18\.0-pnpm10\.6\.5-[0-9a-f]{64}$/)
    writeFileSync(join(directory, 'pnpm-lock.yaml'), 'lockfileVersion: 9.0\nchanged: true\n')
    expect(cacheKey(parts).key).not.toBe(first.key)
  })

  it('finds the working directory and the consumer’s own installed CLI', () => {
    const directory = createRepository({
      'package.json': manifest(),
      'node_modules/@toolpath/dev-config/dist/cli/main.js': '',
      'apps/app/package.json': manifest(),
    })
    expect(resolveWorkingDirectory('apps/app', directory)).toBe(join(directory, 'apps/app'))
    expect(() => resolveWorkingDirectory('missing', directory)).toThrow(/has no package.json/)
    expect(locateCli(join(directory, 'apps/app'))).toBe(
      join(directory, 'node_modules/@toolpath/dev-config/dist/cli/main.js'),
    )
  })
})

describe('the check action', () => {
  it('accepts a declared stage, the standards contract, or one suite identifier', () => {
    expect(selectWork({ stage: 'standards', suite: '' })).toMatchObject({
      args: ['--stage', 'standards'],
      expected: ['format', 'lint', 'types', 'unit'],
    })
    expect(selectWork({ stage: 'lint', suite: '' })).toMatchObject({
      args: ['--stage', 'lint'],
      expected: ['lint'],
    })
    expect(selectWork({ stage: '', suite: 'app:e2e' })).toMatchObject({
      args: ['--suite', 'app:e2e'],
      expected: ['suite:app:e2e'],
      key: 'app-e2e',
    })
  })

  it('rejects commands, unknown stages, and ambiguous selections', () => {
    expect(() => selectWork({ stage: '', suite: '' })).toThrow(/exactly one/)
    expect(() => selectWork({ stage: 'lint', suite: 'app:e2e' })).toThrow(/exactly one/)
    expect(() => selectWork({ stage: 'npm test', suite: '' })).toThrow(/is not standards/)
    expect(() => selectWork({ stage: '', suite: 'app:e2e && curl x' })).toThrow(
      /is not a <project>:<suite>/,
    )
  })
})

describe('the action runtime', () => {
  it('reads composite and JavaScript action inputs', () => {
    expect(input('working-directory', { TOOLPATH_DEV_INPUT_WORKING_DIRECTORY: ' apps/app ' })).toBe(
      'apps/app',
    )
    expect(input('needs', { INPUT_NEEDS: '{}' })).toBe('{}')
    expect(input('missing', {})).toBe('')
  })

  it('cannot be tricked into ending a workflow command or an output early', () => {
    expect(escapeCommand('a\n::error::b%')).toBe('a%0A::error::b%25')
    const directory = createRepository({ output: '' })
    const file = join(directory, 'output')
    setOutput('receipt', 'line one\nline two', { GITHUB_OUTPUT: file })
    const [header, ...rest] = readFileSync(file, 'utf8').split('\n')
    const delimiter = header?.replace('receipt<<', '') ?? ''
    expect(delimiter).toMatch(/^toolpath_dev_/)
    expect(rest.slice(0, 3)).toEqual(['line one', 'line two', delimiter])
  })

  it('reads receipts from nested artifact directories and flags duplicates', () => {
    const directory = createRepository({})
    const receipt = (id: string): string =>
      JSON.stringify({ schemaVersion: 1, kind: RECEIPT_KIND, id })
    mkdirSync(join(directory, 'standards'), { recursive: true })
    mkdirSync(join(directory, 'again'), { recursive: true })
    writeFileSync(join(directory, 'standards', 'lint.json'), receipt('lint'))
    writeFileSync(join(directory, 'again', 'lint.json'), receipt('lint'))
    writeFileSync(join(directory, 'standards', 'broken.json'), '{')
    const receipts = readReceiptDirectory(directory)
    expect([...receipts.keys()].sort()).toEqual(['broken', 'lint'])
    expect(receipts.get('lint')).toEqual({ duplicate: join(directory, 'standards', 'lint.json') })
    expect(receipts.get('broken')).toBeUndefined()
  })
})

describe('the result action', () => {
  const quiet = (): void => undefined

  it('fails the caller aggregate when a required job did not succeed, and passes when all did', () => {
    const directory = createRepository({ output: '', summary: '' })
    const environment = {
      GITHUB_OUTPUT: join(directory, 'output'),
      GITHUB_STEP_SUMMARY: join(directory, 'summary'),
    }
    const required = JSON.stringify([{ kind: 'standards', job: 'standards' }])
    const summary = JSON.stringify(
      createSummary(
        ['format', 'lint', 'types', 'unit'].map((id) => ({
          schemaVersion: 1 as const,
          kind: RECEIPT_KIND,
          id,
          status: 'passed' as const,
          durationMs: 1,
          package: {
            name: '@toolpath/dev-config',
            version: '1.2.3',
            sourceSha: null,
            channel: 'release',
          },
        })),
      ),
    )
    const passed = JSON.stringify({
      standards: { result: 'success', outputs: { receipt: summary } },
    })
    expect(
      runResult({ ...environment, INPUT_NEEDS: passed, INPUT_REQUIRED: required }, quiet),
    ).toBe(0)
    const failed = JSON.stringify({ standards: { result: 'failure', outputs: {} } })
    expect(
      runResult({ ...environment, INPUT_NEEDS: failed, INPUT_REQUIRED: required }, quiet),
    ).toBe(1)
    expect(readFileSync(join(directory, 'summary'), 'utf8')).toContain(
      'job standards finished with failure',
    )
  })

  it('rejects an invocation that is neither the central nor the caller form', () => {
    expect(runResult({ INPUT_NEEDS: '{}' }, quiet)).toBe(2)
    expect(runResult({ INPUT_NEEDS: '{}', INPUT_PLAN: '{}', INPUT_REQUIRED: '[]' }, quiet)).toBe(2)
    expect(runResult({ INPUT_NEEDS: '{}', INPUT_PLAN: '{}' }, quiet)).toBe(2)
  })
})
