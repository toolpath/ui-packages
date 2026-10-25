import { describe, expect, it } from 'vitest'
import { validateConfigShape } from '../../src/config/validate.js'

const base = {
  schemaVersion: 1,
  root: 'file:///repo/dev.config.mjs',
  projects: [
    {
      name: 'core',
      root: '.',
      kind: 'library',
      runtime: 'universal',
      tsconfig: 'tsconfig.json',
      suites: { unit: { runner: 'vitest', config: 'vitest.config.ts' } },
    },
  ],
  ci: { node: '24.18.0' },
}

describe('validateConfigShape', () => {
  it('accepts a minimal configuration', () => {
    expect(validateConfigShape(base)).toEqual([])
  })

  it('names a misspelled field and suggests the intended one', () => {
    const issues = validateConfigShape({ ...base, projets: [] })
    expect(issues).toContainEqual({
      path: 'projets',
      message: 'is not a known field. Did you mean "projects"?',
    })
  })
})
