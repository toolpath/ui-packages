/**
 * What each entry point drags in, asserted from the import graph.
 *
 * `/model` is the DFM rules and the checker, and its promise is that a server
 * can import it: no React, no DOM, no `@toolpath/ui`. `@toolpath/tool-support`
 * proves its own half: it depends on nothing. The root is the rule
 * list, and its promise is that it does not pull in three.js through
 * `@toolpath/viewer` for the one label it borrowed (`direction-label.ts`).
 *
 * The graph is walked rather than rostered, so a module added under `model/`
 * lands covered. `ts.preProcessFile` returns every specifier in a file
 * without type checking it.
 */

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '../src')

/** One relative specifier, as the source file it names. */
const moduleFor = (from: string, spec: string): string | null => {
  const base = resolve(dirname(from), spec.replace(/\.js$/, ''))
  for (const candidate of [`${base}.ts`, `${base}.tsx`, join(base, 'index.ts')]) {
    if (existsSync(candidate)) return candidate
  }
  return null
}

/** Every package an entry point reaches, following its relative imports. */
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
    if (target !== null) for (const name of packagesFrom(target, seen)) packages.add(name)
  }
  return packages
}

describe('/model stays importable from a server', () => {
  const packages = packagesFrom(join(SRC, 'model/index.ts'))

  it('reaches only the cutting-tool domain', () => {
    expect([...packages].sort()).toEqual(['@toolpath/tool-support'])
  })
})

describe('the root stays free of three.js', () => {
  const packages = packagesFrom(join(SRC, 'index.ts'))

  it('reaches no viewer and no three.js', () => {
    expect([...packages].filter((name) => /three|@toolpath\/viewer/.test(name))).toEqual([])
  })
})
