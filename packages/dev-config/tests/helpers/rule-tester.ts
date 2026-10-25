import type { TSESLint } from '@typescript-eslint/utils'
import { RuleTester, type Rule } from 'eslint'
import tseslint from 'typescript-eslint'
import { describe, it } from 'vitest'

// ESLint's RuleTester drives Vitest's suite functions.
RuleTester.describe = describe
RuleTester.it = it
RuleTester.itOnly = it.only

type Tests = Parameters<RuleTester['run']>[2]

const noop: Rule.RuleModule = { create: () => ({}) }
const stubPlugin = {
  rules: new Proxy({}, { get: () => noop, has: () => true }),
}

/**
 * Runs a typescript-eslint rule module through ESLint's RuleTester with the
 * TypeScript parser (TS and TSX, no type information). The two rule types
 * describe the same runtime object.
 */
export const runRule = (
  name: string,
  rule: TSESLint.RuleModule<string, Array<unknown>>,
  tests: Tests,
  { filename }: { filename?: string } = {},
): void => {
  const tester = new RuleTester({
    languageOptions: { parser: tseslint.parser, ecmaVersion: 'latest', sourceType: 'module' },
    // Directives in the cases name rules from these plugins; stubs make them resolvable.
    plugins: { '@typescript-eslint': stubPlugin, 'react-hooks': stubPlugin },
  })
  // JSX is enabled by the file extension, as in a real project.
  const file = filename ?? 'module.ts'
  const withFilename = (cases: Tests['valid']): Tests['valid'] =>
    cases.map((entry) =>
      typeof entry === 'string' ? { code: entry, filename: file } : { filename: file, ...entry },
    )
  tester.run(name, rule as unknown as Rule.RuleModule, {
    valid: withFilename(tests.valid),
    invalid: tests.invalid.map((entry) => ({ filename: file, ...entry })),
  })
}
