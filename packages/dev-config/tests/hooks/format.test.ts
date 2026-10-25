import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { loadConfig } from '../../src/config/load.js'
import { resolveConfig } from '../../src/config/resolve.js'
import { formatFiles } from '../../src/hooks/format.js'
import { createProject, devConfig, tsconfig, vitestConfig } from '../helpers/project.js'

const project = createProject({
  'dev.config.mjs': devConfig(
    [{ name: 'core' }],
    "formatIgnore: [{ files: ['contracts/**'], reason: 'Byte-retained public contract snapshots' }],",
  ),
  'tsconfig.json': tsconfig(),
  'vitest.config.mjs': vitestConfig('core'),
  'src/messy.ts': 'export const value={a:1}\n',
  'contracts/snapshot.json': '{"keep":   "these bytes"}\n',
  'pnpm-lock.yaml': "lockfileVersion:   '9.0'\n",
  'image.png': 'not text Prettier understands',
  'src/broken.ts': 'export const = 1\n',
})
afterAll(() => {
  project.remove()
})

describe('formatFiles', () => {
  it('formats in check mode without writing, skipping retained, lock and unknown files', async () => {
    const resolved = resolveConfig(await loadConfig(join(project.root, 'dev.config.mjs')))
    const files = [
      'src/messy.ts',
      'contracts/snapshot.json',
      'pnpm-lock.yaml',
      'image.png',
      'src/broken.ts',
    ]
    const checked = await formatFiles(resolved, files, { check: true })
    expect(checked.changed).toEqual(['src/messy.ts'])
    expect(checked.errors.map((error) => error.path)).toEqual(['src/broken.ts'])
    expect(checked.skipped).toBe(3)
    expect(readFileSync(join(project.root, 'src/messy.ts'), 'utf8')).toBe(
      'export const value={a:1}\n',
    )

    await formatFiles(resolved, files)
    expect(readFileSync(join(project.root, 'src/messy.ts'), 'utf8')).toBe(
      'export const value = { a: 1 }\n',
    )
    expect(readFileSync(join(project.root, 'contracts/snapshot.json'), 'utf8')).toBe(
      '{"keep":   "these bytes"}\n',
    )
  })
})
