/**
 * What each entry point drags in, asserted from the import graph.
 *
 * The package is the DFM rules and the checker — logic, data types and
 * functions — and its promise is that a server can import it: no React, no
 * DOM, no `@toolpath/ui`, no CSS. The views over it are in `@toolpath/ui`.
 * `@toolpath/tool-support` proves its own half: it depends on nothing.
 *
 * Both entries are held to the same list, because the root is `/model` under
 * a shorter name. The graph is walked rather than rostered, so a module added
 * under `src/` lands covered. `ts.preProcessFile` returns every specifier in a
 * file without type checking it.
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

describe.each(['index.ts', 'model/index.ts'])('src/%s', (entry) => {
  const packages = packagesFrom(join(SRC, entry))

  it('reaches only the cutting-tool domain', () => {
    expect([...packages].sort()).toEqual(['@toolpath/tool-support'])
  })
})

describe('the package ships logic only', () => {
  it('holds no .tsx and no .css', () => {
    const files = readdirSync(SRC, { recursive: true, encoding: 'utf8' })
    expect(files.filter((file) => /\.(tsx|css)$/.test(file))).toEqual([])
  })
})
