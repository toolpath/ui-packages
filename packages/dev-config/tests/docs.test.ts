import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { POLICY_GROUPS } from '../src/policy/rules.js'
import { ESLINT_CONFIG, PRETTIER_CONFIG, vitestConfig } from '../src/sync/templates.js'

const root = fileURLToPath(new URL('..', import.meta.url))
const read = (path: string): string => readFileSync(join(root, path), 'utf8')
const documents = ['README.md', ...readdirSync(join(root, 'docs')).map((file) => `docs/${file}`)]

describe('documentation', () => {
  it('shows the native files exactly as init writes them', () => {
    const readme = read('README.md')
    expect(readme).toContain(`// eslint.config.mjs\n${ESLINT_CONFIG}`)
    expect(readme).toContain(`// prettier.config.mjs\n${PRETTIER_CONFIG}`)
    const vitest = vitestConfig(
      { name: 'core', root: '.', kind: 'library', runtime: 'node', tsconfig: 'tsconfig.json' },
      'unit',
    )
    expect(readme).toContain(`// vitest.config.ts\n${vitest}`)
  })

  it('describes every lint group in the policy table', () => {
    const policy = read('docs/policy.md')
    for (const group of POLICY_GROUPS) {
      expect(policy).toContain(`| \`${group.id}\``)
    }
  })

  it('links only to files that exist', () => {
    const missing: Array<string> = []
    for (const document of documents) {
      for (const match of read(document).matchAll(
        /\]\((?!https?:|#|mailto:)([^)#\s]+)(#[^)]*)?\)/g,
      )) {
        const target = resolve(dirname(join(root, document)), match[1] ?? '')
        if (!existsSync(target)) {
          missing.push(`${document} -> ${match[1] ?? ''}`)
        }
      }
    }
    expect(missing).toEqual([])
  })

  it('never asks anyone to run a formatter', () => {
    for (const document of documents) {
      expect(read(document), document).not.toMatch(
        /\b(run|npm run|pnpm) (format|prettier)\b|prettier --(write|check)/i,
      )
    }
  })
})
