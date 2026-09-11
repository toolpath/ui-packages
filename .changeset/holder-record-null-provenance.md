---
'@toolpath/tool-scraper': major
---

Say which kind of null a toolholding record's null is.

`HolderRecord.cadModelUrl` was `null` for three different reasons — the vendor
publishes no model, the vendor publishes one and nothing has looked it up, or
the platform has no CAD at all — and a consumer could not tell them apart. Every
Kennametal and WIDIA holder reads as the second until `toolpath-scrape cad` has
run over its CSV, because those two vendors publish no CAD link on a family page.

- `HolderRecord.cadModelSource` is new: `unspecified` where nothing has looked,
  `vendor-stated` where the lookup ran, whether or not it found a model. The new
  `cadModel(row)` reader is what every holder mapper now uses to decide it, and
  `holderRecord` refuses a record carrying a URL it calls `unspecified`.
- `HolderRecord.unpublished` and `ColletRecord.unpublished` are new, and required
  by `holderRecord` and `colletRecord`: a mapper states the nullable fields its
  vendor publishes no column for, and the factory refuses a field left out
  without a declaration or declared and then supplied. A null a mapper simply
  never wrote is no longer reachable.
- `OptionalHolderField`, `OPTIONAL_HOLDER_FIELDS`, `OptionalColletField`,
  `OPTIONAL_COLLET_FIELDS` and `CadSource` are exported for callers that build
  records themselves.
- `CadCoverage.unspecified` counts rows carrying no CAD column, so `coverage`
  distinguishes a family nobody has annotated from one whose vendor publishes no
  models. It reported the two identically as `0 STEP`.
