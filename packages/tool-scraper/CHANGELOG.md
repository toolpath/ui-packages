# @toolpath/tool-scraper

## 2.1.0

### Minor Changes

- 4296fb3: A `drill` record may carry no point angle. `RECORD_GEOMETRY.drill` lists `SIG`
  under `sometimes` rather than `always`, so `toolRecord` no longer refuses a
  drill whose mapper supplies none, and a consumer cannot read `geometry.SIG` on
  a drill without checking for it.

  EMUGE-FRANKEN states a point angle on 2,669 of its 2,670 drill variants. The
  last, part `000000000010727800`, publishes a single classification feature and
  no dimensional properties at all — so its row carries no `SIG` **key**, rather
  than a key with an empty value. `SIG` is a mapped column in that adapter rather
  than a family fact, and because `toRecords` maps a family's rows together, that
  one part refused all 2,670 drills.

  The adapter now omits the key and warns, the way it already treats an end mill's
  sentinel flute count. A point-angle cell holding something that is not an angle
  — a length, a range — still refuses, and so does a family that maps no
  point-angle column at all: that is a fact about the map rather than about a row,
  so it is asked of the map directly. Reading the two as one is what cost the
  family, and it named a column map that was correct.

  Kennametal's drills supply `SIG` from a family fact and always carry one.

- b019b61: `ToolRecord` carries a `productLine` — the vendor's own name for the product
  line a part belongs to, or `null` where the vendor names none. Three of the five
  cutting-tool adapters fill it.

  Every vendor here publishes a product line and no two published it in the same
  place, so what a consumer could filter on was an accident of which vendor a
  record came from. `null` is the vendor's silence rather than an empty name, the
  same three-state rule `materialGroups` keeps with `unspecified`; `toolRecord`
  refuses `''` outright.
  - **EMUGE-FRANKEN** reads it from a column it already scrapes, at no request
    cost. Each of the three categories is partitioned exactly by one of the
    vendor's own facets — `product line` for milling, `Geometry` for drilling and
    tapping — so the value is a read rather than a choice between the 43
    overlapping product-family pages the vendor's marketing publishes. Milling
    passes through verbatim (`FRANKEN TOP-Cut VAR`); a drilling or tapping
    geometry code is mapped onto the title of the vendor's own article page for
    it (`MULTI` → `MultiDRILL`, `Z` → `Rekord B-Z Taps`), and a code with no such
    page keeps the code.
  - **Kennametal and WIDIA** read it from the family page's `h1`, which the
    variants table does not state anywhere. `scrapeFamily` takes a new
    `familyTitle` option that fetches it; the whole title reaches the CSV under
    the new vendor-neutral `FAMILY_TITLE_COLUMN`, and its leading `•` segment
    becomes the product line. **Off by default** — it is a second request per
    family, and a caller that only wants dimensions should not pay for one. The
    `toolpath-scrape kennametal` command turns it on.
  - **Destiny Tool** maps its `series` column, which the adapter has scraped
    since it was written and nothing had read.

  Harvey Tool records carry `null`: its product-line title is already this
  record's `description`, and a second copy of one string is what that field's own
  docstring refuses.

- 9dbe657: `toRecords` skips a part the vendor left a required dimension blank on, rather
  than failing the whole family. It warns naming the part, and every other
  refusal still throws.

  The rows of a family are mapped together, so until now one incomplete part
  ended the conversion and took every good row with it. EMUGE-FRANKEN omits
  `overall length l₁` on roughly 175 of its 7,021 end mill variants — the
  property is absent from the response, not blank — and both end mill families
  therefore produced no records at all.

  `columns.required` now raises the new `IncompletePartError`, a subclass of
  `VendorResponseError`, and that is the only failure `toRecords` skips past. A
  cutting material with no mapping, a column a family stopped mapping, a response
  that changed shape: those say the vendor's vocabulary or this package's catalog
  has moved, and they still fail the family.

  **No kind's contract is relaxed.** `RECORD_GEOMETRY.endmill` still lists `OAL`
  under `always`, and every record returned still carries one — a part without it
  becomes no record rather than a record with a hole. That is the difference
  between this and a drill's `SIG`, which is `sometimes` because the vendor
  genuinely never publishes it.

  Callers that assumed one record per scraped row should read the returned length.

## 2.0.0

### Major Changes

- 220c0f0: A `tap` record may carry no flute count. `RECORD_GEOMETRY.tap` lists `NOF`
  under `sometimes` rather than `always`, so `toolRecord` no longer refuses a tap
  whose mapper supplies none, and a consumer cannot read `geometry.NOF` on a tap
  without checking for it.

  Kennametal's taps publish a `Z` column and still fill it; the relaxation is for
  a vendor that publishes no tap flute count anywhere a scrape can reach.

### Minor Changes

- bee2487: Add an EMUGE-FRANKEN adapter covering end mills, drills and taps, published as
  `@toolpath/tool-scraper/vendors/emuge` with an `emuge` CLI subcommand and four
  families: `emuge_end_mills_inch.csv`, `emuge_end_mills_mm.csv`,
  `emuge_drills.csv` and `emuge_taps.csv`.
- 588b43b: Export the per-vendor scrape-target tables, which no subpath reached.
  `./families` points at the merged index, and that index re-exports `FAMILIES`,
  `HOLDER_FAMILIES` and `COLLET_FAMILIES` and nothing else — so Harvey Tool's
  `PRODUCT_PAGES`, MariTool's `LEAVES` and EMUGE-FRANKEN's `SCRAPE_TARGETS` built
  into `dist`, shipped in the tarball, and threw `ERR_PACKAGE_PATH_NOT_EXPORTED`
  at any consumer that imported them. Adds `./families/harvey`,
  `./families/maritool` and `./families/emuge`.
- cd2a0be: Publish the readers a display-string adapter shares. `measure.asLength` and
  `measure.asCount` turn one read cell into a length or a count — converting a
  stated unit the family does not publish, refusing an angle in a length column —
  and `columns.columnReaders` binds a vendor's reader to the three steps between a
  `GeometryName` and a number. Both were duplicated verbatim in the Harvey Tool
  and EMUGE-FRANKEN adapters, warnings and refusal wording included.

  Adds `asLength`, `asCount`, `Measured`, `StatedUnit`, `columnReaders`,
  `ColumnReaders` and `LengthReader` to the package entry point. No existing
  signature changes.

## 1.0.0

### Major Changes

- 147ca62: Four things two vendors each declared for themselves now have one home, and a check that keeps it
  that way.
  - New `measure` module on the main entry point: `MM_PER_INCH`, `fractionValue` for the decimal,
    fraction and mixed-number grammar every vendor publishes, and `convertLength`. It replaces three
    adapter-local readers that disagreed — REGO-FIX refused `1-1/2`, Destiny Tool refused `1.5-1/2`,
    Harvey read both — and two exported copies of 25.4.
  - **`MM_PER_INCH` is gone from `./vendors/harvey` and `./vendors/regofix`.** Import it from the
    package root.
  - `unionHeader` moves to the main entry point and is gone from `./vendors/regofix` and
    `./vendors/maritool`. It was byte-identical in both.
  - `conventions` gains `DESCRIPTION_COLUMN`, `CONTACT_COLUMN`, `COLLET_SERIES_COLUMN` and
    `GAGE_COLUMNS` — the CSV columns two vendors each write and neither owns, beside `CAD_COLUMN` for
    the same reason. `./vendors/maritool` no longer exports its own copies of them, and
    `./vendors/harvey` no longer exports `DESCRIPTION_COLUMN`.

  Harvey's record mapper now reads the `ColumnMap` its caller passes rather than `family.columns`,
  which is what `registry.toRecords` has just validated. `cornerRadius` and `flutes` on
  `./vendors/harvey` take that map as a new third argument.

  `tests/vendor-boundary.test.ts` now fails on a name exported by two manufacturers that is not part
  of the adapter contract, so the next one of these is caught rather than reviewed.

- 4bc7595: `ToolRecord` is now the package's shipped output, and its shape changed.
  - `toRecords(familyName, scrape, options?)` on the `./registry` subpath maps one family's scrape to
    `ToolRecord[]`, checking the identity and mapped columns against the header first. Every command
    previously ended at a vendor-labelled CSV.
  - `grade` is removed. `coating` replaces it and carries the vendor's own coating string, `''` where
    none is published; the carbide grade a Kennametal table publishes reaches no record.
  - `brand` and `guid` are new. `toolRecord()` mints `guid` as `recordGuid(brand, materialNumber)`
    itself, so an adapter cannot get it wrong and the guid is derivable from a record.
  - `materialGroups` is `readonly string[] | null`: `null` is "we do not know what this tool is for",
    `[]` is a vendor index that rates the part for nothing, non-empty is a rating. New
    `materialGroupsSource` is never absent — the new `UNSPECIFIED` label in the first case, otherwise
    `vendor-stated` or `derived` — and the label and the null go together or the record is refused.
    Every Harvey record is `unspecified`: its material index is published per part, not in a variant
    table, and varies by coating within a family, so nothing a scrape reads can stand in for it.
  - Every mapper now reads `unit`, `bmc` and `coolantThrough` as required family facts. Harvey's
    `family.unit!`, Destiny Tool's hardcoded `'inches'`, and the `?? false` / `?? ''` fallbacks are
    gone, and the three Kennametal tap families state `coolantThrough` rather than the mapper
    assuming it.
  - `description` is now the vendor's own free text, `''` where the vendor publishes none, and
    never a copy of another field on the record. Kennametal publishes no description column, so its
    drill and end mill records carry `''` where they used to repeat `catalogNumber`; a tap carries
    its thread designation alone rather than the catalog number and the designation.
  - `geometry` values are `number`. They were `number | boolean` and no adapter has ever produced a
    boolean, so every consumer narrowed a type nothing could hold.
  - New `RECORD_GEOMETRY` states, per tool kind, which geometry a record always carries and which it
    may omit. `toolRecord()` refuses anything else. An absent key is now a declared claim — an end
    mill may omit `NOF` where the vendor publishes no flute count (Harvey's two deburring families),
    a drill carries `SIG` and never `RE` — instead of the ambiguity `materialGroups` had already been
    given `UNSPECIFIED` to resolve.
  - REGO-FIX row order no longer depends on the machine's locale.

### Minor Changes

- cba558e: Add the Harvey Tool vendor adapter: 52 miniature end mill and keyseat cutter families, 12,773 orderable parts, scraped from each product page's inline variant table.

  New exports: `@toolpath/tool-scraper/vendors/harvey`, `conventions.CAD_DXF_COLUMN` for a vendor's 2D profile link, and `FamilyFacts.profile` for the end profile a vendor states once per product line. `conventions.IDENTITY_DEVIATIONS` gains a `harvey` entry — Harvey publishes one `Tool #` per part and no catalog designation.

  `toolpath-scrape harvey FAMILY.csv` scrapes one family; `toolpath-scrape harvey --catalog` walks the category trees.

- 54c4144: Add the MariTool vendor adapter: five toolholding families — CAT40, CAT50,
  BT30, BT40 and HSK — covering 529 ER collet chucks, shrink-fit holders and
  hydraulic chucks, and a `toolpath-scrape maritool` command that writes them.

  New public surface: the `@toolpath/tool-scraper/vendors/maritool` entry point,
  `maritool` in `identity.BRANDS` and `conventions.IDENTITY_DEVIATIONS`, and five
  entries in `families.HOLDER_FAMILIES`. Nothing existing changes shape.

  The gage length is promoted into an `L1_in`/`L1_mm` pair with exactly one cell
  filled per row, and nothing is converted: MariTool publishes both unit systems
  in that one column, within a single family and within a single category page.

  MariTool ships toolholding, so like REGO-FIX it binds no record mapper: its
  scrape ends at rows and a receipt, not at `ToolRecord`. The columns two
  toolholding vendors now share — `Description`, `contact`, `CST` and the
  `L1_in`/`L1_mm` pair — are named in `conventions` rather than in either
  adapter, so a consumer joining the two catalogs has one spelling to read.

## 0.1.0

### Minor Changes

- 987c3a9: Export the types the package's own signatures are written in. The main entry
  point now exports `ScrapeResult` and `ScrapedRow` — the return type of every
  scrape and the parameter of `toCsv`, `annotateCadUrls` and `addThreadPitch` —
  along with `BoundFamily`, `Warn`, `FetcherOptions`, `HttpError`, `statusOf` and
  `AEM_BRANDS`, none of which a consumer could name before. Each entry point now
  re-exports its modules whole, so a symbol cannot be public in a module and
  invisible from the package.

  `REQUEST_DELAY_MS` is one constant on the main entry point rather than a copy
  per looping step; `@toolpath/tool-scraper/vendors/kennametal` no longer exports
  its own.

- 92a9645: Add `@toolpath/tool-scraper`: scrape cutting-tool and toolholding geometry from Kennametal, WIDIA,
  REGO-FIX and Destiny Tool catalogs into records.

  The main entry point returns rows and never touches the filesystem, so a Node backend can embed it;
  CSV serialization, the provenance sidecar and the bulk CAD mirror live behind
  `@toolpath/tool-scraper/node`. The transport is a `Fetcher` a caller supplies, so retries, proxies
  and rate limits stay the consumer's decision. A `toolpath-scrape` command line drives every vendor.

### Patch Changes

- 987c3a9: Refuse two more inputs a scrape cannot serve, and fill two cells that were left
  empty: a Kennametal header whose columns reduce to one name no longer silently
  drops a column's data, a `toolpath-scrape kennametal` constant column that is
  not `Name=Value` is refused instead of dropped, a Destiny Tool record's `vendor`
  carries the brand's published name rather than its catalog key, and an inch
  tapping collet's drive square is projected into `Square_mm` the way its
  diameter already was.
- ec90d59: Refuse the inputs each scrape step cannot serve rather than carrying them into
  a record: an unreadable thread designation or collet size, a `Thread System`
  tag that is neither `metric` nor `inch`, a non-integer flute count, and a
  `--brand` or `cad` target that is not on the AEM platform. A record's `vendor`
  carries the brand's published name, and a 404 from the CAD endpoint reads as
  the vendor publishing no model.
