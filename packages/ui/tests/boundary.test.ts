/**
 * What this package is: **styling and display, and nothing else.**
 *
 * It is the component kit Storybook documents — a resource for reusable UI
 * elements and a guide for building them. Storage policy, routing, API calls
 * and application state are somebody else's job, and `@toolpath/app-support`
 * is that somebody.
 *
 * Nothing noticed when that stopped being true. `loadUnit`, `saveUnit` and
 * `useUnit` — a browser-storage reader with a back-compatible spelling
 * migration, and the React state over it — arrived in a `src/helpers/`
 * directory, were swept into the public entry by a wholesale
 * `export * from './helpers'`, and shipped in two minor releases. Removing
 * them again cost a major.
 *
 * ## The shape of the check
 *
 * A component's own hook is not the problem and never was:
 * `callout/use-dismissed-callouts.ts` reads `localStorage` so a dismissed
 * callout stays dismissed, and `table/use-column-layout.ts` so a table
 * remembers its columns. Both are that component's, and both live in that
 * component's directory. So the rule is not "no storage" — it is **where the
 * file lives**:
 *
 * - Every directory under `src/` is one component's, and contains at least one
 *   `.tsx`. A directory with no component in it is a bucket, and a bucket is
 *   what `helpers/` was.
 * - Nothing sits loose at the top of `src/` but the entry point, because a
 *   loose file is the same bucket without the directory.
 * - No module imports a Toolpath sibling. The two files removed here each
 *   spelled `UnitSystem` out as a literal union, with a comment explaining that
 *   a component kit should not put the cutting-tool domain in a consumer's
 *   `node_modules` — a package boundary being routed around rather than
 *   respected, and the tell that the code was in the wrong package.
 *
 * Read from the tree and the manifest rather than from a list, in the shape
 * `tool-support`'s `boundary.test.ts` uses and for the same reason: a rostered
 * check goes stale the first time somebody adds a file.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'src')

/** Every directory under `src/`, at any depth. */
const directories = (where: string): string[] => {
  const found: string[] = []
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir).sort()) {
      const path = join(dir, entry)
      if (statSync(path).isDirectory()) {
        found.push(path)
        walk(path)
      }
    }
  }
  walk(where)
  return found
}

/** Every `.ts` and `.tsx` file under `where`. */
const modules = (where: string): string[] => {
  const found: string[] = []
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir).sort()) {
      const path = join(dir, entry)
      if (statSync(path).isDirectory()) walk(path)
      else if (entry.endsWith('.ts') || entry.endsWith('.tsx')) found.push(path)
    }
  }
  walk(where)
  return found
}

/** The import specifiers this file names, relative paths included. */
const importsOf = (path: string): string[] =>
  ts.preProcessFile(readFileSync(path, 'utf8'), true, true).importedFiles.map((f) => f.fileName)

const manifest = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
  dependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
}

const DIRECTORIES = directories(SRC)
const SOURCES = modules(SRC)
const rel = (path: string) => relative(SRC, path)

describe('every directory is a component’s', () => {
  it('has a tree to check', () => {
    // Guards every rule below: a layout that moved would leave them iterating
    // nothing and reporting that as a pass.
    expect(DIRECTORIES.length).toBeGreaterThan(20)
    expect(SOURCES.length).toBeGreaterThan(100)
  })

  it.each(DIRECTORIES.map((path) => [rel(path), path] as const))(
    'src/%s holds a component',
    (name, path) => {
      const components = readdirSync(path).filter((entry) => entry.endsWith('.tsx'))

      expect(
        components.length,
        `src/${name} contains no .tsx, so it is not a component's directory — it is a ` +
          `bucket, which is what src/helpers/ was. Application logic belongs in ` +
          `@toolpath/app-support; a hook or helper one component needs belongs beside ` +
          `that component`,
      ).toBeGreaterThan(0)
    },
  )

  it('keeps nothing loose at the top of src/ but the entry point', () => {
    const loose = readdirSync(SRC).filter(
      (entry) => entry.endsWith('.ts') || entry.endsWith('.tsx'),
    )

    expect(
      loose,
      'a loose file at the top of src/ is the same bucket without the directory',
    ).toEqual(['index.ts'])
  })
})

describe('the kit reaches for no Toolpath sibling', () => {
  it.each(SOURCES.map((path) => [rel(path), path] as const))(
    'src/%s imports no sibling package',
    (name, path) => {
      const siblings = importsOf(path).filter((spec) => spec.startsWith('@toolpath/'))

      expect(
        siblings,
        `src/${name} imports ${siblings.join(', ')} — a component kit that reaches into a ` +
          `Toolpath package is holding that package's concerns, and puts it in every ` +
          `consumer's node_modules`,
      ).toEqual([])
    },
  )

  it('declares no dependency on a Toolpath sibling', () => {
    const declared = [
      ...Object.keys(manifest.dependencies ?? {}),
      ...Object.keys(manifest.peerDependencies ?? {}),
    ]

    expect(declared.filter((name) => name.startsWith('@toolpath/'))).toEqual([])
  })
})
