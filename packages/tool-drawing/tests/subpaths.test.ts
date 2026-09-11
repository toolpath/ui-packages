/**
 * What each entry point drags in, asserted from the import graph.
 *
 * The package publishes three subpaths and the split is the point: the root
 * draws, `/geometry` is free of React and of the DOM so a server can import it,
 * and `/clearance` is the optional overlay. The README says so to consumers.
 *
 * **Nothing was checking it, and this is the change that made it worth
 * checking.** Until `@toolpath/tool-support` existed the package had no runtime
 * dependency at all, so "`/geometry` imports no React" was true by inspection —
 * there was nothing for it to import. Now `/geometry` reaches into another
 * package, and whether it stays server-safe depends on what that package
 * reaches for. `@toolpath/tool-support` proves its own half in its
 * `tests/boundary.test.ts`: no dependency, no peer, no React, no DOM, no `fs`.
 * This is the other half — that `/geometry` reaches *only* there.
 *
 * The graph is walked rather than rostered, so a module added under
 * `model/` lands covered without anybody remembering this test exists.
 * `ts.preProcessFile` returns every specifier in a file without type checking
 * it, and `typescript` is already a devDependency.
 */

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
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

/** The modules an entry point reaches, for a failure message that names one. */
const modulesFrom = (entry: string, seen = new Set<string>()): Set<string> => {
  if (seen.has(entry) || !existsSync(entry)) return seen
  seen.add(entry)
  for (const spec of ts
    .preProcessFile(readFileSync(entry, 'utf8'), true, true)
    .importedFiles.map((file) => file.fileName)) {
    if (!spec.startsWith('.')) continue
    const target = moduleFor(entry, spec)
    if (target !== null) modulesFrom(target, seen)
  }
  return seen
}

const GEOMETRY = join(SRC, 'geometry/index.ts')
const ROOT = join(SRC, 'index.ts')
const CLEARANCE = join(SRC, 'clearance/index.ts')

describe('/geometry stays importable from a server', () => {
  it('reaches modules to check', () => {
    // Guards the rules below: an entry point this test failed to resolve would
    // reach nothing and report that as a pass.
    expect(modulesFrom(GEOMETRY).size).toBeGreaterThan(1)
  })

  it('reaches no package but the domain', () => {
    // `@toolpath/tool-support` is the one package allowed through, and it is
    // allowed because it proves it depends on nothing. A second name here is a
    // decision about every server that imports this subpath.
    expect([...packagesFrom(GEOMETRY)].sort()).toEqual(['@toolpath/tool-support'])
  })

  it('reaches no React and no DOM', () => {
    // The claim stated the way it would fail: not "the package list is short"
    // but "none of these three things is in it". A `node:` builtin is barred
    // with them, since a subpath that reads a file is not one a browser bundle
    // can take either.
    const packages = [...packagesFrom(GEOMETRY)]
    for (const barred of ['react', 'react-dom', 'react/jsx-runtime']) {
      expect(packages, `/geometry reaches ${barred}`).not.toContain(barred)
    }
    expect(packages.filter((name) => name.startsWith('node:'))).toEqual([])
  })

  it('pulls in no .tsx at all', () => {
    // The rule one layer down, and the one a reviewer can apply without running
    // anything: React lives in the `.tsx` files, so a `.tsx` reachable from
    // this entry point is the split going wrong whatever it happens to import
    // today.
    const components = [...modulesFrom(GEOMETRY)]
      .filter((path) => path.endsWith('.tsx'))
      .map((path) => relative(SRC, path))

    expect(components, `/geometry reaches ${components.join(', ')}`).toEqual([])
  })
})

describe('the drawing subpaths do need a renderer', () => {
  it.each([
    ['.', ROOT],
    ['/clearance', CLEARANCE],
  ])('%s reaches React', (_name, entry) => {
    // Keeps the rules above honest. If the walk silently resolved nothing, every
    // "reaches no React" assertion would pass for the wrong reason — so the two
    // entry points that *must* reach it are asserted to.
    expect([...packagesFrom(entry)]).toContain('react')
  })
})
