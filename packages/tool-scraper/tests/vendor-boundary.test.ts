/**
 * The layout, asserted from the package tree rather than from a list.
 *
 * The claim this package rests on is that its adapters share the core and
 * never each other — so a REGO-FIX change cannot break a Kennametal scrape,
 * and a constant two vendors both need has one home. A rostered test would go
 * stale the first time somebody added a file; these derive their module lists
 * by walking `src/`, so a new adapter is covered the moment it lands. The
 * count is deliberately not written down here for the same reason.
 *
 * ## Both halves of the claim, not just the first
 *
 * "No vendor imports another" was asserted from the start; **"a constant two
 * vendors both need has one home" was not**, and the rule as stated only forces
 * the first. With the import barred, the second vendor to need something does
 * not reach for the first's copy — it writes its own. That is exactly what
 * happened by 2026-08-29: `MM_PER_INCH` was declared and exported twice,
 * `unionHeader` existed byte for byte in two adapters, `plain` was one name with
 * two behaviours, and three vendors had three fraction readers that disagreed on
 * real inputs. Nothing failed, because nothing was looking.
 *
 * {@link SHARED_BY_CONTRACT} and the collision case below are what look. They
 * cannot tell a genuine duplicate from a name two adapters happen to reuse, so
 * the answer is an allowlist with a reason per entry — the same shape
 * {@link COMPOSITION_ROOTS} uses, and for the same reason: an exception is a
 * deliberate edit here rather than a thing that quietly accumulates.
 *
 * ## How imports are read
 *
 * TypeScript's own compiler API, which is already a devDependency:
 * `ts.preProcessFile` returns every import specifier in a file without type
 * checking it or resolving anything. That is the counterpart of the Python's
 * `ast.walk` over `Import`/`ImportFrom`, and it costs no new dependency —
 * which matters, because a structural guard that needed a linter plugin to run
 * is a guard somebody switches off.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '../src')
const VENDORS = join(SRC, 'vendors')

/**
 * The files whose job **is** to know every vendor, and nothing else.
 *
 * A composition root wires the parts together; it is the one place a
 * dependency on all of them is the point rather than a leak. `registry.ts` is
 * the module that maps a brand to the adapter serving it; `node/cli.ts` is the
 * console entry point, so one command can drive any adapter. Neither holds
 * pipeline logic — they bind and parse argv — which is what keeps the
 * exception narrow.
 *
 * **`index.ts` is deliberately not here.** It re-exports the core surface and
 * reaches a vendor only through `registry`, so it is held to the same rule as
 * any other core module. Listing it would licence a direct vendor import into
 * the package's front door for no reason anything needs.
 *
 * `families/` is not here either. In the source package it briefly did the
 * binding, which made the config table import a manufacturer, and the table is
 * read by every test — none of which should drag a vendor's scraper in behind
 * it. That test is this one.
 *
 * Named rather than pattern-matched, so adding a third is a deliberate edit
 * here with a reason beside it.
 */
const COMPOSITION_ROOTS = ['registry.ts', 'node/cli.ts']

/**
 * Names more than one adapter may export, and why each is not a duplicate.
 *
 * Every entry is a name whose **meaning is per vendor** — two adapters
 * answering the same question about different catalogs — rather than one
 * answer that got written twice. A name that is not here and appears in two
 * manufacturers is the second kind, and belongs in the core.
 */
const SHARED_BY_CONTRACT = new Map([
  // The `RecordMappers` contract: `registry` looks these up by brand and kind.
  // EMUGE-FRANKEN is the second vendor to publish a drill and a tap, so the two
  // entries this list said the second vendor would add back are here.
  ['RECORD_MAPPERS', 'the mapper table every cutting-tool adapter exports'],
  ['HOLDING_MAPPERS', 'its toolholding counterpart, for a vendor that ships holders or collets'],
  ['endmillRecord', 'the end mill half of that contract'],
  ['drillRecord', 'the drill half of it, which two vendors now publish'],
  ['tapRecord', 'the tap half — same contract, two unrelated tap vocabularies'],
  // Each vendor's own transport, one name per shape of scrape.
  ['BASE', "the vendor's own origin — different string, same job"],
  ['CATEGORY_ROOTS', 'where a vendor’s catalog walk starts; a different tree each'],
  ['scrapeHolders', 'the toolholding scrape, which two vendors publish'],
  ['holderRow', 'one holder -> one row, against two different vendor vocabularies'],
  // Per-vendor readings of a value the vendor states its own way.
  ['cornerRadius', 'the radius fallback, whose priority order is a vendor fact'],
])

/** Every `.ts` file under `where`. */
function modules(where: string): string[] {
  const found: string[] = []
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir).sort()) {
      const path = join(dir, entry)
      if (statSync(path).isDirectory()) walk(path)
      else if (entry.endsWith('.ts')) found.push(path)
    }
  }
  try {
    walk(where)
  } catch {
    return []
  }
  return found
}

/** The import specifiers this file names, relative paths included. */
function importsOf(path: string): string[] {
  const info = ts.preProcessFile(readFileSync(path, 'utf8'), true, true)
  return info.importedFiles.map((f) => f.fileName)
}

/**
 * The names this file exports — values, types and re-exports alike.
 *
 * `ts.preProcessFile` reads imports and not exports, so this is a walk of the
 * source file's own top-level statements. Not a type check and no resolution:
 * the question is which identifiers a consumer could name, which the syntax
 * answers on its own.
 */
/** The modules this file re-exports wholesale — `export * from './x.js'`. */
function reExportsOf(path: string): string[] {
  const source = ts.createSourceFile(
    path,
    readFileSync(path, 'utf8'),
    ts.ScriptTarget.Latest,
    false,
  )
  const specs: string[] = []
  for (const statement of source.statements) {
    if (!ts.isExportDeclaration(statement)) continue
    const specifier = statement.moduleSpecifier
    if (
      statement.exportClause === undefined &&
      specifier !== undefined &&
      ts.isStringLiteral(specifier)
    ) {
      specs.push(specifier.text)
    }
  }
  return specs
}

function exportedNames(path: string): string[] {
  const source = ts.createSourceFile(
    path,
    readFileSync(path, 'utf8'),
    ts.ScriptTarget.Latest,
    false,
  )
  const names: string[] = []

  for (const statement of source.statements) {
    // `export { familyBrand, familyId } from '../family.js'` — a re-export
    // carries no modifier, so it is matched by shape rather than by `export`.
    if (ts.isExportDeclaration(statement)) {
      const bindings = statement.exportClause
      if (bindings !== undefined && ts.isNamedExports(bindings)) {
        for (const element of bindings.elements) names.push(element.name.text)
      }
      continue
    }

    const modifiers = ts.canHaveModifiers(statement) ? ts.getModifiers(statement) : undefined
    if (!modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) continue

    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) names.push(declaration.name.text)
      }
    } else if (
      (ts.isFunctionDeclaration(statement) ||
        ts.isInterfaceDeclaration(statement) ||
        ts.isTypeAliasDeclaration(statement) ||
        ts.isClassDeclaration(statement)) &&
      statement.name !== undefined
    ) {
      names.push(statement.name.text)
    }
  }

  return names
}

/**
 * Modules whose exports are for a sibling in this package and never for a
 * consumer, with the reason each is not simply missing from `exports`.
 *
 * These are the case `AGENTS.md` names as the *other* correct fix for an
 * unreferenced export — drop the `export` keyword — which neither can take:
 * ESM has no word for "visible to my siblings only", so the keyword has to
 * stay and the intent has to be written down instead.
 */
const INTERNAL_BY_DESIGN = new Map([
  ['order.ts', 'the one string comparator, imported by provenance.ts and node/receipts.ts'],
  ['uuid5.ts', 'the SHA-1 v5 primitive behind identity.recordGuid, which is what is published'],
])

/** `./dist/families/harvey.js` -> the source file it is built from. */
function sourceOf(distPath: string): string {
  return resolve(
    SRC,
    '..',
    distPath
      .replace(/^\.\//, '')
      .replace(/^dist\//, 'src/')
      .replace(/\.js$/, '.ts'),
  )
}

/** The subpath a module would be published under, for the failure message. */
function subpathFor(module: string): string {
  return `./${module.replace(/\.ts$/, '').replace(/\/index$/, '')}`
}

/** One relative specifier, as the source file it names. */
function moduleFor(from: string, spec: string): string | null {
  const base = resolve(dirname(from), spec.replace(/\.js$/, ''))
  for (const candidate of [`${base}.ts`, join(base, 'index.ts')]) {
    if (existsSync(candidate)) return candidate
  }
  return null
}

/**
 * Every name reachable from an entry module, following its re-exports.
 *
 * `export * from './records.js'` is how both entry points are built, so what a
 * consumer can name is a graph rather than one file's own exports — which is
 * exactly why the gap this closes was invisible by inspection.
 */
function reachableFrom(entry: string, seen = new Set<string>()): Set<string> {
  const names = new Set<string>()
  if (seen.has(entry) || !existsSync(entry)) return names
  seen.add(entry)

  for (const name of exportedNames(entry)) names.add(name)
  for (const spec of reExportsOf(entry)) {
    const target = moduleFor(entry, spec)
    if (target !== null) for (const name of reachableFrom(target, seen)) names.add(name)
  }
  return names
}

/** Which module each import resolves to, as a path relative to `src/`. */
function importedModules(path: string): string[] {
  return importsOf(path)
    .filter((spec) => spec.startsWith('.'))
    .map((spec) => relative(SRC, resolve(dirname(path), spec)))
}

const ALL = modules(SRC)
const CORE = ALL.filter((p) => !p.startsWith(VENDORS))
const VENDOR_MODULES = modules(VENDORS)

/** The manufacturer directories under `vendors/`. */
const BRANDS = readdirSync(VENDORS)
  .filter((name) => !name.startsWith('_') && !name.startsWith('.'))
  .filter((name) => statSync(join(VENDORS, name)).isDirectory())
  .sort()

const rel = (path: string) => relative(SRC, path)

describe('the tree is the shape these rules assume', () => {
  it('has the core modules the rules are written against', () => {
    // Guards `CORE`. A tree that moved would leave the rules below iterating
    // nothing, and they would report that as a pass.
    const names = new Set(CORE.map(rel))

    for (const module of [
      'identity.ts',
      'records.ts',
      'provenance.ts',
      'thread.ts',
      'conventions.ts',
    ]) {
      expect(names, module).toContain(module)
    }
  })

  it('has one directory per manufacturer, each with a scraper', () => {
    // Derived rather than rostered, for the same reason the module lists are:
    // an adapter that lands in the wrong shape has to fail here, not be absent
    // from a list nobody updated. A directory that fetches nothing is a
    // vendor's name attached to no transport.
    expect(BRANDS.length).toBeGreaterThan(0)

    for (const brand of BRANDS) {
      const files = readdirSync(join(VENDORS, brand))
      expect(files, brand).toContain('scrape.ts')
    }
  })

  it('gives every manufacturer a subpath a consumer can import', () => {
    // The direction `tests/packaging.test.ts` cannot check. That one walks
    // `exports` and proves each entry has a module behind it, which catches a
    // subpath added for a file that is not there. The failure this catches is
    // the other one: an adapter that builds into `dist`, ships in the tarball,
    // and cannot be reached — `import '@toolpath/tool-scraper/vendors/maritool'`
    // throws ERR_PACKAGE_PATH_NOT_EXPORTED at a consumer, and nothing before
    // that says so. Derived from the tree rather than rostered, so the sixth
    // vendor is covered without anybody remembering this test exists.
    const manifest = JSON.parse(readFileSync(join(SRC, '../package.json'), 'utf8')) as {
      exports: Record<string, { types: string; import: string }>
    }

    for (const brand of BRANDS) {
      expect(existsSync(join(VENDORS, brand, 'index.ts')), `${brand} has no index.ts`).toBe(true)
      expect(
        Object.keys(manifest.exports),
        `src/vendors/${brand} builds and ships, but no ./vendors/${brand} subpath ` +
          `exports it — a consumer cannot import it`,
      ).toContain(`./vendors/${brand}`)
      expect(manifest.exports[`./vendors/${brand}`]).toEqual({
        types: `./dist/vendors/${brand}/index.d.ts`,
        import: `./dist/vendors/${brand}/index.js`,
      })
    }
  })

  it('reaches every exported name through a published subpath, or says why not', () => {
    // The general form of the manufacturer case above, and the one that would
    // have caught what shipped: `./families` points at the merged index, that
    // index re-exports `FAMILIES`, `HOLDER_FAMILIES` and `COLLET_FAMILIES` and
    // nothing else, and a vendor's **scrape-target** table is none of those. So
    // `import { PRODUCT_PAGES } from '@toolpath/tool-scraper/families/harvey'`
    // threw ERR_PACKAGE_PATH_NOT_EXPORTED at a consumer while
    // `dist/families/harvey.js` sat in the installed package. `exports` is an
    // allowlist, not documentation.
    //
    // **`pnpm knip` cannot see this and did not.** Its entry points include
    // `tests/**`, so a symbol a test imports counts as referenced — and every
    // one of those tables had a test. Referenced is not reachable, and this is
    // the difference stated as a check.
    //
    // Per name rather than per directory, so the next module lands covered
    // wherever it lands, and per **name** rather than per file so that it
    // cannot push the package into over-exporting: `families/kennametal.ts`
    // publishes only `FAMILIES`, `HOLDER_FAMILIES` and `COLLET_FAMILIES`, all of
    // which a consumer reaches through the merged table and filters by brand, so
    // it needs no subpath and does not get one. An accidental export is permanent.
    const manifest = JSON.parse(readFileSync(join(SRC, '../package.json'), 'utf8')) as {
      exports: Record<string, { types: string; import: string }>
    }

    const published = new Set<string>()
    for (const entry of Object.values(manifest.exports)) {
      for (const name of reachableFrom(sourceOf(entry.import))) published.add(name)
    }
    // Guards the loop below: an `exports` map this test failed to resolve would
    // leave `published` empty and report the whole package as unreachable, which
    // is a failure that reads like a catastrophe and is really a broken test.
    expect(published.size).toBeGreaterThan(0)

    for (const path of ALL) {
      const module = rel(path)
      const unreachable = exportedNames(path).filter((name) => !published.has(name))

      if (INTERNAL_BY_DESIGN.has(module)) {
        // An exception that has stopped being needed gets dropped, the same
        // discipline `COMPOSITION_ROOTS` and `SHARED_BY_CONTRACT` are held to.
        expect(
          unreachable,
          `src/${module} is listed as internal but every name it exports is ` +
            `already published — drop its ${JSON.stringify(module)} entry`,
        ).not.toEqual([])
        continue
      }

      expect(
        unreachable.sort(),
        `src/${module} publishes ${unreachable.sort().join(', ')}, which builds ` +
          `into dist and ships in the tarball with no subpath reaching it — add ` +
          `${JSON.stringify(subpathFor(module))} to \`exports\`, re-export it from ` +
          `one that is already there, or list the module in INTERNAL_BY_DESIGN`,
      ).toEqual([])
    }
  })

  it('names a composition root that really is one', () => {
    // An exception nobody uses is an exception that has quietly stopped being
    // needed.
    for (const root of COMPOSITION_ROOTS) {
      const path = join(SRC, root)
      const reaches = importedModules(path).some((m) => m.startsWith('vendors/'))
      expect(
        reaches,
        `${root} is listed as a composition root but imports no adapter — ` +
          `drop it from COMPOSITION_ROOTS`,
      ).toBe(true)
    }
  })
})

describe('only a composition root imports a vendor', () => {
  it.each(CORE.filter((p) => !COMPOSITION_ROOTS.includes(rel(p))).map((p) => [rel(p), p] as const))(
    '%s imports no adapter',
    (name, path) => {
      // A core module that needs a vendor's constant is telling you the constant
      // belongs in the core — that is exactly what `CAD_COLUMN` was, and moving
      // it up is what this test forces.
      const imported = importedModules(path).filter((m) => m.startsWith('vendors/'))

      expect(
        imported,
        `${name} imports ${imported.join(', ')} — a core module must not ` +
          `depend on one manufacturer`,
      ).toEqual([])
    },
  )

  it('lets the core name a vendor in a string, but not reach one', () => {
    // The rule stated one layer down. `identity.BRANDS` is keyed on brand
    // names and `conventions.IDENTITY_DEVIATIONS` names Destiny Tool outright
    // — a core module knowing *that a vendor exists* is the core doing its
    // job. A core module knowing *how* one serves a table is the leak.
    for (const path of CORE) {
      if (COMPOSITION_ROOTS.includes(rel(path))) continue
      const reaches = importedModules(path).some((m) => m.startsWith('vendors/'))
      expect(reaches, rel(path)).toBe(false)
    }
  })
})

describe('no vendor imports another vendor', () => {
  it.each(VENDOR_MODULES.map((p) => [relative(VENDORS, p), p] as const))(
    '%s stays inside its own manufacturer',
    (name, path) => {
      const own = relative(VENDORS, path).split('/')[0]

      for (const imported of importedModules(path)) {
        if (!imported.startsWith('vendors/')) continue
        const other = imported.split('/')[1]
        expect(
          other,
          `${name} imports ${imported} — adapters share the core, never ` + `each other`,
        ).toBe(own)
      }
    },
  )

  it('declares no name twice that is not part of the adapter contract', () => {
    // The half the import rule cannot reach. Barring the import stops one
    // vendor *reading* another's constant; it does nothing to stop the second
    // vendor writing its own copy, which is how 25.4 came to be exported from
    // two subpaths of one package at once. A name in two manufacturers is
    // either the adapter contract — allowlisted above, with a reason — or a
    // core concern that has not been moved up yet.
    const declared = new Map<string, Set<string>>()

    for (const brand of BRANDS) {
      for (const path of modules(join(VENDORS, brand))) {
        const source = readFileSync(path, 'utf8')
        const exported = source.matchAll(
          /^export (?:declare )?(?:async )?(?:const|function|class|interface|type|enum) ([A-Za-z_0-9$]+)/gm,
        )
        for (const [, name] of exported) {
          if (SHARED_BY_CONTRACT.has(name!)) continue
          declared.set(name!, (declared.get(name!) ?? new Set()).add(brand))
        }
      }
    }

    const shared = [...declared]
      .filter(([, brands]) => brands.size > 1)
      .map(([name, brands]) => `${name} (${[...brands].sort().join(', ')})`)
      .sort()

    expect(
      shared,
      `exported by more than one manufacturer: ${shared.join('; ')} — either it ` +
        `is one thing two vendors need, and belongs in the core beside ` +
        `MM_PER_INCH and unionHeader, or it is the adapter contract and belongs ` +
        `in SHARED_BY_CONTRACT with a reason`,
    ).toEqual([])
  })

  it('keeps its allowlist honest: every entry is really shared', () => {
    // An exception nobody uses is an exception that has quietly stopped being
    // needed — the same check `COMPOSITION_ROOTS` gets above.
    const count = new Map<string, number>()
    for (const brand of BRANDS) {
      const names = new Set<string>()
      for (const path of modules(join(VENDORS, brand))) {
        for (const [, name] of readFileSync(path, 'utf8').matchAll(
          /^export (?:declare )?(?:async )?(?:const|function|class|interface|type|enum) ([A-Za-z_0-9$]+)/gm,
        )) {
          names.add(name!)
        }
      }
      for (const name of names) count.set(name, (count.get(name) ?? 0) + 1)
    }

    for (const [name, why] of SHARED_BY_CONTRACT) {
      expect(
        count.get(name) ?? 0,
        `${name} is allowlisted as "${why}" but no longer appears in two ` +
          `manufacturers — drop it from SHARED_BY_CONTRACT`,
      ).toBeGreaterThan(1)
    }
  })

  it('really do share no code, stated once as a total', () => {
    // The claim the whole layout rests on. REGO-FIX's scraper is an
    // Elasticsearch proxy plus a DIN 4000 reader, Kennametal's is an AEM table
    // client and Destiny Tool's is a Firestore client; if any two ever grew a
    // common module it would belong in the core, not in one of them.
    for (const brand of BRANDS) {
      const imported = modules(join(VENDORS, brand)).flatMap(importedModules)

      for (const other of BRANDS) {
        if (other === brand) continue
        expect(
          imported.filter((m) => m.startsWith(`vendors/${other}/`)),
          brand,
        ).toEqual([])
      }
    }
  })
})
