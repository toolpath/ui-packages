# Tool scraper — structure and port plan

_Written 2026-08-26, from a read of this repo and of `tool_catalog/packages/scraper`
(`/Users/justingray/toolpath/new_code/tool_catalog`), against one question: what shape should
vendor tool scraping take here, and how does the existing code get in._

**Status: the port is complete — all seven steps landed, and the result was then
re-implemented in TypeScript.** Steps are checked off in "The port" below as they landed.

**Amended 2026-08-26: the package is TypeScript, not Python.** The seven steps below describe the
port out of `tool_catalog`, and every structural decision in this document still holds — the
acquisition/conversion split, one package rather than one per vendor, the vendor boundary, ISO 13399
as the vocabulary, provenance as a gate. What changed is the language and two things that follow
from it:

- **The library returns records; files are a separate entry point.** Every Python scrape function
  ended in `open(out_path, 'w')`, which is right for a console script and wrong for a package a
  Node backend imports. CSV serialization, the receipt sidecar and the CAD mirror are
  `@toolpath/tool-scraper/node`.
- **It publishes to npm**, so decision 7 below — that this package takes no Changeset — is
  reversed. `AGENTS.md` records that.

The port was checked rather than argued: all 37 families across all six config tables were
converted mechanically and diffed as JSON against the Python's own evaluated tables; every guid and
all 2,232 thread designations are pinned against values the Python generated; and the corpus suite
carries across intact, so a machine holding a scrape checks that this code reproduces what the
Python wrote.

## What is being ported

`tool_catalog/packages/scraper` is the `tooling_scraper` distribution — 14k lines, 504 tests green
in 2.2s, Python ≥3.11, **zero runtime dependencies**. It scrapes three vendors and converts what it
scrapes into Fusion 360 tool libraries and an assembly catalog.

Three vendors, three unrelated transports:

| Vendor             | Transport                                        | What it imports from the core |
| ------------------ | ------------------------------------------------ | ----------------------------- |
| Destiny Tool       | Firestore REST, paginated                        | nothing — pure stdlib         |
| Kennametal / WIDIA | AEM variant-table GET, parsed with `HTMLParser`  | `identity.BRANDS`             |
| REGO-FIX           | Elasticsearch proxy POST + per-part DIN 4000 XML | `toolholding.CAD_COLUMN`      |

## One package, not one per vendor

The three adapters share no code with each other. That is not a reading of the source — it is
asserted by `tests/test_vendor_boundary.py`, which derives its module lists from the package tree
and fails when a core module imports a vendor or a vendor imports another vendor. That test comes
across intact and is the reason the layout can be trusted without packaging enforcing it.

Sharing nothing with each other is not an argument for separate distributions, because all three
lean on a small common core. Measured: the transports need `BRANDS`, `CAD_COLUMN` and
`ISO_MATERIAL_GROUPS` — three symbols. The CSV-to-record mappers add `ColumnMap`, `ToolRecord` and
thread-designation parsing. Splitting by vendor yields N distributions that exist to depend on a
core for a handful of constants, N release cadences, and a cross-repository change every time the
record contract moves — which it will, repeatedly, while vendors are still being added.

`tool_catalog/docs/MULTI-VENDOR-PLAN.md` reaches the same conclusion and records why: "keep the
well-maintained vendors in-tree. A monorepo is what lets one PR change the record contract and every
adapter together." Its phase D is the split into separately installable distributions, deliberately
not done. `registry.py` names the seam where an entry-point lookup would replace the in-process
`ADAPTERS` dict, so the split stays a packaging change rather than a refactor whenever a vendor
needs to ship on its own.

## The split that is worth making: acquisition, not conversion

`tooling_scraper` is two products in one distribution.

**Acquisition** — `vendors/*/scrape.py`, `cad.py`, `materials.py`, `thread_column.py`, plus
`identity`, `records`, `provenance`, `thread`, `registry` and `cli`. Stdlib only. This is what comes
here.

**Conversion** — `fusion.py`, `presets.py`, `profiles.py`, `toolholding.py`, `census.py`,
`assumptions.py`, and the vendored byte-for-byte copy of BetterToolLib. This is the Fusion-library
and assembly-catalog build: a different product, the half that depends on the 105 MB `tool-data`
package, and the source of nearly all of the corpus dependence measured below. It stays where it is.
If it is wanted here later it is a second package, not a widening of this one.

## Layout

```
packages/tool-scraper/
  pyproject.toml            uv_build, matching packages/sdk-python
  src/toolpath_scraper/
    identity.py             brands, per-vendor uuid5 namespaces, product links
    records.py              ToolRecord, ColumnMap, canonical geometry, ISO groups
    provenance.py           Fact, and the assumed/derived/vendor-stated gate
    thread.py               thread designation parsing — a standard, not a vendor's
    conventions.py          NEW — CAD_COLUMN, the identity columns, the _mm/_in rule
    fetch.py                NEW — the polite stdlib GET all three transports copy today
    registry.py             brand -> adapter
    families/               scrape targets and column maps, one module per vendor
    cli.py                  the scrape subcommands
    vendors/
      kennametal/           scrape, cad, materials, thread_column, records
      regofix/              scrape
      destinytool/          scrape, records
  tests/
```

The distribution is `toolpath-tool-scraper` and the import package is `toolpath_scraper`. The import
name is not `toolpath`: `packages/sdk-python` already publishes that, and a scraper is not part of
the API bindings.

Two moves the layout forces, both of which are corrections rather than costs:

- **`CAD_COLUMN` comes up into the core.** It sits in `toolholding.py` today — a conversion module —
  and two vendors reach into it. `test_vendor_boundary.py`'s own docstring records this leak
  happening once in the other direction, when `toolholding.py` imported the constant from
  `vendors/kennametal/cad.py` for a day.
- **`families.py` splits**, one module per vendor. Its 1258 lines mix scrape targets
  (`family_code`, `rows`), the column maps and facts an adapter reads, and conversion config
  (`library_name`, and the preset routing keys). The first two come; the third does not.
  `columns` and `facts` looked like conversion config from outside and are not: `vendors/*/records.py`
  is in the acquisition half, and it reads both — a `ColumnMap` to find a vendor's column and
  `cfg['bmc']`/`cfg['coolant_through']` to fill a record field no table publishes.

## Scraped data is not committed

Measured rather than assumed: the package was copied to a scratch directory with `data/` deleted and
the suite re-run.

| Suite                                                   | Without the corpus    |
| ------------------------------------------------------- | --------------------- |
| Kennametal scrape                                       | 12 / 12 pass          |
| Destiny Tool scrape                                     | 45 / 45 pass          |
| REGO-FIX scrape                                         | 31 / 36 pass          |
| CLI                                                     | 27 / 27 pass          |
| identity, vendor drift                                  | 15 / 15 pass          |
| toolholding, census, materials, csv-to-fusion, profiles | 146 failed, 25 errors |

The scrapers are corpus-independent because their tests already mock the network at one seam —
`urllib.request.urlopen`, or `scrape.fetch` — and feed inline HTML and JSON fixtures. **The test
harness this plan needs already exists and is ported unchanged.** Every failure above is in the
conversion half, which is out of scope anyway.

What remains is an 11-test tail of _corpus-assertion_ tests — `test_every_scraped_holder_satisfies_
the_taper_arithmetic`, `test_every_holder_scraped_so_far_has_a_model`, and their neighbours. Those
check the scraped corpus, not the scraper, so they belong with the data. The source repo already has
the right idiom: `test_vendor_drift.py` skips **with a named reason and the environment variable
that overrides it** when the BetterToolLib checkout is absent. That pattern is reused here, so a
machine holding a corpus checks it and CI skips and says why. A silent pass would be worse than no
test.

Mechanically, `csv_dir()` is hardcoded to `PKG_ROOT/data/<brand>/csv` today. A `TOOL_CATALOG_DATA_ROOT`
environment variable already exists for _outputs_; this package mirrors it for inputs as
`TOOLPATH_SCRAPE_ROOT`, defaults to a gitignored directory, prints the resolved root on every run,
and carries the ignore rules that keep a scrape out of `git status`.

## What gets stored, and in whose vocabulary

Two artifacts per family, and only one of them is an interchange format.

### The CSV is a receipt, not a schema

Each vendor's CSV keeps **that vendor's own column labels**. Relabelling them into a shared
vocabulary on the way into the file would put a lie in the file whose whole job is to record what
the vendor published. The real headers show how little the three have in common:

```
Kennametal    Material Number,ISO Catalog Number,ANSI Catalog Number,Grade,D1_mm,D1_in,L_mm,…
REGO-FIX      Material Number,ISO Catalog Number,CST,contact,L1_mm,D2_mm,B3_mm,CAD_STEP_URL,DIN_A2,…
Destiny Tool  itemNumber,type,description,series,cutDia_in,loc_in,oal_in,rad_in,flutes,…
```

`D1_mm` and `cutDia_in` are the same measurement. Nothing parses a vendor's CSV but that vendor's
own adapter, and the CSV is what gets diffed when a vendor silently changes their table.

**A vendor's column label can collide with a real ISO 13399 code and mean something else.** ISO
13399 defines `D1` as _fixing hole diameter_ and `L` as _cutting edge length_; Kennametal's table
uses `D1` for the cutting diameter and `L` for the overall length. They are that vendor's drawing
dimensions, not codes from the standard, and the two vocabularies overlap on `D1`, `L`, `B`, `H`,
`RE`, `SIG` and `TP` among others. So this is not only a convenience rule — anything that reads a
vendor CSV without going through that vendor's adapter can be confidently wrong rather than
obviously broken.

### The conventions the CSVs do share, and the one already broken

Not a schema — five rules. `conventions.py` is where they become explicit and testable, and the
reason to make them explicit is that vendor #3 already drifted from one:

| Convention                                                                          | Held by                       |
| ----------------------------------------------------------------------------------- | ----------------------------- |
| `_mm`/`_in` suffix carries the unit on every dimensional column                     | all three                     |
| Multi-value cells are space-separated (`Material Groups`, `isoMaterialGroups`)      | all three                     |
| One row per orderable part                                                          | all three                     |
| `CAD_STEP_URL` names a CAD model where one exists                                   | Kennametal holders, REGO-FIX  |
| Unmapped vendor codes kept under a `DIN_` prefix, so they cannot read as dimensions | REGO-FIX; the rule is general |
| **The identity column**                                                             | **broken** — see below        |

REGO-FIX writes `Material Number`/`ISO Catalog Number` because its adapter adopted Kennametal's
identity labels. Destiny Tool passes Firestore's `itemNumber` straight through. The convention was
real but informal, and it eroded the first time a vendor did not resemble the first two. Identity
and units are the two worth enforcing; the rest stay advisory.

### The canonical record is ISO 13399

`ToolRecord` uses `DC`, `OAL`, `LCF`, `RE`, `NOF`, `SIG`, `TP` — and those are not Autodesk's
invention. They are **ISO 13399** codes, _Cutting tool data representation and exchange_, the
machine-tool industry's own interchange dictionary. Fusion implements a subset of it; this package
uses the standard directly.

Checked against the published dictionary, over every `geometry` key present in the 14 generated
libraries:

| Fusion key | ISO 13399 | ISO definition                        |
| ---------- | --------- | ------------------------------------- |
| `DC`       | yes       | Cutting diameter                      |
| `LCF`      | yes       | Chip flute length                     |
| `OAL`      | yes       | Overall length                        |
| `LB`       | yes       | Body length                           |
| `RE`       | yes       | Corner radius                         |
| `SIG`      | yes       | Point angle                           |
| `TP`       | yes       | Thread pitch                          |
| `NOF`      | yes       | Flute count                           |
| `HAND`     | yes       | Hand                                  |
| `TA`       | yes       | Taper angle                           |
| `BMC`      | yes       | Body material code                    |
| `GRADE`    | yes       | The brand name for grade              |
| `SFDM`     | **no**    | Autodesk "Shaft Diameter"; ISO: `DMM` |
| `CSP`      | **no**    | Autodesk "Coolant Support" (boolean)  |
| `NT`       | **no**    | Autodesk "Number of Teeth"            |

Twelve of fifteen are the standard's codes with the standard's meanings. The three exceptions each
have an ISO counterpart Autodesk did not use — `DMM` for shank diameter, `CEDC`/`ZEFP`/`ZEFF` for
edge count, and the `CNSC`/`CXSC`/`CP` coolant codes rather than a flag. Fusion's hyphenated
lowercase keys (`shoulder-length`, `tip-diameter`, `tip-offset`, `thread-profile-angle`,
`assemblyGaugeLength`) are Autodesk's throughout; ISO's nearest are `DN`, `LS`, `PL`, `SDL`/`STA`.

**This is why the vocabulary survives presets going out of scope.** The earlier framing — borrowing
a CAM vendor's field names — undersold it. The canonical names are an industry standard that a CAM
vendor happens to implement, so nothing here depends on Fusion, and the three deviations are a
documented departure from the standard rather than the whole vocabulary being one vendor's choice.

The standard is paid and split across parts (2 and 3 are the reference dictionaries for tool items,
60 covers connection systems, 61 company codes), so the working reference is a manufacturer's
published table. Two complete ones:
[Sandvik Coromant](https://www.sandvik.coromant.com/en-us/knowledge/machining-formulas-definitions/cutting-tool-parameters)
and [Dormer Pramet](https://dormerpramet.com/ISO-13399/).

Two field names are deliberately excluded. `LB` and `assemblyGaugeLength` are `OAL` under
another name on a bare tool — ISO code or not, and a field that is always a copy is not a second measurement — an
adapter able to supply them separately could supply a tool claiming a holder it does not have.

**A canonical name says nothing about units.** An adapter declares `'DC': 'D1'`, and the core
appends `_mm`/`_in` from the family's declared `unit`. Choosing that suffix inside an adapter is
exactly the mistake `unit` exists to prevent, and silent unit assumptions are the likeliest way this
data shows someone a wrong number.

### Holders: Fusion's format is first-class, and geometry-only

`FusionHolder` is a real type in the same document as `FusionTool` — see
`BetterToolLib/webapp/src/schema/types/fusion.ts` — and both live in one `data[]` array, which is
why a holder and a tool share a guid space. Its whole vocabulary is identity, one scalar, and a
stack of truncated cones:

```json
{
  "type": "holder",
  "unit": "millimeters",
  "description": "BT40 ER32 BTKV",
  "vendor": "KMT",
  "product-id": "7195561",
  "gaugeLength": 90.0,
  "segments": [{ "height": 10.0, "upper-diameter": 50.0, "lower-diameter": 44.0 }]
}
```

`FusionSegment` is shared with `FusionTool.shaft`, and `holder_profile.profile_to_segments` is the
one-way conversion from an ascending `(z, r)` profile.

**It carries no spindle interface.** BetterToolLib recovers a size class by fitting the 7:24 cone
against gauge diameters (31.75 / 44.45 / 69.85 mm for 30/40/50) and then has to hold the rest —
`BT40`, `BT40-DC`, `HSK63A`, `Capto` — in an out-of-band `augmented.taper` field that is not part of
Fusion's document at all. `taper_catalog.py` states the limit directly: geometry can report a size
class, never the flavor or dual contact.

The scrape has that information as stated fact. REGO-FIX publishes a literal `contact` column
(face versus cone) alongside the PG series and the `CST` designation; Kennametal sells the
dual-contact variant as BTKV. Writing a scrape straight into Fusion's holder shape would discard
precisely what the scrape is best at.

**ISO 13399 has vocabulary for it where Fusion does not**, which keeps the record inside the
standard rather than inventing names. Candidates, to be confirmed against the dictionary before
anything is mapped: `CZC MS`/`CZC WS` (connection size code, machine and workpiece side) for the
`BT 30 / PG 25` interface pair a holder joins, `DCONMS`/`DCONWS` for the diameters at each, and
`CONARWS` for the arrangement. The whole connection-system half of the standard is Part 60, which is
also the part Fusion's holder type ignores entirely.

### Fusion is a sink, not a source

So the same rule governs both halves, for the same reason: **the record is a superset and Fusion is
one projection of it.** For cutting tools the dropped material is the unlabelled `DIN_A2`/`B1`/`B2`
codes, which have no canonical name and must not be given one — the standing rule is to leave a
vendor code unlabelled rather than guess at what it measures. There is now a lead on pinning them
honestly: REGO-FIX publishes `DXF_ISO13399/DXF` and `DXF_ISO13399/PDF` beside the `XML_DIN4000/XML`
the scraper reads today, so the standard is already in that vendor's own source material.
`REGOFIX_PRODUCTFINDER_API.md` anticipates exactly this — "if you get hold of DIN 4000-89 or a
REGO-FIX ISO 13399 mapping, that is the file to update." For holders it is the stated
interface. Different content, identical shape of argument, and both are reasons a shared CSV schema
would have to either drop data or force someone to invent a name for it.

Where Fusion's vocabulary is adopted wholesale is the **geometry half of a holder**, because a
holder profile genuinely is a stack of truncated cones. Even there the measurement is stored as
`(z, r)` points and segments are treated as an encoding of it, not the other way round — the source
repo's `test_points_round_trip_through_fusion_segments` is what pins the two as equivalent.

### Provenance moves out of git

Git was doing this job for the corpus. Once the CSVs are not tracked, "when was this scraped, from
which URL, under which family code, how many rows" has nowhere to live — and the pipeline leans on
exactly those facts: the hand-counted `rows` per family exists so that a scrape which silently lost
rows cannot agree with itself.

So each scrape writes a sidecar beside its CSV: source URL, family code, timestamp, row count and
scraper version. Cheap now, and effectively impossible to backfill.

## The port

Each step ends green on `pnpm check`.

- [x] **1 — Skeleton.** `packages/tool-scraper/` with its `pyproject.toml`, `.gitignore` and
      `.prettierignore` entries, and the root `lint`/`test` scripts extended to reach it. One
      packaging test that imports the package, so the gate is live from the first commit rather than
      passing over an empty directory.
- [x] **2 — The core, unchanged.** `identity`, `records`, `provenance`, `thread` move as-is, with
      their tests. `records.GEOMETRY_FIELDS` gains the ISO 13399 definition beside each code and
      names the three that are Autodesk's rather than the standard's, so the vocabulary's source is
      readable from the code. `conventions.py` is new: `CAD_COLUMN`, the identity columns and the
      `_mm`/`_in` rule, with a test over each adapter's header so the identity convention Destiny
      Tool broke cannot erode again unnoticed.
- [x] **3 — The boundary test, before any vendor.** `test_vendor_boundary.py` with its tree-derived
      lists and its shape guards. The core half is live from this commit: no core module may name a
      vendor, in an import or in a string. The vendor half has nothing to iterate over, so it
      **skips with a named reason** — "no vendor adapter has landed yet" — rather than failing,
      because the rule above is that each step ends green and a skip pytest prints on every run is
      as loud as a red nobody has been told to expect. Both halves go live without an edit as step
      4 lands.
- [x] **4 — Vendors, one commit each, cheapest first.** Destiny Tool (no core imports, 45
      self-contained tests), then Kennametal (`scrape`, `cad`, `materials`, `thread_column`), then
      REGO-FIX (the 478-line one). Adapter, its tests and its `families/` entries per commit, green
      before the next starts. `fetch.py` landed with Kennametal, where a second transport made the
      shared shape visible, and Destiny Tool moved onto it in the same commit rather than staying a
      copy. The corpus-assertion tests in `test_cad.py`, `test_materials.py` and
      `test_scrape_regofix.py` are deferred to step 5, each behind a note in its own file naming
      what is waiting.
- [x] **5 — The data root and the sidecar.** `TOOLPATH_SCRAPE_ROOT`, `csv_dir`/`family_csv`
      resolved through it, the per-scrape provenance sidecar that git used to provide, the
      corpus-assertion tests converted to skip-with-reason, and `cli.py` narrowed to the scrape
      subcommands. The sidecar is `receipts.py` — one module more than the layout above lists,
      because a scrape receipt and a `Fact` answer different questions and only one of them is a
      per-family constant. `receipts.check_rows` is what the hand-counted `rows` buys: the CLI
      refuses a scrape whose row count disagrees with the declared one.

      Both gates hold. On a fresh clone with no corpus: 296 pass, 45 skip, each naming the family
      and the resolved root. With `TOOLPATH_SCRAPE_ROOT` pointed at the source package's `data/`
      and `TOOLPATH_REQUIRE_CORPUS=1`: 341 pass, none skipped — the ported scrapers agree with the
      corpus the originals produced.

- [x] **6 — CI and documentation.** pytest reached `pnpm check` in step 1 — `pnpm test` already
      calls `test:scraper`, and `_quality.yml` provisions uv 0.11.28 and Python 3.11 — so CI has
      been running this suite since the skeleton. The three vendor API notes are in
      `packages/tool-scraper/docs/`, with the handful of references to the source repo's own layout
      corrected and nothing else touched. `docs/ADDING-A-VENDOR.md` is the runbook, and the package
      README covers the vendors, the commands and the record.
- [x] **7 — Amend `AGENTS.md`.** Its Changeset table names only the three npm packages, and
      Changesets releases neither `packages/sdk-python` nor this package. Stated as an explicit
      exclusion rather than a fourth row: a row would imply a bump type for a package the release
      workflow never versions.

Live-network tests live in `tests/live/` behind an environment variable and stay out of CI. Reaching
three vendors' endpoints on every pull request is slow and impolite.

## Decisions

1. **Scope — decided 2026-08-26: acquisition only.** No presets, no Fusion library generation. That
   half roughly doubles the work, brings the vendored BetterToolLib copy and its drift tripwire, and
   reintroduces the corpus dependence measured above. Fusion's field names are still borrowed as the
   canonical vocabulary, for the reasons under "What gets stored" — a naming choice, not a
   dependency.
2. **Public exposure — open, and it does not block a start.** This repository is public, MIT, and publishes to npm. These scrapers encode
   endpoints found by reading vendors' application bundles, and the REGO-FIX module documents three
   data faults on the vendor's own site. That is a different exposure than the private monorepo they
   live in today, and it is worth a deliberate yes. It is also a second reason, independent of size,
   to keep the CSVs out: they are vendor data.
