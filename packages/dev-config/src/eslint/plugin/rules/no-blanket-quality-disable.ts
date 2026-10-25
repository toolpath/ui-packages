import type { TSESTree } from '@typescript-eslint/utils'
import { createRule } from '../create-rule.js'
import { isCriticalRule } from '../critical-rules.js'

type MessageIds = 'disableAll' | 'unexplained' | 'criticalRegion' | 'inlineConfig'

export interface Directive {
  kind:
    | 'eslint-disable'
    | 'eslint-enable'
    | 'eslint-disable-line'
    | 'eslint-disable-next-line'
    | 'eslint'
  rules: Array<string>
  reason: string
}

const DIRECTIVE =
  /^\s*(eslint-disable-next-line|eslint-disable-line|eslint-disable|eslint-enable|eslint)(?=\s|$)([\s\S]*)$/

/**
 * Parses one comment the way ESLint reads directive comments: a keyword, an
 * optional comma-separated rule list, and an optional `-- reason`. Only real
 * comments reach this, so directive-like text in strings is never inspected.
 */
export const parseDirective = (comment: TSESTree.Comment): Directive | undefined => {
  const text = comment.value.replace(/^\s*\*?/, '').trimStart()
  const match = DIRECTIVE.exec(text)
  if (!match) {
    return undefined
  }
  const kind = match[1] as Directive['kind']
  const [body = '', ...reason] = (match[2] ?? '').split(/\s--\s|\s--$/)
  if (kind === 'eslint') {
    return { kind, rules: [], reason: reason.join(' -- ').trim() }
  }
  const rules = body
    .split(',')
    .map((rule) => rule.trim())
    .filter((rule) => rule !== '')
  return { kind, rules, reason: reason.join(' -- ').trim() }
}

const MINIMUM_REASON = 10

export const noBlanketQualityDisable = createRule<[], MessageIds>({
  name: 'no-blanket-quality-disable',
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow suppressing every rule, suppressions without a reason, block suppressions of critical rules, and inline rule configuration.',
    },
    messages: {
      disableAll:
        'Name the rules this suppresses; a directive without rules turns off every check.',
      unexplained:
        'Explain this suppression: `{{kind}} {{rules}} -- <why the rule does not apply here>`.',
      criticalRegion:
        '{{rule}} protects against a real defect class and may be suppressed only on a single line, with a reason.',
      inlineConfig:
        'Configure rules through @toolpath/dev-config, not inline comments. A narrow exception goes in dev.config.mjs with its reason.',
    },
    schema: [],
  },
  defaultOptions: [],
  create: (context) => ({
    Program: () => {
      for (const comment of context.sourceCode.getAllComments()) {
        const directive = parseDirective(comment)
        if (!directive || directive.kind === 'eslint-enable') {
          continue
        }
        if (directive.kind === 'eslint') {
          context.report({ loc: comment.loc, messageId: 'inlineConfig' })
          continue
        }
        if (directive.rules.length === 0) {
          context.report({ loc: comment.loc, messageId: 'disableAll' })
          continue
        }
        if (directive.reason.length < MINIMUM_REASON) {
          context.report({
            loc: comment.loc,
            messageId: 'unexplained',
            data: { kind: directive.kind, rules: directive.rules.join(', ') },
          })
        }
        if (directive.kind === 'eslint-disable') {
          for (const rule of directive.rules.filter(isCriticalRule)) {
            context.report({ loc: comment.loc, messageId: 'criticalRegion', data: { rule } })
          }
        }
      }
    },
  }),
})
