import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'
import { createEslintConfig } from '../src/eslint.js'
import { temporaryDirectory } from './helpers.js'

const TSCONFIG = JSON.stringify({
  compilerOptions: { strict: true, lib: ['ES2023'], types: [], jsx: 'react-jsx', noEmit: true },
  include: ['**/*'],
})

/** Rule ids reported for each fixture file, linted with the shared config. */
const lint = async (
  files: Record<string, string>,
  react = false,
): Promise<Record<string, Array<string>>> => {
  const root = temporaryDirectory({ 'tsconfig.json': TSCONFIG, ...files })
  const eslint = new ESLint({
    cwd: root,
    overrideConfigFile: true,
    overrideConfig: createEslintConfig({ tsconfigRootDir: root, react }),
  })
  const results = await eslint.lintFiles(Object.keys(files))
  return Object.fromEntries(
    results.map((result) => [
      result.filePath.slice(root.length + 1),
      result.messages.map((message) => message.ruleId ?? message.message),
    ]),
  )
}

describe('createEslintConfig', () => {
  it('passes clean TypeScript and reports a floating promise', async () => {
    const reported = await lint({
      'clean.ts': 'export const add = (a: number, b: number): number => a + b\n',
      'floating.ts': 'const run = async (): Promise<void> => {}\n\nrun()\n',
    })
    expect(reported['clean.ts']).toEqual([])
    expect(reported['floating.ts']).toContain('@typescript-eslint/no-floating-promises')
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
    expect((await lint(component, true))['component.tsx']).toContain('react-hooks/rules-of-hooks')
    expect((await lint(component))['component.tsx']).not.toContain('react-hooks/rules-of-hooks')
  })
})
