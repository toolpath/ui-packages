# Kennametal collets: catalog expansion plan

Status: **implemented**. Two things went differently from the proposal below, both because
the data said so, and both are recorded here rather than quietly edited out of the plan:

- **§3.3's `accepts` axis became a published dimension.** REGO-FIX already ships tap collets as
  plain `ColletRecord`s told apart by `style` alone, so inventing a new required axis for the
  second vendor would have left the first without it. What ships instead is `squareSize` — `S10`,
  the square the vendor publishes — and `@toolpath/tool-support`'s `holderTakesTool` refuses a
  non-tap in a collet that states one. It is nullable, so REGO-FIX's tap collets are unchanged
  until their adapter publishes a square.
- **`checkCollet`'s nominal-inside-capacity gate was wrong, not just tight.** Fourteen rows of
  the real catalog sit outside their own band, and the ER40 sealed inch line does it on ten of
  its twelve: `40ERSS1000` is designated 1 inch and clamps 0.9938 — in _both_ unit columns, so
  it is the vendor stating an undersized sealed collet rather than a rounding. The gate now
  carries `NOMINAL_SLACK`, a relative bound derived from those rows.

The row counts, family codes and column shapes below were all confirmed by the shipped
`kennametal --collets` walk and by converting the scraped corpus.

`packages/tool-scraper` already scrapes, maps and validates Kennametal collets — it just
knows about two families out of sixteen, and one of the three product lines it does not know
about cannot be represented by the record type at all. This plan closes both gaps and states
what the join to holders and to cutting tools is worth once it is closed.

Every number below was read off the live endpoints on **2026-09-08** with
`obsoleteFacet:false`. The commands that produced them are in
[The listing endpoint](#the-listing-endpoint), so each is re-runnable rather than a claim.

## 1. What is there today

| Configured in `families/kennametal.ts`  | Family code  | Rows |
| --------------------------------------- | ------------ | ---- |
| `er_standard_collets_metric.csv`        | _unrecorded_ | 110  |
| `er16_collets_coolant_through_inch.csv` | _unrecorded_ | 10   |

Both were scraped by hand from a code read off the page at the time, and
`ToolholdingDefinition` has no `familyCode` key to record it in — the gap `families/kennametal.ts`
already admits for holder families. **120 collet parts, out of 443 the vendor publishes.**

The three category URLs in the request resolve to sixteen families:

### Standard collets — category `51114268`, 224 parts

| Leaf               | Family code | Slug                            | Rows    |
| ------------------ | ----------- | ------------------------------- | ------- |
| `109337186` Metric | `100000478` | `er-standard-collets-metric`    | 110     |
| `109337186` Metric | `100000428` | `er-standard-collet-set-metric` | 7 (kit) |
| `109337187` Inch   | `100000479` | `er-standard-collets-inch`      | 98      |
| `109337187` Inch   | `100000425` | `er-standard-collet-set-inch`   | 9 (kit) |

Series coverage: metric `ER8 ER11 ER16 ER20 ER25 ER32 ER40`; inch `ER16 ER20 ER25 ER32 ER40`.

### Coolant-through collets — category `109337175`, 149 parts

| Leaf               | Family code | Slug                                   | Rows                    |
| ------------------ | ----------- | -------------------------------------- | ----------------------- |
| `109337178` Inch   | `109433662` | `er-coolant-through-collet-set-inch`   | 5 (kit)                 |
| `109337178` Inch   | `109333978` | `er11-collet-coolant-through-inch`     | 4                       |
| `109337178` Inch   | `109333975` | `er16-collet-coolant-through-inch`     | 10 ← already configured |
| `109337178` Inch   | `109333974` | `er20-collet-coolant-through-inch`     | 13                      |
| `109337178` Inch   | `109333628` | `er25-collet-coolant-through-inch`     | 14                      |
| `109337178` Inch   | `109333625` | `er32-collet-coolant-through-inch`     | 17                      |
| `109337178` Inch   | `109321469` | `er40-collet-coolant-through-inch`     | 12                      |
| `109337177` Metric | `109433658` | `er-coolant-through-collet-set-metric` | 5 (kit)                 |
| `109337177` Metric | `109333979` | `er11-collet-coolant-through-metric`   | 5                       |
| `109337177` Metric | `109333976` | `er16-collet-coolant-through-metric`   | 8                       |
| `109337177` Metric | `109333973` | `er20-collet-coolant-through-metric`   | 11                      |
| `109337177` Metric | `109333627` | `er25-collet-coolant-through-metric`   | 11                      |
| `109337177` Metric | `109333626` | `er32-collet-coolant-through-metric`   | 15                      |
| `109337177` Metric | `109321468` | `er40-collet-coolant-through-metric`   | 19                      |

`CCCN == CCCX` on **every one of the 69+70 rows**, which is the `er-sealed` fact the one
configured family already cites, now confirmed across all twelve.

### Tap collets — category `109337171`, 96 parts

| Family code | Slug                                         | Rows |
| ----------- | -------------------------------------------- | ---- |
| `100000434` | `er-standard-tap-collets-inchmetric-ansi`    | 47   |
| `100000435` | `er-standard-tap-collets-metric-din-and-iso` | 49   |

Series coverage: `ER16 ER20 ER25 ER32 ER40` on both.

Row counts sum to each category's published total exactly — 117+107=224, 75+74=149, 47+49=96 —
so nothing is being missed at the family level.

## 2. Three column shapes, not one

This is the part that decides how much code changes. All sixteen tables publish
`Material Number`, `ISO Catalog Number`, `ANSI Catalog Number` and `Collet Series`, and then
diverge:

| Dimension                  | Standard (both units) | Coolant inch | Coolant metric | Tap collets |
| -------------------------- | --------------------- | ------------ | -------------- | ----------- |
| `D1` clamping diameter max | ✓                     | ✓            | ✓              | ✓           |
| `BDX` body diameter        | ✓                     | ✓            | ✓              | ✓           |
| `LF` functional length     | ✓                     | ✓            | —              | —           |
| `L` overall length         | ✓                     | ✓            | ER40 only      | ✓           |
| `L9` clamping hole length  | —                     | —            | ✓              | ✓           |
| `CCCN`/`CCCX` capacity     | ✓                     | ✓            | ✓              | **—**       |
| `Tap Range` (text)         | —                     | —            | —              | ✓           |
| `S10` square size          | —                     | —            | —              | ✓           |

Two consequences:

**Tap collets cannot become a `ColletRecord` today.** `holding.colletRecord` takes `clampMin`
and `clampMax` through `published()`, so all 96 rows would raise `IncompletePartError`, be
dropped by `registry.toHolding`, and the family would convert to zero records — which
`tests/holding-corpus.test.ts` fails on (`expect(records.length).toBeGreaterThan(0)`). This is
a record-model change, not a config change.

**`L9` is a real dimension `ColletRecord` has no field for.** Checked against `109321468`, the
one family publishing both: `L` is constant at 46 mm down all 19 ER40 rows while `L9` runs
22 / 28 / 46 mm by size. It is bore depth, not a second overall length. That matters because
`@toolpath/tool-support`'s `Collet.clampLength` — the input to `maxStickout` — is `null` for
every Kennametal collet today, and `L9` is exactly the number that fills it for the 69 metric
coolant-through and 96 tap parts.

## 3. Proposed changes

### 3.1 `ToolholdingDefinition` gains `familyCode`

One optional key, copied from `FamilyDefinition.familyCode` with the same doc rule. It makes
every collet family re-scrapable from config instead of from a browser, and it retires the
"holder families carry no `familyCode`, and that is a gap rather than a rule" note in
`families/kennametal.ts` for the collet half. Holder families can be backfilled in the same
pass or left alone; they are not in scope here.

_Consumer-visible:_ a new optional field on an exported interface. `@toolpath/tool-scraper` minor.

### 3.2 `ColletRecord` gains `clampingLength` and the tap-collet fields

Additive, all nullable but required on the type, matching the shape `holderRecord` already has:

- `clampingLength: number | null` — `L9`. Plus `clampingLengthMm`, since it is compared rather
  than only displayed (it is the `maxStickout` input), which is the rule `holding.ts` states
  for `bore`, `gaugeLength`, `clampMin` and `clampMax`.
- `tapRange: string | null` — the vendor's own text, verbatim (`"M6 & M6.3"`, `"#14 & 1/4"`).
  Not parsed. It is a designation, not a dimension, and this package does not author tool data.
- `squareSize: number | null` — `S10`, the tap's square drive across flats.

### 3.3 Tap collets: recommended model

**Recommendation: keep them as `ColletRecord`, with `clampMin = clampMax = D1`, and separate
them by `style: 'er-tap'`.**

The vendor publishes `D1` as an exact clamping diameter — `16ERTC025` is 6.477 mm, which is
0.255 in, the ANSI shank of a 1/4-20 tap — so a zero-width band is the true statement, and it
is the same shape `er-sealed` already carries and `checkCollet` already permits ("Equality is
a sealed coolant-through collet clamping one exact size — real, and not a bug").

The honest cost, stated rather than hidden: `tool-support`'s `gripsShank` compares only
`clampMin`/`clampMax`, so a tap collet would report a fit for _any_ tool with that shank
diameter, including an end mill. A square-drive collet takes a tap and nothing else. Two ways
to close that, and neither belongs in this package:

1. `@toolpath/tool-support`'s `Collet` gains an `accepts: 'shank' | 'tap-square'` (or the
   existing `style` is passed through) and `holderTakesTool` refuses the mismatch. This is the
   correct fix and it is a `@toolpath/tool-support` minor.
2. Nothing, and a consumer filters on `style` itself. Cheaper, and it is the state every
   consumer is in today for `er-standard` vs `er-sealed`.

Recommend (1), in the same pull request, because a scraper that starts publishing 96 parts a
fit rule silently mis-matches is worse than the 96 parts being absent.

The rejected alternative — a third `HoldingRecord` kind — costs a new `ToolholdingKind`, a new
mapper slot in `HoldingMappers`, a new gate beside `checkHolder`/`checkCollet`, and a branch
in every consumer, to model a part that answers the same question (`which series, and what
shank`) as the two that exist. `holding.ts`'s own rule is that a holder and a collet are
separate types because their vocabularies "genuinely do not overlap"; a tap collet's overlaps
a collet's almost entirely.

### 3.4 Fourteen new family entries

`COLLET_FAMILIES` grows from 2 to 14 (kits excluded — see §3.5), each with `familyCode`, `rows`,
and a `style`/`unit` fact pair carrying a citation, following the two entries already there:

- `er-standard` — `er_standard_collets_metric.csv` (backfill code `100000478`),
  `er_standard_collets_inch.csv` (`100000479`).
- `er-sealed` — twelve `erNN_collets_coolant_through_{metric,inch}.csv`, one per series per
  unit. The existing `er16_collets_coolant_through_inch.csv` is `109333975` and keeps its name,
  so no consumer's join key moves.
- `er-tap` — `er_tap_collets_ansi.csv` (`100000434`), `er_tap_collets_din_iso.csv` (`100000435`).

One family per vendor family, not one merged file per style: the vendor codes them separately,
the column shapes genuinely differ between the metric and inch coolant lines, and
`ToolholdingDefinition.rows` is a per-family restatement that a merged file would destroy.

`unit` for the tap families needs a decision from the data rather than from the slug —
`100000434` is titled inch/metric ANSI and `100000435` metric DIN/ISO, and both publish both
unit columns. Read the catalog-number suffix the way the `bt30_shrink_fit_hpv` note describes
before writing the fact.

### 3.5 Kits are excluded, deliberately

The four `*-collet-set-*` families (26 parts) publish `Kit Series`, `Number-Kit Items`,
`Dimension Range-Kit Items` and `Incremental Division-Kit Items` — no `D1`, no capacity, no
length. A kit is a purchasing unit whose contents are already in the per-part families. Mapping
one to a `ColletRecord` would mean inventing a capacity band from a range string, which is
authoring tool data. Excluded, and the reason recorded in `families/kennametal.ts` so the next
person does not re-discover it.

### 3.6 Discovery command: `kennametal --collets`

New `src/vendors/kennametal/catalog.ts`, modelled on `vendors/maritool/catalog.ts` and
`vendors/harvey/catalog.ts`, exposed as `toolpath-scrape kennametal --collets`. It walks the
three category queries, follows `category-tile` facet links down to the leaves, and prints
every `fam.<slug>.<code>.html` link with its row count — the same "for noticing what the vendor
added; a scrape needs none of it" contract those two already have. It goes through
`fetch.Fetcher` like every other adapter call, and it is what makes the table in §1
re-derivable instead of a snapshot.

Reuses `TableParser`? No — this is `<a>` and `<div>` scraping, not a table. It needs its own
small `htmlparser2` pass in the same module that already declares that dependency.

## 4. The join, once this lands

### To holders

`HolderRecord.colletSeries` (`CST`) ↔ `ColletRecord.series` (`Collet Series`), exact string
match, which is `tool-support`'s `colletFitsHolder`. **This already works and needs no code.**
Verified against the scraped corpus on this machine: `bt30_er_collet_adapters_metric` publishes
`CST` ∈ {ER11, ER16, ER20, ER25, ER32, ER40} and `btkv30_er_collet_chucks_metric` ∈ {ER16 … ER40};
every collet family above publishes the same spelling with no spacing to close.

What the expansion buys, per holder series:

| Holder series | Collets today | Collets after                         |
| ------------- | ------------- | ------------------------------------- |
| ER11          | 13            | 13 + 9 sealed                         |
| ER16          | 29            | 19 + 12 inch std + 18 sealed + 10 tap |
| ER20          | 13            | 13 + 15 inch std + 24 sealed + 16 tap |
| ER25          | 15            | 15 + 19 inch std + 25 sealed + 21 tap |
| ER32          | 18            | 18 + 23 inch std + 32 sealed + 26 tap |
| ER40          | 23            | 23 + 29 inch std + 31 sealed + 23 tap |

ER16's "today" is 29 rather than 19 because the one configured sealed family is its 10 inch
parts; every other row's today column is the metric standard family alone.

One thing to record rather than fix: the 9 `ER8` standard metric collets match **no holder in
this catalog** — no BT30 ER8 adapter is configured. They are still scraped; the conservative
direction `HolderRecord.colletSeries` already documents (an unmatched collet costs an option,
a wrongly matched one costs a purchase).

### To cutting tools

`tool-support`'s `holderTakesTool` → `gripsShank(collet, tool.geometry.SFDM)`, in millimetres.

- **Standard collets** publish real 1 mm-ish bands, so they match a range of shanks. This is
  the case that already works.
- **Sealed collets** clamp one exact size. `gripsShank`'s `GRIP_TOLERANCE` of 1e-6 mm plus
  `holding.ts`'s derived `clampMinMm`/`clampMaxMm` (rounded at 6 decimals rather than read
  from the vendor's other unit column) is what makes an inch collet meet an inch tool at all.
  Worth a corpus assertion, since it is a genuine exact-equality join.
- **Tap collets** match on shank only. Kennametal's own tap tables (`khsst_*`,
  `spiral_point_*`) publish `D` — the shank — and **no square-drive column**, so the square
  cannot be cross-checked against a tool record at all today. `squareSize` is carried for
  display and for a future tap record that states one; it is not a join key, and the plan
  should not pretend otherwise. §3.3's `accepts` axis is what keeps the shank-only match from
  putting an end mill in a tap collet.

### Stickout

`maxStickout` needs `Collet.clampLength`, which no Kennametal collet fills today. `L9` fills it
for the 69 metric coolant-through and 96 tap parts. The bridge from `ColletRecord` to
`tool-support`'s `Collet` lives in a consuming application, not in this repository — nothing
here maps one to the other — so this plan carries the field and the consumer picks it up.

## 5. The listing endpoint

To be written up as `packages/tool-scraper/docs/KENNAMETAL_PRODUCT_LISTING.md`, alongside the
existing `KENNAMETAL_CAD_API.md`, so the next person does not re-derive it.

The category page renders its results client-side. The component behind it is a plain AEM GET,
found in `product-listing.min.js` (`url: a + "." + c + ".html?query=" + d + "&sort=" + e +
"&pageSize=" + f`), where `a` is the component path, `c` is a **page number** and `d` is the
same facet query string the browser URL carries:

```
https://www.kennametal.com/us/en/products/metalworking-tools/tool-holders-and-adapters/
  collets-and-sleeves/_jcr_content/root/responsivegrid/product_listing.<page>.html
  ?query=<url-encoded facet string>&sort=&pageSize=<n>
```

Notes that cost time to find:

- The public `/us/en/...` path works; the authoring `/content/kennametal/us/en/...` path the
  markup's `data-path` shows returns a 307.
- A non-numeric selector (`.results.`, `.products.`) returns the site 404 page with a 404
  status, so a wrong guess is detectable rather than silent.
- A category above the leaves returns **`category-tile` facet links, not products** — that is
  the recursion the discovery command walks. The leaves return `fam.<slug>.<code>.html` links.
- `data-totalResults` on the response is the count to reconcile a walk against.

Once a family code is in hand, nothing new is needed: `vendors/kennametal/scrape.ts` already
takes it, and `toolpath-scrape kennametal <code> <out.csv>` already writes the CSV.

## 6. Work order

1. `ToolholdingDefinition.familyCode`; backfill `100000478` and `109333975` on the two existing
   entries. No behaviour change — a pure config gain, and it is the smallest thing that makes
   step 4 checkable.
2. `ColletRecord` gains `clampingLength`, `clampingLengthMm`, `tapRange`, `squareSize`;
   `vendors/kennametal/holding.ts`'s `collet` mapper reads `L9`, `Tap Range` and `S10`; the
   `COLLET_LABELS` unit-agreement list grows by `L9` and `S10`. `tests/holding.test.ts` gains a
   row per new field and a tap-collet row through the whole gate.
3. `vendors/kennametal/catalog.ts` + `kennametal --collets`, with a captured listing fixture in
   `tests/fixtures/` and a `tests/kennametal-catalog.test.ts` that walks it with a stub fetcher.
   Do this before step 4 so the fourteen codes are produced by the tool rather than pasted.
4. Fourteen `COLLET_FAMILIES` entries with citations; scrape them; `holding-corpus.test.ts`
   picks them up with no change (it iterates `Object.keys(COLLET_FAMILIES)`), and its
   `rows === boundHolding(name).rows` assertion is what proves each count above.
5. `@toolpath/tool-support`: `Collet.accepts`, and `holderTakesTool` refusing a non-tap in a
   tap collet.
6. Changesets — `@toolpath/tool-scraper` **minor** (new optional config key, new record fields,
   new exported catalog module, new CLI subcommand; nothing removed or narrowed) and
   `@toolpath/tool-support` **minor** for step 5. Both are required by
   `.github/workflows/release-intent.yml`.
7. `README.md`'s vendor table already says Kennametal publishes "tools and toolholding"; the
   CLI usage block gains the `--collets` line.

## 7. Request budget

The discovery walk is 3 category queries + 4 leaf queries = **7 requests**, run by hand when
somebody wants to know what the vendor added. A full collet scrape is **16 requests**, one per
family, paced by `scrape.REQUEST_DELAY_MS` like every other family scrape. Nothing here raises
per-run volume against the vendor beyond what scraping fourteen more families costs, and no new
vendor is added.
