/**
 * Every deep `@react-three/drei/...` path the source imports resolves against
 * the installed drei.
 *
 * The package imports drei's modules one by one, since on React Native drei's
 * root loads every module drei has. drei has no `exports` map, so its files
 * are all importable today; if it ever adds one without these paths, this
 * fails here rather than in an application's bundler.
 */

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'src')

const DEEP_IMPORT = /\bfrom\s+'(@react-three\/drei\/[^']+)'/g

/** Every deep drei path a source file imports. */
const deepImports = [
  ...new Set(
    readdirSync(SRC, { recursive: true, encoding: 'utf8' })
      .filter((file) => /\.tsx?$/.test(file))
      .flatMap((file) =>
        [...readFileSync(join(SRC, file), 'utf8').matchAll(DEEP_IMPORT)].map(([, path]) => path!),
      ),
  ),
].sort()

const require = createRequire(join(ROOT, 'package.json'))

describe("drei's deep imports", () => {
  it('finds the ones the source has', () => {
    expect(deepImports).toContain('@react-three/drei/core/Gltf.js')
  })

  it.each(deepImports)('%s resolves, as an import and as a require', (path) => {
    // Vitest's module runner does not implement import.meta.resolve; ask Node
    // itself so this checks the actual import condition and exports map.
    const url = execFileSync(
      process.execPath,
      ['--input-type=module', '-e', 'console.log(import.meta.resolve(process.argv[1]))', path],
      {
        cwd: ROOT,
        encoding: 'utf8',
      },
    ).trim()
    const imported = fileURLToPath(url)
    expect(existsSync(imported), imported).toBe(true)
    expect(require.resolve(path)).toBe(imported)
  })
})
