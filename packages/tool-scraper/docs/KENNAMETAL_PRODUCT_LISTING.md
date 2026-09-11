# Kennametal product listing — finding a family code

How `src/vendors/kennametal/catalog.ts` learns what a category holds. Written 2026-09-08.

`src/vendors/kennametal/scrape.ts` fetches a family once its **code** is known. This is the
other half: where a code comes from. Before this, the answer was "open a category page in a
browser and read it out of a link", which is why every holder and collet family in
`families/kennametal.ts` carried a hand-counted row total and no `familyCode` at all.

Extended to the six holder interfaces 2026-09-09.

## 1. The category page renders nothing

`https://www.kennametal.com/us/en/products/metalworking-tools/tool-holders-and-adapters/collets-and-sleeves.html?query=…`
returns 320 KB of facet chrome with no products in it. The grid is fetched client-side.

## 2. The component behind it

Search the page for `product_listing` and it names its own component path in `data-path`. The
request shape is in the page's own `product-listing.min.js`:

```js
url: a + '.' + c + '.html?' + h + 'query=' + d + '&sort=' + e + '&pageSize=' + f
```

`a` is the component path, `c` is a page index, `d` is the facet string. So:

```
https://www.kennametal.com/us/en/products/<CATEGORY PATH>/_jcr_content/root/
  responsivegrid/product_listing.<PAGE>.html?query=<URL-ENCODED FACETS>&sort=&pageSize=<N>
```

Four things that cost time:

- **Use the public `/us/en/...` path.** The authoring path the markup's own `data-path` shows —
  `/content/kennametal/us/en/...` — answers `307`.
- **The selector must be numeric.** `.results.`, `.products.` and `.search.` all return the
  site's 404 page with a 404 status. A wrong guess fails rather than parsing to nothing.
- **`pageSize` counts families, not parts.** At `pageSize=2` the seven-family coolant-through
  leaf pages two families at a time. `data-totalResults` on the response counts *parts*, so the
  two cannot be divided into a page budget — the walk pages until a page adds nothing new.
- **A `+` in a facet value would be eaten.** The query goes through `encodeURIComponent`; the
  colons in `:relevance:obsoleteFacet:false` are data, not path separators.

## 3. Two response shapes

A **category above the leaves** returns subcategory tiles and no families:

```html
<a class="horizontal-facet" data-query="<PARENT>:allCategoriesKMT:109337186">
  <span class="count">(117)</span>
  <div class="category-tile-title" data-title="ER Standard Collets • Metric">
```

A **leaf** returns family links and no tiles:

```html
<a href="/us/en/products/fam.er-standard-collets-metric.100000478.html?pdpQuery=…">
```

`100000478` is the code `scrapeFamily` takes. The tap-collet category is a leaf at depth 0 and
the standard-collet one is not, so a walk has to handle both.

**A tile's query extends its parent's by exactly one `allCategoriesKMT` id.** The sidebar renders
hundreds of other `data-query` anchors — every filter checkbox has one — so `horizontal-facet` is
what separates a subcategory from a filter, and the prefix test is what keeps a walk inside the
branch it was asked about.

## 4. The path in the URL scopes nothing

The `query` does, alone. Asked for the same BT30 ER-collet-chuck facet, the collets-and-sleeves
path and the tool-holders-and-adapters path return the same 12 parts and the same one family
(JG 2026-09-09). So `COLLET_CATEGORY` and `HOLDER_CATEGORY` are not two scopes — they are two
spellings of "a real product category page to hang the component off". A walk is defined by its
**roots**, and the path only has to exist.

## 5. Running it

```sh
toolpath-scrape kennametal --collets
toolpath-scrape kennametal --holders
```

`--collets` is the three ER collet lines: seven nodes, seven requests. `--holders` is the six
spindle interfaces — BT, BTKV, CV, CVKV, HSK and PSC — which is **336 nodes and about 635
requests**, some minutes at the package's politeness delay. Both print every family the walk
links to, indented by depth, with the CSV whose `familyCode` claims it or `(not configured)`.
Then:

```sh
toolpath-scrape kennametal <CODE> "$TOOLPATH_SCRAPE_ROOT/kennametal/csv/<NAME>.csv"
```

### What the holder tree looks like

Four levels where the collet tree has two, and the middle one is the fact a config table needs:

```
BT                                    565 parts
  BT 40 Shank Tools                   243 parts
    ER Collet Chucks                   12 parts
      100149593  er-collet-adapter-bt40
    Shrink Fit Toolholders             …
```

**The interface and its size are a category, never a column.** Across the 158 holder families in
scope the variant tables publish 33 distinct columns and not one of them is the taper — it
survives only inside the catalog number (`CV40ZTTHT050275`). So `HolderRecord.taper` is read off
level two of this path and declared as a per-family `Fact` in `families/kennametal.ts`, which is
what makes `--holders` the citation for it: re-runnable rather than remembered.

## 6. Extending it to another category

`COLLET_CATEGORIES` and `HOLDER_CATEGORIES` in `catalog.ts` hold the facet strings, and
`COLLET_CATEGORY` / `HOLDER_CATEGORY` the paths they hang off. A different line — sleeves, DA
collets, KM™, DV, a VDI holder — is a different pair of those two, and `discoverFamilies` takes
both as arguments. Do not widen them without being asked: `AGENTS.md` holds this package to not
raising request volume or adding vendor scope on its own.
