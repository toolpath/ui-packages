/**
 * Every `src/x.native.ts(x)` is a drop-in for its web sibling `src/x.ts(x)`.
 *
 * The React Native build resolves `./x.js` and `./x` to `x.native.ts(x)`
 * where there is one, so the two must export exactly the same names: a
 * name only the web file has is `undefined` on a phone, imported by code that
 * type-checked against the web file. Read with the type checker, so a
 * re-exported type counts as an export just as it does for an importer.
 */

import { existsSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'src')

const nativeFiles = (dir: string): string[] =>
  readdirSync(dir)
    .sort()
    .flatMap((entry) => {
      const path = join(dir, entry)
      if (statSync(path).isDirectory()) return nativeFiles(path)
      return /\.native\.tsx?$/.test(entry) && entry !== 'index.native.ts' ? [path] : []
    })

/** The web file a native one replaces: the same path without `.native`, with `.ts` or `.tsx`. */
const siblingOf = (path: string): string | null => {
  const base = path.replace(/\.native\.tsx?$/, '')
  return (
    ['.ts', '.tsx'].map((extension) => base + extension).find((file) => existsSync(file)) ?? null
  )
}

const NATIVE = nativeFiles(SRC)
const PAIRS = NATIVE.map((native) => ({ native, web: siblingOf(native) }))

const config = ts.getParsedCommandLineOfConfigFile(
  join(ROOT, 'tsconfig.json'),
  {},
  {
    ...ts.sys,
    onUnRecoverableConfigFileDiagnostic: (diagnostic) => {
      throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'))
    },
  },
)
if (!config) throw new Error('tsconfig.json did not parse')

// Export names need no types, so neither the default library nor any import is
// loaded: an `export ... from` names its exports whether or not the module it
// names is read. That keeps this a fraction of a type check's cost.
const program = ts.createProgram(
  PAIRS.flatMap(({ native, web }) => (web ? [native, web] : [native])),
  { ...config.options, noLib: true, noResolve: true, types: [] },
)
const checker = program.getTypeChecker()

const exportsOf = (path: string): string[] => {
  const file = program.getSourceFile(path)
  const module = file && checker.getSymbolAtLocation(file)
  if (!module) throw new Error(`${path} is not a module`)
  return checker
    .getExportsOfModule(module)
    .map((symbol) => symbol.name)
    .sort()
}

const name = (path: string) => relative(SRC, path).split(sep).join('/')

/**
 * Every native file, so that one deleted fails here rather than shipping its
 * web sibling to a phone.
 */
const EXPECTED = [
  'banana-asset.native.ts',
  'cube-label.native.tsx',
  'label-overlay.native.tsx',
  'render/keys.native.ts',
  'render/part-picking.native.ts',
  'render/pointer-hover.native.ts',
  'scene-label.native.tsx',
  'viewer-frame.native.tsx',
]

/**
 * Every `export *` in a file. The program reads no imports, so it cannot see
 * the names one brings in, and two files could differ there unnoticed.
 */
const exportStars = (path: string): Array<string> => {
  const file = program.getSourceFile(path)
  if (!file) throw new Error(`${path} was not read`)
  return file.statements
    .filter((statement) => ts.isExportDeclaration(statement) && !statement.exportClause)
    .map((statement) => statement.getText(file))
}

describe('native files and their web siblings', () => {
  it('pairs every native file', () => {
    expect(NATIVE.map(name)).toEqual(EXPECTED)
  })

  it.each(PAIRS.map(({ native, web }) => [name(native), native, web] as const))(
    '%s exports what its sibling does',
    (_file, native, web) => {
      expect(web, 'a .native file replaces its web sibling').not.toBeNull()
      expect([...exportStars(native), ...exportStars(web!)]).toEqual([])
      expect(exportsOf(native)).toEqual(exportsOf(web!))
    },
  )
})
