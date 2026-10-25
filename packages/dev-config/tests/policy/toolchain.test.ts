import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { toolchain } from '../../src/policy/toolchain.js'

interface Manifest {
  engines: { node: string }
  dependencies: Record<string, string>
  peerDependencies: Record<string, string>
  peerDependenciesMeta: Record<string, { optional?: boolean }>
}

const manifest = JSON.parse(
  readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
) as Manifest
const exact = /^\d+\.\d+\.\d+(-[\w.]+)?$/

describe('the toolchain manifest', () => {
  it('pins every version exactly', () => {
    const versions = [
      toolchain.runtime.node,
      toolchain.runtime.pnpm,
      toolchain.runtime.npm,
      toolchain.core.eslint,
      ...toolchain.core.typescript,
      ...Object.values(toolchain.bundled),
      ...Object.values(toolchain.profiles).flatMap((profile) => Object.values(profile).flat()),
      ...Object.values(toolchain.tested),
    ]
    expect(versions.filter((version) => !exact.test(version))).toEqual([])
  })

  it('agrees with the package manifest', () => {
    expect(manifest.engines.node).toBe(toolchain.runtime.nodeRange)
    expect(manifest.dependencies).toEqual(toolchain.bundled)
    expect(manifest.peerDependencies.eslint).toBe(toolchain.core.eslint)
    expect(manifest.peerDependencies.typescript).toBe(toolchain.core.typescript.join(' || '))
    for (const [name, range] of Object.entries(manifest.peerDependencies)) {
      if (
        name === 'eslint' ||
        name === 'typescript' ||
        name === 'react' ||
        name === '@toolpath/api'
      ) {
        continue
      }
      const versions = Object.values(toolchain.profiles).flatMap((profile) =>
        [profile[name] ?? []].flat(),
      )
      expect(
        range.split(' || ').every((version) => versions.includes(version)),
        `${name} ${range}`,
      ).toBe(true)
    }
  })

  it('makes every peer but ESLint and TypeScript optional', () => {
    const required = Object.keys(manifest.peerDependencies).filter(
      (name) => manifest.peerDependenciesMeta[name]?.optional !== true,
    )
    expect(required.sort()).toEqual(['eslint', 'typescript'])
  })

  it('names one SDK artifact per supported contract', () => {
    for (const pin of Object.values(toolchain.engine.contracts)) {
      expect(toolchain.profiles.engine?.['@toolpath/api']).toContain(pin.sdk)
    }
    expect(toolchain.engine.contracts[toolchain.engine.defaultContract]?.channel).toBe('stable')
  })
})
