# REGO-FIX ProductFinder API

How to pull the REGO-FIX product roster and per-part geometry without a
browser. Verified JG 2026-08-07 against `us.rego-fix.com` (powRgrip
toolholders and collets).

This is the REGO-FIX counterpart to `KENNAMETAL_SPEEDFEED_API.md` /
`KENNAMETAL_CAD_API.md`, and **nothing about it transfers from Kennametal**.
Different CMS, different transport, different identity fields, and — the part
that matters most — the geometry does not come from the same request as the
roster.

## The search proxy

`us.rego-fix.com` is Drupal. Product family pages
(`/en/products/toolholders/btpg?system=powRgrip`) are marketing pages and
carry **no variant table at all** — no inline JSON, no server-rendered
`<table>`, and the Drupal node behind an individual part redirects to
`/products`. Reading those pages is a dead end; the first pass here spent a
while confirming it.

What does exist is `/en/productfinder`, a React app built on Searchkit. Its
bundle constructs

```js
new SearchkitManager(window.location.origin + '/' + lang,
                     { searchUrlPath: '/elastic/post', timeout: 0 })
```

so every query is a plain POST of Elasticsearch query DSL:

```bash
curl -s -A 'Mozilla/5.0' -H 'Content-Type: application/json' \
  -X POST 'https://us.rego-fix.com/en/elastic/post' \
  -d '{"size":500,"query":{"bool":{"filter":[
        {"term":{"system_name":"powRgrip"}},
        {"term":{"product_group_name":"BT/PG"}}]}}}'
```

- No auth, no cookie, no CSRF token, no rate limiting seen.
- The index is `elasticsearch_index_main_products`: **4142 products** across
  every system, so one request returns any group whole. There is nothing to
  page, which is why `scrape_regofix.search` treats `hits.total > size` as an
  error rather than fetching more — a truncated roster is the failure this
  package exists to notice.
- `{"query":{"match_all":{}}}` returns **500**. A `bool`/`term` query works,
  and so does omitting `query` entirely. Not diagnosed; use a filter.
- `aggs` work, which is how the group vocabulary below was enumerated.

### The fields worth knowing

Every value is a **list**, even where there is exactly one — hence
`scrape_regofix.one`.

| field | what it is |
|---|---|
| `field_sku_fulltext` | the orderable part number, `2130.72530` |
| `field_sku_ngram` | the same with the dot removed — also the CAD filename |
| `title` | the vendor's designation, `BT 30 / PG 25 x 075`, `PG 25 Ø 1/4"` |
| `type` | `toolholders` \| `collets` \| `accessories` \| … |
| `system_name` | `powRgrip` \| `ER` \| `uniTec` \| `micRun` \| `Measuring` |
| `product_category_name` / `product_group_name` | the vendor's own taxonomy — where every `style` value in `families/regofix.py` comes from |
| `norm_size` | the collet series number, `25` for both `PG 25` and `PGST 25` |
| `form_name` | `Standard` \| `Plus +` — the **dual-contact discriminant** |
| `lpr_mm` | projection length; equals the DIN `B3` below |
| `o_mm` / `o_inch` | a collet's nominal size — **see the warning below** |
| `field_technical_drawings_url` | protocol-relative CDN links: DXF, PDF, STEP, DIN 4000 XML |

**`o_mm` is rounded to two decimals and is wrong on two parts.** It gives
3.18 for a 1/8 in collet where the part is 3.175 — five microns, against the
two-micron tolerance a downstream fit test sizes its equality check to, so
reading it would have made every inch collet fail to match a shank of its own
size. On `1715.08215` and `1725.08215` it repeats the previous row's
value outright. The size is therefore parsed from `title`, which states the
vendor's designation exactly and says which unit system it is in; `o_mm` is
carried as a cross-check column and warned about when it disagrees by more
than half a unit in its last printed place.

## The geometry: per-part DIN 4000 XML

The index carries no dimensions beyond `lpr_mm`. Geometry is a second fetch,
one file per part, linked from `field_technical_drawings_url`:

```
https://static.rego-fix.com/sites/default/files/products/XML_DIN4000/XML/<sku without dot>.xml
```

Public, no auth. Sibling directories under `products/` hold `DXF_ISO13399/DXF`,
`DXF_ISO13399/PDF` and `STP_DIN4003/STP` — the STEP models the holder-profile
runbook needs. (Collet drawings are different: they live under
`file_dimension_sheet_pdf`/`_dxf` as `private://` paths and 404 unauthenticated.)

The document is DIN 4000-89 property codes:

```xml
<Property-Data>
  <PropertyName source="din_mk">B4</PropertyName><Value>123.4</Value>
</Property-Data>
```

**Three codes are pinned to a meaning and the rest are not.** DIN 4000 is a
paid standard and the file itself is a bare code/value list, so this is
exactly the runbook's "when a vendor label is unclear, ask" case. What pins
the three is REGO-FIX's own published tables:

| code | meaning | corroboration |
|---|---|---|
| `B3` | projection from the flange face | the `L` column of the BT/PG table in `RFTC_PG_Catalog121916`, row for row |
| `B4` | gage length | `B4 - B3 == 48.4` on all 24 documents, and 48.4 mm is BT 30's gauge-line-to-flange distance in the vendor's own `BT MAS 403` table (`BT 30 \| 31.75 \| 46 \| 2 \| 48.4 \| 20 \| M 12`) |
| `A1` | diameter at the collet end | the `D` column of that same BT/PG table, row for row |

`A4` is 46 on every BT 30 part — the flange diameter, a property of the taper
— so it is asserted rather than stored. `A2`, `B1`, `B2` and `B3_WOA` are
carried into the CSV under their raw codes with a `DIN_` prefix and are **not**
promoted onto a record: nothing available says what they measure. If you get
hold of DIN 4000-89 or a REGO-FIX ISO 13399 mapping, that is the file to
update.

Not every part has one. Two BT+ 30 holders publish DXF and PDF but no XML, so
they have no gage length and are skipped with a message rather than written
with holes.

**The vendor's own metadata is unreliable in two places.** `J21` states the
part's number and is wrong on `4130.70646` (it says `4130.71646`). `J22`
labels several plain BT 30 holders "PG-SG secuRgrip Werkzeughalter". Neither
is read; the first is warned about.

## Enumerating what exists

```bash
curl -s -A 'Mozilla/5.0' -H 'Content-Type: application/json' \
  -X POST 'https://us.rego-fix.com/en/elastic/post' -d '{"size":0,"aggs":{
     "grp":{"terms":{"field":"product_group_name","size":200}},
     "cat":{"terms":{"field":"product_category_name","size":50}}}}'
```

Add a `query` to scope it. This is how the twelve powRgrip collet groups and
their categories were found, and re-running it is how to check whether the
vendor has added one — a new group is a new `style`, and it needs a label
before it reaches the UI.

## What is deliberately not scraped

- **`BT-OM 30`** (3 parts, same product group as BT 30). The family page, the
  product catalog and the index all print the token and none says what OM
  designates. Recording a spindle interface for it would be a guess about
  which machine a holder fits.
- **PG 32 and PG 48 collets.** No BT 30 holder takes them.
- **Every non-BT taper** — HSK, SK, CAT, CAPTO, CYL, HJNZ, MTSK, ISO 20, WTO.
  The powRgrip toolholder roster is 621 parts; this repo's shop runs BT30.
- **secuRgrip and toolVibe BT holders.** `BT/PG-SG secuRgrip` is BT 40/50
  only, and the one BT+ 30 toolVibe holder publishes no DIN 4000 document.
