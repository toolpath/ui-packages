# Exporters in `@toolpath/tool-support`, starting with Fusion tool libraries

Turning what this package already knows — a `Tool`, a `Holder`, a `HolderProfile`,
an `Assembly` and the stickout arithmetic between them — into files a CAM system
will load. The first target is a Fusion 360 tool library. It is written as the
first of several, so the seam between "what every exporter needs" and "what one
format's vocabulary is" is drawn on day one rather than retrofitted on the second.

---

## Sources consulted

| Role                                | Path                                                                            | What it settled                                                                                                                                                                                             |
| ----------------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Package under edit**              | `packages/tool-support/`                                                        | The domain the exporter reads. No runtime dependency, no `fs`, no DOM — `tests/boundary.test.ts` is the sensor.                                                                                             |
| **Input shape, read-only**          | `packages/tool-scraper/src/records.ts`, `src/holding.ts`, `src/profiles.ts`     | `ToolRecord`, `HolderRecord`, `ColletRecord`, `ProfilesDocument` — what a scrape hands over.                                                                                                                |
| **Format spec, authoritative**      | `https://cam.autodesk.com/tools/tools/Tooling%20Schema/ToolLibrary.schema.json` | Autodesk's own JSON Schema (draft-07, 2.6 MB). **The spec.** A stale copy sits at `toolpath_ui/packages/tools/utils/ToolLibrary.schema.json`; the URL is in that repo's `utils/types_schemas.generator.ts`. |
| **Field roster and hard-won rules** | `/Users/justingray/JustinGrayLabs/code/BetterToolLib`                           | Which shapes crash Fusion's parser, holder gauge-line trimming, name sanitising. Reverse-engineered, not the spec.                                                                                          |

Where BetterToolLib and Autodesk's schema disagree, the schema wins. Three places
they do, and each one matters — see [What the reference gets wrong](#what-the-reference-gets-wrong).

---

## What the format actually is

A Fusion tool library is one JSON document:

```json
{
  "version": 33,
  "data": [
    /* tools and adaptive items */
  ]
}
```

`version` is an integer with a schema minimum of 11; real exports carry 33.
Every entry in `data` requires a `guid`, and is one of:

- a **tool** — `type` is one of 36 cutting/turning/cutting-beam/probe types, with an
  optional embedded `holder` and `shaft`;
- an **adaptive item** — a standalone `holder` (or a `tool block`).

### Facts that are not obvious and that the mapping depends on

**Numbers are in the record's own `unit`, not in millimetres.** `unit` is
`"millimeters" | "inches"` per record, and a tool's embedded `holder` carries its
own `unit` independent of the tool's. Everything in this package is stored in
millimetres, so every length crosses a conversion on the way out and every angle
and count must not. `convertGeometry` already encodes exactly that distinction —
this is the first consumer that needs it for real.

**Segments run from the cutting end toward the machine.** Autodesk states it
outright on the shaft-segment array: _"Segments are ordered starting from the
cutter end and ending at the machine tool."_ Holder segments use the same schema.
So `segments[0]` is at the nose, `height` accumulates toward the spindle,
`lower-diameter` is the face nearer the cutter and `upper-diameter` the face
nearer the machine. A segment carries those three keys and — `additionalProperties:
false` — nothing else.

Both hand-written holder fixtures in the reference repo contradict this
(`webapp/src/schema/__tests__/fixtures/basic-library.json`,
`code/bettertoollib_tests/fixtures/parity_holders.json` — they read spindle-first
and their diameters do not meet at the segment boundary). The reference's own
_code_ agrees with the schema: `holder_profile.profile_to_segments` emits
bottom-to-top, `holder_taper_trim.trim_segments_at_gauge` measures `y` from the
bottom of the stack and keeps what is below the gauge line, and
`orient_profile` picks the orientation whose 7:24 cone narrows going up. Do not
take ordering from those fixtures.

**`gaugeLength` is "height below gauge line"** — nose to gauge line, so
`sum(height)` over a trimmed holder equals `gaugeLength`.

**`LB` is length below holder, and it closes a loop this package already has a
name for.** Fusion's `geometry.LB` is the stickout, and
`assemblyGaugeLength = holder.gaugeLength + LB`. Verified on the reference's own
data: `gaugeLength 50 + LB 24 = assemblyGaugeLength 74`. That is
`GEOMETRY_FIELDS.LBH` — _"length below holder — how far the tool is set out of the
holder nose"_ — and `Assembly.stickout`, the quantity this package exists because
four places disagreed about. The exporter is the first thing that writes it
somewhere a machinist sees it.

**`start-values` is required on every tool**, and `post-process` on every
spinning tool. `presets: []` validates (the schema's `minLength` on an array is a
no-op in draft-07), which is what the reference ships, so an empty preset list is
legal — but the key itself cannot be omitted.

**`GRADE` is a legacy dead enum**, `"Mill Generic" | "generic"`, described in the
schema as _"doesn't do anything anymore."_ It is not a place to put a vendor's
carbide grade. The reference writes `GRADE: ""` into its fixtures, which the
schema rejects. We omit it.

**`guid` must be an RFC-4122-shaped string** and is required on every entry,
embedded holders included.

### The type vocabulary is already ours

`forms.ts` says its vocabulary is Fusion's own _"so that a tool exported there
lands on the type it already has."_ Checked against Autodesk's schema: **all 24
`TOOL_FORMS` values are valid Fusion tool types.** The mapping is the identity
function, and `'other'` is the only input with no answer — which is a refusal, not
a nearest-match. There is no translation table here, and that is the point;
`tool.ts`'s note about not adding `form tap right hand` is the same rule holding.

### Required geometry, per type

Read off Autodesk's schema. This table becomes a source module, because the
exporter needs it at runtime to know what it must emit and what it may.

| Fusion type                                       | Required `geometry` keys                                                                                |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `flat end mill`, `ball end mill`, `lollipop mill` | `CSP DC HAND LB LCF NOF OAL SFDM assemblyGaugeLength shoulder-diameter shoulder-length`                 |
| `bull nose end mill`, `slot mill`                 | …the above **+ `RE`**                                                                                   |
| `tapered mill`                                    | …**+ `RE TA`**, and the record also requires `tapered-type`                                             |
| `dovetail mill`                                   | …**+ `RE TA`**                                                                                          |
| `radius mill`                                     | …**+ `RE tip-length`**                                                                                  |
| `chamfer mill`                                    | …**+ `TA tip-diameter`**                                                                                |
| `face mill`                                       | …**+ `DCX RE TA upper-radius`**                                                                         |
| `thread mill`                                     | …**+ `NT thread-profile-angle thread-tip-type`**                                                        |
| `circle segment *`                                | `CSP DC HAND LB LCF NOF OAL assemblyGaugeLength` + per-shape radii                                      |
| `drill`                                           | `CSP DC HAND LB LCF NOF OAL SFDM SIG assemblyGaugeLength shoulder-length`                               |
| `spot drill`, `counter sink`                      | …**+ `tip-diameter`**                                                                                   |
| `center drill`                                    | …**+ `TA tip-diameter tip-length`**                                                                     |
| `reamer`, `counter bore`, `boring bar`            | `CSP DC HAND LB LCF NOF OAL SFDM assemblyGaugeLength shoulder-length`                                   |
| `tap left hand`, `tap right hand`                 | `CSP DC LB LCF NOF OAL SFDM TP assemblyGaugeLength shoulder-length` (no `HAND`, no `shoulder-diameter`) |
| `holder` (standalone)                             | record-level `gaugeLength guid type unit`                                                               |

Record-level required on every milling/hole-making tool:
`BMC geometry guid post-process start-values type unit`.
`post-process` required: `break-control diameter-offset length-offset live
manual-tool-change number turret` (`comment` optional).

---

## What the reference gets wrong

Worth naming, because the temptation is to port BetterToolLib's Python straight
across.

1. **`GRADE: ""`** — schema-invalid. Omit the key.
2. **Holder segment order in its fixtures** — contradicts both the schema and its
   own code. Follow the schema.
3. **Deriving geometry to fill gaps.** `tool_normalizer` fills a missing
   `assemblyGaugeLength` with `OAL + DC * 5` and a missing `shoulder-length` with
   `max(LCF, DC)`. That is a defensible fix for _its_ problem — a local database
   holding records a user abandoned mid-edit, where Fusion's parser hard-crashes
   on all-zero secondary geometry and shipping something stubby-but-real beats
   bricking the sync. It is the wrong default for us. Our input is a vendor
   catalog, and inventing a shoulder length for a tool whose vendor published one
   is the failure mode this whole tree is organised against — a plausible wrong
   number nobody checks. See [Filling](#filling-what-fusion-requires-and-the-vendor-did-not-publish).

What the reference gets **right**, and we take:

- The parser-crash catalogue itself (`tool_normalizer`'s header): the fields whose
  absence kills Fusion, and the **integer-literal hazard** — a mm value written as
  `25` instead of `25.0` crashed a Syil library on every reload. `JSON.stringify`
  emits `25` for `25.0`, so this is a live bug for any naive serializer. See
  [Serialization](#serialization).
- `sanitize_name`: Fusion uses a library's leaf name as its picker label;
  `[<>:"/\|?*\x00-\x1f]` → `_`, trim, strip leading/trailing dots, cap at 120.
- Trimming a holder at the gauge line so the export carries the part of the holder
  the operator actually mounts, not the spindle-side cone and retention knob.

---

## Decisions taken

| Question                                            | Answer                                                                                                                                                                                                                                                  |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| How the exporter is reached                         | A subpath per format. `@toolpath/tool-support/export` for the shared vocabulary, `…/export/fusion` for this one. Keeps the root from growing ~15 names per format; matches `tool-drawing`'s `/geometry` and `/clearance`.                               |
| What the default does about fields a vendor omitted | Fill the parser-required constants and derive `LB` from `setupStickout`, so a bare scraped tool loads. Never fill a dimension.                                                                                                                          |
| Cutting-data presets                                | Carried, not computed: a caller passes them and the exporter validates them per type. See [Carrying presets](#carrying-presets).                                                                                                                        |
| How the format spec is pinned and watched           | A mechanically derived ~23 KB digest checked in at `fusion/`, cross-checked against the source table by an offline test, with upstream drift caught by a scheduled fetch. The 2.6 MB schema is not vendored. See [Pinning the spec](#pinning-the-spec). |

## Design

### Where it lives

`packages/tool-support/src/export/`, split so the second exporter is an addition
rather than a refactor:

```
src/export/
  catalog.ts        CatalogTool, CatalogHolder — the identity half the domain deliberately omits
  report.ts         ExportNote, ExportResult<T> — what could not be expressed, and why
  index.ts          entry: @toolpath/tool-support/export
  fusion/
    schema.ts       FusionToolLibrary/Tool/Holder/Segment/Preset types, FUSION_GEOMETRY (the table above)
    geometry.ts     Geometry (mm) + UnitSystem  ->  Fusion `geometry` block, in the record's unit
    holder.ts       Holder | HolderProfile      ->  { gaugeLength, segments }
    tool.ts         one CatalogTool + optional Assembly -> FusionTool
    library.ts      many -> FusionToolLibrary, and the serializer
    index.ts        entry: @toolpath/tool-support/export/fusion
```

The boundary holds unchanged: every file imports only siblings, no `node:` builtin,
no dependency. The exporter returns a document and a string; **it never writes a
file.** Writing is the caller's, exactly as `@toolpath/tool-scraper` splits records
from `node/csv.ts`.

### What an exporter takes: `CatalogTool`

`tool.ts` is explicit that identity and commerce — guid, brand, catalog number,
product link — are _not_ domain, and that a catalog's record **extends** `Tool`
rather than being projected onto it. An exporter is the one consumer that needs
that half, so it is named here, under `export/`, rather than pushed into the
domain root:

```ts
export interface CatalogTool extends Tool {
  readonly guid: string // required: Fusion requires one on every entry
  readonly unit: UnitSystem // which system the vendor published in
  readonly description?: string
  readonly vendor?: string
  readonly catalogNumber?: string // -> product-id
  readonly productLink?: string // -> product-link
  readonly substrate?: string // -> BMC, mapped and never guessed
  readonly coolantThrough?: boolean // -> geometry.CSP
  readonly number?: number // -> post-process.number
  readonly hand?: 'right' | 'left' // -> geometry.HAND
}
```

Every field name is `ToolRecord`'s own, so **a scraper record satisfies this
structurally with no adapter** — the same "no adapter" claim `contracts.test.ts`
already pins for `Tool`, asserted the same way. The two things a `ToolRecord` does
not carry are `form` (it carries the coarse `kind`; the finer name is derived where
a dataset is built, per `forms.ts`) and `productLink`.

### `guid` is required, and the exporter does not mint one

Autodesk requires a guid on every entry. Minting a v5 guid needs SHA-1, which needs
`node:crypto`, which the boundary test bars — and a random guid would make every
re-export look to Fusion like a new tool, so re-exporting a catalog would
accumulate duplicates rather than update them. The scraper already mints stable v5
guids per brand and they survive a re-scrape. So the exporter **requires** one and
mints none. That is a deliberate refusal, documented, not a gap.

### Tool mapping

| Fusion                                   | Source                                | Rule                                                                                                                                                                                                                            |
| ---------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `type`                                   | `Tool.form`                           | identity; `'other'` is skipped with a note and no tool emitted                                                                                                                                                                  |
| `unit`                                   | `CatalogTool.unit`                    | the scraper's spelling _is_ Fusion's — no map                                                                                                                                                                                   |
| `guid`                                   | `CatalogTool.guid`                    | required                                                                                                                                                                                                                        |
| `description`                            | `description` ?? `label` ?? `''`      |                                                                                                                                                                                                                                 |
| `vendor` / `product-id` / `product-link` | identity fields                       | omitted when absent                                                                                                                                                                                                             |
| `BMC`                                    | `substrate`                           | `carbide`/`hss`/`ceramics`/`ti coated` pass; **anything else → `unspecified` + a note**. Kennametal's PCD families state `diamond`, which Fusion has no word for — the honest answer is `unspecified`, not the nearest carbide. |
| `GRADE`                                  | —                                     | never written (legacy dead enum)                                                                                                                                                                                                |
| `geometry.*`                             | `Tool.geometry`, in mm                | `convertGeometry(code, mm, 'millimeters', unit)` per key — lengths convert, `NOF`/`SIG`/`TA` do not                                                                                                                             |
| `geometry.CSP`                           | `coolantThrough` ?? `false`           |                                                                                                                                                                                                                                 |
| `geometry.HAND`                          | `hand` ?? `right`                     | `true` is right hand                                                                                                                                                                                                            |
| `geometry.LB`                            | `Assembly.stickout` ?? `geometry.LBH` | see below                                                                                                                                                                                                                       |
| `geometry.assemblyGaugeLength`           | holder gauge length + `LB`            | only when both are known                                                                                                                                                                                                        |
| `post-process`                           | all seven required keys               | `number` from `CatalogTool.number ?? 0`; the rest from the reference's modal constants                                                                                                                                          |
| `start-values`                           | `{ presets: [] }`                     | required key, empty list legal; the named extension point for feeds and speeds                                                                                                                                                  |
| `holder`                                 | `Assembly.holder`                     | see below                                                                                                                                                                                                                       |
| `shaft`                                  | —                                     | not emitted; this package has no shaft-segment model                                                                                                                                                                            |

### Holder mapping

Both arms of the `Holder | HolderProfile` union are handled, and this is where the
package earns its keep against the reference.

**From a `HolderProfile`** (`[z, r]`, `datum: 'gage-line'`, `z` increasing toward
the cutting end): `belowGageLine(profile)` already trims at the spindle face and
interpolates the crossing point. Then `y = zMax − z`, reverse, one segment per
adjacent pair, diameters `2r`, `gaugeLength = zMax`.

The reference reaches the same cut by detecting a 7:24 cone by its ratio within
±0.5 %, matching one of three spec gauge diameters, and solving linearly for the
crossing — 270 lines of Python that fail silently on a Capto, an HSK or a
straight-shank holder, and report a _size class_ because geometry cannot tell BT40
from CAT40. **We do not have to guess, because `ProfileDatum` is carried.** A
`datum: 'nose'` profile writes its segments and **omits `gaugeLength`**, which is
the reference's own documented behaviour for an unsolved taper: leaving the key off
puts Fusion into manual mode, and writing a zero would look like a measurement.
Carrying the datum per profile instead of per document is what makes that possible,
and `profile.ts` says as much.

**From a parametric `Holder`**: nose (`noseDiameter` × `noseLength`), then the body
where the vendor states one, then the flange at `projection`;
`gaugeLength = holder.gaugeLength`. This is the layer model `holderSilhouette`
already states, read from the nose rather than from the tip — reuse it rather than
writing a second stepped outline to disagree with the clearance sweep.
`noseDiameter === null` is a holder with no publishable shape: no `holder` key, and
a note.

**Collet protrusion** is modelled here and has no Fusion counterpart (a collet is
not an entity in a tool library, and its diameter is not on `Holder`). Not emitted,
noted.

### Filling what Fusion requires and the vendor did not publish

A bare scraped tool has no holder, so it has no `LB` and no `assemblyGaugeLength`,
and Fusion requires both. **The default has to produce a document that loads** —
an exporter whose out-of-the-box output Fusion rejects is not an exporter. Three
modes, defaulting to the one that works:

- **`'derived'` (default)** — fill the parser-required constants _and_ derive `LB`
  from `setupStickout`, and `assemblyGaugeLength` with it. Every filled value
  carries a note, and `stickoutRange` is the same arithmetic the drawing and the
  details table read, so the number a consumer sees in Fusion is the number this
  package would have shown anywhere else.
- **`'constants'`** — fill only the values that are genuine constants rather than
  derivations: `RE: 0`, `NT: 1`, `TP: 0`, `TA: 0`, `CSP: false`,
  `thread-profile-angle: 60`, `tip-length: 0`, `tip-offset: 0`. A bare tool will
  be short `LB` and will not load; a tool in an assembly will.
- **`'none'`** — write only what the vendor published, and note every required key
  that is missing. For a caller building its own fill policy.

**No mode ever invents `DC`, `OAL`, `LCF`, `SFDM` or a shoulder.** A tool whose
vendor did not publish its cutting diameter is not a tool this exporter can write;
it is skipped with a note. The line is between a constant that is true of every
tool of that type and a _dimension_, which is the distinction `tool_normalizer`'s
`OAL + DC * 5` crosses and we do not.

### `ExportNote`

One vocabulary, because every future exporter needs it:

```ts
type ExportNote = {
  readonly subject: string // the guid or catalog number
  readonly kind: 'skipped' | 'filled' | 'dropped' | 'coerced'
  readonly field?: string // 'geometry.shoulder-length', 'BMC'
  readonly message: string
}
type ExportResult<T> = { readonly document: T; readonly notes: readonly ExportNote[] }
```

`skipped` is a whole record refused; `dropped` is a fact this format cannot carry
(collet protrusion, provenance, ISO material groups); `coerced` is a value mapped
to a weaker one (`diamond` → `unspecified`); `filled` is a value this package
supplied.

### Serialization

`fusionLibraryJson(document): string`, and it is **not** `JSON.stringify`:

- **Every length must carry a decimal point.** `JSON.stringify(25.0)` is `"25"`,
  and an integer-literal mm value is the shape that crashed a real Syil library on
  every reload (reference, 2026-05-08). Counts and enum-ish integers — `NOF`, `NT`,
  `thread-profile-angle`, `post-process.number`, `turret` — must stay integers. The
  geometry dictionary's `GeometryUnit` already says which is which for the codes it
  knows; the per-type table above covers the rest.
- **Stable key order**, so two exports of one catalog produce a clean diff.

`sanitizeName(name)` is exported alongside, for the caller naming the file.

---

## Pinning the spec

The exporter needs the per-type field table at runtime, so it has to exist as a
source module. That module is a **transcription of a third-party document that
moves**, which is a copy with nothing watching it — the exact failure this
repository organises against. Autodesk has in fact already moved the schema since
the copy in `toolpath_ui` was taken in February (`stickout` gained on the four
turning types; nothing we export changed). So the copy gets the same treatment
`openapi/` gets: a pinned artifact, a checksum, an adopt command, and a verify.

The 2.6 MB schema itself is not vendored — it would be ten times the largest file
in the repository. What is pinned is a **mechanically derived digest**: for every
one of the 37 types, its required record keys, its required geometry keys, its
permitted geometry keys and its permitted record keys, plus the library-level
requirements, the segment schema, the guid pattern and the enums. Measured against
the live document: **23 KB pretty-printed, 12 KB minified.**

```
fusion/
  digest.json      the derived table, plus a provenance block —
                   sourceUrl, the upstream document's sha256, retrievedAt
  schema.sha256    the upstream document's hash, as openapi.sha256 does
```

| Command                      | Network | What it does                                                                                                                                                           |
| ---------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm fusion:adopt`          | opt-in  | Re-derive `digest.json` and rewrite `schema.sha256`, from a local path or `--fetch`. The one command when Autodesk moves.                                              |
| `pnpm fusion:verify`         | no      | Digest is self-consistent and `schema.sha256` matches its recorded provenance. **Joins `pnpm check`** beside `openapi:verify` — cheap and hermetic.                    |
| `pnpm fusion:check-upstream` | yes     | Fetch, hash, re-derive, fail on any difference. **Deliberately not in `pnpm check`** — a third-party HTTP call in the gate means Autodesk's downtime is our red build. |

### How an upstream change reaches a failing test

`fusion:check-upstream` runs on a schedule, in the shape the `automation/engine-api-openapi`
pull request already uses. The loop:

1. Autodesk publishes a change; the scheduled run fails.
2. Automation opens a pull request running `pnpm fusion:adopt -- --fetch`, so
   `fusion/digest.json` and `fusion/schema.sha256` change in the diff.
3. **The offline test then fails on that pull request**, because the transcribed
   source table no longer equals the digest.
4. Somebody reconciles the table — or, when the change touches only types we do not
   export, records that in the same pull request and the test goes green.

That is what makes it a sensor rather than a note: the transcription cannot be
quietly stale, because the digest it is checked against is regenerated from the
live document and the check that compares them runs in the ordinary gate. The
source table is therefore _generated once and checked in_ — the same standing
`openapi/release.json` has — and hand-editing it is what the test catches.

Scheduling means detection lags a change by at most the interval rather than
catching it the instant Autodesk publishes. The alternative, putting the fetch in
`pnpm test`, was rejected: it would either break the gate whenever
`cam.autodesk.com` is unreachable, or skip when offline — and AGENTS.md is explicit
that a skipped check is not a passing one.

## Tests

`packages/tool-support/tests/export-fusion.test.ts` plus
`tests/export-fusion-schema.test.ts`. The oracle is the schema, not a golden file:

- **The table matches the spec.** Every type the exporter claims to support is
  present in `fusion/digest.json`, and its transcribed `recordRequired`,
  `geometryRequired` and `geometryAllowed` deep-equal the digest's. Plus the
  reverse direction: every `TOOL_FORMS` value resolves to a digest entry, so a
  form added to the domain cannot ship without its table row.
- **Emitted records conform.** Every record the exporter produces is validated
  against the transcribed table: required record keys, required geometry keys for
  that type, no geometry key the type does not permit, segments carrying exactly
  the three permitted keys, guid matching the schema's RFC-4122 pattern, `unit` in
  the two-value enum, `BMC` in the five-value enum, `version` at or above the
  schema's minimum.
- **The stickout identity.** A flat end mill on a BT40/ER32 holder at 24 mm →
  `LB 24`, `holder.gaugeLength 50`, `assemblyGaugeLength 74`. The number four
  places used to disagree about, pinned at the one place a machinist reads it.
- **Units.** An inch tool's `DC` is written in inches; its `SIG` and `NOF` are not
  converted. A metric tool with an inch-declared holder converts each in its own
  unit.
- **Segment order and closure.** From a `gage-line` profile: `segments[0]` is the
  nose, adjacent diameters meet, `sum(height) === gaugeLength`. From a `nose`-datum
  profile: segments written, no `gaugeLength`.
- **Serialization.** Every length in the output text matches `/\d\.\d/`; `NOF` does
  not. `JSON.parse(json)` deep-equals the document.
- **Refusals.** `form: 'other'` → skipped, not guessed. `substrate: 'diamond'` →
  `BMC: 'unspecified'` + a `coerced` note. A bare tool → no `holder` key. A holder
  with `noseDiameter: null` → no `holder` key + a note. Missing `DC` → skipped in
  every fill mode.
- **The default loads.** A bare `ToolRecord`-shaped end mill with no holder and no
  options passes schema conformance — the check that the `'derived'` default is
  doing its job, and the one that would fail if a future required key went
  unfilled.
- **The no-adapter claim**, as a compile-time assertion in the style of
  `contracts.test.ts`: a literal shaped exactly like a `ToolRecord` plus `form`,
  assigned to `CatalogTool`.

---

## Wiring

| Change                               | Detail                                                                                                                                                                                    |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/tool-support/package.json` | add `"./export"` and `"./export/fusion"` to `exports`                                                                                                                                     |
| `knip.json`                          | add `src/export/index.ts` and `src/export/fusion/index.ts` to the tool-support entry list — a manifest entry point without its `src/` counterpart makes knip call a live module dead      |
| `fusion/`                            | new: `digest.json`, `schema.sha256`                                                                                                                                                       |
| `scripts/`                           | new: `adopt-fusion-schema.mjs`, `verify-fusion-schema.mjs`, `check-fusion-schema-upstream.mjs`. Covered by the root workspace's existing `scripts/**/*.mjs` knip entry.                   |
| root `package.json`                  | `fusion:adopt`, `fusion:verify`, `fusion:check-upstream`; add `fusion:verify` to `check`, beside `openapi:verify`                                                                         |
| `.github/workflows/`                 | a scheduled job running `fusion:check-upstream`                                                                                                                                           |
| `AGENTS.md`                          | a Project Map row for `fusion/`, three Commands rows, and a Rules-with-a-sensor row: _"The Fusion type table matches Autodesk's published schema" — `pnpm test` (`export-fusion-schema`)_ |
| Build                                | none — `tsc -p tsconfig.build.json` already mirrors `src/` into `dist/`                                                                                                                   |
| `release:npm` order                  | none — no new package                                                                                                                                                                     |
| Changeset                            | `@toolpath/tool-support: minor` — a new public capability. `packages/tool-support/src/` is watched by `scripts/check-release-intent.mjs`, so CI will ask.                                 |
| README                               | a section under "What it holds"                                                                                                                                                           |

`pnpm --filter @toolpath/tool-support test`, then `pnpm check` before it lands.

---

## Order of work

0. `fusion/digest.json` + the three scripts + `fusion:verify` in `check`. First,
   because every table below is generated from it and nothing should be
   hand-typed against a document that has already moved once.
1. `export/report.ts`, `export/catalog.ts`, `export/index.ts` — the vocabulary, and
   the compile-time test that a scraper record satisfies `CatalogTool`.
2. `fusion/schema.ts` — the types and the per-type geometry table, generated from
   the digest and locked to it by `export-fusion-schema.test.ts`.
3. `fusion/geometry.ts` + its tests — unit conversion per code, fill modes.
4. `fusion/holder.ts` + its tests — both union arms, segment order, the datum rule.
5. `fusion/tool.ts` — assembly, `LB`, `assemblyGaugeLength`, `post-process`,
   `start-values`.
6. `fusion/library.ts` — the document, the decimal-safe serializer, `sanitizeName`.
7. Manifest, knip, README, Changeset.

Each step lands with its tests; the schema-conformance assertion runs from step 5
onward over everything emitted.

---

## Deliberately out of scope

- **Computing feeds and speeds.** A caller's presets are carried; deciding what
  they should be needs a machining model this package does not have and is not
  acquiring. See [Carrying presets](#carrying-presets).
- **`shaft` segments.** No shaft model here.
- **Turning, waterjet, laser, probe, tool block.** `TOOL_FORMS` has no words for
  them, and inventing them to fill a schema branch is the wrong direction.
- **Writing files.** The caller's.
- **Reading a Fusion library back.** An importer is a different job with a
  different failure mode; a round-trip test would be the reason to build one.

---

# Carrying presets

`start-values: { presets: [] }` shipped as a placeholder, and
`FusionTool['start-values']` types its list `readonly never[]` — so there is no
way to pass a preset in at all. The catalog application generates PreTool feeds
and speeds into that field today
(`apps/catalog/app/shared/pretool-presets.ts`), so adopting the exporter as it
stands would drop every feed and speed it has. The fix is to widen the input;
the interesting part is what the exporter should check once it can see one.

## What the evidence says, against what was assumed

Two claims were worth testing before building on them. One holds and one does
not.

### Preset requirements are per tool type, and that is the real hazard

The schema has **13 distinct preset shapes**, six of which cover types this
package writes. They are not close to each other:

| Types                                        | Required                                                                                                                                              | Models                                     |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| the 17 milling types                         | `f_n guid material n n_ramp name ramp-angle tool-coolant use-stepdown use-stepover v_c v_f v_f_leadIn v_f_leadOut v_f_plunge v_f_ramp v_f_transition` | + `f_z stepdown stepover expressions`      |
| `drill`, `reamer`                            | `guid material n name tool-coolant use-feed-per-revolution v_c`                                                                                       | + `f_n f_n_retract v_f_plunge v_f_retract` |
| `spot drill`, `counter sink`, `center drill` | …**+ `v_f v_f_leadIn v_f_leadOut v_f_ramp v_f_transition`**                                                                                           | + `f_n f_z v_f_plunge v_f_retract`         |
| `counter bore`, `boring bar`                 | `f_n guid material n name tool-coolant v_c v_f v_f_leadIn v_f_leadOut v_f_plunge v_f_ramp v_f_transition`                                             | + `f_z`                                    |
| `tap left hand`, `tap right hand`            | `guid material n name tool-coolant v_c`                                                                                                               | **nothing else** but `expressions`         |

A tap models nine fields; a milling tool requires seventeen. One `FusionPreset`
type applied to every tool cannot be right for all of them, and the exporter has
no way to notice — which is exactly the gap the geometry table already closed
for `geometry`.

**This is not hypothetical.** `pretoolPresets` routes `spot drill` and
`center drill` through `holePreset`, which writes `guid name material n v_c
v_f_plunge v_f_retract f_n tool-coolant use-feed-per-revolution`. Those two
types require `v_f`, `v_f_leadIn`, `v_f_leadOut`, `v_f_ramp` and
`v_f_transition` as well, so **the application's spot-drill and center-drill
presets are missing five required fields today** and nothing says so. Its drill
and reamer presets are valid; its tap presets carry four fields a tap does not
model, which is legal but invisible in Fusion.

### Integer literals do not crash the parser, and `library.ts` overstates it

The proposal is to extend the serializer's `isFloat` rule to `v_f`, `v_c`,
`f_n`, `stepdown`, `stepover` and `ramp-angle`, on the grounds that writing them
as bare integers is _"the exact parser crash `library.ts` documents"_.

Measured against 100 real tools scanned out of Fusion libraries — 361 presets —
**every one of those fields already appears as a bare integer**: `n`, `v_c`,
`v_f`, `f_z`, `stepdown`, `v_f_plunge`, `v_f_ramp`, and `ramp-angle` which is
_only_ ever an integer. The same libraries carry bare integers in `DC`, `LB`,
`LCF`, `OAL`, `RE`, `TP`, `shoulder-length`, `tip-diameter` and in holder
segment `height` and diameters.

So Fusion demonstrably reads integers in both places, and the rule inherited
from BetterToolLib — one incident in which a Syil library with `LB: 25` failed
to load and `LB: 25.0` did not — is not the general law `library.ts` currently
asserts. **That docstring is wrong and gets corrected as part of this work.**

The float rule still stays, and the preset fields still join it, for the reason
that actually survives: `25.0` is accepted everywhere `25` is, one rule over the
whole document is simpler than two, and the cost is a character. What changes is
the justification, so the next person does not inherit a law that the data in
front of them contradicts.

## Design

### The digest learns about presets

`scripts/fusion-schema.mjs` gains preset extraction per type — `presetRequired`,
`presetAllowed`, `presetClosed` — alongside `startValuesClosed`, the `material`
sub-object's own requirement, and the `use-stepover ⇒ stepover` conditional.
Then `pnpm fusion:adopt`, and preset rules are pinned to Autodesk exactly as the
geometry table is, with the same test and the same weekly upstream check.

Two facts the extraction records because they decide behaviour: `start-values`
itself is closed (`presets` is the only key it takes), and a **preset item is
open** — so a field a type does not model is tolerated rather than rejected,
which is what makes the tap case a note rather than a refusal.

### `preset.ts`

```ts
export interface CatalogPreset {
  readonly guid: string // required; the exporter mints none, as everywhere
  readonly name: string
  readonly material?: PresetMaterial // defaulted to the all-materials entry
  readonly [field: string]: unknown // the numeric fields, per type
}
```

`fusionPresets(type, presets)` then:

- drops any field the type does not model, one `dropped` note each — so a tap
  preset carrying `v_f_plunge` loses it and says so;
- reports every required field the type demands and the preset lacks, which is
  what would have caught the spot-drill gap;
- supplies `material` when absent (`{ category: 'all', query: '', 'use-hardness':
false }` is the all-materials entry, a convention rather than a measurement —
  the same line `FILL_CONSTANTS` already draws);
- enforces `use-stepover ⇒ stepover` and `use-stepdown ⇒ stepdown`.

A preset that is missing a required field does **not** sink the tool. It is
dropped with a note and the tool exports with the presets that are valid, because
a tool with no feeds is still a usable tool and a tool that vanished is not.

### Units are the caller's, and this is the part to get wrong quietly

A preset's numbers are in the tool's unit system, and which unit each field uses
differs per field — `v_c` is m/min or SFM, `v_f` is mm/min or in/min, `f_z` is a
length per tooth. **The exporter does not convert them.** It has no units model
for feeds and speeds, and inventing one to convert a field whose unit it has
guessed is worse than carrying what it was given.

So the contract is stated on the type and in the README: presets arrive stated in
the same unit system as the tool. The application generates metric presets for
metric tools today, so nothing changes for it — but this is the one part of the
exporter where a caller can be wrong without anything noticing, and it is worth
saying out loud rather than leaving implied.

### The rest

- `ToolRequest` gains `presets?: readonly CatalogPreset[]`, and
  `FusionTool['start-values']` becomes `{ presets: readonly FusionPreset[] }`.
- `library.ts`'s `isFloat` reads a new `FUSION_PRESET_KINDS` beside the geometry
  one; counts and flags stay integers, everything dimensional gets its point.
- **A tool with no presets still exports.** `presets: []` is schema-legal, so a
  form PreTool has no generator for produces a tool with an empty preset list and
  a note — where the application skips the tool entirely today. That is a
  behaviour change in the application's favour and worth stating in its migration.

## Tests

- Per type, the resolved `presetRequired` / `presetAllowed` equal the digest's,
  and every preset field has a declared kind whose JSON type matches — the
  geometry table's two checks, applied to presets.
- A milling preset survives whole; the same preset offered for a tap loses the
  fields a tap does not model, with a note naming each.
- A spot-drill preset shaped like the application's is reported missing exactly
  `v_f`, `v_f_leadIn`, `v_f_leadOut`, `v_f_ramp`, `v_f_transition` — the
  regression this whole section exists to catch.
- `use-stepover: true` without `stepover` is refused.
- Presets serialize with decimal points on dimensions and integers on counts, and
  the document still round-trips through `JSON.parse`.
- A tool whose preset list is empty still exports and conforms.

## Wiring

A `@toolpath/tool-support` **minor** Changeset — `start-values` widening from
`never[]` is additive for every consumer that never passed presets, which is all
of them. README gains the preset contract and the unit warning.
