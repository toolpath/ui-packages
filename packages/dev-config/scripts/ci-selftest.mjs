// The dev-config selftest harness (.github/workflows/dev-config-selftest.yml).
//
// `consumer` packs this package with a release identity naming the revision CI
// checked out, then builds a disposable generic consumer from the tarball, so
// the real setup, check, and result actions run against an installed package
// before anything is published. That identity override exists only here.
//
// `format-backstop` proves the CI format stage reports an unformatted commit
// without changing it.
import { spawnSync } from 'node:child_process'
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'

const packageRoot = fileURLToPath(new URL('..', import.meta.url))

/**
 * @param {string} command
 * @param {Array<string>} args
 * @param {string} cwd
 * @param {{ capture?: boolean }} [options]
 * @returns {string}
 */
const run = (command, args, cwd, { capture = false } = {}) => {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
    env: { ...process.env, HUSKY: '0' },
  })
  if (result.error) {
    throw new Error(`could not start ${command}: ${result.error.message}`)
  }
  if (result.status !== 0) {
    throw new Error(
      `${[command, ...args].join(' ')} exited with ${String(result.status ?? result.signal)}`,
    )
  }
  return capture ? result.stdout : ''
}

/**
 * @param {string} text
 * @returns {unknown}
 */
const parseJson = (text) => JSON.parse(text)

/**
 * @param {string} file
 * @returns {unknown}
 */
const readJson = (file) => parseJson(readFileSync(file, 'utf8'))

/**
 * @param {string} file
 * @returns {Promise<unknown>}
 */
const importFile = async (file) => import(pathToFileURL(file).href)

/**
 * @typedef {{
 *   repository: string,
 *   version: string,
 *   toolchain: {
 *     runtime: { pnpm: string, npm: string },
 *     core: { eslint: string, defaultTypescript: string },
 *     profiles: { vitest: { vitest: string } },
 *   },
 * } & Record<string, unknown>} Identity
 */

/**
 * Packs the built package, with its release metadata rewritten to name `sha`.
 * @param {string} sha
 * @param {string} workDirectory
 * @returns {{ tarball: string, identity: Identity }}
 */
const packWithIdentity = (sha, workDirectory) => {
  if (!/^[0-9a-f]{40}$/.test(sha)) {
    throw new Error(`--sha must be a full commit SHA, not "${sha}"`)
  }
  const built = join(packageRoot, 'dist', 'release.json')
  if (!existsSync(built)) {
    throw new Error('Build @toolpath/dev-config first (node scripts/build.mjs).')
  }
  const stage = join(workDirectory, 'package')
  mkdirSync(stage, { recursive: true })
  for (const entry of [
    'package.json',
    'dist',
    'assets',
    'contracts',
    'docs',
    'LICENSE',
    'README.md',
  ]) {
    if (existsSync(join(packageRoot, entry))) {
      cpSync(join(packageRoot, entry), join(stage, entry), { recursive: true })
    }
  }
  const identity = /** @type {Identity} */ (readJson(built))
  const repository = identity.repository
  const release = {
    ...identity,
    channel: 'release',
    sourceSha: sha,
    dirty: false,
    workflow: `${repository}/.github/workflows/dev-config-quality.yml@${sha}`,
    actions: {
      setup: `${repository}/.github/actions/dev-config-setup@${sha}`,
      check: `${repository}/.github/actions/dev-config-check@${sha}`,
      result: `${repository}/.github/actions/dev-config-result@${sha}`,
    },
  }
  writeFileSync(join(stage, 'dist', 'release.json'), `${JSON.stringify(release, null, 2)}\n`)
  const packed = run(
    'npm',
    ['pack', stage, '--pack-destination', workDirectory, '--json'],
    workDirectory,
    {
      capture: true,
    },
  )
  const [first] = /** @type {Array<{ filename: string }>} */ (parseJson(packed))
  if (!first) {
    throw new Error('npm pack produced no tarball')
  }
  return {
    tarball: join(workDirectory, first.filename),
    identity: /** @type {Identity} */ (release),
  }
}

/**
 * The generic fixture: one small Node library with a unit suite, a required
 * command suite that writes a JUnit report, and a manual suite.
 * @param {{ packageManager: 'npm' | 'pnpm', tarball: string, identity: Identity }} options
 * @returns {Record<string, string>}
 */
const fixtureFiles = ({ packageManager, tarball, identity }) => {
  const { toolchain } = identity
  const manager =
    packageManager === 'pnpm' ? `pnpm@${toolchain.runtime.pnpm}` : `npm@${toolchain.runtime.npm}`
  return {
    'package.json': `${JSON.stringify(
      {
        name: 'dev-config-ci-fixture',
        private: true,
        type: 'module',
        packageManager: manager,
        devDependencies: {
          '@toolpath/dev-config': `file:${tarball}`,
          '@types/node': '24.10.1',
          eslint: toolchain.core.eslint,
          typescript: toolchain.core.defaultTypescript,
          vitest: toolchain.profiles.vitest.vitest,
        },
      },
      null,
      2,
    )}\n`,
    '.gitignore': 'node_modules/\nreports/\n',
    'dev.config.mjs': `import { defineConfig } from '@toolpath/dev-config'

export default defineConfig({
  schemaVersion: 1,
  root: import.meta.url,
  projects: [
    {
      name: 'fixture',
      root: '.',
      kind: 'library',
      runtime: 'node',
      tsconfig: 'tsconfig.json',
      suites: {
        unit: { runner: 'vitest', config: 'vitest.config.ts' },
        smoke: {
          runner: 'command',
          argv: ['node', 'scripts/smoke.mjs'],
          report: { format: 'junit', path: 'reports/smoke.xml' },
        },
        device: {
          runner: 'command',
          argv: ['node', 'scripts/smoke.mjs'],
          report: { format: 'junit', path: 'reports/device.xml' },
          ci: 'manual',
          reason: 'Stands in for a suite that needs hardware CI does not have',
        },
      },
    },
  ],
  ci: { node: '24.18.0' },
})
`,
    'eslint.config.mjs': `import config from './dev.config.mjs'
import { createEslintConfig } from '@toolpath/dev-config/eslint'

export default await createEslintConfig(config)
`,
    'prettier.config.mjs': `export { default } from '@toolpath/dev-config/prettier'
`,
    'tsconfig.json': `${JSON.stringify(
      {
        extends: '@toolpath/dev-config/typescript/node.json',
        compilerOptions: { allowJs: true, checkJs: true },
        include: ['src', 'scripts', '*.mjs', '*.ts'],
      },
      null,
      2,
    )}\n`,
    'vitest.config.ts': `import { createVitestConfig } from '@toolpath/dev-config/vitest'
import config from './dev.config.mjs'

export default createVitestConfig(config, { project: 'fixture', suite: 'unit' })
`,
    'src/sum.ts': `export const sum = (left: number, right: number): number => left + right
`,
    'src/sum.test.ts': `import { describe, expect, it } from 'vitest'
import { sum } from './sum.js'

describe('sum', () => {
  it('adds two numbers', () => {
    expect(sum(2, 3)).toBe(5)
  })
})
`,
    'scripts/smoke.mjs': `// A stand-in integration suite: one check, reported as JUnit.
import { mkdirSync, writeFileSync } from 'node:fs'

const passed = [1, 2, 3].reduce((total, value) => total + value, 0) === 6
mkdirSync('reports', { recursive: true })
const failure = passed ? '' : '<failure message="the total is wrong"/>'
writeFileSync(
  process.env.TOOLPATH_DEV_SUITE === 'fixture:device' ? 'reports/device.xml' : 'reports/smoke.xml',
  \`<testsuite name="smoke" tests="1" failures="\${passed ? 0 : 1}" errors="0" skipped="0"><testcase name="adds">\${failure}</testcase></testsuite>\\n\`,
)
process.exitCode = passed ? 0 : 1
`,
  }
}

/**
 * @param {string} directory
 * @param {Record<string, string>} files
 */
const writeFiles = (directory, files) => {
  for (const [path, content] of Object.entries(files)) {
    const file = join(directory, path)
    mkdirSync(join(file, '..'), { recursive: true })
    writeFileSync(file, content)
  }
}

/** @param {string} directory */
const commitAll = (directory) => {
  run('git', ['init', '--quiet', '--initial-branch=main'], directory)
  run('git', ['config', 'user.name', 'dev-config selftest'], directory)
  run('git', ['config', 'user.email', 'selftest@example.invalid'], directory)
  run('git', ['add', '--all'], directory)
  run('git', ['commit', '--quiet', '--message', 'fixture'], directory)
}

/**
 * @param {{ packageManager: 'npm' | 'pnpm', sha: string, out: string }} options
 */
export const createConsumer = async ({ packageManager, sha, out }) => {
  const consumer = resolve(out)
  rmSync(consumer, { recursive: true, force: true })
  mkdirSync(consumer, { recursive: true })
  const work = mkdtempSync(join(tmpdir(), 'dev-config-selftest-'))
  const { tarball, identity } = packWithIdentity(sha, work)
  writeFiles(consumer, fixtureFiles({ packageManager, tarball, identity }))
  if (packageManager === 'pnpm') {
    run('pnpm', ['install', '--no-frozen-lockfile'], consumer)
  } else {
    run('npm', ['install', '--no-audit', '--no-fund'], consumer)
  }

  // The caller workflow, rendered by the installed package from its own
  // (selftest) identity, as `init` would write it.
  const installed = join(consumer, 'node_modules', '@toolpath', 'dev-config', 'dist')
  const { loadConfig } = /** @type {{ loadConfig: (file: string) => Promise<unknown> }} */ (
    await importFile(join(installed, 'config', 'load.js'))
  )
  const { resolveConfig } = /** @type {{ resolveConfig: (config: unknown) => unknown }} */ (
    await importFile(join(installed, 'config', 'resolve.js'))
  )
  const { renderCallerWorkflow } =
    /** @type {{ renderCallerWorkflow: (resolved: unknown, identity: unknown, options: { defaultBranch: string }) => string }} */ (
      await importFile(join(installed, 'ci', 'render.js'))
    )
  const resolved = resolveConfig(await loadConfig(join(consumer, 'dev.config.mjs')))
  const workflow = renderCallerWorkflow(resolved, readJson(join(installed, 'release.json')), {
    defaultBranch: 'main',
  })
  writeFiles(consumer, { '.github/workflows/quality.yml': workflow })
  // What a commit through the installed pre-commit hook would contain: the
  // package's own staged-file worker applies safe lint fixes, then formatting.
  const files = [
    ...Object.keys(fixtureFiles({ packageManager, tarball, identity })),
    '.github/workflows/quality.yml',
  ]
  run(
    process.execPath,
    [join(installed, 'cli', 'main.js'), 'hooks', 'files', '--', ...files],
    consumer,
  )
  commitAll(consumer)
  process.stdout.write(
    `dev-config selftest: ${packageManager} consumer at ${consumer} (identity ${sha})\n`,
  )
}

/**
 * Commits an unformatted file the way a commit made without the hook would,
 * then requires the CI format stage to fail and leave the bytes unchanged.
 * @param {{ consumer: string }} options
 */
export const checkFormatBackstop = ({ consumer }) => {
  const directory = resolve(consumer)
  const path = join(directory, 'src', 'unformatted.ts')
  const content = 'export const  spaced = ( value:number )=>value*2;\n'
  writeFileSync(path, content)
  run('git', ['add', 'src/unformatted.ts'], directory)
  run('git', ['commit', '--quiet', '--message', 'unformatted'], directory)
  const cli = join(directory, 'node_modules', '@toolpath', 'dev-config', 'dist', 'cli', 'main.js')
  const result = spawnSync(process.execPath, [cli, 'ci', '--stage', 'format'], {
    cwd: directory,
    encoding: 'utf8',
  })
  const unchanged = readFileSync(path, 'utf8') === content
  run('git', ['reset', '--quiet', '--hard', 'HEAD~1'], directory)
  if (result.status !== 1) {
    throw new Error(
      `ci --stage format exited with ${String(result.status)} for an unformatted file; expected 1.\n${result.stdout}${result.stderr}`,
    )
  }
  if (!result.stderr.includes('src/unformatted.ts')) {
    throw new Error(`ci --stage format did not name the unformatted file:\n${result.stderr}`)
  }
  if (!unchanged) {
    throw new Error('ci --stage format changed the file; the CI backstop must be read-only')
  }
  process.stdout.write(
    'dev-config selftest: the format backstop reported the file and left it unchanged\n',
  )
}

const main = async () => {
  const [command, ...rest] = process.argv.slice(2)
  const { values } = parseArgs({
    args: rest,
    options: {
      'package-manager': { type: 'string' },
      sha: { type: 'string' },
      out: { type: 'string' },
      consumer: { type: 'string' },
    },
    strict: true,
  })
  if (command === 'consumer') {
    const packageManager = values['package-manager']
    if ((packageManager !== 'npm' && packageManager !== 'pnpm') || !values.sha || !values.out) {
      throw new Error(
        'usage: ci-selftest.mjs consumer --package-manager npm|pnpm --sha <full sha> --out <directory>',
      )
    }
    await createConsumer({ packageManager, sha: values.sha, out: values.out })
    return
  }
  if (command === 'format-backstop') {
    if (!values.consumer) {
      throw new Error('usage: ci-selftest.mjs format-backstop --consumer <directory>')
    }
    checkFormatBackstop({ consumer: values.consumer })
    return
  }
  throw new Error('usage: ci-selftest.mjs consumer|format-backstop ...')
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await main()
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  }
}
