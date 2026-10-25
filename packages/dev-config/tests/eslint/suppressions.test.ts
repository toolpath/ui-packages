import { noBlanketQualityDisable } from '../../src/eslint/plugin/rules/no-blanket-quality-disable.js'
import { requireCompilerOptoutReason } from '../../src/eslint/plugin/rules/require-compiler-optout-reason.js'
import { ESLint } from 'eslint'
import tseslint from 'typescript-eslint'
import { describe, expect, it } from 'vitest'
import { promoteSelfSuppressed } from '../../src/cli/lint.js'
import { runRule } from '../helpers/rule-tester.js'

runRule('no-blanket-quality-disable', noBlanketQualityDisable, {
  valid: [
    '// eslint-disable-next-line no-console -- the CLI writes this banner on purpose\nconsole.log(1)',
    'const value = 1 // eslint-disable-line no-console -- startup diagnostics are the point here',
    '/* eslint-disable no-console -- this module is the logger and prints by design */\nconsole.log(1)',
    // Directive-like text in strings, templates and rule-test fixtures is not a comment.
    "const fixture = '/* eslint-disable */'",
    'const template = `// eslint-disable-next-line`',
    // A critical rule may be suppressed for one line, with a reason.
    '// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the upstream callback type is any\nconst callback: any = null',
    '/* eslint-enable no-console */',
  ],
  invalid: [
    {
      code: '// eslint-disable-next-line no-console\nconsole.log(1)',
      errors: [{ messageId: 'unexplained' }],
    },
    {
      code: '// eslint-disable-next-line no-console -- why\nconsole.log(1)',
      errors: [{ messageId: 'unexplained' }],
    },
    {
      code: '/* eslint-disable @typescript-eslint/no-floating-promises -- this file is all fire-and-forget */\nconst value = 1',
      errors: [{ messageId: 'criticalRegion' }],
    },
    {
      code: '/* eslint-disable react-hooks/exhaustive-deps, no-console -- effects here are hand-tuned */\nconst value = 1',
      errors: [{ messageId: 'criticalRegion' }],
    },
    {
      code: '/* eslint no-console: "off" */\nconsole.log(1)',
      errors: [{ messageId: 'inlineConfig' }],
    },
  ],
})

runRule(
  'require-compiler-optout-reason',
  requireCompilerOptoutReason,
  {
    valid: [
      "const Chart = () => {\n  // The chart library mutates this ref during render, which the compiler cannot model.\n  'use no memo'\n  return null\n}",
      "function Widget() {\n  'use no memo' // An imperative third-party widget owns this subtree.\n  return null\n}",
      // Not in directive position, so not a directive.
      "const Label = () => {\n  const value = 1\n  'use no memo'\n  return value\n}",
      "const text = 'use no memo'",
      "const Fine = () => {\n  'use strict'\n  return null\n}",
    ],
    invalid: [
      {
        code: "const Chart = () => {\n  'use no memo'\n  return null\n}",
        errors: [{ messageId: 'missingReason' }],
      },
      {
        code: "'use no memo'\nexport const Page = () => null",
        errors: [{ messageId: 'missingReason' }],
      },
      {
        code: "const Chart = () => {\n  // tbd\n  'use no forget'\n  return null\n}",
        errors: [{ messageId: 'missingReason' }],
      },
      {
        // A comment two lines above is not adjacent.
        code: "const Chart = () => {\n  // The chart library mutates refs during render.\n\n  'use no memo'\n  return null\n}",
        errors: [{ messageId: 'missingReason' }],
      },
    ],
  },
  { filename: 'chart.tsx' },
)

describe('a directive that disables every rule', () => {
  // ESLint applies a rule-less directive to the policy rule's own report, so the
  // report arrives as a suppressed message; the CLI counts it as an error.
  const lint = async (code: string) => {
    const eslint = new ESLint({
      overrideConfigFile: true,
      overrideConfig: [
        {
          files: ['**/*.ts'],
          languageOptions: { parser: tseslint.parser },
          plugins: {
            toolpath: { rules: { 'no-blanket-quality-disable': noBlanketQualityDisable as never } },
          },
          rules: { 'toolpath/no-blanket-quality-disable': 'error' },
        },
      ],
    })
    const [result] = await eslint.lintText(code, { filePath: 'module.ts' })
    if (!result) {
      throw new Error('ESLint returned no result')
    }
    return promoteSelfSuppressed(result)
  }

  it('fails a file-wide disable-all', async () => {
    const result = await lint('/* eslint-disable */\nconst value = 1')
    expect(result.errorCount).toBe(1)
    expect(result.messages[0]?.message).toMatch(/Name the rules/)
  })

  it('fails a line-scoped disable-all', async () => {
    expect((await lint('const value = 1 // eslint-disable-line')).errorCount).toBe(1)
  })

  it('leaves a named, explained suppression alone', async () => {
    expect(
      (
        await lint(
          '// eslint-disable-next-line no-console -- the CLI prints this banner\nconsole.log(1)',
        )
      ).errorCount,
    ).toBe(0)
  })
})
