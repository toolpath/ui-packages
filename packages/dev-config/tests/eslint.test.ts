import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'
import { createEslintConfig, type EslintOptions } from '../src/eslint.js'
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

/** Rule ids (or messages, for directives) reported for each fixture file. */
const lint = async (
  files: Record<string, string>,
  options: Partial<EslintOptions> = {},
): Promise<Record<string, Array<string>>> => {
  const root = temporaryDirectory({
    'tsconfig.json': TSCONFIG,
    'package.json': MANIFEST,
    // Installed but not declared in package.json.
    'node_modules/left-pad/package.json': JSON.stringify({ name: 'left-pad', main: 'index.js' }),
    'node_modules/left-pad/index.js': 'module.exports = (value) => value\n',
    ...files,
  })
  const eslint = new ESLint({
    cwd: root,
    overrideConfigFile: true,
    overrideConfig: createEslintConfig({ tsconfigRootDir: root, ...options }),
  })
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
  'func-style': 'export function add(a: number, b: number): number {\n  return a + b\n}\n',
  'prefer-arrow-callback':
    'export const same = [1].map(function (value: number): number {\n  return value\n})\n',
  '@typescript-eslint/strict-boolean-expressions':
    "export const label = (count: number): string => (count ? 'some' : 'none')\n",
  '@typescript-eslint/consistent-type-assertions':
    'interface User {\n  name: string\n}\n\nexport const user = {} as User\n',
  '@typescript-eslint/no-unsafe-type-assertion':
    'interface User {\n  name: string\n}\n\nexport const toUser = (value: unknown): User => value as User\n',
  '@eslint-community/eslint-comments/require-description':
    '// eslint-disable-next-line func-style\nexport function one(): number {\n  return 1\n}\n',
  '@eslint-community/eslint-comments/no-restricted-disable':
    "// eslint-disable-next-line no-eval -- needed here\nexport const value: unknown = eval('1')\n",
  '@eslint-community/eslint-comments/disable-enable-pair':
    '/* eslint-disable func-style -- legacy file */\nexport function one(): number {\n  return 1\n}\n',
  '@eslint-community/eslint-comments/no-unlimited-disable':
    '/* eslint-disable */\nexport function one(): number {\n  return 1\n}\n',
  'unicorn/prefer-node-protocol': "import { sep } from 'path'\n\nexport const separator = sep\n",
  'import-x/no-extraneous-dependencies':
    "import leftPad from 'left-pad'\n\nexport const pad: unknown = leftPad\n",
  'import-x/no-duplicates':
    "import { add } from './clean.js'\nimport { sub } from './clean.js'\n\nexport const both = [add, sub]\n",
  'import-x/no-useless-path-segments':
    "import { add } from './nested/../clean.js'\n\nexport const plus = add\n",
}

describe('createEslintConfig', () => {
  const clean =
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
        '// eslint-disable-next-line func-style -- not needed\nexport const one = 1\n',
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
