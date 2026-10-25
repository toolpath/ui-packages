import type { TSESLint } from '@typescript-eslint/utils'
import { noBlanketQualityDisable } from './rules/no-blanket-quality-disable.js'
import { preferConstArrow } from './rules/prefer-const-arrow.js'
import { requireCompilerOptoutReason } from './rules/require-compiler-optout-reason.js'

export { CRITICAL_RULE_PATTERNS, isCriticalRule } from './critical-rules.js'
export { parseDirective, type Directive } from './rules/no-blanket-quality-disable.js'

/**
 * The package-owned generic rules. Each has documentation in `docs/policy.md`
 * under its identifier, plus valid, invalid, edge, and fix tests.
 */
export const rules = {
  'prefer-const-arrow': preferConstArrow,
  'no-blanket-quality-disable': noBlanketQualityDisable,
  'require-compiler-optout-reason': requireCompilerOptoutReason,
} satisfies Record<string, TSESLint.RuleModule<string, Array<unknown>>>

export const plugin = {
  meta: { name: '@toolpath/dev-config/eslint/plugin', namespace: 'toolpath' },
  rules,
}

export default plugin
