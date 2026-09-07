# MariTool's catalog, and how to read it

What `vendors/maritool/scrape.ts` fetches, why it fetches it that way, and the
dead ends that were tried first. Measured against `www.maritool.com` on
2026-08-29; every claim below is re-checkable with one `curl`.

This is the fifth vendor in the package and the only one whose transport needed
no discovery at all. That makes the expensive part of this note the second half:
**what MariTool's own labels mean, and where the site's shape will mislead a
crawler.**

---

## 1. The transport, and the dead ends

An **osCommerce-family storefront** with SEO-rewritten URLs — `shopping_cart.php`,
`advanced_search_result.php`, a `cPath` category parameter. Everything is
server-rendered HTML and the entire transport is a paced `GET`.

What is **not** there, each checked:

| Tried | Result |
| ----- | ------ |
| A JSON or GraphQL API | None. No XHR on any page returns product data. |
| `/sitemap.xml` | 200, but a meta-refresh shell rather than a document. |
| An application bundle to read | None. There is no SPA; the store renders on the server. |
| A flat product index | None. Products exist only under a leaf category. |

`robots.txt` disallows `/admin/`, `/download/`, `/includes/`, `/temp/`,
`/debug/`, `/tmp/`, `/pub/`, `/templates/`, `/urchin/`, `/ext/`, `/font/` and
`/install/`. **Nothing under a tool-holder category or `product_info` is
disallowed.** No rate limiting was observed at 1 req/s.

### 1.1 Three URL forms reach the same page

| Form | Example |
| ---- | ------- |
| Store id | `/product_info.php?products_id=100` |
| SEO product | `/p100/<any-slug>/product_info.html` — **the slug is ignored** |
| Search | `/advanced_search_result.php?keywords=CAT40-ER16-3.0` |

The third is what `identity.BRANDS.maritool.productLink` uses: the first two are
keyed on the store's internal id, and that id is the one thing about a MariTool
part that is not stable.

Categories are the same: `/<Slug>/c23_25_42/index.html` and
`/index.php?cPath=23_25_42` are one page. The adapter uses the second, because
it is the only one derivable from a cPath without inventing a slug —
`/c23_25_42/index.html` with no slug at all is a 404.

### 1.2 What is on the listing page and what is not

Every listing row carries, without visiting the product page:

| Datum | Markup |
| ----- | ------ |
| Store id | the `p<id>` segment of the product link |
| Product URL | the `product_info.html` link |
| Name | the link's text — `CAT40 ER16 3.0 COLLET CHUCK TOOL HOLDER` |
| **Part number** | `<p>Part#: CAT40-ER16-3.0</p>` |
| Brand | `<p>Brand: MariTool</p>` |
| Price | `<h3>$125.70</h3>` |
| Stock | `In Stock` / `Ships Same Day` |
| CAD | `<a class="asset-code">` per format, to `cloudfront.net` |

**Every row carries a `Part#` line** — 1,158 of 1,158 checked. It is the only
universal identifier, and it is the identity this package uses.

**The geometry is not there.** It is a `Product Specifications` table on the
product page, which is what makes this one request per part.

### 1.3 The lead not taken: `var pdata`

23 of the 41 in-scope leaves inline a `var pdata = {…}` object in a `<script>`,
keyed by `products_id`, carrying **the whole leaf's spec values** — the same
cells, byte for byte, as each part's own `Product Specifications` table. A
sibling `var adata` maps each key to the label the table prints. It feeds the
page's product-selector widget, it is served identically on every page of a
paged leaf, and where it exists it makes the per-part request unnecessary.

It is **not** used, and the reason is that it does not exist on the other 18
leaves — including every CAT50 leaf and 9 of the 15 HSK ones. Reading geometry
from one source on some parts and another on the rest would make a single CSV's
provenance non-uniform for a saving of about four minutes on a scrape that is
run by hand. It is recorded here because it is the obvious optimisation and
somebody will find it again.

---

## 2. The category tree

Tool holders live under `c23`. The five roots in scope:

| Taper | cPath |
| ----- | ----- |
| CAT40 | `c23_25` |
| CAT50 | `c23_24` |
| BT30 | `c23_33` |
| BT40 | `c23_26` |
| HSK | `c23_46` |

Walking those five reaches **199 categories, 165 of them leaves, 1,260
products**. `toolpath-scrape maritool --catalog` is that walk.

Four things about the tree, and a crawler gets each of them wrong by default:

- **It is two to four levels deep and no root carries products itself.**
  `Dual Contact CAT40` (`c23_25_432`) and each of the nine HSK sizes are
  intermediate nodes with children. **A crawl that stops at depth 2 finds zero
  HSK holders and zero dual-contact parts** — 187 of the 529 parts in scope.
- **A page links every sibling of every ancestor**, because the sidebar renders
  the whole open branch. Taking every `cPath` link on a page walks the entire
  catalog from any starting point. A child is a link whose cPath extends the
  current one by exactly one segment; that prefix test is the whole of the
  recursion's correctness.
- **There is no CAT30.** MariTool's 30-taper is BT30 and ISO30. Confirmed
  against the full sidebar rather than a landing page.
- **A dual-contact part is a distinct part, not a re-listing.** `c23_25_42`
  (CAT40 ER) and `c23_25_432_433` (dual-contact CAT40 ER) share **zero**
  `products_id`, so both leaves are scraped into the CAT40 CSV.

A product can appear under two leaves — 5 of 1,151 ids catalog-wide, and **none
within the 41 leaves in scope**. The scraper dedupes by `products_id` anyway,
because that is a fact about the store rather than about today's catalog.

### 2.1 Three in-scope leaves are named `Collet Chucks`, and all three are ER

`c23_24_45` (CAT50 ER32), `c23_24_429_430` (dual-contact CAT50 ER32) and
`c23_46_1811_1812` (HSK63F ER20), verified from the part numbers on each page.

**This is why the leaf list is config and not a name filter.** A rule matching
`ER Collet Chucks` drops all three silently, and a CSV that is quietly missing
three parts looks exactly like a CSV that is complete.

### 2.2 What is in scope, and what is not

**Three holder styles: ER collet chucks, shrink fit, hydraulic.** 529 parts in
41 leaves:

| CSV | ER | shrink | hydraulic | parts | leaves |
| --- | ---: | ---: | ---: | ---: | ---: |
| `maritool_cat40_holders.csv` | 97 | 86 | 34 | **217** | 6 |
| `maritool_bt30_holders.csv` | 78 | 50 | 36 | **164** | 8 |
| `maritool_hsk_holders.csv` | 19 | 42 | 9 | **70** | 15 |
| `maritool_bt40_holders.csv` | 39 | 20 | 8 | **67** | 6 |
| `maritool_cat50_holders.csv` | 3 | 2 | 6 | **11** | 6 |
| | 236 | 200 | 93 | **529** | 41 |

Out of scope, and each is a decision rather than an omission: Mega Grip, SK, TG,
end mill holders, shell mills, slitting-saw and hob arbors, threaded-body and
DSF/MCS modulars, drill chucks, floating tap holders, boring-head adapters,
calibration/ATC tooling and coolant tubes — 731 further parts under `c23`.

**BT50 and ISO30 produce no CSV.** MariTool's only BT50 category is end mill
holders. ISO30 has three ER parts and none of them publishes a spec table, so
the family would be a receipt of nothing.

### 2.3 The taps, and how they classify themselves

Not scraped. Recorded here because MariTool's tree already answers the question
`ToolRecord.threadMethod` exists for, and because the answer wants writing down
while somebody has read the pages.

Under `c78_148` (`Cutting Tools / Taps`), read 2026-09-07:

| Leaf | cPath | Method |
| --- | --- | --- |
| Thread Forming Taps | `78_148_274` | `forming` |
| — Plug Form Tap | `78_148_274_275` | `forming` |
| — Bottoming Form Tap | `78_148_274_276` | `forming` |
| Spiral Flute Taps | `78_148_149` | `cutting` |
| — Spiral Flute Plug Taps, Spiral Flute Bottoming | | `cutting` |
| Spiral Point Taps | `78_148_224` | `cutting` |
| Taps for Aluminum | `78_148_271` | `cutting` |
| — Sprial Point Plug Taps *(the vendor's typo)*, Spiral Flute Semi Bottoming | | `cutting` |
| Taper Pipe Taps | `78_148_283` | `cutting` |
| DIN Length HPT Taps | `78_148_284` | `cutting` |
| — Plug Style DIN Taps, Bottoming Style DIN Taps | | `cutting` |

**Only the forming branch carries the word**, in the leaf name and in every
product title under it — `Plug Style Thread Forming Tap Bright Finish 10-24 H4`.
So `form`/`forming` in the name is the rule, applied when the table is built and
checked into it, never run as a filter at scrape time. §2.2 already gives the
reason: three ER leaves are named `Collet Chucks` rather than `ER Collet Chucks`
and a name match would drop all three silently.

**What a tap family still needs decided.** A product page publishes enough for a
record — `Shank Size` → `SFDM`, `Total Length` → `OAL`, `Thread Length` → `LCF`,
`Size` + `Pitch Diameter` → a designation `thread.ts` already parses, and no
`DC`, which is the Kennametal case. What it also does is state a **metric thread
on an inch body**:

```
Size: M3            Pitch Diameter: 0.5      # millimetres
Shank Size: 0.141   Total Length: 1 15/16    # inches
Thread Limit: D5    Finish: TiN
```

`Pitch Diameter` is the vendor's label for what is a pitch on a metric tap and a
thread count on an inch one (`Size: 10`, `Pitch Diameter: 24`). No family in
this package is mixed that way and `ToolRecord.unit` is one value per record, so
this is its own decision — and it is the hazard
`tool-support/src/geometry.ts`'s `TP` docstring already records rather than
resolves.

### 2.4 The roster count

`Displaying 1 to 30 (of 51 products)`, and `Result Pages` paging on `page=N`.
30 products per page; the 41 leaves in scope need **47 listing pages**.

**`(of N products)` is the vendor's own second opinion on the row total**, and
the scraper refuses a leaf whose paging does not reach it. It is the check
REGO-FIX gets free from `hits.total`, and it matters for the reason
`family.rows` exists: every other count is computed from the same rows it is
checking, so a roster that stopped a page early agrees with itself.

---

## 3. The product page

A `Product Specifications` name/value table under its own
`<div class="header">`. Fifteen labels across the catalog, and **which ones
appear is a function of the holder's style** — a shrink-fit holder states
`Shank Size` and `Nose Diameter`, a collet chuck states `Collet Size` and
`Collet Grip Range`, a hydraulic chuck states `Hydraulic Type`. The CSV header
is their union in first-seen order.

Coverage across 473 in-scope parts:

| Label | Coverage | Label | Coverage |
| ----- | -------: | ----- | -------: |
| Gage Length | 100% | Collet Size | 46% |
| Material | 100% | Finish | 46% |
| Balance Spec | 100% | Nose Diameter | 28% |
| Taper | ~100% | Hydraulic Type | 18% |
| Concentricity | 92% | Weight | — |
| Rear Thread | 89% | Collet Nut | — |
| Shank Size | 54% | | |
| Coolant Thru | 54% | | |
| Collet Grip Range | 46% | | |

**A row with an empty value is not rendered at all**, so a label's absence and a
label's blank are the same state on this site.

### 3.1 The part number, restated

The product page repeats the part number in its
`Available Downloads for CAT40-ER16-3.0` header, on roughly three parts in four
— the rest publish no assets and carry no header. It is a **cross-check**: the
scraper warns on a disagreement and never corrects one, the same call REGO-FIX's
`J21` got. Two disagreeing vendor cells cannot say which one is wrong.

### 3.2 Two parts publish no table at all

`CAT50-ER32-3.0` and `CAT50-ER32-4.0`, both in `c23_24_45`. They state their
geometry as English prose in a `Product Info` bullet list — *"Gage length is
100mm (3.93 inch)"*.

**That prose is not parsed.** A regex over a sentence is this package authoring
tool data by hand, and the sentence is also where the vendor's own conversion is
wrong (§4.2). The two parts are skipped with a named warning, and
`maritool_cat50_holders.csv` declares `rows: 9` against the vendor's 11 so the
gap is a number somebody wrote down rather than a silence.

---

## 4. What the labels mean

### 4.1 `Taper` carries the contact form

Seventeen distinct strings, in two casings of the dual-contact suffix:
`CAT40`, `CAT40 DUAL CONTACT`, `CAT50`, `CAT50 DUAL CONTACT`,
`CAT50 Dual Contact`, `BT30`, `BT30 DUAL CONTACT`, `BT40`,
`BT40 DUAL CONTACT`, `HSK25E`, `HSK40E`, `HSK50A`, `HSK50E`, `HSK63A`,
`HSK63F`, `HSK80F`, `HSK100A`.

`TAPER_FORMS` is a closed table over those, upper-cased, and an unlisted value
throws. **Both `taper` and `contact` are columns rather than family facts**: the
vendor states the interface per part, so a family constant would mask a scrape
that lost the column — and the HSK family holds nine sizes in one CSV, where a
constant is not even expressible.

`contact` is `face` on every HSK size, and **MariTool does not say so**. It is
the interface's definition rather than a property of the part: an HSK shank
seats on the flange face at the same time as the cone, which is what
DIN 69893 / ISO 12164 specify, and the `A`/`E`/`F` forms vary the flange rather
than the contact. MariTool marks `DUAL CONTACT` only on its 7/24 tapers, where
it is an option and there is a single-contact form to distinguish it from.

### 4.2 `Gage Length` holds two unit systems, per cell

The cell is metric on some parts and imperial on others **inside one CSV and
inside one category page**:

- `c23_46_1552_1558` — `HSK40E-ER11-40` gages **`40mm`**, `HSK40E-ER16-3.0M`
  gages **`3.0`** inches.
- `c23_46_1552_1553` — `HSK40E-SF.125-45` gages **`45mm`**,
  `HSK40E-SF.125-2.5` gages **`2.5`** inches.

Three further facts about it:

- **The part number does not encode the unit.** `…-ER11-40` is millimetres and
  `…-ER16-3.0M` is inches — that `M` is *Mini Nut*, and MariTool puts exactly
  that designation in a `Collet Nut` cell elsewhere. Only the `mm` in the spec
  cell says which.
- **One row can hold both systems.** `HSK40E-SF.125-45` gages `45mm` and states
  `Shank Size: .125` inches. A per-row unit would be as wrong as a per-family
  one.
- **The vendor's own conversion is unusable.** The spec table gives the metric
  value; the prose bullet says *"Gage length is 40mm (1.6 inches)"* where the
  figure is 1.5748, and *"45mm (1.7 inches)"* where it is 1.7717 — 0.028 out.
  Compute a conversion or leave the other cell empty; never read theirs.

So **no MariTool family declares a `unit`**, the scraper promotes the gage
length into an `L1_in`/`L1_mm` pair with exactly one cell filled, and it
converts nothing. Every other measured cell stays verbatim under MariTool's own
unsuffixed label, because `conventions.dimensionalColumn` takes its suffix from
a family's declared `unit` and these families have none to give it.

The cell has five shapes, and a pattern that reads three of them silently
mangles the rest: `3.0`, `40mm`, `3.5"` (as `&quot;`, sometimes with a trailing
space), `7.8 Inches`, `120mm Tapered`. **A bare number is inches** — MariTool
marks every metric cell and marks nothing on an imperial one.

The nose form — `Tapered`, `Slim`, `Slim Nose`, `Slim Tapered` — is parsed off
the number and **gets no column**. It is not lost: the vendor states it in the
product name on every part that has one (*"BT40 ER11 120mm Tapered Nose Collet
Chuck Tool Holder"*), and the row carries that name verbatim in `Description`.
The raw cell stays in the CSV too.

### 4.3 `Collet Grip Range` is not holder data

MariTool prints it on an ER chuck's page, but it is **the ER series' range
restated** — a pure function of `Collet Size` with no holder-to-holder
variation:

| `Collet Size` | `Collet Grip Range` |
| ------------- | ------------------- |
| ER11 | `.020-.276 inches` |
| ER16 | `.020-.4375 inches` |
| ER20 | `.024-.5625 inches` |
| ER32 | `.024-.875 inches` |

It is recorded and never read. **It is never promoted to `CCCN`/`CCCX`**: that
would make the holder claim a clamping capacity of its own, which is exactly
what the deliberately absent `D1` on `regofix.holderRow` prevents. A real range
comes from a collet family joined on the series. MariTool's ER collets are at
`Collets-And-Sleeves/c21_56`, outside the `c23` tree and out of this scope;
until a MariTool collet family exists, a MariTool holder joins to Kennametal's
or REGO-FIX's on series alone.

### 4.4 `Collet Size` needs normalising, and one value is wrong

MariTool's spacing is inconsistent within a single style — `ER 11` and `ER11`
are both published — so `colletSeries` closes the space before writing `CST`,
the key the other two toolholding vendors already join on. Two spellings of one
series join to nothing.

**`ER25M` is a collet nut designation in a `Collet Size` cell**, on
`CAT40-ER25-3.0MD` and `BT30-ER25-60M`. There is no ER25M collet series;
`HSK40E-ER16-3.0M` puts a value of exactly that shape in its own `Collet Nut`
cell, which is the column it belongs in, and 57 parts carry `ER11M`, `ER16M`,
`ER20M` or `ER25M` there beside a `Collet Size` of the plain series.

**`ER25M` is the mini collet nut series, and the collet a mini nut closes is a
plain ER25** (JG 2026-09-02). `colletSeries` therefore resolves the cell, and
the two parts join to the ER25 collets they fit. Until that answer existed the
string was written into `CST` as designated — joining to no collet — and warned
about, because widening a series on a guess offers a machinist a collet that may
not seat, which costs a purchase, where leaving it costs an option.

The vendor's own `Collet Size` cell is untouched and still says `ER25M`, so the
CSV still records which of the two parts carries a mini nut. `CST` is a derived
join key rather than a record of what the vendor published — the same thing the
spacing rule does to it — and `HolderRecord.colletSeries` is that key. **A
consumer that needs the nut variant reads `Collet Size`**; nothing on the record
carries it, under the standing rule that a field arrives when something displays
it.

### 4.5 `Hydraulic Type` is not a constant

`HC`, `RHC` and `SHC`, across 83 hydraulic chucks. It stays a column. This is
worth stating because it looked like a family fact on a small sample — 14 of 14
sampled parts said `HC` — and the full catalog is what settled it.

---

## 5. What the vendor gets wrong

Four faults. Three are reported as warnings and left uncorrected; the fourth was
resolved by asking, which is what `docs/ADDING-A-VENDOR.md` says to do with a
vendor label nobody can pin down.

1. **`BT40-ER32-60` publishes no `Taper` row**, alone among the 529 parts in
   scope. Its row is kept with `taper` and `contact` empty. The hole is what
   the vendor published.
2. **`ER25M` in a `Collet Size` cell**, on two parts — §4.4. The one that is
   resolved rather than reported: `M` is the mini nut, the collet is a plain
   ER25, and `CST` names the collet.
3. **A product slug can hold a `/`.** MariTool builds the slug from the product
   name and does not escape it, so
   `.../p29006/CAT50-3/4-TAPERED-NOSE-SHRINK-FIT-TOOL-HOLDER-.750-5.0/product_info.html`
   is a real URL. A pattern requiring one path segment between the id and the
   filename matches neither CAT50 shrink-fit holder.
4. **A CAD asset URL can hold a space** — `.../2d50dfa4_CAT50 ER32-3.0.STEP`.
   It is carried verbatim, because the CSV records what the vendor published;
   a consumer fetching one has to encode it.

---

## 6. What is not carried

- **Price.** The listing publishes it and the scrape passes over it, the same
  call Harvey's `PRICE_USD` got: a price in a checked-in receipt goes stale
  silently.
- **Stock.** Same reason, and faster-moving.
- **The DWG and PDF downloads.** `conventions` names two CAD columns — a STEP
  model and a 2D DXF profile — and inventing a third and fourth for one
  vendor's drawing formats is the mistake the `CAD_STP_LWM` rename fixed. The
  STEP and DXF links are carried; the other two are not.
- **`products_id` as identity.** It is carried as an ordinary column, because
  it is what a re-fetch of one part is addressed by. It is not identity: a
  re-created product changes it, and every guid minted off it with it.

---

## 7. The scrape

```
toolpath-scrape maritool maritool_cat40_holders.csv
toolpath-scrape maritool --catalog
```

| Scope | Leaves | Parts | Listing pages | Requests | At `REQUEST_DELAY_MS` |
| ----- | -----: | ----: | ------------: | -------: | --------------------: |
| **The five families** | 41 | 529 | 47 | **576** | ~4 min |
| Every holder style under `c23` | 143 | 1,199 | 152 | 1,351 | ~9 min |
| Everything under `c23` | 165 | 1,270 | 174 | 1,444 | ~10 min |
| `--catalog` (no products) | — | — | — | 199 | ~1.5 min |
