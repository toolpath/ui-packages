/**
 * What the React Native build runs holds no DOM.
 *
 * `tsconfig.native.json` type-checks the native build's graph, but with the
 * DOM's types, which @react-three/fiber's events are typed with on every
 * platform. So a `window` read or a `<div>` in a file that graph reaches would
 * type-check, and then throw on a phone the first time it runs.
 *
 * The graph is walked here as the build walks it: from the native entries,
 * through each import that runs, resolved by TypeScript with the native
 * config's `moduleSuffixes`, so a `.native` file stands in for its web
 * sibling. Each file it reaches is scanned by syntax, not by name, so that a
 * type annotation — `HTMLElement` as a parameter type, a
 * `Pick<HTMLCanvasElement, ...>` cast — is not a use: only what runs is.
 */

import { readFileSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'src')

const DOM_GLOBALS = new Set([
  'window',
  'document',
  'navigator',
  'localStorage',
  'HTMLElement',
  'HTMLCanvasElement',
])

const DOM_TAGS = new Set('div span button a p ul li label section img svg canvas input'.split(' '))

const config = ts.getParsedCommandLineOfConfigFile(
  join(ROOT, 'tsconfig.native.json'),
  {},
  {
    ...ts.sys,
    onUnRecoverableConfigFileDiagnostic: (diagnostic) => {
      throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'))
    },
  },
)
if (!config) throw new Error('tsconfig.native.json did not parse')

const parse = (path: string, text = readFileSync(path, 'utf8')): ts.SourceFile =>
  ts.createSourceFile(
    path,
    text,
    ts.ScriptTarget.Latest,
    true,
    path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  )

/** Whether an import or re-export is erased from the build: `import type`, or every name in it a type. */
const isTypeOnly = (declaration: ts.ImportDeclaration | ts.ExportDeclaration): boolean => {
  if (ts.isImportDeclaration(declaration)) {
    const clause = declaration.importClause
    const named = clause?.namedBindings
    return (
      clause?.isTypeOnly === true ||
      (clause?.name === undefined &&
        named !== undefined &&
        ts.isNamedImports(named) &&
        named.elements.length > 0 &&
        named.elements.every((element) => element.isTypeOnly))
    )
  }
  const clause = declaration.exportClause
  return (
    declaration.isTypeOnly ||
    (clause !== undefined &&
      ts.isNamedExports(clause) &&
      clause.elements.length > 0 &&
      clause.elements.every((element) => element.isTypeOnly))
  )
}

/** Every module specifier a file imports or re-exports at run time. */
const runtimeImports = (file: ts.SourceFile): Array<string> =>
  file.statements.flatMap((statement) => {
    if (!ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement)) return []
    const specifier = statement.moduleSpecifier
    if (!specifier || !ts.isStringLiteral(specifier) || isTypeOnly(statement)) return []
    return [specifier.text]
  })

/** Every source the native build runs: its entries and what they import, as it resolves them. */
const nativeGraph = (): Array<string> => {
  const found = new Set<string>()
  const pending = config.fileNames.filter((path) => !path.endsWith('.d.ts'))
  while (pending.length > 0) {
    const path = pending.pop()!
    if (found.has(path)) continue
    found.add(path)
    for (const specifier of runtimeImports(parse(path))) {
      if (!specifier.startsWith('.')) continue
      const resolved = ts.resolveModuleName(specifier, path, config.options, ts.sys).resolvedModule
      if (resolved && !resolved.isExternalLibraryImport && /\.tsx?$/.test(resolved.extension)) {
        pending.push(resolved.resolvedFileName)
      }
    }
  }
  return [...found].sort()
}

/** The objects a DOM global is also a property of: `globalThis.document`, `window.navigator`. */
const GLOBAL_OBJECTS = new Set(['globalThis', 'self', 'window'])

/** Whether an expression is the global object: `globalThis`, `self.window` and the like. */
const isGlobalObject = (node: ts.Expression): boolean =>
  ts.isIdentifier(node)
    ? GLOBAL_OBJECTS.has(node.text)
    : ts.isPropertyAccessExpression(node) &&
      GLOBAL_OBJECTS.has(node.name.text) &&
      isGlobalObject(node.expression)

/**
 * Whether this identifier is something that runs, rather than a name in a
 * declaration or a member. A member counts when it is a DOM global read off
 * the global object.
 */
const isExpression = (node: ts.Identifier): boolean => {
  const parent = node.parent
  if (ts.isPropertyAccessExpression(parent) && parent.name === node) {
    return isGlobalObject(parent.expression)
  }
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

/**
 * Every DOM use in one file, as `line: what`: the DOM's globals and tags,
 * `import.meta` (Metro has none), `react-dom`, and drei's `Html`. drei's root
 * counts too: on React Native it loads every module drei has as the app
 * starts, so a file the native build runs takes drei's modules one by one.
 */
const domUses = (file: ts.SourceFile): Array<string> => {
  const found: Array<string> = []
  const at = (node: ts.Node, what: string) =>
    found.push(`${file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1}: ${what}`)

  const visit = (node: ts.Node): void => {
    // Types never run, so nothing inside one is a use.
    if (ts.isTypeNode(node) || ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) {
      return
    }

    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const from = node.moduleSpecifier.text
      if (!isTypeOnly(node)) {
        if (from === 'react-dom' || from.startsWith('react-dom/')) at(node, `imports ${from}`)
        if (from === '@react-three/drei') at(node, 'imports @react-three/drei')
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

const GRAPH = nativeGraph()
const name = (path: string) => relative(SRC, path).split(sep).join('/')

describe('the React Native build runs no DOM', () => {
  it('walks the native graph', () => {
    const names = GRAPH.map(name)
    // A tree that moved would leave the rule below iterating nothing.
    expect(names.length).toBeGreaterThan(50)
    // `.native` files stand in for their web siblings, and the web-only files stay out.
    expect(names).toContain('viewer-frame.native.tsx')
    expect(names).toContain('render/keys.native.ts')
    expect(names).not.toContain('viewer-frame.tsx')
    expect(names).not.toContain('render/keys.ts')
    expect(names).not.toContain('measure-tool.tsx')
  })

  it.each(GRAPH.map((path) => [name(path), path] as const))('%s', (_file, path) => {
    expect(domUses(parse(path))).toEqual([])
  })

  it('finds a use where there is one', () => {
    // The scan checked on web files, where each kind is known to be.
    const uses = domUses(parse(join(SRC, 'viewer-frame.tsx')))
    expect(uses.some((use) => use.endsWith('<div>'))).toBe(true)
    expect(uses.some((use) => use.endsWith('HTMLCanvasElement'))).toBe(true)
    expect(domUses(parse(join(SRC, 'banana-asset.ts')))).toEqual([
      expect.stringMatching(/import\.meta$/),
    ])
    expect(domUses(parse(join(SRC, 'render/keys.ts'))).length).toBeGreaterThan(0)
    expect(domUses(parse(join(SRC, 'scene-label.tsx')))).toContainEqual(
      expect.stringMatching(/imports @react-three\/drei$/),
    )
    // A DOM global read off the global object, which a member name alone is not.
    expect(domUses(parse('probe.ts', 'globalThis.document?.title'))).toEqual(['1: document'])
    expect(domUses(parse('probe.ts', 'self.window.navigator'))).toEqual([
      '1: window',
      '1: navigator',
    ])
    expect(domUses(parse('probe.ts', 'part.document; options.window'))).toEqual([])
  })
})
