import { spawnSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createOxlintConfig, type OxlintConfigOptions } from '../dist/oxlint.js'
import { temporaryDirectory } from './helpers.js'

const require = createRequire(import.meta.url)
const OXLINT = join(dirname(require.resolve('oxlint/package.json')), 'bin/oxlint')
const TSGOLINT = join(dirname(require.resolve('oxlint-tsgolint/package.json')), 'bin/tsgolint.js')

const TSCONFIG = JSON.stringify({
  compilerOptions: {
    strict: true,
    lib: ['ES2023', 'DOM'],
    types: [],
    jsx: 'react-jsx',
    module: 'NodeNext',
    moduleResolution: 'NodeNext',
    noEmit: true,
  },
  include: ['**/*'],
})
const MANIFEST = JSON.stringify({ name: 'fixture', type: 'module' })

/** A fixture repository holding `files`, with one installed but undeclared package. */
const fixture = (files: Record<string, string>): string =>
  temporaryDirectory({
    'tsconfig.json': TSCONFIG,
    'package.json': MANIFEST,
    'node_modules/left-pad/package.json': JSON.stringify({ name: 'left-pad', main: 'index.js' }),
    'node_modules/left-pad/index.js': 'module.exports = (value) => value\n',
    ...files,
  })

interface Diagnostic {
  code?: string
  filename: string
  message: string
}

/** `typescript(no-eval)` as `typescript/no-eval`, and `eslint(curly)` as `curly`. */
const ruleOf = ({ code, message }: Diagnostic): string => {
  const match = /^([\w-]+)\((.+)\)$/.exec(code ?? '')
  if (match?.[1] === undefined || match[2] === undefined) {
    return message
  }
  return match[1] === 'eslint' ? match[2] : `${match[1]}/${match[2]}`
}

/** Rule ids reported for each fixture file. */
const lint = (
  files: Record<string, string>,
  options: OxlintConfigOptions = {},
): Record<string, Array<string>> => {
  const root = fixture(files)
  writeFileSync(join(root, '.oxlintrc.json'), JSON.stringify(createOxlintConfig(options)))
  const { stdout } = spawnSync(process.execPath, [OXLINT, '--format=json', '.'], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, OXLINT_TSGOLINT_PATH: TSGOLINT },
  })
  const { diagnostics } = JSON.parse(stdout) as { diagnostics: Array<Diagnostic> }
  const reported: Record<string, Array<string>> = Object.fromEntries(
    Object.keys(files).map((file) => [file, []]),
  )
  for (const diagnostic of diagnostics) {
    reported[diagnostic.filename.replace(/^\.\//, '')]?.push(ruleOf(diagnostic))
  }
  return reported
}

/** One fixture per rule, each written to trip exactly the rule it is named after. */
const VIOLATIONS: Record<string, string> = {
  'typescript/no-floating-promises':
    'const run = async (): Promise<void> => {\n  await Promise.resolve()\n}\n\nrun()\n',
  'typescript/prefer-nullish-coalescing':
    'export const pick = (value: number | undefined): number => value || 10\n',
  'typescript/prefer-optional-chain':
    'export const has = (user: { name?: string } | undefined): boolean =>\n  Boolean(user && user.name)\n',
  'typescript/require-array-sort-compare':
    'export const sorted = (values: Array<number>): Array<number> => values.toSorted()\n',
  'no-eval': "export const value: unknown = eval('1')\n",
  'no-new-func': "export const make = new Function('return 1')\n",
  'toolpath/no-non-null-outside-index':
    'export const size = (sizes: Map<string, number>): number => sizes.get("a")!\n',
  'prefer-arrow-callback':
    'export const same = [1].map(function (value: number): number {\n  return value\n})\n',
  'typescript/strict-boolean-expressions':
    "export const label = (count: number): string => (count ? 'some' : 'none')\n",
  'typescript/consistent-type-assertions':
    'interface User {\n  name: string\n}\n\nexport const user = {} as User\n',
  'typescript/no-unsafe-type-assertion':
    'interface User {\n  name: string\n}\n\nexport const toUser = (value: unknown): User => value as User\n',
  'unicorn/prefer-node-protocol': "import { sep } from 'path'\n\nexport const separator = sep\n",
  'import-x-js/no-extraneous-dependencies':
    "import leftPad from 'left-pad'\n\nexport const pad: unknown = leftPad\n",
  'import/no-duplicates':
    "import { add } from './clean.js'\nimport { sub } from './clean.js'\n\nexport const both = [add, sub]\n",
  // Closed by `cycle_partner.ts` in `SUPPORT`.
  'import/no-cycle':
    "import { partner } from './cycle_partner.js'\n\nexport const cycled = 1\nexport const both = [partner]\n",
  'import/no-self-import':
    "import * as self from './import_no-self-import.js'\n\nexport const value = 1\nexport const same: unknown = self\n",
  'typescript/restrict-template-expressions':
    'export const greet = (name: string | undefined): string => `Hi ${name}`\n',
  'typescript/switch-exhaustiveness-check': [
    "type Shape = 'circle' | 'square'",
    '',
    'export const sides = (shape: Shape): number => {',
    '  switch (shape) {',
    "    case 'circle':",
    '      return 0',
    '    default:',
    '      return 4',
    '  }',
    '}',
    '',
  ].join('\n'),
  'typescript/method-signature-style': 'export interface Store {\n  get(key: string): string\n}\n',
  'typescript/prefer-readonly':
    'export class Counter {\n  private count = 0\n\n  read(): number {\n    return this.count\n  }\n}\n',
  'typescript/no-import-type-side-effects':
    "import { type Pair } from './clean.js'\n\nexport const pair: Pair = [1, 2]\n",
  'no-unused-vars': 'const _hidden = 1\n\nexport const shown = _hidden + 1\n',
  'typescript/ban-ts-comment':
    "// @ts-expect-error a string is not a number\nexport const value: number = 'a'\n",
  'no-template-curly-in-string': "export const greeting = 'Hi ${name}'\n",
  'preserve-caught-error':
    "export const run = (): void => {\n  try {\n    void 0\n  } catch {\n    throw new Error('failed')\n  }\n}\n",
  // Quadratic on long digit runs (7.4 s on 40k characters where it was found).
  'regexp/no-super-linear-backtracking': 'export const decimal = /^(\\d+\\.?\\d*|\\.\\d+)$/\n',
}

/** Files the `VIOLATIONS` fixtures import, which the table does not check. */
const SUPPORT: Record<string, string> = {
  'cycle_partner.ts':
    "import { cycled } from './import_no-cycle.js'\n\nexport const partner = cycled\n",
}

describe('createOxlintConfig', { timeout: 60_000 }, () => {
  const clean =
    'export type Pair = [number, number]\n\n' +
    'export const add = (a: number, b: number): number => a + b\n\n' +
    'export const sub = (a: number, b: number): number => a - b\n'
  const fileOf = (rule: string): string => `${rule.replaceAll('/', '_')}.ts`

  // These fixtures use identical configuration: build their type graph only once.
  let violations: ReturnType<typeof lint> | undefined

  it.each(Object.keys(VIOLATIONS))('reports %s', (rule) => {
    violations ??= lint({
      'clean.ts': clean,
      ...SUPPORT,
      ...Object.fromEntries(Object.entries(VIOLATIONS).map(([key, code]) => [fileOf(key), code])),
    })
    expect(violations['clean.ts']).toEqual([])
    expect(violations[fileOf(rule)]).toContain(rule)
  })

  it('allows string truthiness while requiring explicit checks for numbers', () => {
    const reported = lint({
      'strings.ts': [
        'export const hasText = (value: string): boolean => !!value',
        'export const hasOptionalText = (value: string | null | undefined): boolean => !!value',
        '',
      ].join('\n'),
      'number.ts': 'export const hasCount = (value: number): boolean => !!value\n',
    })
    expect(reported['strings.ts']).not.toContain('typescript/strict-boolean-expressions')
    expect(reported['number.ts']).toContain('typescript/strict-boolean-expressions')
  })

  it('allows void arrow shorthand while rejecting void expressions in return statements', () => {
    const reported = lint({
      'arrow.ts': 'declare const run: () => void\nexport const forward = (): void => run()\n',
      'return.ts':
        'declare const run: () => void\nexport const forward = (): void => {\n  return run()\n}\n',
    })
    expect(reported['arrow.ts']).not.toContain('typescript/no-confusing-void-expression')
    expect(reported['return.ts']).toContain('typescript/no-confusing-void-expression')
  })

  it('allows a non-null assertion only on an index access', () => {
    const reported = lint({
      'index.ts':
        'export const first = (values: Array<number | undefined>): number => values[0]!\n',
      'field.ts': 'export const size = (box: { size?: number }): number => box.size!\n',
      'find.ts':
        'export const even = (values: Array<number>): number =>\n  values.find((value) => value % 2 === 0)!\n',
    })
    expect(reported['index.ts']).not.toContain('toolpath/no-non-null-outside-index')
    expect(reported['field.ts']).toContain('toolpath/no-non-null-outside-index')
    expect(reported['find.ts']).toContain('toolpath/no-non-null-outside-index')
  })

  it('allows framework throws and still reports other thrown values', () => {
    const reported = lint({
      'framework.ts': [
        'export const stop = (kind: number): never => {',
        '  if (kind === 1) {',
        "    throw new Response('Forbidden', { status: 403 })",
        '  }',
        '  throw Promise.resolve(1)',
        '}',
        '',
      ].join('\n'),
      'string.ts': "export const stop = (): never => {\n  throw 'BREAK'\n}\n",
    })
    expect(reported['framework.ts']).not.toContain('typescript/only-throw-error')
    expect(reported['string.ts']).toContain('typescript/only-throw-error')
  })

  it('allows constant loops but reports other unnecessary conditions', () => {
    const reported = lint({
      'loop.ts': 'export const spin = (): never => {\n  while (true) {\n    continue\n  }\n}\n',
      'guard.ts': "export const label = (name: string): string => name ?? 'none'\n",
    })
    expect(reported['loop.ts']).not.toContain('typescript/no-unnecessary-condition')
    expect(reported['guard.ts']).toContain('typescript/no-unnecessary-condition')
  })

  it('lets tests stub classes, spread fixtures and use assertions, and keeps the async rules', () => {
    const reported = lint({
      'fixture.test.ts': [
        'class Org {',
        "  name = 'org'",
        '}',
        '',
        'export const copy = { ...new Org() }',
        'export const stub = class Stub {}',
        'export const first = (sizes: Map<string, number>): number => sizes.get("a")!',
        'void copy',
        'Promise.resolve(1)',
        '',
      ].join('\n'),
    })
    for (const rule of [
      'typescript/no-extraneous-class',
      'typescript/no-misused-spread',
      'toolpath/no-non-null-outside-index',
    ]) {
      expect(reported['fixture.test.ts']).not.toContain(rule)
    }
    expect(reported['fixture.test.ts']).toContain('typescript/no-floating-promises')
  })

  it('reports focused tests and allows an explained @ts-expect-error in tests only', () => {
    const reported = lint({
      'focus.test.ts': "import { it } from 'vitest'\n\nit.only('runs', () => {})\n",
      'types.test.ts':
        "// @ts-expect-error a string is not a number\nexport const value: number = 'a'\n",
    })
    expect(reported['focus.test.ts']).toContain('vitest/no-focused-tests')
    expect(reported['types.test.ts']).not.toContain('typescript/ban-ts-comment')
  })

  it('allows devDependencies in tests, configuration and tooling only', () => {
    const importPad = "import leftPad from 'left-pad'\n\nexport const pad: unknown = leftPad\n"
    const reported = lint({
      'package.json': JSON.stringify({
        name: 'fixture',
        type: 'module',
        devDependencies: { 'left-pad': '1.0.0' },
      }),
      'src/types.test-d.ts': importPad,
      'test.setup.ts': importPad,
      'vite.content-script.ts': importPad,
      'src/drag-test-support.ts': importPad,
      'app/routes.ts': importPad,
      'src/index.ts': importPad,
    })
    for (const file of [
      'src/types.test-d.ts',
      'test.setup.ts',
      'vite.content-script.ts',
      'src/drag-test-support.ts',
      'app/routes.ts',
    ]) {
      expect(reported[file]).not.toContain('import-x-js/no-extraneous-dependencies')
    }
    expect(reported['src/index.ts']).toContain('import-x-js/no-extraneous-dependencies')
  })

  it('reports a relative import into another package and allows one within a package', () => {
    const reported = lint({
      'vendor/package.json': JSON.stringify({ name: 'vendor', type: 'module' }),
      'vendor/value.ts': 'export const value = 1\n',
      'main.ts': "import { value } from './vendor/value.js'\n\nexport const copy = value\n",
      'dynamic.ts': "export const load = (): Promise<unknown> => import('./vendor/value.js')\n",
      'src/lazy.ts': "export const load = (): Promise<unknown> => import('./deep/a.js')\n",
      'src/deep/a.ts': 'export const a = 1\n',
      'src/b.ts': "import { a } from './deep/a.js'\n\nexport const b = a\n",
      'inner/package.json': JSON.stringify({ name: 'inner', type: 'module' }),
      'inner/index.ts': 'export const inner = 1\n',
      'inner/src/c.ts': "import { inner } from '..'\n\nexport const c = inner\n",
    })
    expect(reported['main.ts']).toContain('toolpath/no-relative-packages')
    expect(reported['dynamic.ts']).toContain('toolpath/no-relative-packages')
    expect(reported['src/b.ts']).not.toContain('toolpath/no-relative-packages')
    expect(reported['src/lazy.ts']).not.toContain('toolpath/no-relative-packages')
    expect(reported['inner/src/c.ts']).not.toContain('toolpath/no-relative-packages')
  })

  it('bans styling imports and attributes from src/ with forbidStyling, and only there', () => {
    const view = 'export const View = () => <p className="a" style={{ top: 0 }} />\n'
    const files = {
      'src/kit.ts': "export { Button } from '@toolpath/ui'\n",
      'src/subpath.ts': "export { Button } from '@toolpath/ui/button'\n",
      'src/icons.ts': "export { Cube } from '@phosphor-icons/react'\n",
      'src/classes.ts': "export { clsx } from 'clsx'\n",
      'src/sheet.ts': "import './theme.css'\n",
      'src/view.tsx': view,
      'src/logic.ts': "export { sep } from 'node:path'\n",
      'tests/view.tsx': view,
      'tests/kit.ts': "export { Button } from '@toolpath/ui'\n",
    }
    const banned = lint(files, { forbidStyling: true })
    for (const file of [
      'src/kit.ts',
      'src/subpath.ts',
      'src/icons.ts',
      'src/classes.ts',
      'src/sheet.ts',
    ]) {
      expect(banned[file]).toContain('no-restricted-imports')
    }
    expect(
      banned['src/view.tsx']?.filter((rule) => rule === 'toolpath/no-styling-attributes'),
    ).toHaveLength(2)
    expect(banned['src/logic.ts']).not.toContain('no-restricted-imports')
    expect(banned['tests/view.tsx']).not.toContain('toolpath/no-styling-attributes')
    expect(banned['tests/kit.ts']).not.toContain('no-restricted-imports')

    const allowed = lint(files)
    expect(allowed['src/kit.ts']).not.toContain('no-restricted-imports')
    expect(allowed['src/view.tsx']).not.toContain('toolpath/no-styling-attributes')
  })

  it('reports an unused disable comment', () => {
    const reported = lint({
      'unused.ts': '// eslint-disable-next-line no-eval\nexport const value = 1\n',
    })
    expect(reported['unused.ts']?.join(' ')).toMatch(/[Uu]nused/)
  })

  it('applies the correctness rules to JavaScript files', () => {
    const reported = lint({ 'script.mjs': 'export const value = missing + 1\n' })
    expect(reported['script.mjs']).toContain('no-undef')
  })

  it('leaves out React rules unless asked', () => {
    const files = {
      'view.tsx': [
        "import { useEffect, useState } from 'react'",
        '',
        'export const View = ({ id }: { id: string }) => {',
        '  const [value, setValue] = useState(id)',
        '  useEffect(() => {',
        '    setValue(id)',
        '  }, [])',
        '  return <button onClick={() => undefined}>{value}</button>',
        '}',
        '',
      ].join('\n'),
    }
    expect(lint(files)['view.tsx']).not.toContain('react/exhaustive-deps')
    const reported = lint(files, { react: true })['view.tsx']
    expect(reported?.join(' ')).toMatch(/exhaustive-deps/)
    expect(reported).toContain('react/button-has-type')
  })

  it('reports leaked timers and lets the cancel flag through', () => {
    const reported = lint(
      {
        'timer.tsx': [
          "import { useEffect } from 'react'",
          '',
          'export const useTick = (): void => {',
          '  useEffect(() => {',
          '    setTimeout(() => undefined, 100)',
          '  }, [])',
          '}',
          '',
        ].join('\n'),
        'flag.tsx': [
          "import { useEffect, useState } from 'react'",
          '',
          'export const useLive = (): boolean => {',
          '  const [live, setLive] = useState(false)',
          '  useEffect(() => {',
          '    let current = true',
          '    void Promise.resolve().then(() => {',
          '      if (current) {',
          '        setLive(true)',
          '      }',
          '    })',
          '    return () => {',
          '      current = false',
          '    }',
          '  }, [])',
          '  return live',
          '}',
          '',
        ].join('\n'),
      },
      { react: true },
    )
    expect(reported['timer.tsx']).toContain('eslint-react/web-api-no-leaked-timeout')
    expect(reported['flag.tsx']).not.toContain('react/immutability')
  })

  it('ignores build output and caller globs', () => {
    const reported = lint(
      {
        'kept.ts': "export const value: unknown = eval('1')\n",
        'dist/index.ts': "export const value: unknown = eval('1')\n",
        'node_modules/installed/index.ts': "export const value: unknown = eval('1')\n",
        'skip/index.ts': "export const value: unknown = eval('1')\n",
      },
      { ignores: ['skip/**'] },
    )
    expect(reported['kept.ts']).toContain('no-eval')
    expect(reported['dist/index.ts']).toEqual([])
    expect(reported['node_modules/installed/index.ts']).toEqual([])
    expect(reported['skip/index.ts']).toEqual([])
  })
})
