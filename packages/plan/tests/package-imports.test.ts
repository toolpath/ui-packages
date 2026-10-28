/**
 * What the entry point drags in, asserted from the import graph: no package at all. The package is
 * plan mode — logic, data types and functions — plain rules a server, a browser or a worker can
 * import alike; a view over them belongs in `@toolpath/ui`. The graph is walked rather than
 * rostered, so a module added under `src/` lands covered. `ts.preProcessFile` returns every
 * specifier without type checking.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '../src')

/** One relative specifier, as the source file it names. */
const moduleFor = (from: string, spec: string): string | null => {
  const base = resolve(dirname(from), spec.replace(/\.js$/, ''))
  for (const candidate of [`${base}.ts`, join(base, 'index.ts')]) {
    if (existsSync(candidate)) return candidate
  }
  return null
}

/**
 * Every package an entry point reaches, following its relative imports. A relative import that
 * names no source file is listed as `unresolved:`, so a typo cannot hide a module from the walk.
 */
const packagesFrom = (entry: string, seen = new Set<string>()): Set<string> => {
  const packages = new Set<string>()
  if (seen.has(entry) || !existsSync(entry)) return packages
  seen.add(entry)
  for (const spec of ts
    .preProcessFile(readFileSync(entry, 'utf8'), true, true)
    .importedFiles.map((file) => file.fileName)) {
    if (!spec.startsWith('.')) {
      packages.add(spec)
      continue
    }
    const target = moduleFor(entry, spec)
    if (target === null) {
      packages.add(`unresolved:${spec}`)
      continue
    }
    for (const name of packagesFrom(target, seen)) packages.add(name)
  }
  return packages
}

describe('src/index.ts', () => {
  it('reaches no package at all', () => {
    const path = join(SRC, 'index.ts')
    expect(existsSync(path)).toBe(true)
    expect([...packagesFrom(path)]).toEqual([])
  })
})

describe('the package ships logic only', () => {
  it('holds no .tsx and no .css', () => {
    const files = readdirSync(SRC, { recursive: true, encoding: 'utf8' })
    expect(files.filter((file) => /\.(tsx|css)$/.test(file))).toEqual([])
  })
})
