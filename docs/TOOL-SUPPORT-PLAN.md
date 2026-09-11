# `@toolpath/tool-support` — the cutting-tool domain, extracted

_Written 2026-09-03, from a read of this repository and of the `toolpath-template`
tree, against one question: `@toolpath/tool-scraper` produces tool data and
`@toolpath/tool-drawing` consumes it, and every application in between has had to
re-derive what a tool assembly is. What should be shared, and where should it
live?_

**Status: carried out.** The evidence below is a read of the two trees as they
stood at `d5fe3ea` here and `decd44c` in the template, before the package
existed; it is kept as the reasoning behind the design rather than as a
description of the tree today.

---

## The decision

Add a sixth npm package, **`@toolpath/tool-support`**: what a cutting tool,
holder, collet and assembly _are_, and the arithmetic that follows from them.

It takes **zero runtime dependencies** and imports no React, no DOM, no `fs`, and
no `@toolpath/api`. Everything else in the tree depends on it and it depends on
nothing.

| Package                      | Directory                    | At      | What it is                                           |
| ---------------------------- | ---------------------------- | ------- | ---------------------------------------------------- |
| `@toolpath/ui`               | `packages/ui/`               | 0.1.3   | React + Tailwind component kit and theme             |
| `@toolpath/viewer`           | `packages/viewer/`           | 1.1.0   | three.js / R3F 3D part viewer                        |
| `@toolpath/api`              | `packages/sdk-typescript/`   | 0.4.0   | Generated TypeScript SDK                             |
| `@toolpath/tool-drawing`     | `packages/tool-drawing/`     | 0.2.0   | 2D tool + holder elevation                           |
| `@toolpath/tool-scraper`     | `packages/tool-scraper/`     | 2.2.0   | Vendor catalog scraping → records                    |
| **`@toolpath/tool-support`** | **`packages/tool-support/`** | **new** | **The cutting-tool domain**                          |
| `toolpath`                   | `packages/sdk-python/`       | 0.1.0   | PyPI — generated Python SDK. Untouched by this plan. |

```
                    @toolpath/tool-support        depends on nothing
                     ↑          ↑          ↑
    @toolpath/tool-scraper   @toolpath/tool-drawing   apps / catalog-data
      (+ htmlparser2)          (+ react peer)
```

Every arrow points up into it and none point out. That is the whole design: one
package in the tree that a Node CLI, a React renderer and a server route can all
depend on.

---

## The problem, in evidence

### The same fact, declared three times

| Fact                           | `tool-scraper`                                    | `tool-drawing`                | `catalog-data` / `domain` (template)          |
| ------------------------------ | ------------------------------------------------- | ----------------------------- | --------------------------------------------- |
| Millimetres per inch           | `measure.ts:55`, `holding.ts:334`                 | —                             | `domain/units.ts:21`                          |
| Unit-system vocabulary         | `'millimeters' \| 'inches'` (`conventions.ts:48`) | —                             | `'metric' \| 'inch'`; and `'mm' \| 'in'`      |
| Provenance                     | `FactSource` (`provenance.ts:64`)                 | `model/types.ts:20`           | `types.ts:37`                                 |
| ISO 13399 geometry dictionary  | `GEOMETRY_FIELDS`, 10 entries                     | bare strings, no dictionary   | `GEOMETRY_FIELDS`, 13 entries (`types.ts:70`) |
| `hasNeck`                      | —                                                 | `model/outline.ts:96`         | `forms.ts:136`                                |
| Measured holder profile        | `profiles.ts`, `PROFILES_VERSION = 1`             | `ViewerHolderProfile`         | `profiles.ts:32`, `PROFILES_VERSION = 1`      |
| `heightAt(ReachCurve, offset)` | —                                                 | `clearance/model/curve.ts:47` | `clearance.ts:47`                             |
| The holder                     | `HolderRecord`, 16 fields                         | `ViewerHolder`, 9 fields      | `Holder`, 19 fields                           |

Three names for two unit values, reconciled by a lookup table at `ingest.ts:175`.
Two `PROFILES_VERSION = 1` constants, one of which `scrape.ts:19` imports as
`SCRAPER_PROFILES_VERSION` specifically so it can be compared against the other.
No two of the three holder shapes agree on which fields exist.

### The code already says this

Four separate places in the template say the seam is in the wrong spot:

- `catalog-data/src/forms.ts:136` — _"**A twin of this lives in
  `@toolpath/tool-drawing`**, and that is deliberate… If the rule ever changes, it
  changes in both places or the picture and the verdict disagree about the same
  tool."_
- `catalog-data/src/toolholding.ts` — _"The right long-term home for that mapping
  is the scraper."_
- `catalog-data/src/vendors/regofix.ts` — _"**The right home for that is the
  scraper**… This file is a stopgap."_
- `catalog-data/src/forms.ts` (`statedForm`) — _"**This belongs upstream.** A kind
  of its own in the scraper's family table would state it once for every
  consumer."_

Under this repository's own rule — a rule without a sensor is a preference a
reviewer carries in their head — each of those is a known drift with nothing
watching it.

### And it has already cost a bug

Template commit `decd44c`, 2026-09-03: **how far a tool stands out of its holder
was computed in four unconnected places and disagreed by a factor of two on an
ordinary tool.** The details table printed one number and the drawing beside it
drew another, so the `LBH` dimension line ran past the holder nose and into the
holder body.

That was fixed inside one application. `@toolpath/tool-drawing` still takes
`ViewerAssembly.stickout` as a bare `number | null` with no way to check what it
was handed, so the next consumer of these two packages reproduces the bug from
scratch. This is the single strongest argument for the extraction: the quantity
that went wrong is a pure function of the tool, the collet and a policy, and it
has no home.

---

## What `tool-support` holds

**1. The vocabulary.** `UnitSystem` and `MM_PER_INCH`; `Provenance`; the ISO
13399 geometry dictionary (`DC`, `SFDM`, `OAL`, `LCF`, `RE`, `NOF`, `SIG`,
`shoulder-length`, `shoulder-diameter`, …) with each code's ISO counterpart and
unit kind; the `ToolForm` list.

The dictionary carries the _unit kind_ (`mm` / `deg` / `count` / `ratio`) because
that is what decides whether a number converts. Human-facing labels and
descriptions are presentational and stay with whoever renders them.

**2. The contracts.** `Tool`; the holder as a **union** of the published holder
and the measured silhouette, discriminated by `isHolderProfile`; `Collet`;
`Assembly`; `FeatureDemand`; `ReachCurve`; `ProfileDatum` and one
`PROFILES_VERSION`.

The holder union is `packages/tool-drawing/src/model/types.ts`'s existing design
and its reasoning is right: a measured envelope is not a refinement of a
parametric one, and _"reducing it to a nose and a body throws away the only reason
to measure."_ It is also what resolves the three-way holder disagreement above —
a `HolderRecord` carries no silhouette by design, which the template's `AGENTS.md`
already states.

**3. The arithmetic.** `stickoutRange` and the clamping / hold-share / collet
caps; `colletFitsHolder`, `gripsShank`, `gripRanges`, `holderTakesTool`;
`hasNeck`, `shankOf`; `fitAgainst`; `clearance`, `heightAt`, `sectionOutline`;
tool→feature mapping and pass planning.

---

## The seam that makes this possible

The risk in taking tool→feature fitting is that it drags in the Engine's part
schema: `catalog-data/src/fit.ts` imports `PartFeature`, `facts` and `asNumber`
from `@toolpath/part-contracts`, which itself imports `@toolpath/api`. A published
package inheriting the OpenAPI contract would be a bad trade.

It does not have to. **`fit.ts` already splits cleanly at line 172:**

```
above   demandOf(PartFeature, ctx) → FeatureDemand      reads the Engine schema
──────────────────────────────────────────────────────────────────────────────
below   fitAgainst(tool, FeatureDemand) → FitFailure[]  reads tool vocabulary only
```

`FeatureDemand` is pure tool language — `maxToolDiameter`, `maxDrillDiameter`,
`maxEndmillDiameter`, `holeDiameter`, `depth`, `reachBelowTop`, `floorRadius`,
`reachCurve`. No part schema in it.

So `demandOf` is the adapter and stays on the application side; everything below
it travels. `ReachCurve` is two number arrays, and
`tool-drawing/src/clearance/model/curve.ts` already declares it structurally on
purpose — _"a consumer that draws a tool alone pulls in no Toolpath schema. A
`ReachCurve` from the API satisfies this by structure, with no adapter."_
`tool-support` declares it once and both the drawing and the fitting satisfy it
structurally, exactly as today.

---

## What moves

Line counts are the template's `packages/catalog-data/src/`, which is 8,923 lines
in total.

**Moves whole** — no part-schema coupling once `ReachCurve` is structural:

| From                           | Lines | What                                                             |
| ------------------------------ | ----- | ---------------------------------------------------------------- |
| `stickout.ts` + `clamping.ts`  | 396   | The quantity `decd44c` collapsed. The reason this plan exists.   |
| `toolholding.ts`               | 461   | `Holder`, `Collet`, `Assembly`, collet fit, grip ranges          |
| `forms.ts`                     | 145   | `TOOL_FORMS`, `hasNeck`, `shankOf` — kills the documented twin   |
| `clearance.ts`                 | 311   | Sweep, collisions, `heightAt`                                    |
| `profiles.ts`                  | 183   | The `[z, r]` silhouette, `belowGageLine`, one `PROFILES_VERSION` |
| `section.ts`, `outline.ts`     | ~90   | Material profile and section geometry                            |
| `mapping.ts`, `preferences.ts` | ~200  | `Mapping` is keyed on `featureTag` and guids — no schema         |

Plus, from this repository: the unit constants and `FactSource` out of
`tool-scraper`, and `Provenance` / `ViewerTool` / `ViewerHolder` /
`ViewerHolderProfile` out of `tool-drawing`, all of which stay exported from their
current homes as aliases.

**Splits:**

- `fit.ts` — `fitAgainst`, `FeatureDemand`, `FitFailure`, `ToolFit` move.
  `demandOf`, `partTop`, `DemandContext` stay.
- `assembly-fit.ts` — the `FeatureDemand`-taking core moves; the `PartFeature[]`
  wrappers stay as one-liners.

**Stays in the applications:** `types.ts`'s `Catalog` / `Facets` /
`CATALOG_VERSION`, `ingest.ts`, `build.ts`, `facets.ts`, `scrape.ts`,
`assembly-picking` and `assembly-selection` (URL state), `vendors/`. That is the
catalog _document_ and how it is browsed, which is application data shape rather
than tool domain.

**Stays in `tool-scraper`:** vendor adapters, transport, `fetch.ts`, guid minting,
`BRANDS`, and `ToolRecord` / `HolderRecord` / `ColletRecord` as the _record_ seam.
The scraper adopts `tool-support` for units, provenance and geometry codes rather
than the reverse. A vendor's transport, its column vocabulary and its dimension
codes stay beside the tests that check them.

**Stays in `tool-drawing`:** `frameFor`, `laneLayout`, `SHEETS`, `assemblyOutline`,
the arrow and silhouette renderers, every `.tsx`, and the clearance _overlay_. The
clearance **verdict** moves; the lines drawn from it do not.

**Gets nothing:** `@toolpath/ui`. See below.

---

## Why not one of the existing packages

### Not `@toolpath/ui`

It peers React, React-DOM and Tailwind and carries seven runtime dependencies
(`@base-ui/react`, `@phosphor-icons/react`, `@table-library/react-table-library`,
`clsx`, `lodash-es`, `react-resizable-panels`, `tailwind-merge`). A Node ingest or
a server route needing `Provenance` and `hasNeck` would install all of it.

That directly reverses the reason `@toolpath/tool-drawing/geometry` exists —
_"deliberately free of React and of the DOM so a server can import it."_ It is
also permanent: `scripts/test-ui-package.mjs` asserts the `ui` tarball's contents,
so a domain module put there ships inside a React kit for good.

### Not `@toolpath/tool-scraper`

Mechanically this is viable and it was the leading alternative. The scraper's
domain core imports **no third-party code at all** — `htmlparser2` appears in
exactly six files, all under `src/vendors/`; `src/scrape.ts` imports nothing;
`conventions`, `provenance`, `records`, `holding`, `measure`, `profiles` and
`identity` import only each other. It has no peer dependencies, so
`tool-drawing` depending on it would cost no React entanglement. It is upstream of
everything, and it already originates five of the eight duplicated facts. Its own
docstring claims the role: _"a module beside this one knows the domain — what a
tool record is, how a guid is minted, what the ISO workpiece groups are."_

**What rules it out is the scope.** Tool→feature fitting, pass planning and
clearance sweeps inside a package named "scraper" is the wrong name on the wrong
domain, and it would pull the scraper into the part world it has no business
knowing. A narrower contracts-only extraction would have fitted here; this one
does not.

Secondary costs, recorded for completeness: 760 KB of source installed for a
consumer that wants `Provenance`; and the template's `NO_SCRAPER` ESLint rule —
which today permits the scraper's types and forbids its values, so a route handler
cannot turn the catalog into a live proxy onto five vendors' sites — would need to
allow one subpath's values while still refusing the rest.

### Not merged into `@toolpath/tool-drawing`

**First, a correction to an argument that does not hold.** There is no `.npmrc` in
either repository and pnpm 10 defaults `strict-peer-dependencies` to false, so a
Node package depending on `tool-drawing` gets _warnings_ about unmet React peers,
not a failed install. That is friction, not a blocker.

Three that do hold:

**1. Version cadence.** `tool-drawing` is 0.2.0 with two changesets staged in the
working tree right now — a minor, and a **major** that stops the drawing lettering
its dimensions and removes `formatLength`, `dimensionLayout`, `stackLabels`,
`dimensionLabel`, `formatMillimetres`, `bandOffset`, `bandRoom`, `figureType`,
`figureHeight` and five types. Merge the domain in and that major bumps every
consumer of `stickoutRange` and `fitAgainst`: a backend maintainer reads a
changelog about SVG arrowheads and has to work out whether their stickout math
broke. That recurs on every renderer change, and the renderer is the fastest-moving
thing in the tree — against `tool-scraper` at 2.2.0.

**2. The non-drawing consumers already exist.** `catalog-data` runs `ingest.mjs`,
`rebuild.mjs`, `scrape.mjs` and `profiles.mjs` as Node scripts with no React
anywhere, and it needs stickout (it writes `geometry.LBH` at build time), `forms`
and `fit`. `tool-scraper` needs the vocabulary half. Each would install a React
renderer to run a build script.

**3. Merging relocates the duplication rather than deleting it.** The scraper
originates the vocabulary. If the domain merges into `tool-drawing`, then either
`tool-drawing` depends on `tool-scraper` — a drawing package installing
`htmlparser2` and 61 vendor-adapter files — or the vocabulary is re-declared and
the exact duplication this plan exists to delete stays standing. Merging fixes the
arithmetic duplication and leaves the vocabulary duplication.

**The condition that would reverse this:** if the domain's only consumers were
ever things that also draw, merging would be correct. What makes it wrong today is
`catalog-data`'s Node ingest and the scraper, both of which exist now.

---

## On package count

The concern is fair, and the net is close to zero.

- **+1** published npm package: `@toolpath/tool-support`.
- **−1** private package: the template's `@toolpath/domain` dissolves. `units.ts`
  goes to `tool-support`; `classNames` and `moveThroughList` are generic UI helpers
  that belong in `@toolpath/ui`, which already carries `clsx` and `tailwind-merge`.
- `catalog-data` drops roughly 1,900 of its 8,923 lines and stops being the place
  four things quietly disagreed about stickout.

The decision is also recoverable in both directions, which is worth saying out
loud. Splitting later, having merged: keep the subpath as a re-export shim, which
costs nothing. Merging later, having split: deprecate a package, which is mildly
annoying. Neither is a trap.

---

## Not a class

Everything in both trees is readonly interfaces and pure functions; the only
classes are errors. Two reasons beyond consistency:

- A class loses structural typing at a package boundary. Today a `CatalogTool`
  simply _is_ a `ViewerTool`, with the adapter kept explicit by choice rather than
  by necessity. A class ends that.
- `instanceof` breaks across duplicate installs. `tool-scraper` already carries a
  `packaging` test asserting its errors are `instanceof`-safe, so this has bitten
  before.

If a single handle is wanted for ergonomics, it is one constructor returning a
frozen record with the derived quantities resolved together:

```ts
const stack = assembly({ tool, holder, collet, stickout: chosen, policy })
// → { tool, holder, collet, stickout, range, grip, band, limitedBy }
```

The point is that a caller cannot compute one of those and forget the others,
which is precisely the defect `decd44c` fixed. Functions over a readonly record,
not methods on an object.

---

## The plan

Each step is releasable on its own and nothing downstream breaks at any step —
existing names stay exported as aliases throughout.

### Step 0 — Create the package

`packages/tool-support/`, `"version": "0.1.0"`, no `dependencies`, no
`peerDependencies`. One entry point to start; subpaths only when something needs
one. Repository URL must be `https://github.com/toolpath/ui-packages.git`.

Repository plumbing, all of which is a hard requirement rather than tidying:

- `pnpm-workspace.yaml` — add `packages/tool-support`.
- `knip.json` — add a workspace block with `src/index.ts` and `tests/**` as
  entries. Knip models entry points by hand because every manifest's `exports` map
  points at `dist/`; without this it calls the whole module dead.
- `AGENTS.md` — a row in the Changeset table (`packages/tool-support/src/` →
  `@toolpath/tool-support`) and a row in the "What ships" table.
- `scripts/check-release-intent.mjs` — a `releaseSensitivePaths` entry for
  `packages/tool-support/src/`.
- `docs/BOOTSTRAPPING-NPM-PACKAGES.md` — this is a brand-new package, so it needs
  the one maintainer-run bootstrap publish before trusted publishing works.

### Step 1 — Vocabulary and contracts

Units, `Provenance`, the geometry dictionary, `ToolForm`, the holder union,
`Collet`, `ProfileDatum`, one `PROFILES_VERSION`, `ReachCurve`, `FeatureDemand`.
Types and constants only; no behaviour yet beyond unit conversion.

Nothing depends on it at the end of this step. That is deliberate — it is the last
point at which the surface can be changed freely.

### Step 2 — `tool-drawing` adopts it

`Provenance`, `ViewerTool`, `ViewerHolder`, `ViewerHolderProfile` become aliases
of the shared types and stay exported from `.` and `/geometry`. No consumer break.

Changeset: `minor` on `@toolpath/tool-drawing` — a new runtime dependency is
consumer-visible install cost, which `AGENTS.md` counts as needing one.

### Step 3 — `tool-scraper` adopts it

`MM_PER_INCH`, `convertLength`, `millimeters`, `asUnit`, `FactSource` and
`GEOMETRY_FIELDS` come from `tool-support`; the scraper's current names stay as
aliases. `HolderRecord` and `ColletRecord` stay where they are — they are the
record seam, not the domain shape.

Changeset: `minor` on `@toolpath/tool-scraper`.

### Step 4 — The documented twins

`hasNeck` and `shankOf`, `heightAt` and `ReachCurve`, `belowGageLine` and the
profile datum. Both copies of each are deleted and re-exported from the one
implementation. This is the step that retires the four "this will drift" notes.

Changeset: `minor` on `@toolpath/tool-drawing` and `@toolpath/tool-support`.

### Step 5 — Stickout, fit and holding

`stickout.ts`, `clamping.ts`, `toolholding.ts`, `forms.ts`, `clearance.ts`,
`section.ts`, `mapping.ts`, `preferences.ts`, and the lower half of `fit.ts` and
`assembly-fit.ts` move up out of the template's `catalog-data`.

Template-side work in the same change: `catalog-data` re-exports what its
consumers already import so `apps/catalog` does not move in lockstep; the
`NO_SCRAPER` ESLint rule is left alone, since nothing new imports the scraper; and
`@toolpath/domain` dissolves.

`apps/catalog` stops owning the number the drawing draws. That is the outcome this
plan is for.

---

## Sensors

A rule with a sensor is a fact about the code. Each of these replaces something
currently kept in a reviewer's head:

| Rule                                                             | Proven by                                                                    |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `tool-support` imports no package but itself                     | a boundary test in the shape of `vendor-boundary.test.ts`                    |
| One `25.4` in the tree                                           | a test over `packages/*/src/`                                                |
| `DRAWABLE_FORMS` matches what `assemblyOutline` actually returns | move `apps/catalog`'s `tool-drawing-input.test.ts` check into `tool-drawing` |
| One `PROFILES_VERSION`                                           | the type system, once `catalog-data`'s copy is gone                          |
| `min ≤ setup ≤ max` for stickout                                 | `stickout.test.ts`, moved with the module                                    |
| No unreferenced export in the new package                        | `pnpm knip`, once its entry is registered                                    |

The `DRAWABLE_FORMS` sensor is worth calling out: which forms the drawing can draw
is `tool-drawing`'s own fact, and it is currently kept by hand in the application
as two sets, `DRAWABLE_FORMS` and `UNDRAWABLE_FORMS`, policed by a test in
`apps/catalog`. The package should export it, and both sets and their test should
disappear from the application.

---

## Open questions

1. **Does `mapping.ts` belong here or in the application?** `Mapping` is keyed on
   `featureTag` and guids and has no schema coupling, so it _can_ move. Whether a
   pass plan is tool domain or catalog-application workflow is a judgement call,
   and it is the one item in the "moves whole" list I would happily leave behind.
2. **Should the profile document move too, or only its shape?** `tool-support`
   should own `HolderProfile` and `ProfileDatum`. Whether it also owns the
   `ProfilesDocument` envelope — version, kernel version, keyed-by-guid map — or
   whether that stays a scraper output shape, is unresolved.
3. **`@toolpath/tool-support` vs. `@toolpath/tool-model`.** "Support" reads as a
   grab bag; "model" is more precise about contracts but under-sells the
   arithmetic. Named `tool-support` here because that is what it was asked for; the
   name is cheap to change before Step 0 and expensive after.
4. **Does `@toolpath/viewer` want any of this?** It shares nothing today. If a
   future 3D view draws a tool assembly, `tool-support` is where the stickout comes
   from — worth checking before fixing the public surface in Step 1.
