# Adding a vendor

What it takes, in the order it takes it. Roughly one day per vendor, and the
expensive part is never the code — it is finding the endpoint and then finding
out what the vendor's own labels mean.

## 1. Find the transport, and write down how you found it

The six adapters here reach their data six unrelated ways: an AEM variant-table
GET, a Firestore REST walk, an Elasticsearch proxy POST, an osCommerce category
listing, a SAP Commerce JSON API, and a product page parsed as HTML. None of
them is documented by the vendor and none was guessable; each was read off the
site's own application bundle.

**This is the most expensive thing in the package to rediscover**, so it is
written down before anything else: `KENNAMETAL_CAD_API.md`,
`KENNAMETAL_SPEEDFEED_API.md` and `REGOFIX_PRODUCTFINDER_API.md` each record
the endpoint, the request shape, the fields it returns, and the dead ends that
were tried first. Add one for the new vendor.

Dead ends are worth a paragraph each. The REGO-FIX note's is the useful kind:
the marketing pages carry no variant table at all, no inline JSON and no
server-rendered `<table>`, and the Drupal node behind a part redirects to
`/products`. Somebody will try it again otherwise.

## 2. `identity.BRANDS`

Four keys — `host`, `home`, `vendor`, `product_link` — and one optional `node`
that only the AEM platform uses.

`home` is the guid namespace seed and is **stated rather than derived**. Every
record of this brand is minted under `uuid5(NAMESPACE_URL, home)`, so a
mistake here is not a wrong string: it is every one of that vendor's guids,
permanently, and a guid is the join key downstream.

`product_link` is what the vendor actually offers. Two of the four brands
publish no per-part page at all, and their links are searches. A link that
404s is worse than a link to a listing.

## 3. The adapter, under `vendors/<brand>/`

`scrape.ts` at minimum, and whatever else that vendor's data needs — Kennametal
has four modules because its geometry, its material index, its CAD links and
its thread pitches arrive four different ways.

Two rules, and `tests/vendor-boundary.test.ts` enforces both from the package
tree:

- **Nothing in the core imports a vendor.** A core module that needs a
  vendor's constant is telling you the constant belongs in the core.
- **No vendor imports another vendor.** The cheapest way to add vendor three is
  to reach into vendor one's parsing, and that is how a "shared" scraper that
  serves nobody gets built.

Take a `Fetcher` and read through it, so the transport gets the same
`User-Agent`, timeout and decoding rules as the others — and so a caller can
supply its own retries, proxy or rate limiting without reimplementing the
decoding, and a test can pass a stub instead of reaching for a global.

## 4. The CSV: the vendor's own labels

**Keep them.** Relabelling a vendor's columns on the way into the file would
put a lie in the file whose whole job is to record what the vendor published,
and the CSV is what gets diffed when a vendor silently changes their table.

`conventions.ts` holds the short list of rules that do hold across vendors.
Two are enforced:

- **Units.** A dimensional column carries `_mm` or `_in`. An adapter declares a
  bare label and the core appends the suffix from the family's declared `unit`;
  choosing the suffix inside an adapter is exactly the mistake `unit` exists to
  prevent.
- **Identity.** `Material Number` and `ISO Catalog Number`, unless the vendor
  genuinely does not have them — in which case add an entry to
  `IDENTITY_DEVIATIONS` rather than inventing columns. Three vendors have one
  today, and writing each down is what makes the next drift a decision somebody
  made rather than a thing that happened. Two of the three are the honest kind:
  Harvey Tool and MariTool each publish exactly one number per part, so the
  two-column shape is Kennametal's rather than the industry's.

  The deviation is read, not guessed at. `conventions.catalogColumn` is what
  answers "which column names this part" for anything that has to — the STEP
  mirror names its files from it — because a header missing `ISO Catalog Number`
  and a scrape that lost the column look identical from the row.

A vendor code you cannot pin to a meaning keeps its raw code behind
`DIN_PREFIX`. **Do not guess at what it measures.** A column named `A2_mm`
sits in the CSV looking exactly like a mapped length; `DIN_A2` reads as what it
is.

## 5. `families/<brand>.ts`

Scrape targets, the column map, the hand-counted `rows`, and the facts no
vendor table states.

**The column map is keyed by ISO 13399 code** — `DC`, `OAL`, `LCF`, `RE`,
`NOF`, `SIG`, `TP` — with the vendor's own label as the value, unsuffixed. See
`records.GEOMETRY_FIELDS`, which carries each code's definition and names the
three that are Autodesk's rather than the standard's.

**Every constant the vendor's table does not state is a `Fact`.** `Fact` is a
union discriminated on `source`, so most of the gate is the compiler: a
`vendor-stated` fact needs a citation specific enough to re-check with one
request, a `derived` one needs a note saying what was computed from what, and an
`assumed` one needs a note, a date and initials — because the only thing
standing behind an assumption is a person on a day. `checkFact` in
`provenance.ts` catches what a type cannot say: an empty string, and a `checked`
that is not a date.

When a vendor label is unclear, **ask**. Record the answer and its date. Do not
guess and flag it afterwards; the flag is what gets lost.

`rows` is what a human counted on the vendor's own page. It is the one key
nothing reads at scrape time, and it is the point: every other count is
computed from the same file it is checking, so a scrape that silently lost rows
agrees with itself. `receipts.checkRows` is what the second number buys.

## 6. Toolholding, if the vendor publishes holders or collets

**Optional, per vendor and per kind.** A vendor may publish holders, collets,
both or neither. REGO-FIX publishes both and no cutting tools; MariTool
publishes holders and no collets; Harvey Tool, EMUGE-FRANKEN, Destiny Tool and
WIDIA publish neither. Nothing anywhere requires a vendor to have any of it, and
`tests/registry.test.ts` holds the catalog to still containing an example of
each shape — a catalog that lost one has stopped proving the claim.

A vendor's toolholding families go in `HOLDER_FAMILIES` and `COLLET_FAMILIES` in
`families/<brand>.ts`, and `families/index.ts` merges whichever exist. Two
separate tables rather than a `kind` on one, because a holder and a collet carry
different discriminants: a holder states a taper and a clamping mode, a collet
states a series and a capacity band, and a scrape of one is not a scrape of the
other.

### The columns that join across vendors

`conventions.ts` names them, and a second vendor writing the same fact under a
different label joins to nothing:

| Column            | What it holds                                           |
| ----------------- | ------------------------------------------------------- |
| `contact`         | `taper` or `face` — whether the flange face seats too   |
| `CST`             | the collet series a **holder takes**                    |
| `Collet Series`   | the series a **collet is** — the other half of the join |
| `L1_in` / `L1_mm` | a holder's gage length, a pair with one cell filled     |
| `CAD_STEP_URL`    | the downloadable solid, where the vendor publishes one  |
| `CAD_DXF_URL`     | the 2D profile — a different thing, never a fallback    |

Both vendors that publish a collet series close the vendor's own spacing before
writing it (`ER 16` -> `ER16`), for the same reason: two spellings join to
nothing. Write the series **exactly as the vendor designates it** otherwise —
REGO-FIX's `PGST 15` becomes `PGST15` and deliberately matches no `PG25` holder,
because nothing published says a PGST collet seats in a plain PG holder. Hiding
a collet that would have fitted costs an option; offering one that does not fit
costs a machinist a purchase. Resolve it by asking the vendor, not by widening
the string.

The gage pair is a pair — rather than one column and a unit tag — because a
single catalog page can publish both: MariTool gages `HSK40E-ER11-40` in
millimetres and `HSK40E-ER16-3.0M` in inches on one listing. Nothing is
converted between them at scrape time; computing one would put a number in the
file the vendor never published.

### Which of these is a fact and which is a column

The rule is the one `families/` already runs on, and it decides itself: **a
constant the vendor states once per family is a `Fact`; a value the vendor
states per part is a column, and a fact standing beside it would mask a scrape
that lost the column.**

The two ends of that range are both in the tree:

- **Kennametal** declares `taper`, `contact`, `clamping`, `style` and `unit` as
  five facts on every toolholding family, because it sells one interface and one
  clamping mode per family — its dual-contact BT30 is a separate line with its
  own family code.
- **MariTool declares no facts at all.** Each CSV is one spindle taper holding
  three clamping styles, the HSK file holds nine sizes, and the gage length is
  metric on some parts and imperial on others _inside one category page_. Every
  candidate constant is a column there, and `families/maritool.ts` writes down
  why for each one. That is the precedent to follow for a vendor whose taper and
  clamping vary row by row.
- **REGO-FIX is the middle case**, and worth reading for it: `taper`, `clamping`,
  `style` and `unit` are facts on its holder family, and `contact` is a column —
  because it publishes plain and dual-contact powRgrip in one product group,
  states which is which in a `form_name` field, and a `contact` fact there would
  silently mask the column going missing.

### The mappers, in `vendors/<brand>/holding.ts`

One module exporting `HOLDING_MAPPERS`, and `registry.HOLDING_ADAPTERS` binds it
by brand. Both halves are optional — `{ holder }` alone is what MariTool ships —
and **a brand absent from that table is not an error**: its families still bind,
still scrape, still write a CSV and still check a receipt. Only
`registry.toHolding` refuses, and it names the brand and what that brand does
map. That is what makes adding a vendor's holders a separate step from reading
its columns.

The mapper's whole job is which of this vendor's columns answers each question.
Everything about _what a record is_ lives in `holding.ts`: the millimetre
projection, the unit fallback, and the two gates. Read those before writing a
mapper, because they decide what your columns have to produce:

- A holder grips a shank or a collet and **never both** — a bore-clamping holder
  publishes a bore and no `CST`, a collet-clamping one the reverse.
- `contact` is never defaulted. Defaulting to `taper` would record a
  dual-contact family as a plain cone on no evidence.
- A collet's capacity is the vendor's published `CCCN`/`CCCX` and is **never
  derived**. DIN 6499 is usually summarised as a 1 mm band, which is wrong at the
  small end of every series and wrong by a whole millimetre on a sealed collet.

Use `holding.published` for a cell the vendor left blank on one part: it raises
the one refusal a family survives, so one part with an unpublished measurement
becomes a warning and no record rather than ending the conversion. A value that
is present and unreadable, or two present values that contradict, is a
`VendorResponseError` and stops the family — that is the vendor's vocabulary
having moved, and skipping past it quietly is how a scraper starts publishing a
catalog nobody checked.

## 7. `registry.ADAPTERS`, if the vendor ships cutting tools

One line. A vendor that ships only toolholding needs no entry — REGO-FIX has
none.

`HOLDING_ADAPTERS` is the same one line for the toolholding half, with one
difference worth knowing: an absent brand there is legal, so **a typo in a key
cannot fail at bind time the way one in `ADAPTERS` does**. `HOLDING_ADAPTERS.regofx`
reads as "regofix maps nothing", and nothing would say otherwise until somebody
noticed a vendor's records had stopped being minted. `tests/registry.test.ts`
checks every key against `identity.BRANDS` for exactly that reason.

## 8. Tests

Pass a stub `Fetcher` and feed inline fixtures. Every test in this package
does, and `tests/setup.ts` replaces the global `fetch` with one that throws and
names the URL that asked — without it, a test that forgets its stub quietly
pages a vendor's whole catalog and passes.

Check the header the adapter really writes against `conventions`, in that
vendor's own test file. A header quoted as a literal is a second copy of what
the adapter writes, updated at the same time, checking nothing.

Cases that read a scraped CSV go through `tests/corpus.ts`, which skips with a
named reason where no scrape exists.

## 9. The scrape

A subcommand in `node/cli.ts`. Print the resolved scrape root first, and record
a receipt after.

A vendor-specific step belongs behind a per-brand dispatch table rather than a
check on a brand list, and **a brand it has no entry for is a no-op with a
message, not an exit code**. The `cad` step got that wrong: it filled the CAD
column through Kennametal's own CDS lookup and exited 2 on the first family of
any other vendor, which made it impossible to run across a catalog holding more
than one vendor's holders. REGO-FIX and MariTool fill the column during the
scrape itself, so for them there is genuinely nothing to do — and saying so is
the answer.

`toolpath-scrape coverage` is worth running once the holders are in. It reads
the CSVs, makes no requests, and reports how many rows of each family publish a
STEP model — the number that bounds anything built on measured geometry, and one
better known before a mirror runs than after.

Then run it, and read the CSV. The three faults documented in
`vendors/regofix/scrape.ts` — a part whose XML states the wrong part number, a
product-line label that lies, a cell repeating the row above it — were all
found this way and none of them raised anything.
