import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'
import type { Linter } from 'eslint'
import { createCommentAuditConfig, createEslintConfig, type EslintOptions } from '../src/eslint.js'
import { temporaryDirectory } from './helpers.js'

const TSCONFIG = JSON.stringify({
  compilerOptions: {
    strict: true,
    lib: ['ES2023'],
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
    // Installed but not declared in package.json.
    'node_modules/left-pad/package.json': JSON.stringify({ name: 'left-pad', main: 'index.js' }),
    'node_modules/left-pad/index.js': 'module.exports = (value) => value\n',
    ...files,
  })

/** Rule ids (or messages, for directives) reported for each fixture file. */
const lint = async (
  files: Record<string, string>,
  options: Partial<EslintOptions> = {},
  configure: (root: string) => ESLint.Options = (root) => ({
    overrideConfig: createEslintConfig({ tsconfigRootDir: root, ...options }),
  }),
): Promise<Record<string, Array<string>>> => {
  const root = fixture(files)
  const eslint = new ESLint({ cwd: root, overrideConfigFile: true, ...configure(root) })
  const results = await eslint.lintFiles(Object.keys(files))
  return Object.fromEntries(
    results.map((result) => [
      result.filePath.slice(root.length + 1),
      result.messages.map((message) => message.ruleId ?? message.message),
    ]),
  )
}

/** One fixture per rule, each written to trip exactly the rule it is named after. */
const VIOLATIONS: Record<string, string> = {
  '@typescript-eslint/no-floating-promises':
    'const run = async (): Promise<void> => {\n  await Promise.resolve()\n}\n\nrun()\n',
  '@typescript-eslint/prefer-nullish-coalescing':
    'export const pick = (value: number | undefined): number => value || 10\n',
  '@typescript-eslint/prefer-optional-chain':
    'export const has = (user: { name?: string } | undefined): boolean =>\n  Boolean(user && user.name)\n',
  '@typescript-eslint/require-array-sort-compare':
    'export const sorted = (values: Array<number>): Array<number> => values.toSorted()\n',
  'no-eval': "export const value: unknown = eval('1')\n",
  'no-new-func': "export const make = new Function('return 1')\n",
  '@typescript-eslint/no-non-null-assertion':
    'export const first = (values: Array<number | undefined>): number => values[0]!\n',
  'prefer-arrow-callback':
    'export const same = [1].map(function (value: number): number {\n  return value\n})\n',
  '@typescript-eslint/strict-boolean-expressions':
    "export const label = (count: number): string => (count ? 'some' : 'none')\n",
  '@typescript-eslint/consistent-type-assertions':
    'interface User {\n  name: string\n}\n\nexport const user = {} as User\n',
  '@typescript-eslint/no-unsafe-type-assertion':
    'interface User {\n  name: string\n}\n\nexport const toUser = (value: unknown): User => value as User\n',
  '@eslint-community/eslint-comments/require-description':
    '// eslint-disable-next-line no-self-compare\nexport const same = (x: number): boolean => x === x\n',
  '@eslint-community/eslint-comments/no-restricted-disable':
    "// eslint-disable-next-line no-eval -- needed here\nexport const value: unknown = eval('1')\n",
  '@eslint-community/eslint-comments/disable-enable-pair':
    '/* eslint-disable no-self-compare -- legacy file */\nexport const same = (x: number): boolean => x === x\n',
  '@eslint-community/eslint-comments/no-unlimited-disable':
    '/* eslint-disable */\nexport const same = (x: number): boolean => x === x\n',
  'unicorn/prefer-node-protocol': "import { sep } from 'path'\n\nexport const separator = sep\n",
  'import-x/no-extraneous-dependencies':
    "import leftPad from 'left-pad'\n\nexport const pad: unknown = leftPad\n",
  'import-x/no-duplicates':
    "import { add } from './clean.js'\nimport { sub } from './clean.js'\n\nexport const both = [add, sub]\n",
  'import-x/no-useless-path-segments':
    "import { add } from './nested/../clean.js'\n\nexport const plus = add\n",
  '@typescript-eslint/restrict-template-expressions':
    'export const greet = (name: string | undefined): string => `Hi ${name}`\n',
  '@typescript-eslint/switch-exhaustiveness-check': [
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
  '@typescript-eslint/method-signature-style':
    'export interface Store {\n  get(key: string): string\n}\n',
  '@typescript-eslint/prefer-readonly':
    'export class Counter {\n  private count = 0\n\n  read(): number {\n    return this.count\n  }\n}\n',
  '@typescript-eslint/no-import-type-side-effects':
    "import { type Pair } from './clean.js'\n\nexport const pair: Pair = [1, 2]\n",
  '@typescript-eslint/no-unused-vars': 'const _hidden = 1\n\nexport const shown = _hidden + 1\n',
  '@typescript-eslint/ban-ts-comment':
    "// @ts-expect-error a string is not a number\nexport const value: number = 'a'\n",
  'no-template-curly-in-string': "export const greeting = 'Hi ${name}'\n",
  'unicorn/no-xor-as-exponentiation': 'export const size = 2 ^ 8\n',
  // Quadratic on long digit runs (7.4 s on 40k characters where it was found).
  'regexp/no-super-linear-backtracking': 'export const decimal = /^(\\d+\\.?\\d*|\\.\\d+)$/\n',
  '@eslint-community/eslint-comments/no-use':
    '/* eslint no-eval: "off" -- trying */\nexport const value: unknown = eval(\'1\')\n',
}

describe('createEslintConfig', () => {
  const clean =
    'export type Pair = [number, number]\n\n' +
    'export const add = (a: number, b: number): number => a + b\n\n' +
    'export const sub = (a: number, b: number): number => a - b\n'
  const fixtures = Object.fromEntries(
    Object.entries(VIOLATIONS).map(([rule, code]) => [`${rule.replaceAll(/[@/]/g, '_')}.ts`, code]),
  )

  it.each(Object.keys(VIOLATIONS))('reports %s', async (rule) => {
    const file = `${rule.replaceAll(/[@/]/g, '_')}.ts`
    const reported = await lint({ 'clean.ts': clean, [file]: fixtures[file] ?? '' })
    expect(reported['clean.ts']).toEqual([])
    expect(reported[file]).toContain(rule)
  })

  it('ignores build output and generated files', async () => {
    const root = fixture({})
    const eslint = new ESLint({
      cwd: root,
      overrideConfigFile: true,
      overrideConfig: createEslintConfig({ tsconfigRootDir: root }),
    })
    for (const path of [
      'dist/index.js',
      '.react-router/types/app/+types/root.ts',
      'playwright-report/trace/index.js',
      'test-results/run/data.js',
      'storybook-static/main.js',
    ]) {
      expect(await eslint.isPathIgnored(path)).toBe(true)
    }
    expect(await eslint.isPathIgnored('src/index.ts')).toBe(false)
  })

  it('allows devDependencies in tests and test setup files only', async () => {
    const importPad = "import leftPad from 'left-pad'\n\nexport const pad: unknown = leftPad\n"
    const reported = await lint({
      'package.json': JSON.stringify({
        name: 'fixture',
        type: 'module',
        devDependencies: { 'left-pad': '1.0.0' },
      }),
      'src/types.test-d.ts': importPad,
      'src/types.spec-d.ts': importPad,
      'test.setup.ts': importPad,
      'src/index.ts': importPad,
    })
    for (const file of ['src/types.test-d.ts', 'src/types.spec-d.ts', 'test.setup.ts']) {
      expect(reported[file]).not.toContain('import-x/no-extraneous-dependencies')
    }
    expect(reported['src/index.ts']).toContain('import-x/no-extraneous-dependencies')
  })

  it('parses .jsx without the React rules', async () => {
    const reported = await lint({ 'widget.jsx': 'export const Widget = () => <p>hi</p>\n' })
    expect(reported['widget.jsx']).toEqual([])
  })

  it('applies the correctness rules to JavaScript files', async () => {
    const reported = await lint({ 'script.mjs': 'export const value = missing + 1\n' })
    expect(reported['script.mjs']).toContain('no-undef')
  })

  it('reports a relative import into another package', async () => {
    const reported = await lint({
      'vendor/package.json': JSON.stringify({ name: 'vendor', type: 'module' }),
      'vendor/value.ts': 'export const value = 1\n',
      'main.ts': "import { value } from './vendor/value.js'\n\nexport const copy = value\n",
    })
    expect(reported['main.ts']).toContain('import-x/no-relative-packages')
  })

  it('lets tests use non-null assertions and casts but keeps the async rules', async () => {
    const reported = await lint({
      'fixture.test.ts': [
        'interface Report {',
        '  parts: Array<{ id: string } | undefined>',
        '}',
        '',
        'const load = async (): Promise<unknown> => {',
        '  await Promise.resolve()',
        '  return { parts: [] }',
        '}',
        '',
        'export const firstId = async (): Promise<string> => {',
        '  const report = (await load()) as Report',
        '  return report.parts[0]!.id',
        '}',
        '',
        'load()',
        '',
      ].join('\n'),
    })
    expect(reported['fixture.test.ts']).toEqual(['@typescript-eslint/no-floating-promises'])
  })

  it('reports focused tests and allows an explained @ts-expect-error in tests only', async () => {
    const reported = await lint({
      'focus.test.ts': "import { it } from 'vitest'\n\nit.only('runs', () => {})\n",
      'types.test.ts':
        "// @ts-expect-error a string is not a number\nexport const value: number = 'a'\n",
    })
    expect(reported['focus.test.ts']).toContain('vitest/no-focused-tests')
    expect(reported['types.test.ts']).not.toContain('@typescript-eslint/ban-ts-comment')
  })

  it.each(['x.ts', 'x.tsx', 'x.test.ts', 'x.mjs', 'x.jsx'])(
    'leaves no rule at warn for %s',
    async (file) => {
      const root = fixture({ [file]: '' })
      const eslint = new ESLint({
        cwd: root,
        overrideConfigFile: true,
        overrideConfig: createEslintConfig({ tsconfigRootDir: root, react: true }),
      })
      const config = (await eslint.calculateConfigForFile(file)) as Linter.Config
      const warnings = Object.entries(config.rules ?? {}).filter(([, entry]) => {
        const level: unknown = Array.isArray(entry) ? entry[0] : entry
        return level === 1 || level === 'warn'
      })
      expect(warnings).toEqual([])
    },
  )

  it('runs the comment rules with inline configuration disabled', async () => {
    const reported = await lint(
      {
        'evade.ts': [
          '/* eslint-disable */',
          '/* eslint @eslint-community/eslint-comments/no-use: "off" */',
          'export const value = 1',
          '',
        ].join('\n'),
      },
      {},
      () => ({ overrideConfig: createCommentAuditConfig(), allowInlineConfig: false }),
    )
    expect(reported['evade.ts']).toEqual(
      expect.arrayContaining([
        '@eslint-community/eslint-comments/no-unlimited-disable',
        '@eslint-community/eslint-comments/no-use',
      ]),
    )
  })

  it('reports an import of the file itself', async () => {
    const reported = await lint({
      'self.ts':
        "import { one } from './self.js'\n\nexport const two = one + 1\nexport const one = 1\n",
    })
    expect(reported['self.ts']).toContain('import-x/no-self-import')
  })

  it('reports an unused disable directive', async () => {
    const reported = await lint({
      'directive.ts':
        '// eslint-disable-next-line no-self-compare -- not needed\nexport const one = 1\n',
    })
    expect(reported['directive.ts']).toEqual([
      expect.stringMatching(/Unused eslint-disable directive/),
    ])
  })

  it('accepts an explained disable of a rule that may be suppressed', async () => {
    const reported = await lint({
      'cast.ts': [
        'interface User {',
        '  name: string',
        '}',
        '',
        'export const toUser = (value: unknown): User =>',
        '  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- validated by the caller',
        '  value as User',
        '',
      ].join('\n'),
    })
    expect(reported['cast.ts']).toEqual([])
  })

  it('cannot be switched off by disabling the guard itself', async () => {
    const reported = await lint({
      'cheat.ts': [
        '// eslint-disable-next-line @eslint-community/eslint-comments/no-restricted-disable, no-eval -- trying',
        "export const value: unknown = eval('1')",
        '',
      ].join('\n'),
    })
    expect(reported['cheat.ts']).toContain(
      '@eslint-community/eslint-comments/no-restricted-disable',
    )
  })

  // ESLint strips the quotes and honours the directive; the restriction must still apply.
  const quoted = {
    'quoted.ts': [
      '// eslint-disable-next-line "no-eval" -- trying',
      "export const value: unknown = eval('1')",
      "/* eslint-disable '@typescript-eslint/no-explicit-any' -- trying */",
      'export const loose: any = 1',
      "/* eslint-enable '@typescript-eslint/no-explicit-any' -- trying */",
      '',
    ].join('\n'),
  }

  it('rejects a disable that quotes a rule name', async () => {
    const reported = await lint(quoted)
    expect(
      reported['quoted.ts']?.filter(
        (rule) => rule === '@eslint-community/eslint-comments/no-restricted-disable',
      ),
    ).toHaveLength(2)
  })

  it('rejects a quoted rule name in the comment audit too', async () => {
    const reported = await lint(quoted, {}, () => ({
      overrideConfig: createCommentAuditConfig(),
      allowInlineConfig: false,
    }))
    expect(
      reported['quoted.ts']?.filter(
        (rule) => rule === '@eslint-community/eslint-comments/no-restricted-disable',
      ),
    ).toHaveLength(2)
  })

  it('reports import cycles', async () => {
    const cycle = {
      'a.ts': "import { b } from './b.js'\n\nexport const a = (): number => b() + 1\n",
      'b.ts': "import { a } from './a.js'\n\nexport const b = (): number => a() - 1\n",
    }
    expect((await lint(cycle))['a.ts']).toContain('import-x/no-cycle')
  })

  it('adds the Hooks rules only with react', async () => {
    const component = {
      'component.tsx': [
        'const useThing = (): number => 1',
        '',
        'export const Component = ({ on }: { on: boolean }): number => {',
        '  if (on) {',
        '    return useThing()',
        '  }',
        '  return 0',
        '}',
        '',
      ].join('\n'),
    }
    expect((await lint(component, { react: true }))['component.tsx']).toContain(
      'react-hooks/rules-of-hooks',
    )
    expect((await lint(component))['component.tsx']).not.toContain('react-hooks/rules-of-hooks')
  })

  it('checks hooks in .ts files', async () => {
    const reported = await lint(
      {
        'use-total.ts': [
          'const useThing = (): number => 1',
          '',
          'export const useTotal = (on: boolean): number => {',
          '  if (on) {',
          '    return useThing()',
          '  }',
          '  return 0',
          '}',
          '',
        ].join('\n'),
      },
      { react: true },
    )
    expect(reported['use-total.ts']).toContain('react-hooks/rules-of-hooks')
  })

  it('reports a button without a type and an unused React import', async () => {
    const reported = await lint(
      {
        'save.tsx': [
          "import React from 'react'",
          '',
          'export const Save = (): unknown => <button>Save</button>',
          '',
        ].join('\n'),
      },
      { react: true },
    )
    expect(reported['save.tsx']).toEqual(
      expect.arrayContaining([
        '@eslint-react/dom-no-missing-button-type',
        '@typescript-eslint/no-unused-vars',
      ]),
    )
  })

  it('finds leaked conditional rendering in .tsx with type information', async () => {
    const reported = await lint(
      {
        'badge.tsx': [
          'export const Badge = ({ count }: { count: number }): unknown => (',
          '  <div>{count && <span>{count}</span>}</div>',
          ')',
          '',
        ].join('\n'),
      },
      { react: true },
    )
    expect(reported['badge.tsx']).toContain('@eslint-react/no-leaked-conditional-rendering')
  })
})
