/**
 * The two claims this package's shape rests on, neither of which anything else
 * would notice breaking.
 *
 * **The root entry imports no React.** That is the reason there are two entry
 * points at all: a preference is read by a loader on a server as often as by a
 * component in a browser. A single `import { useState }` in `src/` outside
 * `src/react/` compiles, tests and publishes, and the first consumer to find
 * out is a server route that suddenly bundles a renderer.
 *
 * **The arrow between this package and `@toolpath/ui` points nowhere.** The
 * component kit is styling and display; this is the logic. They were one
 * package for two releases and that is what this repository is correcting — an
 * import either way puts them back together.
 *
 * Asserted from the package tree and the manifest rather than from a list, in
 * the shape `tool-support`'s `boundary.test.ts` uses and for the same reason: a
 * rostered check goes stale the first time somebody adds a file.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'src')

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

const SOURCES = modules(SRC)
const rel = (path: string) => relative(SRC, path)
const PURE = SOURCES.filter((path) => !rel(path).startsWith(`react${sep}`))

describe('the root entry needs no React', () => {
  it('has source on both sides of the split to check', () => {
    // Guards every rule below: a tree that moved would leave them iterating
    // nothing and reporting that as a pass.
    expect(PURE.length).toBeGreaterThan(0)
    expect(SOURCES.length).toBeGreaterThan(PURE.length)
  })

  it.each(PURE.map((path) => [rel(path), path] as const))('%s imports no React', (name, path) => {
    const react = importsOf(path).filter((spec) => spec === 'react' || spec === 'react-dom')

    expect(
      react,
      `src/${name} imports ${react.join(', ')} — it is outside src/react/, so a server ` +
        `route that imports @toolpath/app-support for a stored preference would now ` +
        `bundle a renderer to get it`,
    ).toEqual([])
  })

  it('takes React as a peer and never as a dependency', () => {
    // Two copies of React in one application breaks hooks outright, and a
    // dependency here is what puts the second copy there.
    expect(Object.keys(manifest.dependencies ?? {})).not.toContain('react')
    expect(Object.keys(manifest.dependencies ?? {})).not.toContain('react-dom')
    expect(Object.keys(manifest.peerDependencies ?? {})).toEqual(['react', 'react-dom'])
  })
})

describe('the component kit and the logic stay apart', () => {
  it.each(SOURCES.map((path) => [rel(path), path] as const))(
    '%s imports no component kit',
    (name, path) => {
      const kit = importsOf(path).filter((spec) => spec.startsWith('@toolpath/ui'))

      expect(
        kit,
        `src/${name} imports ${kit.join(', ')} — @toolpath/ui is styling and display, this ` +
          `package is the logic, and an import either way is the pairing this package was ` +
          `split out to end`,
      ).toEqual([])
    },
  )

  it('declares no dependency on the component kit', () => {
    const declared = [
      ...Object.keys(manifest.dependencies ?? {}),
      ...Object.keys(manifest.peerDependencies ?? {}),
    ]

    expect(declared).not.toContain('@toolpath/ui')
  })
})
