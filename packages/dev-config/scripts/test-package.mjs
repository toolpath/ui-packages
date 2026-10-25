// Packs @toolpath/dev-config and proves the tarball works for a consumer outside
// this monorepo: contents, public imports and declarations, optional-peer
// isolation, the CLI, and init/sync/doctor/check/hooks in npm and pnpm repositories.
import assert from 'node:assert/strict'
import { existsSync, readFileSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'
import {
  childEnv,
  createWorkRoot,
  exec,
  gitInit,
  materialize,
  must,
  packageRoot,
  packTarball,
  readJson,
  tarballFiles,
  useFixtureRelease,
  writeFiles,
  writeManifest,
} from './harness.mjs'

/** @type {{ core: { eslint: string, defaultTypescript: string }, runtime: { pnpm: string, npm: string } }} */
const toolchain = readJson(join(packageRoot, 'src/policy/toolchain.json'))
const keep = process.argv.includes('--keep')
const only = process.argv
  .find((argument) => argument.startsWith('--only='))
  ?.slice('--only='.length)
const work = createWorkRoot()
const tarball = packTarball(join(work, 'tarballs'))
/** @type {Array<{ name: string, ms: number }>} */
const passed = []

/**
 * @param {string} name
 * @param {() => void} body
 */
const scenario = (name, body) => {
  if (only !== undefined && !name.startsWith(only)) {
    return
  }
  const started = performance.now()
  try {
    body()
  } catch (error) {
    process.stderr.write(
      `✗ ${name}\n${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
    )
    process.stderr.write(`Disposable consumers kept in ${work}\n`)
    process.exit(1)
  }
  passed.push({ name, ms: performance.now() - started })
}

const bin = (/** @type {string} */ root) => join(root, 'node_modules/.bin/toolpath-dev')

scenario('tarball contents', () => {
  const files = tarballFiles(tarball)
  const required = [
    'package.json',
    'README.md',
    'LICENSE',
    'dist/index.js',
    'dist/index.d.ts',
    'dist/cli/main.js',
    'dist/release.json',
    'dist/policy/toolchain.json',
    'assets/typescript/base.json',
    'assets/typescript/node.json',
    'assets/typescript/browser.json',
    'assets/typescript/library.json',
  ]
  for (const file of required) {
    assert.ok(files.includes(file), `the tarball is missing ${file}`)
  }
  const forbidden = files.filter(
    (file) =>
      /^(src|tests|scripts|fixtures|\.tmp)\//.test(file) ||
      /(^|\/)node_modules\//.test(file) ||
      /\.(map|tsbuildinfo)$/.test(file) ||
      /(^|\/)\.env/.test(file) ||
      file.endsWith('.build-inputs'),
  )
  assert.deepEqual(forbidden, [], 'the tarball ships files consumers must not receive')
  const manifest = must('tar', ['-xzOf', tarball, 'package/package.json'], { cwd: work }).stdout
  assert.ok(
    !manifest.includes('workspace:'),
    'a workspace: range escaped into the published manifest',
  )
})

const minimal = join(work, 'npm-minimal')
scenario('minimal npm consumer installs only required peers', () => {
  must('mkdir', ['-p', minimal], { cwd: work })
  writeManifest(minimal, { packageManager: `npm@${toolchain.runtime.npm}` })
  must(
    'npm',
    [
      'install',
      '--save-dev',
      '--save-exact',
      tarball,
      `eslint@${toolchain.core.eslint}`,
      `typescript@${toolchain.core.defaultTypescript}`,
    ],
    {
      cwd: minimal,
    },
  )
  for (const absent of [
    'react',
    'react-dom',
    'msw',
    'expo',
    '@playwright/test',
    'vitest',
    'vite',
    'jest',
    '@toolpath/api',
  ]) {
    assert.ok(
      !existsSync(join(minimal, 'node_modules', absent)),
      `${absent} was installed although no profile selects it`,
    )
  }
  const mode = statSync(join(minimal, 'node_modules/@toolpath/dev-config/dist/cli/main.js')).mode
  assert.ok((mode & 0o111) !== 0, 'the CLI is not executable')
  const help = must(bin(minimal), ['--help'], { cwd: minimal })
  assert.match(help.stdout, /Usage: toolpath-dev <command>/)
  const bad = exec(bin(minimal), ['lint', '--nope'], { cwd: minimal })
  assert.equal(bad.code, 2, 'an unknown flag must exit 2')
})

scenario('core entry points load no optional framework', () => {
  const script = `
import { registerHooks } from 'node:module'
const heavy = /node_modules\\/(react|react-dom|msw|expo|jest|jest-expo|vite|vitest|@playwright|@babel\\/core|@toolpath\\/api|@vitejs|esbuild)\\//
const loaded = new Set()
registerHooks({ resolve: (specifier, context, next) => { const result = next(specifier, context); if (heavy.test(result.url)) loaded.add(result.url); return result } })
await import('@toolpath/dev-config')
await import('@toolpath/dev-config/prettier')
await import('@toolpath/dev-config/hooks')
await import('@toolpath/dev-config/eslint/plugin')
await import('@toolpath/dev-config/eslint')
await import('@toolpath/dev-config/engine/eslint')
const metadata = await import('@toolpath/dev-config/package.json', { with: { type: 'json' } })
const release = await import('@toolpath/dev-config/release.json', { with: { type: 'json' } })
if (metadata.default.name !== '@toolpath/dev-config' || release.default.name !== '@toolpath/dev-config') throw new Error('JSON exports')
for (const preset of ['base', 'node', 'browser', 'library']) import.meta.resolve('@toolpath/dev-config/typescript/' + preset + '.json')
console.log(JSON.stringify([...loaded]))
`
  const result = must('node', ['--input-type=module', '-e', script], { cwd: minimal })
  assert.deepEqual(
    JSON.parse(result.stdout.trim().split('\n').at(-1) ?? '[]'),
    [],
    'a core entry point loaded an optional framework',
  )
})

scenario('optional entry points name the missing profile', () => {
  writeFiles(minimal, {
    'dev.config.mjs': `import { defineConfig } from '@toolpath/dev-config'
export default defineConfig({
  schemaVersion: 1,
  root: import.meta.url,
  projects: [{ name: 'core', root: '.', kind: 'library', runtime: 'node', tsconfig: 'tsconfig.json', suites: { unit: { runner: 'vitest', config: 'vitest.config.mjs' } } }],
  ci: { node: '24.18.0' },
})
`,
    'tsconfig.json':
      '{ "extends": "@toolpath/dev-config/typescript/node.json", "include": ["*.mjs"] }\n',
    'vitest.config.mjs': '',
  })
  const script = `
import config from './dev.config.mjs'
const { createVitestConfig } = await import('@toolpath/dev-config/vitest')
try { createVitestConfig(config, { project: 'core', suite: 'unit' }); console.log('no error') } catch (error) { console.log(error.message) }
`
  const result = must('node', ['--input-type=module', '-e', script], { cwd: minimal })
  assert.match(result.stdout, /The Vitest profile needs vitest/)
  assert.match(result.stdout, /npm install --save-dev --save-exact vitest@/)
})

scenario('declarations compile against the minimal install', () => {
  writeFiles(minimal, {
    'consumer.ts': `import { defineConfig, resolveConfig, type DevConfig, type ResolvedConfig } from '@toolpath/dev-config'
import { createEslintConfig } from '@toolpath/dev-config/eslint'
import plugin from '@toolpath/dev-config/eslint/plugin'
import prettier from '@toolpath/dev-config/prettier'
import { createLintStagedConfig } from '@toolpath/dev-config/hooks'

export const checks: Array<unknown> = [defineConfig, resolveConfig, createEslintConfig, plugin, prettier.printWidth, createLintStagedConfig]
export type Shapes = [DevConfig, ResolvedConfig]
`,
    'tsconfig.check.json':
      '{ "extends": "@toolpath/dev-config/typescript/node.json", "compilerOptions": { "types": [] }, "files": ["consumer.ts"] }\n',
  })
  must(join(minimal, 'node_modules/.bin/tsc'), ['-p', 'tsconfig.check.json'], { cwd: minimal })
})

const single = join(work, 'npm-single')
scenario('npm single project: init, idempotent sync, doctor, check', () => {
  must('mkdir', ['-p', single], { cwd: work })
  gitInit(single)
  writeFiles(single, { '.gitignore': 'node_modules/\n' })
  writeManifest(single, { packageManager: `npm@${toolchain.runtime.npm}` })
  materialize('node', single)
  must('npm', ['install', '--save-dev', '--save-exact', tarball], { cwd: single })
  useFixtureRelease(single)
  const dry = must(
    bin(single),
    ['init', '--dry-run', '--name', 'sum', '--kind', 'library', '--runtime', 'node'],
    { cwd: single },
  )
  assert.match(dry.stdout, /\+\+\+ b\/dev\.config\.mjs/)
  assert.ok(!existsSync(join(single, 'dev.config.mjs')), 'init --dry-run wrote a file')
  must(bin(single), ['init', '--name', 'sum', '--kind', 'library', '--runtime', 'node'], {
    cwd: single,
    env: childEnv({ CI: '' }),
  })
  useFixtureRelease(single)
  const again = must(bin(single), ['sync', '--dry-run'], { cwd: single })
  assert.match(again.stdout, /no changes/, `a second sync would change files:\n${again.stdout}`)
  must(bin(single), ['doctor'], { cwd: single })
  const check = must(bin(single), ['check'], { cwd: single })
  assert.ok(
    Buffer.byteLength(check.stdout) < 2048,
    `a passing check printed ${Buffer.byteLength(check.stdout)} bytes`,
  )
  assert.ok(!/prettier/i.test(check.output), 'check invoked formatting')
})

scenario('npm single project: real defects fail each scope', () => {
  /** @type {Array<[string, string]>} */
  const defects = [
    ['src/defect.ts', 'export const parse = (text: string) => JSON.parse(text).value\n'],
    [
      'src/defect.test.ts',
      "import { it } from 'vitest'\nit('waits', () => { Promise.resolve(1) })\n",
    ],
    ['scripts/defect.mjs', "export const read = () => { Promise.resolve('x') }\n"],
  ]
  for (const [path, content] of defects) {
    writeFiles(single, { [path]: content })
    const result = exec(bin(single), ['lint'], { cwd: single })
    rmSync(join(single, path))
    assert.equal(result.code, 1, `lint passed with a defect in ${path}:\n${result.output}`)
  }
  writeFiles(single, { 'src/broken.ts': 'export const value: number = "text"\n' })
  const types = exec(bin(single), ['check-types'], { cwd: single })
  rmSync(join(single, 'src/broken.ts'))
  assert.equal(types.code, 1, 'check-types passed a type error')
  writeFiles(single, { 'src/empty.ts': 'export const nothing = 0\n' })
  rmSync(join(single, 'src/sum.test.ts'))
  const empty = exec(bin(single), ['test'], { cwd: single })
  materialize('node', single)
  rmSync(join(single, 'src/empty.ts'))
  assert.equal(empty.code, 1, `a suite with no tests passed:\n${empty.output}`)
})

scenario('npm single project: the pre-commit hook fixes and formats staged files only', () => {
  must('git', ['add', '-A'], { cwd: single })
  must('git', ['commit', '--quiet', '-m', 'init'], { cwd: single })
  writeFiles(single, {
    'src/format-me.ts':
      'export function twice(value:number){ if (value > 0) return value*2\n  return 0 }\n',
    'notes.md': '#   Notes\n',
  })
  must('git', ['add', 'src/format-me.ts', 'notes.md'], { cwd: single })
  writeFiles(single, { 'notes.md': '#   Notes\n\nunstaged line\n' })
  must('git', ['commit', '--quiet', '-m', 'format'], { cwd: single })
  const committed = must('git', ['show', 'HEAD:src/format-me.ts'], { cwd: single }).stdout
  assert.match(
    committed,
    /export const twice = \(value: number\) => \{/,
    `the hook did not apply the safe fix:\n${committed}`,
  )
  assert.match(
    committed,
    /\{\n\s+return value \* 2\n\s+\}/,
    `the hook did not format:\n${committed}`,
  )
  assert.equal(must('git', ['show', 'HEAD:notes.md'], { cwd: single }).stdout, '# Notes\n')
  assert.equal(
    readFileSync(join(single, 'notes.md'), 'utf8'),
    '# Notes\n\nunstaged line\n',
    'the unstaged edit was lost',
  )
  writeFiles(single, {
    'src/bad-commit.ts': 'export const parse = (text: string) => JSON.parse(text).value\n',
  })
  must('git', ['add', 'src/bad-commit.ts'], { cwd: single })
  const refused = exec('git', ['commit', '--quiet', '-m', 'bad'], { cwd: single })
  assert.notEqual(refused.code, 0, 'a commit with a lint error passed the hook')
  assert.ok(existsSync(join(single, 'src/bad-commit.ts')), 'the refused file was lost')
  must('git', ['reset', '--quiet', 'HEAD', 'src/bad-commit.ts'], { cwd: single })
  rmSync(join(single, 'src/bad-commit.ts'))
})

const workspace = join(work, 'pnpm-workspace')
scenario('pnpm workspace: init, focused check, idempotent sync', () => {
  must('mkdir', ['-p', join(workspace, 'packages/core'), join(workspace, 'packages/util')], {
    cwd: work,
  })
  gitInit(workspace)
  writeFiles(workspace, { '.gitignore': 'node_modules/\n' })
  writeManifest(workspace, { packageManager: `pnpm@${toolchain.runtime.pnpm}` })
  writeFiles(workspace, { 'pnpm-workspace.yaml': 'packages:\n  - packages/*\n' })
  materialize('node', join(workspace, 'packages/core'))
  materialize('node', join(workspace, 'packages/util'))
  writeManifest(join(workspace, 'packages/core'), { name: '@fixture/core' })
  writeManifest(join(workspace, 'packages/util'), {
    name: '@fixture/util',
    dependencies: { '@fixture/core': 'workspace:*' },
  })
  must('pnpm', ['add', '--save-dev', '--save-exact', '--workspace-root', tarball], {
    cwd: workspace,
  })
  useFixtureRelease(workspace)
  must(
    bin(workspace),
    [
      'init',
      '--project-spec',
      'name=core,root=packages/core,kind=library,runtime=universal',
      '--project-spec',
      'name=util,root=packages/util,kind=library,runtime=node',
    ],
    { cwd: workspace, env: childEnv({ CI: '' }) },
  )
  useFixtureRelease(workspace)
  assert.match(must(bin(workspace), ['sync', '--dry-run'], { cwd: workspace }).stdout, /no changes/)
  must(bin(workspace), ['doctor'], { cwd: workspace })
  const focused = must(bin(workspace), ['check', '--project', 'core'], { cwd: workspace })
  assert.ok(!focused.stdout.includes('util:'), 'a focused check ran another project')
  must(bin(workspace), ['check'], { cwd: workspace, env: childEnv({}) })
})

if (!keep) {
  rmSync(work, { recursive: true, force: true })
}
const total = passed.reduce((sum, entry) => sum + entry.ms, 0)
process.stdout.write(
  `test:package: ${passed.length} scenarios passed (${(total / 1000).toFixed(1)}s)\n`,
)
