---
'@toolpath/tool-scraper': major
---

Scrape Kennametal's BT, BTKV, CV, CVKV, HSK and PSC toolholders.

`kennametal --holders` walks the six spindle-interface category trees and prints every
family they link to — 538 families and 2,862 parts, in 552 listings because a family
reachable from two branches is reported under each — indented by branch, each against the
CSV whose `familyCode` claims it. `HOLDER_FAMILIES` grows from nine families on one BT30
spindle to **158 families and 1,192 parts**: every family under those six interfaces whose
clamping `HolderRecord` already models — ER collet chucks, shrink fit, and hydraulic
chucks. Shell-mill arbors, modular adapters, PSC cutting units and bar blanks grip neither
a shank nor a collet and stay out; the walk lists them as `(not configured)`. So does the one
family that sells two spindle sizes from one table, which no per-family `taper` can describe —
`tests/holding-corpus.test.ts` now holds every other family to the interface the vendor writes
into its part numbers, so a second one cannot arrive unnoticed.

Breaking:

- A Kennametal holder record reads its `unit` from the part's own catalog number rather
  than from its family. 21 of the 158 families sell metric and inch bores from one table,
  and the family-level fact showed 6.35 mm to a machinist who ordered a 1/4 in bore. The
  fact remains, as the family's catalogued system and the fallback for a row with no
  catalog number. Collets are unchanged.
- `parseColletListing`, `colletListingPages` and `ColletListing` are `parseCategoryListing`,
  `categoryListingPages` and `CategoryListing`. They serve two category trees now, and
  MariTool's adapter already exports a `Listing`.
- `discoverFamilies` requires its `roots` argument; there are two trees to walk and no
  sensible default between them.
- `DiscoveredCategory` carries `path`, every name from the root down. `describeFamily`
  prints that branch instead of the leaf name — `ER Collet Chucks` names six different
  families across the six interfaces.
- `bt30_shrink_fit_hpv_form_ad_metric.csv` and `bt30_shrink_fit_hpv_form_ad_inch.csv` are
  one family again, `bt30_shrink_fit_hpv_form_ad.csv`. They were one vendor family split by
  hand because it mixed both systems, which the per-row unit now handles.

Also:

- A listing page is re-asked up to four times, waiting 2 s, then 8 s, then 32 s. The holder
  walk is about 635 requests and the vendor fails roughly one in a hundred, so a single
  attempt ended a ten-minute walk with nothing printed — and retries spaced by the walk's
  own 400 ms politeness delay were no better, because all of them landed inside the same
  bad minute. The wait is only paid when something is already wrong.
- `TAPER_PREFIXES` accepts `CV`, Kennametal's name for the 7:24 V-flange cone MariTool
  designates `CAT`. `taperDesignation` still refuses `PSC`: ISO 26623 is a polygon, with no
  7:24 size to read and no `TaperFamily` to belong to.
- Every holder family declares its `familyCode`, including the nine that predate the walk.
