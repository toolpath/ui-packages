/**
 * The claim the whole design rests on: **every arrow points into this package
 * and none point out.**
 *
 * That is what makes one package a Node CLI, a React renderer and a server
 * route can all depend on. It held on the day it was written and nothing else
 * would notice it stopping: a single `import` of a sibling workspace package
 * would compile, test and publish, and the first consumer to find out would be
 * a build script that suddenly installs a renderer.
 *
 * So it is asserted from the package tree and the manifest rather than from a
 * list, in the shape `tool-scraper`'s `vendor-boundary.test.ts` uses and for the
 * same reason: a rostered check goes stale the first time somebody adds a file.
 *
 * TypeScript's own compiler API reads the imports — `ts.preProcessFile` returns
 * every specifier in a file without type checking it or resolving anything — and
 * `typescript` is already a devDependency here for the build.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'src')

/** Every `.ts` file under `where`. */
const modules = (where: string): string[] => {
  const found: string[] = []
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir).sort()) {
      const path = join(dir, entry)
      if (statSync(path).isDirectory()) walk(path)
      else if (entry.endsWith('.ts')) found.push(path)
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

describe('the package depends on nothing', () => {
  it('has source to check', () => {
    // Guards every rule below: a tree that moved would leave them iterating
    // nothing and reporting that as a pass.
    expect(SOURCES.length).toBeGreaterThan(0)
  })

  it('declares no runtime or peer dependency', () => {
    // The install cost a consumer inherits, stated as a check. A dependency
    // here is a dependency in every application, Node script and React app in
    // the tree at once.
    expect(manifest.dependencies ?? {}).toEqual({})
    expect(manifest.peerDependencies ?? {}).toEqual({})
  })

  it.each(SOURCES.map((path) => [rel(path), path] as const))(
    '%s imports nothing but a sibling module',
    (name, path) => {
      // Bare specifiers only: a relative path is a sibling of this package, and
      // anything else is a package — `react`, `node:fs`, a workspace sibling.
      // Node builtins are barred alongside the rest and deliberately so, since
      // "imports no `fs`" is half of what makes this importable from a browser.
      const outside = importsOf(path).filter((spec) => !spec.startsWith('.'))

      expect(
        outside,
        `src/${name} imports ${outside.join(', ')} — this package is the one ` +
          `thing in the tree that depends on nothing, and every consumer of it ` +
          `inherits whatever it reaches for`,
      ).toEqual([])
    },
  )
})

/**
 * The tree-wide half of the same claim, and the reason this package exists.
 *
 * `MM_PER_INCH` was declared and exported twice inside `@toolpath/tool-scraper`
 * alone before anything was looking — two of its published subpaths each
 * shipped their own 25.4 — and moving it up to that package's core fixed it
 * *within* that package while a third copy went on standing in the application
 * downstream. A constant every consumer shares can only be declared once
 * somewhere every consumer can reach, which is here.
 *
 * So the check is not "this package states it once". It is **"the tree states it
 * once"**, and it lives with the package that owns the constant.
 *
 * ## Numeric literals, not text
 *
 * Read off the syntax tree rather than by searching for a substring, because
 * three modules in the scraper discuss 25.4 in prose — the float-error note on
 * `holding.round6`, a family that publishes one column a factor of 25.4 out —
 * and a check that counted those would be turned off within the week. What is
 * barred is the *value* appearing in code, however it is spelled.
 */
describe('the tree states the conversion constant once', () => {
  const PACKAGES = resolve(ROOT, '..')

  /** Every `.ts` and `.tsx` under each package's own `src`, generated sources excluded. */
  const shipped = (): string[] =>
    readdirSync(PACKAGES)
      .sort()
      .flatMap((name) => {
        const src = join(PACKAGES, name, 'src')
        if (!existsSync(src) || !statSync(src).isDirectory()) return []
        return modules(src)
      })
      // The generated SDK is regenerated from the OpenAPI document; a hand edit
      // there survives exactly until the next generation, so it is not a place
      // a rule can be kept.
      .filter((path) => !path.includes(`${sep}generated${sep}`))

  /** The files whose *code* names the value 25.4, prose ignored. */
  const declaring = (): string[] =>
    shipped().filter((path) => {
      const source = ts.createSourceFile(
        path,
        readFileSync(path, 'utf8'),
        ts.ScriptTarget.Latest,
        false,
      )
      let found = false
      const visit = (node: ts.Node): void => {
        if (ts.isNumericLiteral(node) && Number(node.text) === 25.4) found = true
        else ts.forEachChild(node, visit)
      }
      visit(source)
      return found
    })

  it('reads every published package’s source', () => {
    // Guards the rule below. A layout that moved would leave it scanning
    // nothing and reporting that as a pass — which is the failure mode this
    // whole file is written against.
    const scanned = shipped()
    expect(scanned.length).toBeGreaterThan(100)
    expect(scanned.some((path) => path.includes(`${sep}tool-scraper${sep}`))).toBe(true)
    expect(scanned.some((path) => path.includes(`${sep}tool-drawing${sep}`))).toBe(true)
  })

  it('declares 25.4 in exactly one module', () => {
    expect(
      declaring().map((path) => relative(PACKAGES, path)),
      'more than one package states the millimetres-per-inch constant',
    ).toEqual(['tool-support/src/units.ts'])
  })
})
