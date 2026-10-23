/**
 * The DOM stays in the files that are web-only by design.
 *
 * The React Native build swaps each `.native.ts(x)` file in for its sibling
 * and bundles everything else as it is, so a `window` read or a `<div>` in any
 * other file ships to a phone, where it throws the first time it runs — and
 * nothing in the web build, its tests or its types would notice. So the uses
 * are found in the source, with TypeScript's own parser, and allowed only in
 * the web halves of the platform files and the four components that are
 * web-only outright.
 *
 * Found by syntax, not by name, so that a type annotation — `HTMLElement` as a
 * parameter type, a `Pick<HTMLCanvasElement, ...>` cast — is not a use: only
 * what runs is.
 *
 * Two more rules hold the swap together. A web-only file with no `.native`
 * sibling ships as it is, so only other web-only files may import it. And the
 * native modules — React Native, Expo, three-mesh-bvh, fiber's native build —
 * are imported only by `.native` files, which the web build never sees.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'src')

/** Web-only by design: the platform files' web halves and the web-only components. */
const WEB_FILES = new Set([
  'viewer-frame.tsx',
  'scene-label.tsx',
  'cube-label.tsx',
  'render/label-texture.ts',
  'banana-asset.ts',
  'render/keys.ts',
  'measure-tool.tsx',
  'hover-card.tsx',
  'viewer-toolbar.tsx',
  'toolbar-icons.tsx',
  // The WebGL check and its alert: only the web frame imports them.
  'render/webgl.ts',
  'webgl-unavailable.tsx',
])

const DOM_GLOBALS = new Set([
  'window',
  'document',
  'navigator',
  'localStorage',
  'HTMLElement',
  'HTMLCanvasElement',
])

const DOM_TAGS = new Set('div span button a p ul li label section img svg canvas input'.split(' '))

/** Every `.ts` and `.tsx` source, declarations aside. */
const sources = (dir: string): string[] =>
  readdirSync(dir)
    .sort()
    .flatMap((entry) => {
      const path = join(dir, entry)
      if (statSync(path).isDirectory()) return sources(path)
      return /\.tsx?$/.test(entry) && !entry.endsWith('.d.ts') ? [path] : []
    })

/** Whether this identifier is something that runs, rather than a name in a declaration or a member. */
const isExpression = (node: ts.Identifier): boolean => {
  const parent = node.parent
  if (ts.isPropertyAccessExpression(parent) && parent.name === node) return false
  if (ts.isQualifiedName(parent)) return false
  if (
    (ts.isPropertyAssignment(parent) ||
      ts.isPropertyDeclaration(parent) ||
      ts.isPropertySignature(parent) ||
      ts.isMethodDeclaration(parent) ||
      ts.isMethodSignature(parent) ||
      ts.isVariableDeclaration(parent) ||
      ts.isParameter(parent) ||
      ts.isBindingElement(parent) ||
      ts.isFunctionDeclaration(parent) ||
      ts.isJsxAttribute(parent)) &&
    parent.name === node
  ) {
    return false
  }
  if (ts.isImportSpecifier(parent) || ts.isExportSpecifier(parent) || ts.isImportClause(parent)) {
    return false
  }
  return true
}

/** Every DOM use in one file, as `line: what`. */
const domUses = (path: string): string[] => {
  const text = readFileSync(path, 'utf8')
  const kind = path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const file = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, kind)
  const found: string[] = []
  const at = (node: ts.Node, what: string) =>
    found.push(`${file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1}: ${what}`)

  const visit = (node: ts.Node): void => {
    // Types never run, so nothing inside one is a use.
    if (ts.isTypeNode(node) || ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) {
      return
    }

    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const from = node.moduleSpecifier.text
      if (from === 'react-dom' || from.startsWith('react-dom/')) at(node, `imports ${from}`)
      const named = node.importClause?.namedBindings
      if (from === '@react-three/drei' && named && ts.isNamedImports(named)) {
        for (const element of named.elements) {
          const imported = (element.propertyName ?? element.name).text
          if (imported === 'Html' && !element.isTypeOnly) at(element, 'imports Html from drei')
        }
      }
      return
    }

    if (ts.isMetaProperty(node) && node.keywordToken === ts.SyntaxKind.ImportKeyword) {
      at(node, 'import.meta')
    }

    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(file)
      if (DOM_TAGS.has(tag)) at(node, `<${tag}>`)
    }

    if (ts.isIdentifier(node) && DOM_GLOBALS.has(node.text) && isExpression(node)) {
      at(node, node.text)
    }

    ts.forEachChild(node, visit)
  }

  visit(file)
  return found
}

const SOURCES = sources(SRC)
const name = (path: string) => relative(SRC, path).split(sep).join('/')

interface Import {
  line: number
  from: string
  /** Erased from the build: `import type`, or every name in it a type. */
  typeOnly: boolean
}

/** Every import and re-export in one file. */
const importsOf = (path: string): Import[] => {
  const text = readFileSync(path, 'utf8')
  const kind = path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const file = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, kind)
  const found: Import[] = []
  for (const statement of file.statements) {
    const declaration =
      ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement) ? statement : null
    if (!declaration?.moduleSpecifier || !ts.isStringLiteral(declaration.moduleSpecifier)) continue
    let typeOnly = false
    if (ts.isImportDeclaration(declaration)) {
      const clause = declaration.importClause
      const named = clause?.namedBindings
      typeOnly =
        clause?.isTypeOnly === true ||
        (clause?.name === undefined &&
          named !== undefined &&
          ts.isNamedImports(named) &&
          named.elements.length > 0 &&
          named.elements.every((element) => element.isTypeOnly))
    } else {
      const clause = declaration.exportClause
      typeOnly =
        declaration.isTypeOnly ||
        (clause !== undefined &&
          ts.isNamedExports(clause) &&
          clause.elements.length > 0 &&
          clause.elements.every((element) => element.isTypeOnly))
    }
    found.push({
      line: file.getLineAndCharacterOfPosition(declaration.getStart(file)).line + 1,
      from: declaration.moduleSpecifier.text,
      typeOnly,
    })
  }
  return found
}

const NAMES = new Set(SOURCES.map(name))
const isNative = (file: string) => /\.native\.tsx?$/.test(file)
const hasNativeSibling = (file: string) =>
  NAMES.has(file.replace(/\.tsx?$/, '.native.ts')) ||
  NAMES.has(file.replace(/\.tsx?$/, '.native.tsx'))

/** The source a relative `./x.js` specifier in `file` names, if it is one. */
const resolveRelative = (file: string, from: string): string | null => {
  if (!from.startsWith('.') || !from.endsWith('.js')) return null
  const base = join(dirname(file), from.slice(0, -'.js'.length)).split(sep).join('/')
  for (const extension of ['.ts', '.tsx']) if (NAMES.has(base + extension)) return base + extension
  return null
}

/** What a file imports at run time that only a web-only file may: the web-only files nothing replaces. */
const webOnlyImports = (path: string): string[] => {
  const file = name(path)
  return importsOf(path)
    .filter((each) => !each.typeOnly)
    .flatMap((each) => {
      const target = resolveRelative(file, each.from)
      return target && WEB_FILES.has(target) && !hasNativeSibling(target)
        ? [`${each.line}: imports ${target}`]
        : []
    })
}

const NATIVE_MODULE =
  /^(react-native(\/|$)|expo-|three-mesh-bvh(\/|$)|@react-three\/fiber\/native$)/

/** Every native-only module a file imports. */
const nativeImports = (path: string): string[] =>
  importsOf(path)
    .filter((each) => NATIVE_MODULE.test(each.from))
    .map((each) => `${each.line}: imports ${each.from}`)

/**
 * Every import of drei's root. On React Native the root loads every module
 * drei has as the app starts (hls.js, troika's text, all of it), so a file the
 * native build ships takes drei's modules one by one.
 */
const dreiRootImports = (path: string): string[] =>
  importsOf(path)
    .filter((each) => !each.typeOnly && each.from === '@react-three/drei')
    .map((each) => `${each.line}: imports @react-three/drei`)

describe('the DOM stays in the web-only files', () => {
  it('has source to check', () => {
    // A tree that moved would leave the rules below iterating nothing.
    expect(SOURCES.length).toBeGreaterThan(50)
  })

  it('allows only files that exist', () => {
    const names = new Set(SOURCES.map(name))
    expect([...WEB_FILES].filter((file) => !names.has(file))).toEqual([])
  })

  it.each(SOURCES.map((path) => [name(path), path] as const))('%s', (file, path) => {
    if (WEB_FILES.has(file)) return
    expect(domUses(path)).toEqual([])
  })

  it('imports the web-only files nothing replaces only from web-only files', () => {
    const offenders = SOURCES.filter((path) => !WEB_FILES.has(name(path))).flatMap((path) =>
      webOnlyImports(path).map((use) => `${name(path)}:${use}`),
    )
    expect(offenders).toEqual([])
  })

  it("imports drei's root only from files React Native does not ship", () => {
    const shipped = SOURCES.filter(
      (path) => !(WEB_FILES.has(name(path)) && hasNativeSibling(name(path))),
    )
    const offenders = shipped.flatMap((path) =>
      dreiRootImports(path).map((use) => `${name(path)}:${use}`),
    )
    expect(offenders).toEqual([])
  })

  it('imports the native modules only from .native files', () => {
    const offenders = SOURCES.filter((path) => !isNative(name(path))).flatMap((path) =>
      nativeImports(path).map((use) => `${name(path)}:${use}`),
    )
    expect(offenders).toEqual([])
  })

  it('finds an import where there is one', () => {
    // The import rules checked, on files where each kind is known to be.
    expect(webOnlyImports(join(SRC, 'viewer-toolbar.tsx'))).toContainEqual(
      expect.stringMatching(/imports toolbar-icons\.tsx$/),
    )
    expect(nativeImports(join(SRC, 'viewer-frame.native.tsx'))).toContainEqual(
      expect.stringMatching(/imports react-native$/),
    )
    expect(dreiRootImports(join(SRC, 'measure-tool.tsx'))).toContainEqual(
      expect.stringMatching(/imports @react-three\/drei$/),
    )
  })

  it('finds a use where there is one', () => {
    // The checker checked: every kind it looks for, in the web frame.
    const uses = domUses(join(SRC, 'viewer-frame.tsx'))
    expect(uses.some((use) => use.endsWith('<div>'))).toBe(true)
    expect(uses.some((use) => use.endsWith('HTMLCanvasElement'))).toBe(true)
    expect(domUses(join(SRC, 'banana-asset.ts'))).toEqual([expect.stringMatching(/import\.meta$/)])
    expect(domUses(join(SRC, 'render/keys.ts')).length).toBeGreaterThan(0)
    expect(domUses(join(SRC, 'scene-label.tsx'))).toContainEqual(
      expect.stringMatching(/imports Html from drei$/),
    )
  })
})
