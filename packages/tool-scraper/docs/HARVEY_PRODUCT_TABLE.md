# Harvey Tool product tables

How one Harvey Tool product page is read, what it publishes, and what was tried
first and did not work. Written before the adapter, on the rule that finding a
vendor's transport is the most expensive thing in this package to rediscover.

Everything below was measured against the live site on 2026-08-29 by walking the
four category trees the adapter covers: **52 product pages, 80 tables, 5,033 HTML
geometry rows, 12,773 orderable parts.** Harvey's own add-to-cart payloads list
12,799 entries; 26 of them are not parts, and §3 is why.

## 1. Transport

ASP.NET MVC, server-rendered, Cloudflare in front. **There is no JSON API.** The
variant data is a JavaScript object literal inlined in a ~557 KB `<script>` block
on each product page, and the `<table>` beside it carries only the header.

### 1.1 The URL tree

```
/products/<category>/<subcategory>[/<sub-subcategory>]   catalog-grid pages
    -> /products/<product-slug>                          the product page
        -> /products/tool-details-<toolnumber>           one part (NOT fetched, §1.5)
```

Two selectors, both verified against all 33 category pages walked:

- **subcategory links** — `<a class="img-wrapper" href="/products/...">` inside
  `div.catalog-grid-component`
- **product links** — `<a href="/products/...">` inside
  `div.col-md-4.col-12.item-wrapper` inside `div.product-grid-component`

A page has one or the other, never both, so the walk terminates when a page
yields products. Product slugs live in one flat namespace: three of them say
`end-mills-` rather than `miniature-end-mills-` even though the
miniature-end-mills tree is where they are reached from.

### 1.2 What a product page inlines

Three globals in one script block:

```js
var cols1 = [{data:"a0"},{data:"a1"},...,{data:"s0"},...,{data:"p0"},...,{data:"atc"}];
var cols2 = [ ... ];   // cols3..cols10 exist and are [] when unused

var tableData1 = [{
  a0:{c:"l product-table-datum", d:".250 (1/4)", s:".250 (1/4) .250 (1/4)",
      v:".250 (1/4)", t:""},
  a3:{c:"product-table-datum", d:"(17.5x)", s:"(17.5x)", v:"(17.5x)",
      t:"color:#70C0FF"},
  s0:{c:"... product-table-td-toolnum",
      d:"<a href=\"/products/tool-details-14916\">14916</a>",
      s:"14916 014916.0000", v:"014916.0000", t:""},
  s1:{c:"...", d:"", s:null, v:null, t:""},        // empty = not offered
  p0:{c:"... product-table-td-price", d:"$148.40 ", s:"148.400000000",
      v:"0148.4", t:""},
  atc:{c:"...", v:"2002", d:"", s:"",
       j:"[{\"T\":\"14916\",\"C\":\"14916\",\"Q\":\"1\"}]"}
}, ... ];
var tableData2 = [ ... ];   // tableData3..tableData10 exist and are []

var viewModel = {simFileViewModel:{
  productCode:"HT-Harvey-EndMill-025",
  productTitle:"Miniature End Mills - Ball - Extra Long Length",
  variantSimFileViewModel:[
    {variantName:"14916",
     variantDxfFileLink:"https://harveyperformance.widen.net/content/.../Harvey_14916.dxf?...",
     variantStepFileLink:""}, ... ]}};
```

Cell keys: `c` css class, **`d` display HTML — the value**, `s` sort string, `v`
sort value, `t` inline style, `j` add-to-cart payload (`atc` only).

`cols<N>` is positionally aligned with the flattened `<thead>` of table `<N>`.
Verified for all 80 tables across all 52 pages: zero mismatches.

### 1.3 The DOM header

Each table's `<thead>` has exactly two `<tr>`s. The flattening rule, verified on
all 80 tables:

```
for each <th> in row 1:
    if rowspan >= 2:  it is its own data column, no sub-label   (Add to Cart)
    else:             consume `colspan` cells from row 2 as its sub-labels
```

Table ids are `<productCode minus the leading HT->_<n>` — `Harvey-EndMill-008_1`,
`Harvey-EndMill-008_2`.

Two things about the header text:

- **A top label may be split by `<br>`** — `CUTTER <br/>DIAMETER`. The tag has to
  become a space before whitespace is collapsed, or the canonicaliser sees
  `CUTTERDIAMETER` as a distinct label.
- **A sub-label's tolerance lives in its own `div.hpc-inline`.** Reading the
  `<th>`'s full text yields `D1+.0005"-.0005"`; reading it with that div excluded
  yields `D1`. The adapter excludes it, which is also what makes the vendor's own
  tolerance typos (`D1+0005"-.0005"`, `R+.001"-001"`, `L2.020"-.000"` — all real)
  irrelevant rather than three more label variants to canonicalise.

**Why some pages have two tables:** the split is purely on published tolerance.
The ball page's table 1 is `D1 +.0005"/-.0005"` and table 2 is `D1 +.000"/-.002"`.
Tolerances are dropped (§4), so nothing distinguishing survives and both tables
merge into one CSV. 40 of 52 pages have 2 tables, 12 have 1. Every table of a
given page publishes the same column labels — checked on all 52.

### 1.4 One HTML row is up to nine orderable parts

The table is a matrix. `a0...aN` are geometry. Then a **coating × flute grid**:
each coating group is a `colspan`-ed top header (`UNCOATED`, `AlTiN COATED`, ...)
whose sub-labels are either flute counts (`2 FL`, `4FL`) or the literal `TOOL #`,
and every group ends in one `PRICE` column mapping to `p<n>`. Verified on all 80
tables: every coating group has exactly one price column, and it is last.

**5,033 HTML rows -> 12,773 CSV rows.** This is the single most important
structural behaviour of the adapter.

Two flute patterns, and it is a clean binary:

| sub-label            | flutes come from                               |
| -------------------- | ---------------------------------------------- |
| `TOOL #`             | a separate `FLUTES` geometry column on the row |
| `2 FL` / `4FL` / ... | the sub-label itself — per part, not per row   |

Four tables carry both; they agree, and the adapter checks that they do.
Two families (`EndMill-015`, `EndMill-023`, the deburring end mills) publish
`TOOL #` and no `FLUTES` column at all — they state right- and left-hand tooth
counts instead, so those CSVs have no flute column and those families map no
`NOF`.

**One known vendor fault.** Two tables render a flute sub-label as `&nbsp;&nbsp;`
where a sibling coating group labels the same slot correctly — `EndMill-008`
table 2 (`AMORPHOUS DIAMOND COATED` slot 1, siblings say `3 FL`) and
`EndMill-018` table 2 (`AlTiN COATED` slot 1, siblings say `3FL`). The adapter
fills a blank flute label from a sibling group of the same width whose other
labels all agree, and warns; two candidate siblings that disagree is a hard
failure.

### 1.5 CAD is free — no per-part requests

`variantSimFileViewModel` carries the DXF and STEP link for **every variant on
the page**, joined on tool number. There is no CAD annotate step and no extra
request, unlike Kennametal.

`variantStepFileLink` is empty on **all 12,773** variants published across the 52
pages; Harvey publishes DXF only. That is why `CAD_DXF_URL` exists beside
`CAD_STEP_URL` rather than a DXF link being written into the STEP column — see
`conventions.CAD_DXF_COLUMN`. The Widen asset id is opaque and not derivable from
the tool number, which is why the inline list is the only source.

The variant list has exactly 12,773 entries, one per real part. The 26 cart
entries with no DXF are the 26 that are not parts at all — see §3.

The per-part `/products/tool-details-<n>` page adds: a coating code, the profile,
a catalog page number, quantity available, an operations list and a **materials
list**. Everything but the last is already in the table.

### 1.5.1 The materials list — measured 2026-08-29, 192 requests

The one thing on a part page the variant table does not carry, so it is the one
thing worth the requests. The markup:

```html
<div class="option-section">
  <h5 class="h5 subtitle">Materials</h5>
  <div class="option-content">
    <div class="option-list">
      <span class="material-option ">Aluminum</span>
      <span class="material-option active">Steel</span>
      ...
    </div>
  </div>
</div>
```

`active` on the `<span>` is the whole signal. Every page renders **all thirteen**
terms in the same order, so a short list is a parse failure and not a vendor
omission: Aluminum, Non-Ferrous Metal, Cast Iron, Steel, Stainless Steel, Exotic
Metal, Titanium, Plastic, Wood, Composites, Graphite, Hardened Alloys, Green
(unfired). Across 101 sampled parts, `Plastic`, `Graphite` and `Green (unfired)`
were never active on any of them.

An unknown tool number **302s to `/products/all-products?tool-not-found`**, whose
shell has no Materials section at all.

**It is per part, not per family, and the axis is the coating.** This is what
kills the cheap version of the idea — one part page per family, 52 requests,
recorded as a per-family fact. On `harvey_endmill_005.csv` the parts split
cleanly by coating column:

| part     | column                   | rated for                                                                             |
| -------- | ------------------------ | ------------------------------------------------------------------------------------- |
| `750410` | UNCOATED (`s0`)          | Aluminum, Cast Iron, Steel, Stainless Steel, Exotic Metal, Titanium, Wood, Composites |
| `10230`  | AMORPHOUS DIAMOND (`s2`) | Aluminum, Wood, Composites                                                            |

Same geometry line, opposite answers, and the vendor is right: diamond dissolves
into ferrous carbon, so a diamond-coated end mill must not be recommended for
steel. A per-family fact would flatten exactly that.

Two further findings from the same run, both of which refute reading a **page
title** as a material rating:

- `keyseat-cutters---square---for-non-ferrous-materials` — its own part pages
  rate it for **Steel and Stainless Steel** as well as aluminium.
- `keyseat-cutters---square---for-hardened-steels` — its part pages carry **no
  Materials section at all**, and the only four families whose parts are marked
  `Hardened Alloys` are end mills (`EndMill-009`, `-010`, `-021`, `-022`).

51 of 52 families agreed across their first and last part; five-sample runs over
six families found one family varying (the `EndMill-005` split above). So the
data is orderly — it is just keyed per part.

**Reaching it costs 12,773 requests**, one per part, and would land as a CSV
column filled by a separate enrichment step — the shape
`vendors/kennametal/materials.ts` already has for the same kind of data. That is
a decision nobody has taken; until somebody does, `ToolRecord.materialGroups` is
`null` for every Harvey part, which is the record contract's way of saying _no
evidence_ rather than _rated for nothing_.

**Do not crawl the part page for anything else** — the other five fields are
12,799 requests to learn what the header already says.

### 1.6 Dead ends

Each of these was tried first.

- **`robots.txt` — 404.** Returns the site's SPA 404 shell with HTTP 404. There
  is no crawl directive to honour or violate.
- **`sitemap.xml`, `sitemap_index.xml`, `sitemap` — all 404.** No URL index
  exists, so the tree walk is the only discovery path.
- **`/products/all-products`** sounds like a flat index and is not: it lists the
  seven top categories and no products.
- **No XHR endpoint.** No `/api/`, no `/ajax/`, nothing in the page scripts.
  DataTables is initialised from the inline `tableData<N>` arrays — client-side,
  not server-side.
- **No conditional requests.** Cloudflare serves `cache-control: no-cache,
no-store`, `cf-cache-status: DYNAMIC`, and **no `ETag` or `Last-Modified`**, so
  a re-scrape cannot be made cheaper with `If-None-Match`. `vary:
Accept-Encoding` — gzip works, and it is the 13x saving (720 KB -> 55 KB) that
  makes the whole scrape about 3 MB over the wire.
- **`productLink = "93981__CatalogContent"`** in the page suggests an
  Optimizely/EPiServer content id. Not pursued: the inline data is complete, so a
  CMS API would buy nothing.

### 1.7 Request budget

~33 category pages plus 52 product pages, sequential, at the package's shared
`scrape.REQUEST_DELAY_MS` of 400 ms — under two minutes, about 3 MB compressed.
There is no pagination to page and nothing here needs concurrency. Cloudflare
fronts the site, so **raising** request volume is the only real risk.

## 2. The `v` trap — read this before touching a number

`v` is a pre-parsed-looking numeric string and it is **the wrong field.** It
changes unit basis _within a single row_. Measured on
`/products/miniature-end-mills-ball-stub--standard-metric`:

| cell | header             | display `d` | `v`           | `v` is actually |
| ---- | ------------------ | ----------- | ------------- | --------------- |
| `a0` | `D1 +.00/-.02`     | `.500 mm`   | `000000.0197` | **inches**      |
| `a1` | `L2 +.25mm/-.00mm` | `.75`       | `000000.7500` | **mm**          |
| `a3` | `D2`               | `3 mm`      | `000000.1181` | **inches**      |
| `a4` | `L1`               | `38 mm`     | `000001.4961` | **inches**      |

`v` is the inch equivalent where the display carries a unit suffix, and the raw
display number where it does not. Anything reading `v` gets a clean conversion
with wrong numbers in it — precisely the failure `conventions.ts` warns about.

**Parse `d`. Never read `v` for a value**, and do not carry `v` into the CSV
either: it would be a second copy that lies on the metric families.

## 3. Tool numbers, and 26 cells that are not one

A tool-number cell is `<a href="/products/tool-details-14916">14916</a>`, and the
link text is the number.

**26 cells are not a part at all.** Across two families — `EndMill-007` (10) and
`EndMill-019` (16) — a tool-number cell carries the marketing string
`30x Diameter!` or `25x Diameter!`, rendered in red or blue with an inline
`style`, with no link and no CAD model. Harvey's own add-to-cart payload lists
them as though they were orderable, so a shopper adding that row to a cart adds
`30x Diameter!` to it.

The adapter skips a tool-number cell with no `<a href>` and warns. **The link is
the structural difference**, and it is what the rule keys on: matching the text
would catch these two strings and miss the next one. That is also why the family
`rows` counts for those two are 718 and 1,026 rather than the payload's 728 and
1,042.

**62 cells append a footnote marker** to the number — `*` (31), `!` (26), `†`
(5). The marker references a note printed under the table and is not part of the
number. Both forms are already in `atc.j`: `C` is the string as printed, marker
and all, and `T` is the clean number. The adapter checks the cell against `C` and
records `T`, so nothing here strips a marker by guessing at one.

## 4. Value grammar

Measured across all 12,799 parts (digits masked to `9`), most frequent first:

```
9025 '.999'          5692 '9/9'         4410 '9'          3674 '9-9/9'
2579 '(9x)'          2052 '.999 (9/99)' 1899 '9/99'       1187 '(9.9x)'
 915 'I'              791 '(99x)'        698 '.999 (9/9)'  655 '9.999'
 240 ''               224 '99'           205 'II'          194 '.999 (.9 mm)'
 191 '9.9°'           178 '.999 (9 mm)'  167 '99 mm'       166 '9 mm'
 154 '9.99 mm'        123 '(.9x)'        107 '9-9/99'       91 '-'
  88 '.999 (9.9 mm)'   83 '99/99'         76 '99.99 mm'     68 '.9999 (9/99)'
  61 '9°'              50 '99.9°'         42 '9.99'         36 '99°'
  33 '.9999'           33 '.999 (99/99)'  32 '99.99'        28 '.99 mm'
  23 'III'             20 '9/9*'          19 '.9'           13 '(99.9x)'
  11 '.9999 (9 mm)'    11 '.99'            9 '999 mm'        9 'LONG!'
   8 '.9999 (9/9)'      8 '.999 mm'        5 '9-99/99'       4 'LONG'
   4 '.9999 (9.9 mm)'   3 '9/99*'          3 '9.9°(N.P.T.)'  1 '9*'
   1 '.999 (.9mm)'
```

**One rule covers all of it: the value is the leading token, and anything in
parentheses is Harvey's own equivalent annotation.**

- `.1250 (1/8)` -> `0.1250`, annotated with the fraction
- `.1181 (3 mm)` -> `0.1181` in, annotated with the metric equivalent
- `1-1/2` -> `1.5`; `1/16` -> `0.0625`
- `3 mm` -> 3 mm — on a metric family the unit rides the value itself
- `-` -> **null, not 0.** 91 cells, meaning "not applicable"
- `(1.5x)` -> not a dimension at all; the ratio annotation column, §5.3
- `9.5°`, `1.8°(N.P.T.)` -> the tapered families' angle columns
- `I` / `II` / `III` -> the keyseat `TYPE` code — meaning unknown, §6
- `LONG`, `LONG!` -> a badge, and only ever in a white-text column, §5.3

One inconsistency worth knowing about, found reading the scraped CSVs: the
half-degree tapered families publish their angle as `.5` with **no degree
sign**, where every other row on the same page says `5.0°` or `10°`. The sort
string beside it says `0.5°`, so the omission is in the display only. `ANGLE PER
SIDE` is unmapped and kept verbatim, so this reaches the CSV as Harvey wrote it
and touches no record.

This resolves the apparent "imperial pages contain mm cells" alarm: almost all of
those are imperial values carrying a parenthesised metric equivalent.

**46 cells are the real thing, though.** Six imperial families publish a _leading_
metric value in an otherwise imperial column: `Keyseat-006` (`NECK DIA.` 15,
`NECK LENGTH` 15, `CUTTER DIA.` 9), `EndMill-003` (`SHANK DIAMETER` 3),
`EndMill-001` and `EndMill-002` (2 each) — metric-shank or metric-neck tools
listed on an imperial page. The adapter converts such a value into the family's
declared unit and warns each time, naming the part. A parenthesised marker is an
annotation and never triggers that.

## 5. Header lexicon

50 distinct header shapes across 52 pages, and one small vocabulary behind them,
because **every dimension's sub-label carries Harvey's own ISO-ish symbol**.

### 5.1 Geometry labels

| Harvey top label (all spellings observed)             | symbol     | canonical           |
| ----------------------------------------------------- | ---------- | ------------------- |
| `CUTTER DIA.`, `CUTTER DIAMETER`                      | `D1`       | `DC`                |
| `LOC`, `LENGTH OF CUT`, `CUTTER WIDTH`                | `L2`       | `LCF`               |
| `SHANK DIA.`, `SHANK DIAMETER` (one page adds `(h6)`) | `D2`       | `SFDM`              |
| `OAL`, `OVERALL LENGTH`                               | `L1`       | `OAL`               |
| `CORNER RADIUS`, `RADIUS`                             | `R`        | `RE`                |
| `NECK DIA.`                                           | —          | `shoulder-diameter` |
| `NECK LENGTH`, `OVERALL REACH`                        | `L3`, `L4` | `shoulder-length`   |
| `FLUTES`                                              | `#`        | `NOF`               |

`CUTTER WIDTH` is what the keyseat families call the length of cut; `OVERALL
REACH` carries `L4` rather than `L3` on the two tapered-reach families.

Labels kept verbatim and mapped to nothing, because nothing available says what
they measure or they are not a canonical field:

| label                                           | holds                      |
| ----------------------------------------------- | -------------------------- |
| `RADIAL DOC*`, `Radial DOC*`, `Radial DOC**`    | a length, inches           |
| `TYPE`                                          | `I` / `II` / `III`, see §6 |
| `ANGLE PER SIDE` (`A1`)                         | degrees                    |
| `EFFECTIVE WALL ANGLE*`, `EFF WALL ANGLE`       | degrees                    |
| `Interference Depth At Wall Angle*` (`0°`…`4°`) | six lengths, inches        |
| `RIGHT HAND TEETH`, `LEFT HAND TEETH`           | counts                     |

Sub-labels observed that carry no information at all and are ignored: `.`, `"`,
`X`, `&nbsp;`, empty.

`records.REQUIRED_GEOMETRY.endmill` is `DC`, `SFDM`, `OAL`, `LCF` — all four are
present on every one of the 80 tables. No family fails the required check.

### 5.2 Coating vocabulary — 8 values, complete

```
UNCOATED · AlTiN COATED · AMORPHOUS DIAMOND COATED · AlTiN NANO COATED
Ti NANO COATED · TiB2 COATED · BALL END UNCOATED · AlTiN NANO BALL END COATED
```

### 5.3 The ratio column, and the white-text column

Most tables carry an extra `a`-column holding `(1.5x)`, `(3x)`, `(0.8x)` — the
vendor's own reach- or length-to-diameter ratio. It is not a dimension. Two
shapes:

- **A repeat of the previous column's top label**, taking the second slot of a
  `colspan="2"` header with a junk sub-label. 66 columns.
- **A column of its own with `.` as its top label and `white-text` on its
  `<th>`.** 9 columns across 5 families. Five hold ratios, two hold the badge
  text `LONG`/`LONG!`, and two are entirely empty.

Both are written to the CSV under the column they follow, unmapped, with a
suffix saying what they hold: `RATIO` where every cell on the page is a `(Nx)`
annotation, and `NOTE` otherwise. The second case is four columns on two
families: two carry the badge `LONG` on a handful of rows and two are entirely
empty, so calling them `RATIO` would be a claim about their contents that is
false. Which suffix a column gets is therefore decided from the whole page's
data rather than from its header — the tables merge into one CSV and a column
cannot be named two things.

Naming these for the column they annotate is the only honest option available:
Harvey gives them no label, and leaving them out would drop a published column.

A column whose top label repeats and whose sub-labels are distinct and meaningful
is **not** this — `Interference Depth At Wall Angle*` is six real columns, and it
is written as `Interference Depth At Wall Angle* 0°` and so on.

## 6. Open question for Harvey

`TYPE` yields `I`, `II` and `III`, and nothing on the site states what they mean.
It stays under Harvey's own label with **no guessed mapping**, and is on the list
to ask about. Record the answer and its date when it arrives.

## 7. What the CSV holds

`Tool #` is the identity column and the guid seed. Harvey publishes exactly one
number per part and no second catalog designation, which is why
`conventions.IDENTITY_DEVIATIONS.harvey` is `['Tool #']` rather than an invented
`ISO Catalog Number`.

| Column                          | Source                                              |
| ------------------------------- | --------------------------------------------------- |
| `Tool #`                        | the `s*` cell's link text, footnote marker removed  |
| `Description`                   | the page's own `productTitle`                       |
| `Coating`                       | the coating group's top header label                |
| `FLUTES`                        | the group sub-label, else the row's `FLUTES` column |
| `CUTTER DIA._in`, `LOC_in`, ... | `a*` cells; the suffix comes from the family `unit` |
| `RADIAL DOC*`, `TYPE`, ...      | Harvey's own label, unmapped, verbatim              |
| `PRICE_USD`                     | the `p*` cell of that part's coating group          |
| `CAD_STEP_URL`, `CAD_DXF_URL`   | `variantSimFileViewModel`, joined on tool number    |

**Cells are the vendor's own display strings, not parsed numbers** — `.250 (1/4)`
reaches the CSV as `.250 (1/4)`, and `vendors/harvey/value.ts` is what resolves it
when a record is built. The CSV is the receipt; keeping Harvey's own fractional
and metric annotations costs nothing and loses nothing.

**Three columns are synthesised rather than lifted**, and each is a fact encoded
in a column's _position_ with no cell to copy: `Coating` always, `FLUTES` on the
matrix tables, and the `... RATIO` / `... NOTE` names in §5.3. `Description` is
lifted from the page rather than the row, because Harvey states it once per page.

`FLUTES` is **one** column whichever way the table encoded it, so the vendor's
own `FLUTES` column is taken out of the geometry list rather than written a
second time under the same name.

**Tolerances are dropped.** They are parsed out of the sub-label to find the
symbol and then discarded; that is what makes the two-table split invisible and
lets both tables merge into one CSV.

**Price is a CSV column and not a `ToolRecord` field.** Adding one would be a
cross-package contract change for one vendor's data. A price cell is per coating
group, so the two parts of a `2FL`/`4FL` group share one — that is Harvey's own
table shape, not a join error.

## 8. The strongest sensor is free

Each row's `atc.j` independently lists every tool number on that row, in the same
order as the non-empty `s*` cells:

```json
[
  { "T": "690508", "C": "690508", "Q": "1" },
  { "T": "679608", "C": "679608", "Q": "1" }
]
```

So the matrix explosion is checked against Harvey's own list **5,033 times per
scrape** rather than once against a hand count, and a coating/flute misalignment
cannot pass. The check is against `C`, the string as printed, so a footnote
marker is part of what is compared rather than something stripped first; the row
records `T`. `Q` is `"1"` on all 12,799 entries and is not read.
