// Compatibility sections outside React: the second TypeScript line, npm
// workspaces, and both pinned Engine SDK artifacts driving the packed test kit
// through injected fetch, real HTTP and MSW.
import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import {
  childEnv,
  gitInit,
  materialize,
  must,
  packageRoot,
  readJson,
  useFixtureRelease,
  writeFiles,
  writeManifest,
} from '../harness.mjs'

/** @type {{ core: { typescript: Array<string> }, runtime: { npm: string }, engine: { contracts: Record<string, { sdk: string }> }, profiles: Record<string, Record<string, string | Array<string>>> }} */
const toolchain = readJson(join(packageRoot, 'src/policy/toolchain.json'))

/** @param {string} root */
const bin = (root) => join(root, 'node_modules/.bin/toolpath-dev')

/**
 * A single npm project initialized with exact tools, optionally pinning TypeScript first.
 * @param {{ tarball: string, root: string, typescript?: string, init: Array<string>, extra?: Array<string> }} options
 */
const npmProject = ({ tarball, root, typescript, init, extra = [] }) => {
  mkdirSync(root, { recursive: true })
  gitInit(root)
  writeFiles(root, { '.gitignore': 'node_modules/\n' })
  writeManifest(root, { packageManager: `npm@${toolchain.runtime.npm}` })
  materialize('node', root)
  must(
    'npm',
    [
      'install',
      '--save-dev',
      '--save-exact',
      tarball,
      ...(typescript ? [`typescript@${typescript}`] : []),
      ...extra,
    ],
    { cwd: root },
  )
  useFixtureRelease(root)
  must(bin(root), ['init', ...init], { cwd: root, env: childEnv({ CI: '' }) })
  useFixtureRelease(root)
}

/** @param {string} contract @param {string} baseUrl */
const engineTest = (
  contract,
  baseUrl,
) => `import { createToolpathClient, uploadToPresignedUrl } from '@toolpath/api'
import { createEngineFetch, createEngineScenario, TEST_API_KEY } from '@toolpath/dev-config/engine/testing'
import { createEngineHandlers } from '@toolpath/dev-config/engine/testing/msw'
import { startEngineTestServer } from '@toolpath/dev-config/engine/testing/node'
import { setupServer } from 'msw/node'
import { describe, expect, it } from 'vitest'

const BASE_URL = '${baseUrl}'

const analyze = async (client: ReturnType<typeof createToolpathClient>, fetch: typeof globalThis.fetch, advance: (jobId: string) => void) => {
  const part = await client.parts.createPart({ filename: 'bracket.step' })
  await uploadToPresignedUrl(part.uploadUrl, new Uint8Array([1, 2, 3]), { fetch })
  const { jobId } = await client.parts.updatePart({ id: part.partId })
  advance(jobId)
  return { partId: part.partId, jobId, result: await client.parts.getPart({ id: part.partId }) }
}

describe('${contract} through every adapter', () => {
  it('runs the journey through the injected fetch', async () => {
    const scenario = createEngineScenario({ contract: '${contract}', baseUrl: BASE_URL })
    const fetch = createEngineFetch(scenario)
    const client = createToolpathClient({ apiKey: TEST_API_KEY, baseUrl: BASE_URL, fetch })
    const { jobId, result } = await analyze(client, fetch, (id) => {
      scenario.advanceJob(id, 'running')
      scenario.advanceJob(id, 'succeeded')
    })
    expect(result.jobId).toBe(jobId)
    expect(scenario.violations).toEqual([])
  })

  it('runs the same journey over real HTTP', async () => {
    const scenario = createEngineScenario({ contract: '${contract}' })
    const server = await startEngineTestServer(scenario)
    try {
      const client = createToolpathClient({ apiKey: TEST_API_KEY, baseUrl: server.url })
      const { jobId, result } = await analyze(client, globalThis.fetch, (id) => {
        scenario.advanceJob(id, 'running')
        scenario.advanceJob(id, 'succeeded')
      })
      expect(result.jobId).toBe(jobId)
      expect(scenario.violations).toEqual([])
    } finally {
      await server.close()
    }
  })

  it('runs the same journey through MSW', async () => {
    const scenario = createEngineScenario({ contract: '${contract}', baseUrl: BASE_URL })
    const msw = setupServer(...createEngineHandlers(scenario))
    msw.listen({ onUnhandledRequest: 'error' })
    try {
      const client = createToolpathClient({ apiKey: TEST_API_KEY, baseUrl: BASE_URL })
      const { jobId, result } = await analyze(client, globalThis.fetch, (id) => {
        scenario.advanceJob(id, 'running')
        scenario.advanceJob(id, 'succeeded')
      })
      expect(result.jobId).toBe(jobId)
      expect(scenario.violations).toEqual([])
    } finally {
      msw.close()
    }
  })
})
`

/**
 * @param {{ tarball: string, workDir: string, log: (line: string) => void }} options
 */
export const runCoreCompatibility = ({ tarball, workDir, log }) => {
  const [, second] = toolchain.core.typescript
  assert.ok(second, 'the toolchain names a second TypeScript line')
  const typescriptRoot = join(workDir, `typescript-${second}`)
  npmProject({
    tarball,
    root: typescriptRoot,
    typescript: second,
    init: ['--name', 'sum', '--kind', 'library', '--runtime', 'node'],
  })
  /** @type {{ version: string }} */
  const installed = readJson(join(typescriptRoot, 'node_modules/typescript/package.json'))
  assert.equal(installed.version, second, 'init replaced a tested TypeScript version')
  must(bin(typescriptRoot), ['doctor'], { cwd: typescriptRoot })
  must(bin(typescriptRoot), ['check'], { cwd: typescriptRoot })
  log(`typescript ${second}: init, doctor and check pass`)

  const workspace = join(workDir, 'npm-workspaces')
  mkdirSync(join(workspace, 'packages/core'), { recursive: true })
  mkdirSync(join(workspace, 'packages/cli'), { recursive: true })
  gitInit(workspace)
  writeFiles(workspace, { '.gitignore': 'node_modules/\n' })
  writeManifest(workspace, {
    packageManager: `npm@${toolchain.runtime.npm}`,
    workspaces: ['packages/*'],
  })
  materialize('node', join(workspace, 'packages/core'))
  materialize('node', join(workspace, 'packages/cli'))
  writeManifest(join(workspace, 'packages/core'), { name: '@fixture/core' })
  writeManifest(join(workspace, 'packages/cli'), {
    name: '@fixture/cli',
    dependencies: { '@fixture/core': '0.0.0' },
  })
  must('npm', ['install', '--save-dev', '--save-exact', tarball], { cwd: workspace })
  useFixtureRelease(workspace)
  must(
    bin(workspace),
    [
      'init',
      '--project-spec',
      'name=core,root=packages/core,kind=library,runtime=node',
      '--project-spec',
      'name=cli,root=packages/cli,kind=application,runtime=node',
    ],
    { cwd: workspace, env: childEnv({ CI: '' }) },
  )
  useFixtureRelease(workspace)
  assert.match(must(bin(workspace), ['sync', '--dry-run'], { cwd: workspace }).stdout, /no changes/)
  must(bin(workspace), ['doctor'], { cwd: workspace })
  const focused = must(bin(workspace), ['test', '--project', 'cli'], { cwd: workspace })
  assert.ok(!focused.stdout.includes('core:unit'), 'a focused test ran another project')
  must(bin(workspace), ['check'], { cwd: workspace })
  log('npm workspaces: init, doctor, focused test and check pass')

  for (const [contract, pin] of Object.entries(toolchain.engine.contracts)) {
    const msw = toolchain.profiles['engine-msw']?.msw
    assert.ok(typeof msw === 'string', 'the toolchain pins msw')
    const root = join(workDir, `engine-${contract}`)
    const baseUrl = pin.sdk.includes('-')
      ? 'https://api.staging.toolpath.com'
      : 'https://api.toolpath.com'
    npmProject({
      tarball,
      root,
      init: [
        '--name',
        'client',
        '--kind',
        'application',
        '--runtime',
        'node',
        '--engine',
        contract,
        '--engine-integration',
        'src/**/*.test.ts',
      ],
      extra: [`msw@${msw}`],
    })
    /** @type {{ version: string }} */
    const sdk = readJson(join(root, 'node_modules/@toolpath/api/package.json'))
    assert.equal(
      sdk.version,
      pin.sdk,
      `init installed @toolpath/api@${sdk.version} for ${contract}`,
    )
    writeFiles(root, { 'src/engine.test.ts': engineTest(contract, baseUrl) })
    must(bin(root), ['doctor'], { cwd: root })
    must(bin(root), ['check'], { cwd: root })
    log(`engine ${contract} (@toolpath/api@${pin.sdk}): injected fetch, Node HTTP and MSW pass`)
  }
}
