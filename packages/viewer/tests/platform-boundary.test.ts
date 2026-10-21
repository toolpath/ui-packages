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
