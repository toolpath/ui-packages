import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'
import enginePlugin from '../../src/engine/eslint/index.js'
import toolpathPlugin from '../../src/eslint/plugin/index.js'
import { POLICY_GROUPS } from '../../src/policy/rules.js'

const pluginModules: Record<string, () => Promise<{ default: ESLint.Plugin }>> = {
  '@typescript-eslint': async () => ({
    default: (await import('typescript-eslint')).default.plugin as unknown as ESLint.Plugin,
  }),
  'react-hooks': () => import('eslint-plugin-react-hooks') as Promise<{ default: ESLint.Plugin }>,
  '@eslint-react': () => import('@eslint-react/eslint-plugin'),
  'jsx-a11y-x': () => import('eslint-plugin-jsx-a11y-x'),
  vitest: () => import('@vitest/eslint-plugin'),
  jest: () => import('eslint-plugin-jest'),
  playwright: () => import('eslint-plugin-playwright'),
  'testing-library': () => import('eslint-plugin-testing-library'),
}

/** Core rules are checked through ESLint itself: an unknown one throws, a deprecated one is listed. */
const coreRuleProblems = async (rules: Array<string>): Promise<Array<string>> => {
  if (rules.length === 0) {
    return []
  }
  const eslint = new ESLint({
    overrideConfigFile: true,
    overrideConfig: { rules: Object.fromEntries(rules.map((rule) => [rule, 'error'])) },
  })
  try {
    const results = await eslint.lintText('export {}\n')
    return results.flatMap((result) =>
      result.usedDeprecatedRules.map((rule) => `${rule.ruleId} is deprecated`),
    )
  } catch (error) {
    return [error instanceof Error ? error.message : String(error)]
  }
}

const ruleMeta = async (rule: string): Promise<{ deprecated: unknown } | undefined> => {
  const slash = rule.lastIndexOf('/')
  const namespace = rule.slice(0, slash)
  const name = rule.slice(slash + 1)
  if (namespace === 'toolpath') {
    return name in toolpathPlugin.rules ? { deprecated: false } : undefined
  }
  if (namespace === 'toolpath-engine') {
    return name in enginePlugin.rules ? { deprecated: false } : undefined
  }
  const load = pluginModules[namespace]
  if (!load) {
    return undefined
  }
  const { default: loaded } = await load()
  const definition = loaded.rules?.[name] as { meta?: { deprecated?: unknown } } | undefined
  return definition ? { deprecated: definition.meta?.deprecated } : undefined
}

describe('the effective rule map', () => {
  for (const group of POLICY_GROUPS) {
    it(`${group.id}: every rule exists in the pinned plugin and is not deprecated`, async () => {
      const rules = Object.keys(group.rules)
      const problems = await coreRuleProblems(rules.filter((rule) => !rule.includes('/')))
      for (const rule of rules.filter((candidate) => candidate.includes('/'))) {
        const meta = await ruleMeta(rule)
        if (!meta) {
          problems.push(`${rule} does not exist`)
        } else if (meta.deprecated !== undefined && meta.deprecated !== false) {
          problems.push(`${rule} is deprecated`)
        }
      }
      expect(problems).toEqual([])
    })
  }

  it('uses only error and off, because lint allows zero warnings', () => {
    const severities = POLICY_GROUPS.flatMap((group) =>
      Object.values(group.rules).map((entry) => (typeof entry === 'string' ? entry : entry[0])),
    )
    expect(new Set(severities)).toEqual(new Set(['error', 'off']))
  })

  it('changes a rule set by an earlier group only in the groups that exist to override it', () => {
    // Checker-owned core rules, CommonJS `require`, and the runners' own unbound-method rule.
    const overriding = new Set(['typescript-checked', 'commonjs', 'vitest', 'jest'])
    const seen = new Map<string, string>()
    const conflicts: Array<string> = []
    for (const group of POLICY_GROUPS) {
      for (const [rule, entry] of Object.entries(group.rules)) {
        const value = JSON.stringify(entry)
        const previous = seen.get(rule)
        if (previous !== undefined && previous !== value && !overriding.has(group.id)) {
          conflicts.push(`${rule} in ${group.id}`)
        }
        seen.set(rule, value)
      }
    }
    expect(conflicts).toEqual([])
  })
})
