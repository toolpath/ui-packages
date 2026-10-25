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

scenario('CommonJS configuration files can require the entry points', () => {
  // babel.config.js, jest.config.js and metro.config.js are often CommonJS.
  const script = `
const { defineConfig } = require('@toolpath/dev-config')
const prettier = require('@toolpath/dev-config/prettier')
const { createEslintConfig } = require('@toolpath/dev-config/eslint')
if (typeof defineConfig !== 'function' || prettier.default.printWidth !== 100 || typeof createEslintConfig !== 'function') {
  throw new Error('a CommonJS require returned the wrong module')
}
`
  must('node', ['-e', script], { cwd: minimal })
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
  writeFiles(single, {
    '.gitignore': 'node_modules/\n',
    'AGENTS.md': '# Repository guidance\n\nOur own rule: keep the changelog current.\n',
  })
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
  const agents = readFileSync(join(single, 'AGENTS.md'), 'utf8')
  assert.match(
    agents,
    /^# Repository guidance\n\nOur own rule: keep the changelog current\.\n\n<!-- toolpath-dev:begin /,
  )
  // Every process `check` starts records the modules it loads; none may be a formatter,
  // browser installer, MSW, Expo, or the Engine SDK.
  const loads = join(work, 'check-loads.log')
  const tracer = `data:text/javascript,${encodeURIComponent(`
import { registerHooks } from 'node:module'
import { appendFileSync } from 'node:fs'
registerHooks({ resolve: (specifier, context, next) => { const result = next(specifier, context); if (/node_modules\\/(prettier|msw|expo|jest-expo|playwright|@playwright|@toolpath\\/api)\\//.test(result.url)) appendFileSync(${JSON.stringify(loads)}, result.url + '\\n'); return result } })
`)}`
  const check = must(bin(single), ['check'], {
    cwd: single,
    env: childEnv({ NODE_OPTIONS: `--import=${tracer}` }),
  })
  assert.ok(
    Buffer.byteLength(check.stdout) < 2048,
    `a passing check printed ${Buffer.byteLength(check.stdout)} bytes`,
  )
  assert.ok(
    !existsSync(loads),
    `check loaded:\n${existsSync(loads) ? readFileSync(loads, 'utf8') : ''}`,
  )
})

scenario('npm single project: doctor diagnoses a stale receipt and a missing managed file', () => {
  const receiptFile = join(single, '.toolpath/dev-config.json')
  const original = readFileSync(receiptFile, 'utf8')
  writeFiles(single, {
    '.toolpath/dev-config.json': original.replace(
      /"sourceSha": "[0-9a-f]+"/,
      `"sourceSha": "${'f'.repeat(40)}"`,
    ),
  })
  const stale = exec(bin(single), ['doctor'], { cwd: single })
  assert.equal(stale.code, 2)
  assert.match(stale.stderr, /records workflow revision f{40}/)
  writeFiles(single, { '.toolpath/dev-config.json': original })
  rmSync(join(single, '.claude/skills/commit/SKILL.md'))
  const missing = exec(bin(single), ['doctor'], { cwd: single })
  assert.equal(missing.code, 2)
  assert.match(
    missing.stderr,
    /\.claude\/skills\/commit\/SKILL\.md: is a managed file that is missing/,
  )
  must(bin(single), ['sync'], { cwd: single })
  must(bin(single), ['doctor'], { cwd: single })
})

scenario('npm single project: the Engine profile adds and removes the toolpath-api skill', () => {
  const configFile = join(single, 'dev.config.mjs')
  const original = readFileSync(configFile, 'utf8')
  const skill = join(single, '.claude/skills/toolpath-api/SKILL.md')
  assert.match(original, /^ {2}schemaVersion: 1,$/m)
  writeFiles(single, {
    'dev.config.mjs': original.replace(
      /^ {2}schemaVersion: 1,$/m,
      "  schemaVersion: 1,\n  engine: { contract: 'api-1.29.1', integrationFiles: ['src/engine/**/*.ts'] },",
    ),
  })
  must(bin(single), ['agents', 'sync'], { cwd: single })
  assert.match(readFileSync(skill, 'utf8'), /^name: toolpath-api$/m)
  assert.match(
    readFileSync(join(single, 'AGENTS.md'), 'utf8'),
    /\[toolpath-api\]\(\.claude\/skills\/toolpath-api\/SKILL\.md\)/,
  )
  writeFiles(single, { 'dev.config.mjs': original })
  must(bin(single), ['agents', 'sync'], { cwd: single })
  assert.ok(
    !existsSync(join(single, '.claude/skills/toolpath-api')),
    'the toolpath-api skill was left behind',
  )
  assert.doesNotMatch(readFileSync(join(single, 'AGENTS.md'), 'utf8'), /toolpath-api/)
  assert.ok(
    existsSync(join(single, 'eslint.config.mjs')),
    'agents sync removed a file of another scope',
  )
  assert.match(must(bin(single), ['sync', '--dry-run'], { cwd: single }).stdout, /no changes/)
  must(bin(single), ['doctor'], { cwd: single })
})

scenario(
  'init refuses a competing native config without writing, and recovers from a failed install',
  () => {
    const competing = join(work, 'npm-competing')
    must('mkdir', ['-p', competing], { cwd: work })
    gitInit(competing)
    writeManifest(competing, {
      packageManager: `npm@${toolchain.runtime.npm}`,
      prettier: { semi: true },
    })
    writeFiles(competing, { '.prettierrc': '{ "semi": true }\n', '.gitignore': 'node_modules/\n' })
    must('npm', ['install', '--save-dev', '--save-exact', tarball], { cwd: competing })
    useFixtureRelease(competing)
    const refused = exec(bin(competing), ['init', '--name', 'app', '--runtime', 'node'], {
      cwd: competing,
    })
    assert.equal(refused.code, 2)
    assert.match(refused.stderr, /\.prettierrc: is another Prettier configuration/)
    assert.match(refused.stderr, /package\.json#prettier/)
    assert.ok(!existsSync(join(competing, 'dev.config.mjs')), 'a refused init wrote files')

    // Hooks another tool owns are a conflict too: init never redirects Git away from them.
    rmSync(join(competing, '.prettierrc'))
    writeManifest(competing, {
      packageManager: `npm@${toolchain.runtime.npm}`,
      devDependencies: { '@toolpath/dev-config': `file:${tarball}` },
    })
    must('git', ['config', 'core.hooksPath', '.githooks'], { cwd: competing })
    const hooks = exec(bin(competing), ['init', '--name', 'app', '--runtime', 'node'], {
      cwd: competing,
      env: childEnv({ CI: '' }),
    })
    assert.equal(hooks.code, 2)
    assert.match(hooks.stderr, /git hooks: Git runs hooks from \.githooks/)
    assert.ok(
      !existsSync(join(competing, 'dev.config.mjs')),
      'init wrote files over a foreign hook setup',
    )
    must('git', ['config', '--unset', 'core.hooksPath'], { cwd: competing })
    writeManifest(competing, {
      packageManager: `npm@${toolchain.runtime.npm}`,
      devDependencies: { '@toolpath/dev-config': `file:${tarball}` },
    })
    const offline = exec(bin(competing), ['init', '--name', 'app', '--runtime', 'node'], {
      cwd: competing,
      env: childEnv({
        npm_config_registry: 'http://127.0.0.1:9/',
        npm_config_fetch_retries: '0',
        CI: '',
      }),
    })
    assert.equal(offline.code, 2, offline.output)
    assert.match(offline.stderr, /had already written: .*dev\.config\.mjs/)
    assert.ok(
      existsSync(join(competing, '.toolpath/dev-config-recovery.patch')),
      'no recovery patch was saved',
    )
    assert.ok(
      !existsSync(join(competing, '.toolpath/dev-config.json')),
      'a failed install wrote the receipt',
    )
  },
)

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
      'function twice(value:number){ if (value > 0) return value*2\n  return 0 }\nexport const doubled = twice(2)\n',
    'notes.md': '#   Notes\n',
  })
  must('git', ['add', 'src/format-me.ts', 'notes.md'], { cwd: single })
  writeFiles(single, { 'notes.md': '#   Notes\n\nunstaged line\n' })
  must('git', ['commit', '--quiet', '-m', 'format'], { cwd: single })
  const committed = must('git', ['show', 'HEAD:src/format-me.ts'], { cwd: single }).stdout
  assert.match(
    committed,
    /^const twice = \(value: number\) => \{/,
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

scenario('npm single project: an interrupted hook restores the unstaged edits it hid', () => {
  writeFiles(single, { 'src/interrupt.ts': 'export const first = 1\n' })
  must('git', ['add', 'src/interrupt.ts'], { cwd: single })
  must('git', ['commit', '--quiet', '-m', 'interrupt base'], { cwd: single })
  writeFiles(single, { 'src/interrupt.ts': 'export const first =  1\n' })
  must('git', ['add', 'src/interrupt.ts'], { cwd: single })
  writeFiles(single, { 'src/interrupt.ts': 'export const first =  1\nexport const second = 2\n' })
  // Signal while lint-staged has the unstaged hunk hidden: the work tree then holds only the staged text.
  const file = join(single, 'src/interrupt.ts')
  const script = `
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
const child = spawn(${JSON.stringify(bin(single))}, ['hooks', 'pre-commit'], { cwd: ${JSON.stringify(single)}, stdio: 'ignore' })
const started = Date.now()
const poll = setInterval(() => {
  let text = ''
  try { text = readFileSync(${JSON.stringify(file)}, 'utf8') } catch {}
  if (!text.includes('second') || Date.now() - started > 20000) {
    clearInterval(poll)
    child.kill('SIGINT')
  }
}, 2)
child.on('close', (code, signal) => { console.log(JSON.stringify({ code, signal })) })
`
  const result = must('node', ['--input-type=module', '-e', script], { cwd: single })
  /** @type {unknown} */
  const parsed = JSON.parse(result.stdout.trim())
  const outcome = /** @type {{ code: number | null, signal: string | null }} */ (parsed)
  assert.notEqual(outcome.code, 0, 'an interrupted hook reported success')
  assert.equal(
    readFileSync(join(single, 'src/interrupt.ts'), 'utf8'),
    'export const first =  1\nexport const second = 2\n',
    'the unstaged edit was not restored after the interruption',
  )
  assert.equal(
    must('git', ['show', ':src/interrupt.ts'], { cwd: single }).stdout,
    'export const first =  1\n',
    'the index changed',
  )
  must('git', ['reset', '--quiet', 'HEAD', 'src/interrupt.ts'], { cwd: single })
  must('git', ['checkout', '--', 'src/interrupt.ts'], { cwd: single })
})

scenario('npm single project: hook edge cases', () => {
  const show = (/** @type {string} */ path) =>
    must('git', ['show', `HEAD:${path}`], { cwd: single }).stdout
  const commit = (/** @type {string} */ message) =>
    exec('git', ['commit', '--quiet', '-m', message], { cwd: single })

  // A byte-retained asset, declared as a project fact.
  const configFile = join(single, 'dev.config.mjs')
  writeFiles(single, {
    'dev.config.mjs': readFileSync(configFile, 'utf8').replace(
      '  ci: {',
      "  formatIgnore: [{ files: ['retained/**'], reason: 'Recorded bytes whose hash a test checks' }],\n  ci: {",
    ),
  })
  must('git', ['add', 'dev.config.mjs'], { cwd: single })
  assert.equal(commit('retain').code, 0)

  writeFiles(single, {
    'src/with space/odd (1).ts': 'export const   spaced = 1\n',
    'retained/snapshot.json': '{"keep":   "these bytes"}\n',
    'image.png': '\u0089PNG\r\n\u001a\n\u0000binary',
  })
  must('git', ['add', 'src/with space/odd (1).ts', 'retained/snapshot.json', 'image.png'], {
    cwd: single,
  })
  assert.equal(commit('edge').code, 0)
  assert.equal(show('src/with space/odd (1).ts'), 'export const spaced = 1\n')
  assert.equal(
    show('retained/snapshot.json'),
    '{"keep":   "these bytes"}\n',
    'a retained file was reformatted',
  )

  must('git', ['mv', 'src/with space/odd (1).ts', 'src/renamed.ts'], { cwd: single })
  assert.equal(commit('rename').code, 0, 'a rename-only commit failed')
  must('git', ['rm', '--quiet', 'src/renamed.ts'], { cwd: single })
  assert.equal(commit('delete').code, 0, 'a deletion-only commit failed')

  writeFiles(single, { 'broken.json': '{ "unterminated": \n' })
  must('git', ['add', 'broken.json'], { cwd: single })
  const parse = commit('broken')
  assert.notEqual(parse.code, 0, 'a formatter parse failure passed the hook')
  assert.match(parse.output, /broken\.json: Prettier could not parse this file/)
  assert.equal(
    readFileSync(join(single, 'broken.json'), 'utf8'),
    '{ "unterminated": \n',
    'the file that failed to parse changed',
  )
  must('git', ['rm', '--quiet', '--cached', 'broken.json'], { cwd: single })
  rmSync(join(single, 'broken.json'))

  // The unstaged edit touches the line the formatter rewrites, so it cannot be reapplied cleanly.
  writeFiles(single, { 'src/conflict.ts': 'export const value={a:1}\n' })
  must('git', ['add', 'src/conflict.ts'], { cwd: single })
  writeFiles(single, { 'src/conflict.ts': 'export const value={a:2}\n' })
  const conflicted = commit('conflict')
  // lint-staged fails the commit, says so, and returns the index and work tree to how they were.
  assert.notEqual(conflicted.code, 0, 'a commit whose unstaged edit could not be restored passed')
  assert.match(conflicted.output, /Failed to restore unstaged changes/)
  assert.equal(
    must('git', ['show', ':src/conflict.ts'], { cwd: single }).stdout,
    'export const value={a:1}\n',
    'the staged version was lost',
  )
  assert.equal(
    readFileSync(join(single, 'src/conflict.ts'), 'utf8'),
    'export const value={a:2}\n',
    'the unstaged edit was lost',
  )
})

scenario('npm React app: init wires the compiler into Vite and check proves it compiles', () => {
  const app = join(work, 'npm-react')
  must('mkdir', ['-p', app], { cwd: work })
  gitInit(app)
  writeFiles(app, { '.gitignore': 'node_modules/\n' })
  writeManifest(app, { packageManager: `npm@${toolchain.runtime.npm}` })
  materialize('react', app)
  must('npm', ['install', '--save-exact', 'react@19.3.0', 'react-dom@19.3.0'], { cwd: app })
  must(
    'npm',
    [
      'install',
      '--save-dev',
      '--save-exact',
      tarball,
      '@types/react@19.3.0',
      '@types/react-dom@19.3.0',
    ],
    { cwd: app },
  )
  useFixtureRelease(app)
  must(
    bin(app),
    [
      'init',
      '--name',
      'web',
      '--kind',
      'application',
      '--runtime',
      'dom',
      '--react',
      'vite-modern',
    ],
    {
      cwd: app,
      env: childEnv({ CI: '' }),
    },
  )
  useFixtureRelease(app)
  assert.match(
    readFileSync(join(app, 'vite.config.ts'), 'utf8'),
    /createReactPlugins\(config, \{ project: 'web' \}\)/,
  )
  must(bin(app), ['doctor'], { cwd: app })
  const check = must(bin(app), ['check'], { cwd: app })
  assert.match(check.stdout, /react web \(vite-modern\): compiled/)
  assert.match(check.stdout, /web:unit: 1 test passed/)
  writeFiles(app, {
    'vite.config.ts': "import { defineConfig } from 'vite'\n\nexport default defineConfig({})\n",
  })
  const unwired = exec(bin(app), ['check'], { cwd: app })
  assert.equal(unwired.code, 2, 'check passed with the compiler removed from the build')
  assert.match(unwired.stderr, /does not import @toolpath\/dev-config\/react\/vite|not wired/)
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
