import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import {
  createProject,
  devConfig,
  eslintConfig,
  tsconfig,
  vitestConfig,
  type TestProject,
} from '../helpers/project.js'

const SUM =
  'export const sum = (values: ReadonlyArray<number>): number => values.reduce((total, value) => total + value, 0)\n'
const SUM_TEST = `import { expect, it } from 'vitest'
import { sum } from './sum.js'

it('adds', () => {
  expect(sum([1, 2])).toBe(3)
})
`

const projects: Array<TestProject> = []
const project = (files: Record<string, string>): TestProject => {
  const created = createProject(files)
  projects.push(created)
  return created
}

afterAll(() => {
  for (const created of projects) {
    created.remove()
  }
})

const singleProject = (
  overrides: Record<string, string> = {},
  facts: Parameters<typeof devConfig>[0][number] = { name: 'core' },
  top = '',
): TestProject =>
  project({
    'dev.config.mjs': devConfig([facts], top),
    'eslint.config.mjs': eslintConfig(),
    'vitest.config.mjs': vitestConfig(facts.name),
    'tsconfig.json': tsconfig(),
    'src/sum.ts': SUM,
    'src/sum.test.ts': SUM_TEST,
    ...overrides,
  })

describe('the CLI against a real project', { timeout: 120_000 }, () => {
  it('passes a clean project and keeps a passing check concise', () => {
    const clean = singleProject({ 'src/odd name (1).ts': "export const label = 'odd'\n" })
    const result = clean.run(['check'])
    expect(result.stderr).toBe('')
    expect(result.code).toBe(0)
    expect(Buffer.byteLength(result.stdout)).toBeLessThan(2048)
    expect(result.stdout).toMatch(/lint: 6 files clean/)
    expect(result.stdout).toMatch(/core:unit: 1 test passed/)
  })

  it('finds the configuration from a subdirectory and through --config', () => {
    const nested = singleProject()
    expect(nested.run(['lint'], { cwd: join(nested.root, 'src') }).code).toBe(0)
    const other = createProject({})
    projects.push(other)
    expect(other.run(['lint', '--config', join(nested.root, 'dev.config.mjs')]).code).toBe(0)
    expect(other.run(['lint', '--config', 'missing.mjs']).code).toBe(2)
  })

  it('fails a real defect in source, tests and tooling, with exit code 1', () => {
    const defects = singleProject({
      'src/unsafe.ts': 'export const parse = (text: string) => JSON.parse(text).value\n',
      'src/floating.test.ts':
        "import { it } from 'vitest'\n\nit('waits', () => {\n  void 0\n  Promise.resolve(1)\n})\n",
      'tool.mjs': "export const go = () => {\n  Promise.resolve('x')\n}\n",
    })
    const result = defects.run(['lint'])
    expect(result.code).toBe(1)
    expect(result.stderr).toMatch(/unsafe\.ts[\s\S]*no-unsafe-member-access/)
    expect(result.stderr).toMatch(/floating\.test\.ts[\s\S]*no-floating-promises/)
    expect(result.stderr).toMatch(/tool\.mjs[\s\S]*no-floating-promises/)
  })

  it('rejects unknown flags and missing configuration with exit code 2', () => {
    const clean = singleProject()
    expect(clean.run(['lint', '--frobnicate']).code).toBe(2)
    expect(clean.run(['nonsense']).code).toBe(2)
    const unowned = singleProject(
      { 'elsewhere/stray.ts': 'export const stray = 1\n' },
      { name: 'core', root: 'src' },
    )
    unowned.write({
      'src/tsconfig.json': tsconfig({ include: ['.'] }),
      'src/vitest.config.mjs': vitestConfig('core', '../dev.config.mjs'),
    })
    const result = unowned.run(['lint'])
    expect(result.code).toBe(2)
    expect(result.stderr).toMatch(
      /elsewhere\/stray\.ts: is maintained JS\/TS that no project root or tooling glob/,
    )
  })

  it('enforces runtime import boundaries and allows Node APIs in tests', () => {
    const dom = singleProject(
      {
        'tsconfig.json': tsconfig({ preset: 'browser' }),
        'src/reads-disk.ts':
          "import { readFileSync } from 'node:fs'\n\nexport const read = () => readFileSync('x', 'utf8')\n",
        'src/fixture.test.ts':
          "import { readFileSync } from 'node:fs'\nimport { expect, it } from 'vitest'\n\nit('reads', () => {\n  expect(typeof readFileSync).toBe('function')\n})\n",
      },
      { name: 'web', runtime: 'dom' },
    )
    const result = dom.run(['lint'])
    expect(result.code).toBe(1)
    expect(result.stderr).toMatch(/reads-disk\.ts[\s\S]*'dom' project/)
    expect(result.stderr).not.toMatch(/fixture\.test\.ts/)
  })

  it('applies only declared narrow generated exclusions', () => {
    const generated = singleProject(
      {
        'src/generated/client.ts': 'export const client: any = 1\n',
        'src/generated-helpers.ts': 'export const helper: any = 1\n',
      },
      { name: 'core' },
      "generated: [{ files: ['src/generated/**'], reason: 'Written by the API client generator' }],",
    )
    const result = generated.run(['lint'])
    expect(result.code).toBe(1)
    expect(result.stderr).toMatch(/generated-helpers\.ts/)
    expect(result.stderr).not.toMatch(/generated\/client\.ts/)
  })

  it('honours a narrow exception and rejects unknown, broad, or expired ones', () => {
    const withException = (exception: string): TestProject =>
      singleProject(
        { 'src/legacy.ts': 'export const legacy: any = 1\n' },
        { name: 'core' },
        `exceptions: [${exception}],`,
      )
    const valid = withException(
      "{ rule: '@typescript-eslint/no-explicit-any', files: ['src/legacy.ts'], reason: 'Migrating this module in its own change' }",
    )
    expect(valid.run(['lint']).code).toBe(0)
    const unknown = withException(
      "{ rule: 'no-such-rule', files: ['src/legacy.ts'], reason: 'Migrating this module in its own change' }",
    )
    expect(unknown.run(['lint']).stderr).toMatch(
      /"no-such-rule" is not a rule this configuration's policy enables/,
    )
    const broad = withException(
      "{ rule: '@typescript-eslint/no-explicit-any', files: ['**/*.ts'], reason: 'Migrating this module in its own change' }",
    )
    expect(broad.run(['lint']).stderr).toMatch(/selects files everywhere/)
    const expired = withException(
      "{ rule: '@typescript-eslint/no-explicit-any', files: ['src/legacy.ts'], reason: 'Migrating this module in its own change', expires: '2020-01-01' }",
    )
    const result = expired.run(['lint'])
    expect(result.code).toBe(2)
    expect(result.stderr).toMatch(/expired on 2020-01-01/)
  })

  it('refuses a native config that weakens a baseline rule', () => {
    const weakened = singleProject({
      'eslint.config.mjs': eslintConfig(
        ", { rules: { '@typescript-eslint/no-explicit-any': 'off' } }",
      ),
    })
    const result = weakened.run(['lint'])
    expect(result.code).toBe(2)
    expect(result.stderr).toMatch(/changes baseline rule @typescript-eslint\/no-explicit-any/)
  })

  it('refuses a native config that stops reporting unused suppressions', () => {
    const quiet = singleProject({
      'eslint.config.mjs': eslintConfig(
        ", { linterOptions: { reportUnusedDisableDirectives: 'off' } }",
      ),
    })
    const result = quiet.run(['lint'])
    expect(result.code).toBe(2)
    expect(result.stderr).toMatch(/lowers linterOptions\.reportUnusedDisableDirectives/)
  })

  it('reports unused and blanket suppressions', () => {
    const suppressions = singleProject({
      'src/unused.ts':
        '// eslint-disable-next-line no-debugger -- nothing here triggers it any more\nexport const unused = 1\n',
      'src/blanket.ts': '/* eslint-disable */\nexport const blanket: any = 1\n',
    })
    const result = suppressions.run(['lint'])
    expect(result.code).toBe(1)
    expect(result.stderr).toMatch(/unused\.ts[\s\S]*Unused eslint-disable directive/)
    expect(result.stderr).toMatch(/blanket\.ts[\s\S]*Name the rules/)
  })

  it('fails a type error, an empty suite, and a focused test', () => {
    const broken = singleProject({ 'src/broken.ts': 'export const value: number = "text"\n' })
    const types = broken.run(['check-types'])
    expect(types.code).toBe(1)
    expect(types.stderr).toMatch(/broken\.ts\(1,14\): error TS2322/)

    const noTests = singleProject()
    noTests.write({ 'src/sum.test.ts': "import { it } from 'vitest'\n" })
    expect(noTests.run(['test']).code).toBe(1)

    const focused = singleProject({
      'src/sum.test.ts': SUM_TEST.replace("it('adds'", "it.only('adds'"),
    })
    const lint = focused.run(['lint'])
    expect(lint.code).toBe(1)
    expect(lint.stderr).toMatch(/vitest\/no-focused-tests/)
  })

  it('checks a focused project without testing the others', () => {
    const workspace = project({
      'dev.config.mjs': devConfig([
        { name: 'a', root: 'packages/a' },
        { name: 'b', root: 'packages/b' },
      ]),
      'eslint.config.mjs': eslintConfig(),
      'tsconfig.json': tsconfig({ include: ['*.mjs'] }),
      'packages/a/tsconfig.json': tsconfig(),
      'packages/a/vitest.config.mjs': vitestConfig('a', '../../dev.config.mjs'),
      'packages/a/src/sum.ts': SUM,
      'packages/a/src/sum.test.ts': SUM_TEST,
      'packages/b/tsconfig.json': tsconfig(),
      'packages/b/vitest.config.mjs': vitestConfig('b', '../../dev.config.mjs'),
      'packages/b/src/sum.ts': SUM,
      'packages/b/src/sum.test.ts': SUM_TEST,
    })
    workspace.write({
      'dev.config.mjs': readFileSync(join(workspace.root, 'dev.config.mjs'), 'utf8').replace(
        "ci: { node: '24.18.0' },",
        "ci: { node: '24.18.0' },\n  tooling: { files: ['*.mjs'], tsconfig: 'tsconfig.json' },",
      ),
    })
    const focused = workspace.run(['test', '--project', 'a'])
    expect(focused.code).toBe(0)
    expect(focused.stdout).toMatch(/a:unit/)
    expect(focused.stdout).not.toMatch(/b:unit/)
  })

  it('applies typed fixes in a CI environment', () => {
    // CI=true makes typescript-eslint assume a single run, which a fix pass must not use.
    const fixable = singleProject({
      'src/twice.ts':
        'function twice(value: number) {\n  if (value > 0) return value * 2\n  return 0\n}\nexport const doubled = twice(2)\n',
    })
    const result = fixable.run(['lint:fix'], { env: { CI: 'true' } })
    expect(result.stderr).toBe('')
    expect(result.code).toBe(0)
    expect(readFileSync(join(fixable.root, 'src/twice.ts'), 'utf8')).toMatch(
      /^const twice = \(value: number\) => \{/,
    )
  })

  it('keeps watching with --watch and exits after a plain run', async () => {
    const watched = singleProject()
    expect(watched.run(['test']).code).toBe(0)
    const child = watched.start(['test', '--watch', '--suite', 'core:unit'])
    let output = ''
    child.stdout?.on('data', (chunk: Buffer) => {
      output += chunk.toString()
    })
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`watch mode printed no result:\n${output}`))
      }, 30_000)
      const poll = setInterval(() => {
        if (/Waiting for file changes|press h to show help/i.test(output)) {
          clearInterval(poll)
          clearTimeout(timer)
          resolve()
        }
      }, 100)
    })
    expect(child.exitCode).toBeNull()
    child.kill('SIGTERM')
  })

  it('does not report success when interrupted', async () => {
    const slow = singleProject({
      'src/sum.test.ts': `import { it } from 'vitest'\n\nit('waits', async () => {\n  await new Promise((resolve) => setTimeout(resolve, 4000))\n})\n`,
    })
    const child = slow.start(['test'])
    await new Promise((resolve) => setTimeout(resolve, 1500))
    child.kill('SIGINT')
    const code = await new Promise<number | null>((resolve) => {
      child.on('close', (exitCode) => {
        resolve(exitCode)
      })
    })
    expect(code).not.toBe(0)
  })
})

describe('hooks install', { timeout: 60_000 }, () => {
  it('skips without failing an install in CI, with HUSKY=0, or with no configuration', () => {
    const bare = createProject({})
    projects.push(bare)
    expect(bare.run(['hooks', 'install'], { env: { CI: 'true' } })).toMatchObject({
      code: 0,
      stdout: 'hooks install: skipped in CI\n',
    })
    expect(bare.run(['hooks', 'install'], { env: { HUSKY: '0' } })).toMatchObject({ code: 0 })
    // The package's own dev.config.mjs is above .tmp/, so look from outside any configured tree.
    const outside = bare.run(['hooks', 'install'], { cwd: '/' })
    expect(outside).toMatchObject({
      code: 0,
      stdout: 'hooks install: skipped; no dev.config.mjs here\n',
    })
  })

  it('never takes over hooks another tool owns', () => {
    const owned = singleProject()
    spawnSync('git', ['config', 'core.hooksPath', '.githooks'], { cwd: owned.root })
    const install = owned.run(['hooks', 'install'])
    expect(install.code).toBe(0)
    expect(install.stdout).toMatch(/skipped; Git runs hooks from \.githooks/)
    expect(
      spawnSync('git', ['config', '--get', 'core.hooksPath'], {
        cwd: owned.root,
        encoding: 'utf8',
      }).stdout.trim(),
    ).toBe('.githooks')
  })
})

describe('TypeScript programs', { timeout: 60_000 }, () => {
  it('refuse a strict-family check turned off on its own', () => {
    const loose = singleProject({
      'tsconfig.json': JSON.stringify({
        extends: '@toolpath/dev-config/typescript/node.json',
        compilerOptions: {
          types: ['node'],
          allowJs: true,
          checkJs: true,
          noImplicitAny: false,
          useUnknownInCatchVariables: false,
        },
        include: ['src', '*.mjs'],
      }),
    })
    const result = loose.run(['check-types'])
    expect(result.code).toBe(2)
    expect(result.stderr).toMatch(/noImplicitAny must not be turned off/)
    expect(result.stderr).toMatch(/useUnknownInCatchVariables must not be turned off/)
  })
})

describe('init', { timeout: 60_000 }, () => {
  it('refuses a CommonJS package before writing anything, with the remedy', () => {
    const commonjs = createProject({ 'package.json': '{ "name": "legacy", "private": true }\n' })
    projects.push(commonjs)
    const result = commonjs.run([
      'init',
      '--name',
      'core',
      '--runtime',
      'node',
      '--package-manager',
      'npm',
    ])
    expect(result.code).toBe(2)
    expect(result.stderr).toMatch(
      /package\.json "type": is unset \(CommonJS\)[\s\S]*npm pkg set type=module/,
    )
    expect(existsSync(join(commonjs.root, 'dev.config.mjs'))).toBe(false)
  })
})
