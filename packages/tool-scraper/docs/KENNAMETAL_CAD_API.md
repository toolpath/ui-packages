# Kennametal CAD model API (CDS Visual)

Kennametal does not host its own CAD models. The product page loads a third
party's viewer — CDS Visual, on `product-config.net` — and that service is
where the downloadable STEP, Parasolid and DWG files come from.

All findings below verified live 2026-08-05 with plain `curl`
(`-A "Mozilla/5.0"`, no cookies, no login).

Discovered by reading the page's own scripts, in the order the
`CLAUDE.md` runbook prescribes:
`product-config.net/catalog3/d/kennametal/cds.js` (function `getStaticModel`).

## The two paths, and why only one matters here

`cds.js` branches on whether the thing being downloaded has child components:

- **An assembly** POSTs to `ms.cdsvisual.net/kennametal/instructions`, then
  POSTs a batch to `/visualization/batches/`, then polls it until an
  `aggregateUrl` appears. The result is generated on demand and transient.
- **A single part with no child components** — every holder in this catalog —
  skips all of that and asks for a **pre-built static file**.

Only the second path is used here, and it is a single unauthenticated GET.

## The endpoint

```
GET https://www.product-config.net/catalog3/cad?d=kennametal&id=<materialNumber>
```

`id` is the vendor's **material number** (`6694846`), not the catalog number.
That is the same key `productLink` is built from, so nothing extra has to be
scraped to call this.

Response (fields this pipeline reads, from BT30ER11060M):

```json
{
  "productID": "6694846",
  "cadAvailable": true,
  "cadDownloadAvailable": true,
  "authenticatedDownload": false,
  "availableFormats": [
    {"name": "stp",     "label": "STEP (.stp)"},
    {"name": "stp-lwm", "label": "Lightweight STEP (.stp)"},
    {"name": "dxf",     "label": "Drawing (.dxf)"},
    {"name": "pdf",     "label": "Drawing (.pdf)"}
  ],
  "staticURLs": {
    "stp-gtm": ".../domains/kennametal/zip-g/BT30ER11060M_GTM.stp",
    "stp-lwm": ".../domains/kennametal/zip-l/BT30ER11060M_LWM.stp",
    "x_t":     ".../domains/kennametal/zip-x/BT30ER11060M.x_t",
    "bmg":     ".../domains/kennametal/zip-b/BT30ER11060M_BMG.dwg",
    "json":    ".../domains/kennametal/json/BT30ER11060M_GTM/…json",
    "zip-gl":  ".../domains/kennametal/final/gl/BT30ER11060M.zip"
  }
}
```

The `zip-*` keys are combinations, keyed by first letter: `b` drawing, `g`
graphical model, `l` lightweight model, `x` Parasolid. `zip-glx` is all three
3D formats in one archive.

**`staticURLs` files are named after the catalog number**, not the material
number. That is what `tests/test_cad.py` cross-checks: a URL that landed on
the wrong row names a different holder, and nothing else in the pipeline
would notice.

## Which format this pipeline takes, and why

`stp-lwm` — the **lightweight STEP**, which the vendor's own UI calls the "3D
Anti Collision Model". It is the simplified solid, and it is the geometry to
give Fusion as holder geometry. 54 KB for BT30ER11060M against 256 KB for the
full `stp-gtm`.

The full model, the Parasolid and the DWG are deliberately not scraped. One
click, one file; adding a second format is a second column, not a change to
this one.

## What makes a direct link viable

- `"authenticatedDownload": false` on every holder checked. No login, no
  session, no token.
- The files are ordinary CloudFront objects: `200`,
  `Content-Type: application/octet-stream`, `Last-Modified` in 2024. They are
  not generated per request.
- Because the content type is `application/octet-stream`, a plain `<a href>`
  in the web app **downloads the file without navigating away**.

Two things that do *not* work, recorded so they are not re-derived:

- **The Downloads tab cannot be deep-linked.** Neither
  `v2/tabs.min.*.js` nor `v2/product.min.*.js` reads `location.hash`, and
  `#product-download` is a jQuery selector in their code rather than a
  supported fragment. A link with that fragment lands on Overview.
- **The product page itself carries no CAD URL.** It is a client-rendered
  template full of `{{materialNo}}` placeholders; the URLs only exist in this
  endpoint's response.

## Coverage as scraped

2026-08-05, all 20 BT30 holders: `cadAvailable: true`,
`authenticatedDownload: false`, both `stp-gtm` and `stp-lwm` present.

Collets and tools answer the same endpoint (verified on collet `1025778` and
drill `4151623`) and are **not** scraped in this pass.

## Re-scraping

```bash
toolpath-kennametal-cad bt30_er_collet_adapters_metric.csv \
                        bt30_hydraulic_chucks_form_ad_metric.csv
```

The command writes the `CAD_STEP_URL` column into the CSVs under the scrape
root, in place, and is safe to re-run. Everything downstream is offline: every
consumer and every test read that column and never the network.

**Nothing offline can tell you a URL has gone stale.** A consumer links the
vendor's CDN rather than mirroring the files, so if Kennametal re-keys it the
links die silently and the fix is to re-run the command above. Mirroring the
~1 MB of STEP files is the fallback, and it needs their Terms & Conditions read
first — that has not been done.
