// Measures the developer loop on disposable consumers installed from the packed
// tarball: cold and warm wall time of a focused `toolpath-dev check`, peak
// resident memory of the process tree's largest process, how many processes the
// CLI starts, and the bytes a passing run prints. Targets are engineering goals,
// not assertions; correctness is never traded for a number here.
import { spawnSync } from 'node:child_process'
import { cpus, platform, release, totalmem } from 'node:os'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  childEnv,
  createWorkRoot,
  gitInit,
  materialize,
  must,
  packageRoot,
  packTarball,
  readJson,
  useFixtureRelease,
  writeFiles,
  writeManifest,
} from './harness.mjs'

/** @type {{ runtime: { npm: string, pnpm: string, node: string }, core: { eslint: string, defaultTypescript: string } }} */
const toolchain = readJson(join(packageRoot, 'src/policy/toolchain.json'))
const runs = Number.parseInt(
  process.argv.find((argument) => argument.startsWith('--runs='))?.slice(7) ?? '5',
  10,
)
const keep = process.argv.includes('--keep')
const work = createWorkRoot()
const tarball = packTarball(join(work, 'tarballs'))

/** @param {string} root */
const bin = (root) => join(root, 'node_modules/.bin/toolpath-dev')

/**
 * Runs once under the platform's `time`, which reports the largest resident set
 * among the process and the children it waited for.
 * @param {string} root
 * @param {Array<string>} args
 * @returns {{ ms: number, peakKiB: number | undefined, processes: number, stdoutBytes: number }}
 */
const measure = (root, args) => {
  const log = join(work, `spawns-${String(Date.now())}.log`)
  writeFileSync(log, '')
  const timeArgs = platform() === 'darwin' ? ['-l'] : ['-v']
  const started = performance.now()
  const result = spawnSync('/usr/bin/time', [...timeArgs, bin(root), ...args], {
    cwd: root,
    env: childEnv({ TOOLPATH_DEV_SPAWN_LOG: log, CI: '' }),
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
  const ms = performance.now() - started
  if (result.status !== 0) {
    throw new Error(`${args.join(' ')} failed in ${root}:\n${result.stdout}${result.stderr}`)
  }
  const darwin = /(\d+)\s+maximum resident set size/.exec(result.stderr)
  const linux = /Maximum resident set size \(kbytes\): (\d+)/.exec(result.stderr)
  const peakKiB = darwin?.[1]
    ? Math.round(Number(darwin[1]) / 1024)
    : linux?.[1]
      ? Number(linux[1])
      : undefined
  const processes = readFileSync(log, 'utf8').split('\n').filter(Boolean).length
  rmSync(log, { force: true })
  return { ms, peakKiB, processes, stdoutBytes: Buffer.byteLength(result.stdout) }
}

/** @param {Array<number>} values */
const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
    : (sorted[middle] ?? 0)
}

/**
 * @param {string} root
 * @param {Array<string>} init
 * @param {{ template?: string, extra?: Array<string>, files?: Record<string, string> }} [options]
 */
const npmConsumer = (root, init, { template = 'node', extra = [], files = {} } = {}) => {
  mkdirSync(root, { recursive: true })
  gitInit(root)
  writeFiles(root, { '.gitignore': 'node_modules/\n', ...files })
  writeManifest(root, { packageManager: `npm@${toolchain.runtime.npm}` })
  materialize(template, root)
  must('npm', ['install', '--save-dev', '--save-exact', tarball, ...extra], { cwd: root })
  useFixtureRelease(root)
  must(bin(root), ['init', ...init], { cwd: root, env: childEnv({ CI: '' }) })
  useFixtureRelease(root)
}

/** @type {Array<{ name: string, root: string, args: Array<string>, target?: number }>} */
const scenarios = []

const node = join(work, 'node')
npmConsumer(node, ['--name', 'core', '--kind', 'library', '--runtime', 'node'])
scenarios.push({
  name: 'Node library, focused check',
  root: node,
  args: ['check', '--project', 'core'],
  target: 8000,
})

const react = join(work, 'react')
npmConsumer(
  react,
  ['--name', 'web', '--kind', 'application', '--runtime', 'dom', '--react', 'vite-modern'],
  {
    template: 'react',
    extra: ['react@19.3.0', 'react-dom@19.3.0', '@types/react@19.3.0', '@types/react-dom@19.3.0'],
  },
)
scenarios.push({
  name: 'React DOM app, focused check',
  root: react,
  args: ['check', '--project', 'web'],
  target: 15000,
})

const workspace = join(work, 'workspace')
mkdirSync(join(workspace, 'packages/core'), { recursive: true })
mkdirSync(join(workspace, 'packages/util'), { recursive: true })
gitInit(workspace)
writeFiles(workspace, {
  '.gitignore': 'node_modules/\n',
  'pnpm-workspace.yaml': 'packages:\n  - packages/*\n',
})
writeManifest(workspace, { packageManager: `pnpm@${toolchain.runtime.pnpm}` })
materialize('node', join(workspace, 'packages/core'))
materialize('node', join(workspace, 'packages/util'))
writeManifest(join(workspace, 'packages/core'), { name: '@fixture/core' })
writeManifest(join(workspace, 'packages/util'), {
  name: '@fixture/util',
  dependencies: { '@fixture/core': 'workspace:*' },
})
must('pnpm', ['add', '--save-dev', '--save-exact', '--workspace-root', tarball], { cwd: workspace })
useFixtureRelease(workspace)
must(
  bin(workspace),
  [
    'init',
    '--project-spec',
    'name=core,root=packages/core,kind=library,runtime=node',
    '--project-spec',
    'name=util,root=packages/util,kind=library,runtime=node',
  ],
  { cwd: workspace, env: childEnv({ CI: '' }) },
)
useFixtureRelease(workspace)
scenarios.push({
  name: 'pnpm workspace, one project of two',
  root: workspace,
  args: ['check', '--project', 'util'],
})

const engine = join(work, 'engine')
npmConsumer(
  engine,
  [
    '--name',
    'client',
    '--kind',
    'application',
    '--runtime',
    'node',
    '--engine',
    'api-1.29.1',
    '--engine-integration',
    'src/**/*.ts',
  ],
  {
    files: {
      'src/engine.test.ts': `import { createToolpathClient, uploadToPresignedUrl } from '@toolpath/api'
import { createEngineFetch, createEngineScenario, TEST_API_KEY } from '@toolpath/dev-config/engine/testing'
import { expect, it } from 'vitest'

it('analyzes a part through the injected fetch', async () => {
  const scenario = createEngineScenario()
  const fetch = createEngineFetch(scenario)
  const client = createToolpathClient({ apiKey: TEST_API_KEY, fetch })
  const part = await client.parts.createPart({ filename: 'bracket.step' })
  await uploadToPresignedUrl(part.uploadUrl, new Uint8Array([1]), { fetch })
  const { jobId } = await client.parts.updatePart({ id: part.partId })
  scenario.advanceJob(jobId, 'running')
  scenario.advanceJob(jobId, 'succeeded')
  expect((await client.parts.getPart({ id: part.partId })).jobId).toBe(jobId)
})
`,
    },
  },
)
scenarios.push({
  name: 'Engine injected-fetch suite, focused check',
  root: engine,
  args: ['check', '--project', 'client'],
})

/**
 * @typedef {{ scenario: string, command: string, coldMs: number, warmMedianMs: number, warmRangeMs: [number, number],
 *   peakKiB: number | undefined, processes: number, stdoutBytes: number, targetMs: number | undefined }} Row
 */
/** @type {Array<Row>} */
const results = []
for (const scenario of scenarios) {
  const cold = measure(scenario.root, scenario.args)
  /** @type {Array<ReturnType<typeof measure>>} */
  const warm = []
  for (let index = 0; index < runs; index += 1) {
    warm.push(measure(scenario.root, scenario.args))
  }
  const times = warm.map((entry) => entry.ms)
  results.push({
    scenario: scenario.name,
    command: `toolpath-dev ${scenario.args.join(' ')}`,
    coldMs: Math.round(cold.ms),
    warmMedianMs: Math.round(median(times)),
    warmRangeMs: [Math.round(Math.min(...times)), Math.round(Math.max(...times))],
    peakKiB: warm.some((entry) => entry.peakKiB !== undefined)
      ? Math.max(...warm.map((entry) => entry.peakKiB ?? 0))
      : undefined,
    processes: cold.processes,
    stdoutBytes: Math.max(...warm.map((entry) => entry.stdoutBytes)),
    targetMs: scenario.target,
  })
}

const environment = {
  node: process.version,
  platform: `${platform()} ${release()}`,
  cpus: `${String(cpus().length)} × ${cpus()[0]?.model ?? 'unknown'}`,
  memoryGiB: Math.round(totalmem() / 2 ** 30),
  runs,
  eslint: toolchain.core.eslint,
  typescript: toolchain.core.defaultTypescript,
}
const report = { environment, results }
mkdirSync(join(packageRoot, '.tmp'), { recursive: true })
writeFileSync(join(packageRoot, '.tmp/benchmark.json'), `${JSON.stringify(report, null, 2)}\n`)
process.stdout.write(`${JSON.stringify(environment)}\n`)
process.stdout.write(
  '| Scenario | Cold | Warm median (range) | Peak RSS | Processes | Stdout | Target |\n|---|---|---|---|---|---|---|\n',
)
for (const row of results) {
  const [low, high] = row.warmRangeMs
  const peak = row.peakKiB === undefined ? 'n/a' : `${String(Math.round(row.peakKiB / 1024))} MiB`
  const target = row.targetMs === undefined ? '—' : `< ${String(row.targetMs)} ms`
  process.stdout.write(
    `| ${row.scenario} | ${String(row.coldMs)} ms | ${String(row.warmMedianMs)} ms (${String(low)}–${String(high)}) | ` +
      `${peak} | ${String(row.processes)} | ${String(row.stdoutBytes)} B | ${target} |\n`,
  )
}
if (!keep) {
  rmSync(work, { recursive: true, force: true })
}
