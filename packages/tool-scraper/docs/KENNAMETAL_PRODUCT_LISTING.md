# Kennametal product listing — finding a family code

How `src/vendors/kennametal/catalog.ts` learns what a category holds. Written 2026-09-08.

`src/vendors/kennametal/scrape.ts` fetches a family once its **code** is known. This is the
other half: where a code comes from. Before this, the answer was "open a category page in a
browser and read it out of a link", which is why every holder and collet family in
`families/kennametal.ts` carried a hand-counted row total and no `familyCode` at all.

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

## 4. Running it

```sh
toolpath-scrape kennametal --collets
```

Seven requests. Prints every family the three ER collet categories link to, with the CSV whose
`familyCode` claims it or `(not configured)`. Then:

```sh
toolpath-scrape kennametal <CODE> "$TOOLPATH_SCRAPE_ROOT/kennametal/csv/<NAME>.csv"
```

## 5. Extending it to another category

`COLLET_CATEGORIES` in `catalog.ts` holds three facet strings and `COLLET_CATEGORY` holds the
path they hang off. A different line — sleeves, DA collets, a holder category — is a different
pair of those two, and `discoverFamilies` takes both as arguments. Do not widen the three
without being asked: `AGENTS.md` holds this package to not raising request volume or adding
vendor scope on its own.
