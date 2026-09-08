# @toolpath/tool-scraper

Scrapes cutting-tool and toolholding geometry from vendor catalogs into records.

Node ≥20, ESM, one runtime dependency. One vendor-neutral core plus one adapter per manufacturer
under `src/vendors/`; two adapters share the core and never each other, which
`tests/vendor-boundary.test.ts` asserts from the package tree rather than from a list.

**Scraped output is not committed.** A CSV is the vendor's data and a working file, not source —
and this repository is public, which is a second reason independent of size.

## Install

```sh
pnpm add @toolpath/tool-scraper
```

## Vendors

| Vendor             | Transport                                               | What it publishes                                 |
| ------------------ | ------------------------------------------------------- | ------------------------------------------------- |
| Kennametal / WIDIA | AEM variant-table GET, parsed with `htmlparser2`        | tools and toolholding                             |
| REGO-FIX           | Elasticsearch proxy POST + per-part DIN 4000 XML        | toolholding                                       |
| Destiny Tool       | Firestore REST, paginated                               | solid end mills                                   |
| Harvey Tool        | inline JS literal on a product page, plus its `<thead>` | miniature end mills, keyseat cutters              |
| MariTool           | osCommerce category listings, then one page per part    | toolholding                                       |
| EMUGE-FRANKEN      | SAP Commerce JSON API: grouped, variant, batched detail | end mills, twist drills, taps cutting and forming |

## Two entry points

**`@toolpath/tool-scraper` returns records.** Every scrape hands back the vendor's own rows and
enough provenance to say where they came from; `toRecords` turns one family's scrape into
`ToolRecord[]` — canonical ISO 13399 geometry, one shape whatever the vendor. Nothing in either
touches the filesystem, so a backend can embed it and do what it likes with the result.

```ts
import { createFetcher, type ToolRecord } from '@toolpath/tool-scraper'
import { toRecords } from '@toolpath/tool-scraper/registry'
import { scrapeFamily } from '@toolpath/tool-scraper/vendors/kennametal'

const fetcher = createFetcher() // or your own: retries, proxy, rate limits
const scrape = await scrapeFamily(fetcher, '100003658')

const records: ToolRecord[] = toRecords('godrill_3xd_metric.csv', scrape)
// { brand: 'kennametal', guid: '…', geometry: { DC: 10, OAL: 89, … },
//   materialGroups: ['P', 'N'], materialGroupsSource: 'vendor-stated', … }
```

`toRecords` is on the `./registry` subpath because it is the one place that knows both the family
table and the vendor adapters; the main entry point deliberately imports no vendor. It checks the
scrape's header for the identity and mapped columns before it maps a single row, so a re-scrape
whose part-number column was renamed fails by name instead of minting every guid off an empty
string.

The transport is a parameter, not a module global. Supply your own `Fetcher` and the vendor
adapters read through it — which is also how every test in this package runs without a network.

**`@toolpath/tool-scraper/node` writes files.** CSV serialization, the provenance sidecar, the
scrape-root resolution and the bulk CAD mirror all need `fs`, so they are a separate entry point and
a consumer that only wants records never imports them.

## Command line

Every command prints the resolved scrape root before it does anything, and writes a receipt beside
what it produces — the source URL, the family code, a timestamp, the row count and the scraper
version.

```sh
export TOOLPATH_SCRAPE_ROOT=~/toolpath-scrapes      # default: ./scrape-out, gitignored

toolpath-scrape kennametal 100003658 "$TOOLPATH_SCRAPE_ROOT/kennametal/csv/godrill_3xd_metric.csv"
toolpath-scrape kennametal --collets                 # every ER collet family, and which CSV claims it
toolpath-scrape materials godrill_3xd_metric.csv
toolpath-scrape regofix holders "$TOOLPATH_SCRAPE_ROOT/regofix/csv/regofix_bt30_pg_holders.csv"
toolpath-scrape destinytool "$TOOLPATH_SCRAPE_ROOT/destinytool/csv/destinytool_end_mills_inch.csv"
toolpath-scrape harvey harvey_endmill_008.csv     # the page and the unit come from its config
toolpath-scrape harvey --catalog                  # what the four category trees link to today
toolpath-scrape maritool maritool_cat40_holders.csv  # its leaf categories come from its config
toolpath-scrape maritool --catalog                # what the five taper trees hold today
toolpath-scrape emuge emuge_drills.csv            # its category and unit come from its config
toolpath-scrape emuge emuge_form_taps.csv         # FG02, the cold-forming taps
```

`toolpath-scrape --help` lists the rest.

## The record

Geometry lands in **ISO 13399** codes — `DC`, `OAL`, `LCF`, `RE`, `NOF`, `SIG`, `TP` — the
machine-tool industry's own interchange dictionary. CAM vendors implement subsets of it, which is
why these names also appear in Fusion's tool JSON. `records.GEOMETRY_FIELDS` carries each code's
definition and names the three that are Autodesk's rather than the standard's.

Vendor CSVs keep the **vendor's** own column labels. Nothing reads a vendor's CSV but that vendor's
adapter, and `conventions.ts` holds the short list of rules that do hold across all of them.

`materialGroups` has three states, and they are different claims: `null` labelled `unspecified` is
"we do not know what this tool is for" — not indexed, not published, or not swept — `[]` is a vendor
index that rates the part for nothing, and a non-empty list is a rating. `materialGroupsSource` is
never absent: it is `unspecified`, or it says whether the rating was `vendor-stated` or `derived`
here. Every Harvey record is `unspecified`: Harvey's material index is published per part rather
than in a variant table, and a scrape cannot reach it — see
[`docs/HARVEY_PRODUCT_TABLE.md`](docs/HARVEY_PRODUCT_TABLE.md) §1.5.1.

`threadMethod` is `cutting` or `forming` on a tap and `null` on everything else,
because the question does not apply to a drill. It is the one field that
separates a thread former from a cut tap: the two are the same `DC`, `TP`,
`SFDM`, `OAL` and `LCF`, often the same substrate and coating, and a shop drills
a larger hole before one than before the other. Neither vendor publishes it in a
variant table — Kennametal states it in a `newTapType` facet and EMUGE in the
split between its `FG01` and `FG02` categories — so it is a per-family fact, and
each family cites the index it was read off.

Every per-family constant no vendor table states carries its provenance — whether it was
vendor-stated, derived or assumed, and by whom on what date. The types enforce it: an assumed fact
without a note, a date and initials does not compile.

## Documentation

- [`docs/ADDING-A-VENDOR.md`](docs/ADDING-A-VENDOR.md) — the runbook.
- [`docs/KENNAMETAL_CAD_API.md`](docs/KENNAMETAL_CAD_API.md),
  [`docs/KENNAMETAL_SPEEDFEED_API.md`](docs/KENNAMETAL_SPEEDFEED_API.md),
  [`docs/REGOFIX_PRODUCTFINDER_API.md`](docs/REGOFIX_PRODUCTFINDER_API.md),
  [`docs/HARVEY_PRODUCT_TABLE.md`](docs/HARVEY_PRODUCT_TABLE.md),
  [`docs/MARITOOL_CATALOG.md`](docs/MARITOOL_CATALOG.md) — how each endpoint or table was
  found, and the dead ends tried first.
- [`../../docs/TOOL-SCRAPER-PLAN.md`](../../docs/TOOL-SCRAPER-PLAN.md) — the structure, the evidence
  behind it, and what has landed.

## Tests

```sh
pnpm --filter @toolpath/tool-scraper test
```

Nothing in the suite reaches a vendor: `tests/setup.ts` replaces the global `fetch` with one that
throws, so a test that forgets its stub fails loudly instead of quietly paging a vendor's catalog.

Tests that read a scraped CSV skip with a named reason where no scrape exists; set
`TOOLPATH_REQUIRE_CORPUS=1` on a machine that keeps one to turn those skips into failures.
