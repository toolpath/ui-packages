import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { toolchain } from '../../src/policy/toolchain.js'
import type { ReleaseIdentity } from '../../src/release/metadata.js'
import type { DesiredState } from '../../src/sync/desired.js'
import { applyWrites, planSync, type PlanInput } from '../../src/sync/engine.js'
import type { Receipt } from '../../src/sync/receipt.js'

const identity: ReleaseIdentity = {
  schemaVersion: 1,
  name: '@toolpath/dev-config',
  version: '1.2.3',
  policyVersion: 1,
  channel: 'release',
  repository: 'toolpath/ui-packages',
  sourceSha: 'a'.repeat(40),
  dirty: false,
  workflow: `toolpath/ui-packages/.github/workflows/dev-config-quality.yml@${'a'.repeat(40)}`,
  actions: { setup: 'x', check: 'y', result: 'z' },
  toolchain,
}

const roots: Array<string> = []
afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true })
  }
})

const repository = (files: Record<string, string>): string => {
  const root = mkdtempSync(join(tmpdir(), 'toolpath-dev-sync-'))
  roots.push(root)
  for (const [path, content] of Object.entries({
    'package.json': '{\n  "name": "fixture"\n}\n',
    ...files,
  })) {
    writeFileSync(join(root, path), content)
  }
  return root
}

const desired = (overrides: Partial<DesiredState> = {}): DesiredState => ({
  managed: [
    { kind: 'file', path: 'eslint.config.mjs', content: 'managed config v1\n' },
    { kind: 'block', path: 'AGENTS.md', id: 'standard', content: 'standard v1\n' },
  ],
  scripts: { lint: 'toolpath-dev lint', prepare: 'toolpath-dev hooks install' },
  devDependencies: { eslint: '10.9.1' },
  ...overrides,
})

const plan = (
  root: string,
  state: DesiredState,
  receipt?: Receipt,
  extra: Partial<PlanInput> = {},
) =>
  planSync({
    root,
    desired: state,
    receipt,
    identity,
    packageManager: 'npm@11.16.0',
    installedSelfVersion: '1.2.3',
    ...extra,
  })

const apply = (root: string, state: DesiredState, receipt?: Receipt): Receipt => {
  const result = plan(root, state, receipt)
  expect(result.conflicts).toEqual([])
  applyWrites(root, result.writes)
  return result.receipt
}

describe('planSync', () => {
  it('initializes, then plans nothing on a second run', () => {
    const root = repository({ 'AGENTS.md': '# Our repository\n\nLocal guidance.\n' })
    const receipt = apply(root, desired())
    expect(readFileSync(join(root, 'AGENTS.md'), 'utf8')).toMatch(
      /^# Our repository\n\nLocal guidance\.\n\n<!-- toolpath-dev:begin standard -->/,
    )
    const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as Record<
      string,
      unknown
    >
    expect(manifest.scripts).toEqual({
      lint: 'toolpath-dev lint',
      prepare: 'toolpath-dev hooks install',
    })
    expect(manifest.packageManager).toBe('npm@11.16.0')
    const again = plan(root, desired(), receipt)
    expect(again.writes).toEqual([])
    expect(again.conflicts).toEqual([])
  })

  it('updates unchanged managed text and merges local edits that do not overlap', () => {
    const root = repository({})
    const receipt = apply(root, desired())
    writeFileSync(join(root, 'eslint.config.mjs'), 'managed config v1\nlocal addition\n')
    const next = desired({
      managed: [
        { kind: 'file', path: 'eslint.config.mjs', content: 'managed header\nmanaged config v1\n' },
        { kind: 'block', path: 'AGENTS.md', id: 'standard', content: 'standard v2\n' },
      ],
    })
    const result = plan(root, next, receipt)
    expect(result.conflicts).toEqual([])
    applyWrites(root, result.writes)
    expect(readFileSync(join(root, 'eslint.config.mjs'), 'utf8')).toBe(
      'managed header\nmanaged config v1\nlocal addition\n',
    )
    expect(readFileSync(join(root, 'AGENTS.md'), 'utf8')).toContain('standard v2')
  })

  it('stops with a proposed patch when an edited block overlaps a change, writing nothing', () => {
    const root = repository({})
    const receipt = apply(root, desired())
    const agents = readFileSync(join(root, 'AGENTS.md'), 'utf8').replace(
      'standard v1',
      'standard edited here',
    )
    writeFileSync(join(root, 'AGENTS.md'), agents)
    const result = plan(
      root,
      desired({
        managed: [{ kind: 'block', path: 'AGENTS.md', id: 'standard', content: 'standard v2\n' }],
      }),
      receipt,
    )
    expect(result.conflicts.map((conflict) => conflict.path)).toEqual(['AGENTS.md'])
    expect(result.conflicts[0]?.patch).toContain('+standard v2')
  })

  it('treats an existing, different native config as a conflict before adopting it', () => {
    const root = repository({ 'eslint.config.mjs': 'export default []\n' })
    const result = plan(root, desired())
    expect(result.conflicts[0]).toMatchObject({ path: 'eslint.config.mjs' })
    expect(result.conflicts[0]?.patch).toContain('-export default []')
  })

  it('composes an existing prepare step and refuses to replace another script', () => {
    const root = repository({
      'package.json': '{\n  "scripts": { "prepare": "node setup.mjs", "lint": "eslint ." }\n}\n',
    })
    const result = plan(root, desired())
    expect(result.conflicts.map((conflict) => conflict.reason)).toEqual([
      expect.stringMatching(/script "lint" is "eslint \."/),
    ])
    const composed = plan(
      repository({ 'package.json': '{ "scripts": { "prepare": "husky" } }\n' }),
      desired(),
    )
    expect(composed.conflicts).toEqual([])
    const write = composed.writes.find((entry) => entry.path === 'package.json')
    expect(JSON.parse(write?.after ?? '{}')).toMatchObject({
      scripts: { prepare: 'toolpath-dev hooks install' },
    })
    const other = plan(
      repository({ 'package.json': '{ "scripts": { "prepare": "node setup.mjs" } }\n' }),
      desired(),
    )
    expect(
      JSON.parse(other.writes.find((entry) => entry.path === 'package.json')?.after ?? '{}'),
    ).toMatchObject({
      scripts: { prepare: 'node setup.mjs && toolpath-dev hooks install' },
    })
  })

  it('installs only tools that are missing or at another version', () => {
    const root = repository({
      'package.json': '{ "devDependencies": { "eslint": "10.9.1", "typescript": "^5.0.0" } }\n',
    })
    const result = plan(
      root,
      desired({ devDependencies: { eslint: '10.9.1', typescript: '5.9.3', vitest: '4.1.10' } }),
    )
    expect(result.installs).toEqual({ typescript: '5.9.3', vitest: '4.1.10' })
    const written = plan(root, desired({ devDependencies: { vitest: '4.1.10' } }), undefined, {
      writeDependencies: true,
    })
    expect(written.installs).toEqual({})
    expect(
      JSON.parse(written.writes.find((entry) => entry.path === 'package.json')?.after ?? '{}'),
    ).toMatchObject({
      devDependencies: { vitest: '4.1.10' },
    })
  })
})
