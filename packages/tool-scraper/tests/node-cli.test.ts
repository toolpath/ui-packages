/**
 * The console entry point, and the receipt every scrape leaves beside its CSV.
 *
 * `run` is exported and takes its console and its transport, so these drive
 * the real command paths without a subprocess and without a vendor — the same
 * seam every other test in this suite uses.
 *
 * The scrape root is pointed at a temporary directory per test, because the
 * default is derived from the package's own location and a test that wrote
 * there would leave a scrape in the working tree.
 */

import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { REQUEST_DELAY_MS } from '../src/scrape.js'
import { CATEGORY_ROOTS as HARVEY_ROOTS } from '../src/vendors/harvey/catalog.js'
import { CAD_COLUMN, CAD_DXF_COLUMN, checkIdentityColumns } from '../src/conventions.js'
import { parseCsv } from '../src/node/csv.js'
import { HOLDER_FAMILIES, familyConfig } from '../src/families/index.js'
import { familyBrand } from '../src/family.js'
import { LEAVES as MARITOOL_LEAVES } from '../src/families/maritool.js'
import { categoryUrl } from '../src/vendors/maritool/scrape.js'
import { toCsv } from '../src/node/csv.js'
import {
  SCRAPE_ROOT_ENV,
  describeRoot,
  familyCsv,
  profilesJson,
  stepDir,
} from '../src/node/paths.js'
import { API_URL_ENV, type HolderApi } from '../src/node/holder-import.js'
import * as receipts from '../src/node/receipts.js'
import { run } from '../src/node/cli.js'
import { asFetcher, recordPauses, recorder, stub } from './stubs.js'

/** A family whose CSV the in-place commands can be pointed at. */
const TAPS = 'khsst_spiral_point_plug_inch.csv'

let root: string

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'toolpath-scrape-'))
  process.env[SCRAPE_ROOT_ENV] = root
})

afterEach(() => {
  delete process.env[SCRAPE_ROOT_ENV]
})

/** A fetcher that refuses every request, for the paths that need none. */
const noNetwork = stub()

describe('every command states where scraped data lands', () => {
  it.each([
    [],
    ['--help'],
    ['kennametal'],
    ['regofix'],
    ['destinytool'],
    ['harvey'],
    ['emuge'],
    ['thread-pitch'],
    ['cad'],
    ['materials'],
    ['mirror-cad'],
    ['coverage'],
    ['profiles'],
  ])('announces the root for %j', async (...argv) => {
    // Somebody reading the usage text is the person most likely to be about to
    // point a scrape at the wrong place.
    const { io, out } = recorder()

    await run(argv as string[], io, noNetwork)

    expect(out[0]).toContain('scrape root:')
  })

  it('says whether the root came from the environment', () => {
    expect(describeRoot()).toContain(`${SCRAPE_ROOT_ENV} set`)
    expect(describeRoot()).toContain(root)

    delete process.env[SCRAPE_ROOT_ENV]
    expect(describeRoot()).toContain(`${SCRAPE_ROOT_ENV} default`)
  })
})

describe('the kennametal command', () => {
  const TABLE = `<table>
    <tr><th class="collab-checkbox-header"></th><th>Material Number</th>
        <th class="CatNo">ISO Catalog Number</th>
        <th class="X metric">D1</th></tr>
    <tr><td></td><td>4151623</td><td>B041</td><td>1</td></tr>
    <tr><td></td><td>4151624</td><td>B042</td><td>2</td></tr>
  </table>`

  const serving = (html: string) => asFetcher({ text: vi.fn(async () => html) })

  it('rejects an unknown brand', async () => {
    const { io, err } = recorder()

    expect(await run(['kennametal', '--brand', 'sandvik', '1', 'x.csv'], io)).toBe(2)
    expect(err.join('\n')).toContain('unknown brand: sandvik')
  })

  it('requires a code and an output path', async () => {
    const { io } = recorder()

    expect(await run(['kennametal', '100003658'], io)).toBe(2)
  })

  it('rejects a known brand that is not on the AEM platform', async () => {
    // Checked against every brand, so `--brand regofix` passed and the scraper
    // built a URL with `undefined` where the AEM component node goes.
    const { io, err } = recorder()

    expect(await run(['kennametal', '--brand', 'regofix', 'CODE', 'out.csv'], io, noNetwork)).toBe(
      2,
    )
    expect(err.join('\n')).toContain('unknown brand: regofix')
    expect(err.join('\n')).toContain('kennametal, widia')
  })

  it('needs a value after --brand', async () => {
    const { io, err } = recorder()

    expect(await run(['kennametal', '--brand'], io)).toBe(2)
    expect(err.join('\n')).toContain('--brand needs a value')
  })

  it('refuses a constant column that is not Name=Value', async () => {
    // A quoting slip — `"Thread System" metric` — used to be filtered out, so
    // the scrape wrote a CSV with the column missing and exited 0. Refusing
    // here is what every other bad input in this package gets.
    const out = join(root, 'fam.csv')
    const { io, err } = recorder()

    expect(await run(['kennametal', '100003658', out, 'Thread System'], io, serving(TABLE))).toBe(2)
    expect(err.join('\n')).toContain('constant column "Thread System" is not Name=Value')
    expect(existsSync(out)).toBe(false)
  })

  it('defaults to kennametal, and appends tag columns', async () => {
    const out = join(root, 'fam.csv')
    const { io } = recorder()

    expect(
      await run(['kennametal', '100003658', out, 'Thread System=metric'], io, serving(TABLE)),
    ).toBe(0)

    const written = readFileSync(out, 'utf8')
    expect(written.split('\r\n')[0]).toBe('Material Number,ISO Catalog Number,D1_mm,Thread System')
    expect(written).toContain('4151623,B041,1,metric')
  })

  it('leaves a receipt naming what it fetched', async () => {
    const out = join(root, 'fam.csv')
    const { io, out: logged } = recorder()

    await run(['kennametal', '100003658', out], io, serving(TABLE))

    const receipt = receipts.read(out)
    expect(receipt?.brand).toBe('kennametal')
    expect(receipt?.rows).toBe(2)
    expect(receipt?.familyCode).toBe('100003658')
    expect(receipt?.source).toContain('www.kennametal.com')
    expect(receipt?.source).toContain('100003658')
    expect(receipt?.scrapedAt).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\+00:00$/)
    expect(logged.join('\n')).toContain('wrote 2 rows')
    expect(logged.join('\n')).toContain('receipt: fam.csv.scrape.json')
  })

  it('records WIDIA’s host and not Kennametal’s', async () => {
    const out = join(root, 'w.csv')
    const { io } = recorder()

    await run(['kennametal', '--brand', 'widia', '103354322', out], io, serving(TABLE))

    const receipt = receipts.read(out)
    expect(receipt?.brand).toBe('widia')
    expect(receipt?.source).toContain('www.widia.com')
    expect(receipt?.source).not.toContain('kennametal.com')
  })

  it('refuses a scrape that disagrees with the hand count', async () => {
    // Two independently-arrived-at numbers. Every other count in a pipeline
    // like this is computed from the file it is checking, so a scrape that
    // silently lost rows agrees with itself.
    const out = join(root, 'godrill_3xd_metric.csv')
    const { io } = recorder()

    await expect(run(['kennametal', '100003658', out], io, serving(TABLE))).rejects.toThrow(
      /wrote 2 rows where this family declares 259/,
    )
  })

  it('walks the collet categories and says which codes are configured', async () => {
    // The maintenance question `families/kennametal.ts` cannot answer: has the
    // vendor added, split or retired a family? A leaf here links one family
    // that a CSV claims and one that none does.
    const leaf = `<div data-totalResults="117">
      <a href="/us/en/products/fam.er-standard-collets-metric.100000478.html">x</a>
      <a href="/us/en/products/fam.er-standard-collet-set-metric.100000428.html">x</a>
    </div>`
    const asked: string[] = []
    const { io, out: printed } = recorder()

    const code = await run(
      ['kennametal', '--collets'],
      io,
      asFetcher({
        text: (url: string) => {
          asked.push(url)
          return Promise.resolve(url.includes('_listing.0.') ? leaf : '<div></div>')
        },
      }),
    )

    expect(code).toBe(0)
    expect(asked.every((url) => url.includes('product_listing.'))).toBe(true)
    const all = printed.join('\n')
    expect(all).toContain('100000478\ter-standard-collets-metric')
    expect(all).toContain('er_standard_collets_metric.csv')
    // The four collet kits are the families no CSV claims, and this is what
    // keeps them visible rather than forgotten.
    expect(all).toContain('100000428\ter-standard-collet-set-metric')
    expect(all).toContain('(not configured)')
    expect(all).toMatch(/families under 3 category trees, \d+ not configured$/m)
  })

  it('states the collet walk in its usage text', async () => {
    const { io, err } = recorder()
    expect(await run(['kennametal'], io)).toBe(2)
    expect(err.join('\n')).toContain('kennametal --collets')
  })
})

describe('receipts', () => {
  it('replaces rather than accumulates', () => {
    // A receipt describes the file sitting next to it; a history of scrapes
    // that produced files no longer there is a log, not a receipt.
    const csv = join(root, 'x.csv')
    writeFileSync(csv, 'a\r\n')

    receipts.write(csv, { brand: 'regofix', source: 'https://a', rows: 1 })
    receipts.write(csv, { brand: 'regofix', source: 'https://b', rows: 2 })

    expect(receipts.read(csv)?.source).toBe('https://b')
    expect(receipts.read(csv)?.rows).toBe(2)
  })

  it('reads a CSV with no receipt as null rather than refusing it', () => {
    // A CSV somebody scraped before receipts existed is still a usable CSV,
    // and refusing it would be refusing data over its paperwork.
    const csv = join(root, 'orphan.csv')
    writeFileSync(csv, 'a\r\n')

    expect(receipts.read(csv)).toBeNull()
    expect(existsSync(receipts.pathFor(csv))).toBe(false)
  })

  it('stamps a caller-supplied moment, so a test is not a clock', () => {
    const csv = join(root, 'x.csv')

    receipts.write(csv, {
      brand: 'regofix',
      source: 'https://a',
      rows: 1,
      now: new Date('2026-08-26T12:34:56.789Z'),
    })

    expect(receipts.read(csv)?.scrapedAt).toBe('2026-08-26T12:34:56+00:00')
  })

  it('records no family code where the vendor has none', () => {
    // REGO-FIX and Destiny Tool scrape a set of index filters, so it is null
    // rather than an empty string, which would read as a code left blank.
    const csv = join(root, 'x.csv')

    receipts.write(csv, { brand: 'destinytool', source: 'https://a', rows: 1 })

    expect(receipts.read(csv)?.familyCode).toBeNull()
  })

  it('sorts its keys, so a re-scrape diffs only where it differs', () => {
    const csv = join(root, 'x.csv')

    receipts.write(csv, { brand: 'regofix', source: 'https://a', rows: 1 })

    const keys = Object.keys(JSON.parse(readFileSync(receipts.pathFor(csv), 'utf8')) as object)
    expect(keys).toEqual([...keys].sort())
  })
})

describe('the harvey command', () => {
  const HEAD = `<table id="Harvey-EndMill-025_1"><thead>
  <tr><th colspan="1" rowspan="1">CUTTER DIA.</th>
      <th colspan="1" rowspan="1">LOC</th>
      <th colspan="1" rowspan="1">SHANK DIA.</th>
      <th colspan="1" rowspan="1">OAL</th>
      <th colspan="2" rowspan="1">UNCOATED</th>
      <th rowspan="2">Add to Cart</th></tr>
  <tr><th colspan="1"><b>D</b><sub>1</sub></th><th colspan="1"><b>L</b><sub>2</sub></th>
      <th colspan="1"><b>D</b><sub>2</sub></th><th colspan="1"><b>L</b><sub>1</sub></th>
      <th colspan="1">4 FL</th>
      <th class="product-table-th-price" colspan="1">PRICE</th></tr>
</thead><tbody><tr><td>x</td></tr></tbody></table>`

  /** One HTML row carrying one part, the way the smallest real page does. */
  const row = (number: string) =>
    `{a0:{d:".250 (1/4)"},a1:{d:".375"},a2:{d:"1/4"},a3:{d:"6"},` +
    `s0:{d:"<a href=\\"/products/tool-details-${number}\\">${number}</a>"},` +
    `p0:{d:"$148.40 "},` +
    `atc:{j:"[{\\"T\\":\\"${number}\\",\\"C\\":\\"${number}\\",\\"Q\\":\\"1\\"}]"}}`

  /** `harvey_endmill_025.csv` declares 10 parts; `parts` says how many to serve. */
  const page = (parts: number) => {
    const numbers = Array.from({ length: parts }, (_, i) => String(14916 + i))
    return `<html><body>${HEAD}<script>
var cols1 = [{data:"a0"},{data:"a1"},{data:"a2"},{data:"a3"},{data:"s0"},{data:"p0"},{data:"atc"}];
var cols2 = [];
var tableData1 = [${numbers.map(row).join(',')}];
var tableData2 = [];
var viewModel = {simFileViewModel:{productCode:"HT-Harvey-EndMill-025",productTitle:"Miniature End Mills - Ball - Extra Long Length",variantSimFileViewModel:[
${numbers.map((n) => `{variantName:"${n}",variantDxfFileLink:"https://cdn.example/${n}.dxf",variantStepFileLink:""}`).join(',\n')}]}};
</script></body></html>`
  }

  const serving = (parts: number) => {
    const asked: string[] = []
    return {
      asked,
      fetcher: asFetcher({
        text: (url: string) => {
          asked.push(url)
          return Promise.resolve(page(parts))
        },
      }),
    }
  }

  it('scrapes a family into the CSV its own config names', async () => {
    // The page to fetch and the unit system come from the family's config, so
    // neither is typed again and neither can be typed wrong.
    const { io, all } = recorder()
    const { asked, fetcher } = serving(10)

    expect(await run(['harvey', 'harvey_endmill_025.csv'], io, fetcher)).toBe(0)

    expect(asked).toEqual([
      'https://www.harveytool.com/products/miniature-end-mills---ball---extra-long-length',
    ])
    const written = readFileSync(familyCsv('harvey_endmill_025.csv'), 'utf8')
    expect(written).toContain('CUTTER DIA._in')
    expect(written).toContain('14916')
    expect(all()).toContain('wrote 10 rows')
  })

  it('records a receipt naming the vendor family code', async () => {
    const { io } = recorder()

    await run(['harvey', 'harvey_endmill_025.csv'], io, serving(10).fetcher)

    expect(receipts.read(familyCsv('harvey_endmill_025.csv'))).toMatchObject({
      brand: 'harvey',
      familyCode: 'HT-Harvey-EndMill-025',
      rows: 10,
    })
  })

  it('refuses a scrape that lost rows against the declared count', async () => {
    // The one check nothing computes from the file it is checking. Harvey's own
    // add-to-cart payloads are where the declared number came from.
    const { io } = recorder()

    await expect(run(['harvey', 'harvey_endmill_025.csv'], io, serving(9).fetcher)).rejects.toThrow(
      /declares 10/,
    )
  })

  it('refuses a CSV name no Harvey family claims', async () => {
    const { io } = recorder()

    await expect(run(['harvey', 'not_a_family.csv'], io, noNetwork)).rejects.toThrow(
      /Harvey family/,
    )
  })

  it('waits between families, and not before the first', async () => {
    // The per-page scrape is one request and does not pace itself, so this loop
    // is the only thing between a caller naming eight families and eight
    // requests going out back to back. Nowhere else exercises it: every other
    // test here names one family, and the pause is guarded on the index.
    const { io } = recorder()
    const counts: Record<string, number> = {
      '/products/miniature-end-mills---ball---extra-long-length': 10,
      '/products/miniature-end-mills---corner-radius---extra-long-length': 12,
    }
    const fetcher = asFetcher({
      text: (url: string) => {
        const path = Object.keys(counts).find((p) => url.endsWith(p))
        return Promise.resolve(page(counts[path!]!))
      },
    })
    const { waits, restore } = recordPauses()

    try {
      expect(
        await run(['harvey', 'harvey_endmill_025.csv', 'harvey_endmill_026.csv'], io, fetcher),
      ).toBe(0)
    } finally {
      restore()
    }

    expect(waits).toEqual([REQUEST_DELAY_MS])
  })

  it('prints the product pages the category walk finds, paced', async () => {
    // The command passes the walk no delay, so this runs the vendor-facing
    // default. Recording the waits rather than sleeping them is what keeps four
    // roots from costing the suite 1.6 seconds, and it asserts the pacing at
    // the same time.
    const { io, out } = recorder()
    const fetcher = asFetcher({
      text: () =>
        Promise.resolve(
          '<div class="product-grid-component">' +
            '<div class="col-md-4 col-12 item-wrapper"><a href="/products/thing"></a></div>' +
            '</div>',
        ),
    })
    const { waits, restore } = recordPauses()

    try {
      expect(await run(['harvey', '--catalog'], io, fetcher)).toBe(0)
    } finally {
      restore()
    }

    expect(out).toContain('/products/thing')
    expect(waits).toEqual(HARVEY_ROOTS.map(() => REQUEST_DELAY_MS))
  })
})

describe('the maritool command', () => {
  // A MariTool family is 6 listing pages and 11 product pages, and the command
  // paces itself between every one of them — 17 real waits, which is seven
  // seconds of a suite that otherwise runs in two. `recordPauses` is what takes
  // the wait out without taking the code path out, and it keeps what was asked
  // for: `waits` below is the same record `tests/maritool.test.ts` asserts the
  // pacing against, so this block is not the one place the delay disappears.
  let paused: ReturnType<typeof recordPauses>

  beforeEach(() => {
    paused = recordPauses()
  })
  afterEach(() => {
    paused.restore()
  })

  /** One listing row, in MariTool's own markup. */
  const row = (id: string, part: string) => {
    const link = `https://www.maritool.com/x/c23/p${id}/${part}/product_info.html`
    return `<tr class="product-info">
      <td><a href="${link}"><img/></a></td>
      <td><div><a href="${link}" title="${part}">${part} TOOL HOLDER</a></div>
        <div class="product-info-detail"><p>Part#: ${part}</p><p>Brand: MariTool</p></div></td>
    </tr>`
  }

  const listing = (parts: string[][]) =>
    `<html><body>Displaying <b>1</b> to <b>${parts.length}</b> (of <b>${parts.length}</b> products)
     <table><tbody>${parts.map(([id, part]) => row(id!, part!)).join('')}</tbody></table></body></html>`

  const product = (specs: boolean) =>
    specs
      ? `<html><body><div class="product-info-box"><div class="header">Product Specifications</div>
         <table><tr><td><b>Taper:&nbsp;</b></td><td>CAT50</td></tr>
                <tr><td><b>Gage Length:&nbsp;</b></td><td>3.0</td></tr></table></div></body></html>`
      : '<html><body><div class="header">Product Info</div></body></html>'

  /**
   * The CAT50 catalog as MariTool really publishes it: six leaves, eleven
   * parts, and the two in `c23_24_45` publishing no spec table.
   */
  function catalog(): Record<string, string> {
    const counts = [2, 1, 1, 1, 3, 3]
    const pages: Record<string, string> = {}
    let next = 1

    MARITOOL_LEAVES['maritool_cat50_holders.csv'].forEach((leaf, index) => {
      const parts = Array.from({ length: counts[index]! }, () => {
        const id = String(next++)
        return [id, `CAT50-PART-${id.padStart(2, '0')}`]
      })
      pages[categoryUrl(leaf.cPath)] = listing(parts)
      for (const [id, part] of parts) {
        // The first leaf is `c23_24_45`, whose two parts publish no table.
        pages[`https://www.maritool.com/x/c23/p${id}/${part}/product_info.html`] = product(
          index > 0,
        )
      }
    })
    return pages
  }

  const serving = (pages: Record<string, string>) =>
    asFetcher({
      text: (url: string) => {
        const page = pages[url]
        return page === undefined
          ? Promise.reject(new Error(`no fixture for ${url}`))
          : Promise.resolve(page)
      },
    })

  it('scrapes a family into the CSV its own config names, and skips what has no table', async () => {
    // The leaf cPaths come from the family's config, so none is typed again
    // and none can be typed wrong. The declared `rows` is 9 against the
    // vendor's 11 — the two skipped parts are the difference, and
    // `receipts.checkRows` is what holds the two numbers together.
    const { io, all } = recorder()

    expect(await run(['maritool', 'maritool_cat50_holders.csv'], io, serving(catalog()))).toBe(0)

    const written = readFileSync(familyCsv('maritool_cat50_holders.csv'), 'utf8')
    expect(written).toContain('Material Number')
    expect(written).toContain('L1_in')
    expect(all()).toContain('wrote 9 rows')
    expect(all()).toContain('SKIPPED CAT50-PART-01')

    // The identity check against the header the command really wrote, rather
    // than against one a mapper built in memory. Nothing in the write path runs
    // it: `checkIdentityColumns` has one production caller, `registry.toRecords`,
    // and only cutting-tool families reach it — MariTool and REGO-FIX ship
    // toolholding and no column map, so for them this assertion is the whole
    // sensor. A re-scrape whose `Part#` line moved would still parse, still
    // have the right row count, and mint every guid off an empty string.
    expect(() => checkIdentityColumns('maritool', parseCsv(written).header)).not.toThrow()
    // And it fails where the column is gone, so the line above is not passing
    // on a header it never looked at.
    expect(() => checkIdentityColumns('maritool', ['L1_in', 'taper'])).toThrow(/Material Number/)
  })

  it('paces itself between every request the family takes', async () => {
    // 6 listing pages and 11 product pages: a pause before each product page,
    // one closing each leaf, and none before the first request of a leaf whose
    // roster is a single page. The vendor is a small shop and the rule is that
    // a scrape does not raise request volume.
    const { io } = recorder()

    await run(['maritool', 'maritool_cat50_holders.csv'], io, serving(catalog()))

    expect(paused.waits).toHaveLength(17)
    expect(new Set(paused.waits)).toEqual(new Set([REQUEST_DELAY_MS]))
  })

  it('records a receipt naming every leaf it paged', async () => {
    // A MariTool family is scraped from several categories, so the receipt
    // carries all of their cPaths rather than one.
    const { io } = recorder()

    await run(['maritool', 'maritool_cat50_holders.csv'], io, serving(catalog()))

    expect(receipts.read(familyCsv('maritool_cat50_holders.csv'))).toMatchObject({
      brand: 'maritool',
      familyCode: '23_24_45 23_24_429_430 23_24_1978 23_24_429_1979 23_24_957 23_24_429_1512',
      rows: 9,
    })
  })

  it('refuses a scrape that lost rows against the declared count', async () => {
    const { io } = recorder()
    const pages = catalog()
    // The last leaf now publishes two parts where the family declares three.
    const last = MARITOOL_LEAVES['maritool_cat50_holders.csv'].at(-1)!
    pages[categoryUrl(last.cPath)] = listing([
      ['90', 'CAT50-PART-90'],
      ['91', 'CAT50-PART-91'],
    ])
    for (const id of ['90', '91']) {
      pages[`https://www.maritool.com/x/c23/p${id}/CAT50-PART-${id}/product_info.html`] =
        product(true)
    }

    await expect(
      run(['maritool', 'maritool_cat50_holders.csv'], io, serving(pages)),
    ).rejects.toThrow(/declares 9/)
  })

  it('refuses a CSV name no MariTool family claims', async () => {
    const { io } = recorder()

    await expect(run(['maritool', 'not_a_family.csv'], io, noNetwork)).rejects.toThrow(
      /MariTool family/,
    )
  })

  it('prints the categories the walk finds, and which are leaves', async () => {
    const { io, out } = recorder()
    const fetcher = asFetcher({
      text: (url: string) =>
        Promise.resolve(
          url.includes('cPath=23_25_42')
            ? '<html><head><title>x ER Collet Chucks - MariTool</title></head>' +
                '<body>Displaying <b>1</b> to <b>1</b> (of <b>7</b> products)</body></html>'
            : '<html><head><title>x CAT40 - MariTool</title></head><body>' +
                '<a href="https://www.maritool.com/s/c23_25_42/index.html">ER</a></body></html>',
        ),
    })

    expect(await run(['maritool', '--catalog'], io, fetcher)).toBe(0)

    expect(out.join('\n')).toContain('cPath=23_25_42')
    expect(out.join('\n')).toContain('of them leaves')
  })
})

describe('the in-place commands', () => {
  it('rejects a CSV that is not a holder family', async () => {
    const { io } = recorder()

    await expect(run(['cad', 'nope.csv'], io, noNetwork)).rejects.toThrow(/unknown holder CSV/)
  })

  it('makes no request for the cad step on a vendor that has no lookup', async () => {
    // `annotateCadUrls` posts to Kennametal's CDS and rewrites CAD_STEP_URL on
    // every row, so running it over the REGO-FIX holders would send that
    // vendor's SKUs to Kennametal and blank the URLs its own scrape filled in.
    // `noNetwork` throws on any request, so a green run here is the assertion.
    const { io, out } = recorder()
    const name = Object.keys(HOLDER_FAMILIES).find((n) => n.startsWith('regofix'))
    expect(name).toBeDefined()

    expect(await run(['cad', name!], io, noNetwork)).toBe(0)
    expect(out.join('\n')).toContain(`${name}: nothing to annotate — regofix publishes`)
  })

  it('carries on past a vendor it cannot annotate, family after family', async () => {
    // It exited 2 on the first non-Kennametal family until 2026-09-02, which
    // made `cad <every holder family>` impossible on a catalog holding more
    // than one vendor's — the argument for a no-op with a message.
    const names = Object.keys(HOLDER_FAMILIES).filter(
      (n) => familyBrand(familyConfig(n)) !== 'kennametal',
    )
    expect(new Set(names.map((n) => familyBrand(familyConfig(n)))).size).toBeGreaterThan(1)
    const { io, out } = recorder()

    expect(await run(['cad', ...names], io, noNetwork)).toBe(0)
    for (const name of names) expect(out.join('\n'), name).toContain(`${name}: nothing to annotate`)
  })

  it('reports one family it has no CSV for rather than failing on it', async () => {
    const { io, out } = recorder()
    const name = Object.keys(HOLDER_FAMILIES).find((n) => n.startsWith('regofix'))

    expect(await run(['cad', name!], io, noNetwork)).toBe(0)
    expect(out.join('\n')).toContain('not scraped on this machine')
  })

  it('rejects a CSV that is not a tool family', async () => {
    const { io } = recorder()

    await expect(run(['materials', 'nope.csv'], io, noNetwork)).rejects.toThrow(
      /unknown family CSV/,
    )
  })

  it('derives a thread pitch in each row’s own system', async () => {
    // The CLI resolves the path through the family's own brand, so the file
    // has to be written where that resolves to — a typed directory is ignored
    // precisely so one vendor's receipt cannot land in another's.
    const path = familyCsv(TAPS)
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(
      path,
      toCsv(
        ['Material Number', 'D1-TDZ', 'Z', 'Thread System'],
        [
          {
            'Material Number': '1',
            'D1-TDZ': '#4-40',
            Z: '2',
            'Thread System': 'inch',
          },
        ],
      ),
    )

    const { io, out } = recorder()
    expect(await run(['thread-pitch', TAPS], io, noNetwork)).toBe(0)

    const written = readFileSync(path, 'utf8')
    expect(written.split('\r\n')[0]).toBe('Material Number,D1-TDZ,Thread Pitch,Z,Thread System')
    expect(written).toContain('1,#4-40,0.025,2,inch')
    expect(out.join('\n')).toContain(`${TAPS}: 1 rows updated`)
  })
})

describe('the coverage command', () => {
  /** One holder family's CSV on disk, with `n` rows and `withStep` of them modelled. */
  function holders(name: string, rows: number, withStep: number, withDxf = 0): void {
    const path = familyCsv(name)
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(
      path,
      toCsv(
        ['Material Number', CAD_COLUMN, CAD_DXF_COLUMN],
        Array.from({ length: rows }, (_, i) => ({
          'Material Number': `P${i}`,
          [CAD_COLUMN]: i < withStep ? `https://cdn.invalid/${i}.stp` : '',
          [CAD_DXF_COLUMN]: i < withDxf ? `https://cdn.invalid/${i}.dxf` : '',
        })),
      ),
    )
  }

  const MARITOOL = 'maritool_cat40_holders.csv'
  const REGOFIX = 'regofix_bt30_pg_holders.csv'

  it('reports the share of a family that publishes a model, and asks for none of it', async () => {
    holders(MARITOOL, 10, 7, 9)
    const { io, out } = recorder()

    // `noNetwork` throws on any request. This command reads CSVs and nothing else.
    expect(await run(['coverage', MARITOOL], io, noNetwork)).toBe(0)
    expect(out.join('\n')).toContain(`${MARITOOL}: 10 rows, 7 STEP (70%), 9 DXF`)
  })

  it('totals across families, and only when there is more than one to total', async () => {
    holders(MARITOOL, 10, 7)
    holders(REGOFIX, 10, 10)
    const { io, out } = recorder()

    expect(await run(['coverage', MARITOOL, REGOFIX], io, noNetwork)).toBe(0)
    expect(out.join('\n')).toContain('2 families: 20 rows, 17 STEP (85%), 0 DXF')

    const one = recorder()
    expect(await run(['coverage', MARITOOL], one.io, noNetwork)).toBe(0)
    expect(one.out.join('\n')).not.toContain('families:')
  })

  it('reports a family it has no CSV for rather than failing the whole report', async () => {
    // The whole command is a report, and one absent CSV must not stop it
    // printing the rest — which is the shape the `cad` step had wrong.
    holders(MARITOOL, 4, 4)
    const { io, out } = recorder()

    expect(await run(['coverage', MARITOOL, REGOFIX], io, noNetwork)).toBe(0)
    expect(out.join('\n')).toContain(`${REGOFIX}: not scraped on this machine`)
    expect(out.join('\n')).toContain(`${MARITOOL}: 4 rows, 4 STEP (100%)`)
  })

  it('covers every holder family when given no arguments', async () => {
    holders(MARITOOL, 2, 1)
    const { io, out } = recorder()

    expect(await run(['coverage'], io, noNetwork)).toBe(0)
    for (const name of Object.keys(HOLDER_FAMILIES)) {
      expect(out.join('\n'), name).toContain(name)
    }
  })

  it('refuses a CSV name no holder family claims', async () => {
    const { io } = recorder()

    await expect(run(['coverage', 'nope.csv'], io, noNetwork)).rejects.toThrow(/unknown holder CSV/)
  })

  it('reads an empty family as no rows rather than as a division by zero', async () => {
    holders(MARITOOL, 0, 0)
    const { io, out } = recorder()

    expect(await run(['coverage', MARITOOL], io, noNetwork)).toBe(0)
    expect(out.join('\n')).toContain(`${MARITOOL}: 0 rows, 0 STEP (—), 0 DXF`)
  })
})

describe('the profiles command', () => {
  /**
   * A Kennametal ER-adapter CSV on disk. Its family declares the taper, the
   * contact and the clamping mode as facts, so a row is a part number, a gage
   * length and the collet series it takes.
   */
  const ADAPTERS = 'bt30_er_collet_adapters_metric.csv'

  function scraped(parts: { catalog: string; material: string; l1: string }[]): void {
    const path = familyCsv(ADAPTERS)
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(
      path,
      toCsv(
        ['Material Number', 'ISO Catalog Number', 'L1_mm', 'CST'],
        parts.map((p) => ({
          'Material Number': p.material,
          'ISO Catalog Number': p.catalog,
          L1_mm: p.l1,
          CST: 'ER16',
        })),
      ),
    )
  }

  /** One mirrored STEP file, whose contents nothing here reads. */
  function mirrored(catalog: string): void {
    const dir = stepDir('kennametal')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, `${catalog}.stp`), 'ISO-10303-21;')
  }

  /** A holder API that measures every part as the same 60 mm BT30 chuck. */
  function measuring(): HolderApi {
    return {
      pollIntervalMs: 0,
      pollTimeoutMs: 1000,
      call: <T>(method: string, path: string) => {
        if (method === 'POST') {
          return Promise.resolve({
            holderId: 'h-1',
            uploadUrl: 'https://storage.invalid/put',
          } as T)
        }
        if (method === 'PATCH') return Promise.resolve({ jobId: 'j-1' } as T)
        if (path.includes('/v1/jobs/')) return Promise.resolve({ status: 'succeeded' } as T)
        return Promise.resolve({
          kernelVersion: '0.7.2',
          options: { tolerance: 0.05, fillBays: false, flipped: false },
          layers: [
            { thickness: 48.4, bottomDiameter: 32, topDiameter: 17 },
            { thickness: 60, bottomDiameter: 23, topDiameter: 32 },
          ],
          gaugeLength: 60,
          sizeClass: 30,
          taperFamily: 'iso7x24',
        } as T)
      },
      put: () => Promise.resolve(),
    }
  }

  it('announces the API base URL beside the scrape root, before anything uploads', async () => {
    // This is the one command that sends a vendor's binary to Toolpath, and
    // production is still v1.1.0 with none of these routes on it.
    scraped([{ catalog: 'BT30ER16060M', material: '1258023', l1: '60' }])
    mirrored('BT30ER16060M')
    const { io, out } = recorder()

    expect(await run(['profiles', ADAPTERS], io, noNetwork, measuring())).toBe(0)
    expect(out[0]).toContain('scrape root:')
    expect(out[1]).toContain(`holder API:`)
    expect(out[1]).toContain(API_URL_ENV)
  })

  it('writes the family document and the merged one, and counts what agrees', async () => {
    scraped([
      { catalog: 'BT30ER16060M', material: '1258023', l1: '60' },
      { catalog: 'BT30ER16100M', material: '1258024', l1: '100' },
    ])
    mirrored('BT30ER16060M')
    mirrored('BT30ER16100M')
    const { io, out } = recorder()

    expect(await run(['profiles', ADAPTERS], io, noNetwork, measuring())).toBe(0)

    const family = JSON.parse(
      readFileSync(join(root, 'kennametal/profiles/bt30_er_collet_adapters_metric.json'), 'utf8'),
    )
    expect(family.holderCount).toBe(2)
    expect(family.unit).toBe('millimeters')
    expect(family.kernelVersion).toBe('0.7.2')

    // The stub measures both at 60 mm, so the 100 mm row is 40 mm short — well
    // past the 1 mm tolerance, and reported as such rather than smoothed over.
    expect(out.join('\n')).toContain('2 profiles, 1 complete')

    const merged = JSON.parse(readFileSync(profilesJson(), 'utf8'))
    expect(Object.keys(merged.holders)).toEqual(Object.keys(family.holders))
  })

  it('reports a holder with no mirrored model rather than failing on it', async () => {
    // MariTool publishes no STEP model for about a third of its parts and none
    // at all for its CAT50 line.
    scraped([
      { catalog: 'BT30ER16060M', material: '1258023', l1: '60' },
      { catalog: 'BT30ER20060M', material: '1258025', l1: '60' },
    ])
    mirrored('BT30ER16060M')
    const { io, out } = recorder()

    expect(await run(['profiles', ADAPTERS], io, noNetwork, measuring())).toBe(0)
    expect(out.join('\n')).toContain('1 holders publish no mirrored model')
    expect(out.join('\n')).toContain('1 profiles, 1 complete')
  })

  it('writes nothing and says why when the family has no mirrored models at all', async () => {
    scraped([{ catalog: 'BT30ER16060M', material: '1258023', l1: '60' }])
    const { io, out } = recorder()

    expect(await run(['profiles', ADAPTERS], io, noNetwork, measuring())).toBe(0)
    expect(out.join('\n')).toContain('run mirror-cad first')
    expect(existsSync(profilesJson())).toBe(false)
  })

  it('refuses a CSV name no holder family claims', async () => {
    const { io } = recorder()
    await expect(run(['profiles', 'nope.csv'], io, noNetwork, measuring())).rejects.toThrow(
      /unknown holder CSV/,
    )
  })

  it('prints the usage rather than measuring nothing', async () => {
    const { io, err } = recorder()
    expect(await run(['profiles'], io, noNetwork)).toBe(2)
    expect(err.join('\n')).toContain('usage: toolpath-scrape')
  })
})

describe('unknown input', () => {
  it('refuses an unknown command with a usage message', async () => {
    const { io, err } = recorder()

    expect(await run(['convert'], io, noNetwork)).toBe(2)
    expect(err.join('\n')).toContain('unknown command "convert"')
    expect(err.join('\n')).toContain('usage: toolpath-scrape')
  })
})

describe('the emuge command', () => {
  const NAME = 'emuge_drills.csv'
  const GROUP = {
    code: 'H109070',
    productListInfo: 'Solid carbide twist drill, 5xD.',
    technicalDetails: [{ property: 'Specification', value: 'Twist drill' }],
  }
  const VARIANT = {
    code: '000000000010727835',
    articleCode: 'TA219744.0300',
    dimensionFeatureValue: 'd1=3,0',
    mainDrawing: {
      technicalDetails: [
        { property: 'nominal diameter d₁ [mm]', value: '3 mm' },
        { property: 'Shank diameter d₂', value: '6 mm' },
        { property: 'Overall length l₁', value: '66 mm' },
        { property: 'Flute length l₂', value: '28 mm' },
      ],
    },
  }
  const DETAIL = {
    code: VARIANT.code,
    technicalDetails: [
      { property: 'point angle', value: '140 deg' },
      { property: 'Coolant supply', value: 'internal coolant supply' },
      { property: 'Cutting material', value: 'carbide' },
      { property: 'Coating', value: 'TIALN-T63' },
    ],
    applicationMaterials: [{ code: 'P' }, { code: 'M' }],
  }

  /** The vendor's three calls, answered from the fixtures above. */
  const serving = () =>
    asFetcher({
      json: (url: string) => {
        const params = new URL(url).searchParams
        if (params.get('productCodes') !== null) return Promise.resolve([DETAIL])
        if (params.get('searchQueryContext') === 'KLAMMER_GROUPING') {
          return Promise.resolve({ pagination: { totalPages: 1 }, products: [GROUP] })
        }
        return Promise.resolve({ pagination: { totalPages: 1 }, products: [VARIANT] })
      },
    })

  it('writes the CSV and its receipt, then refuses the count it wrote', async () => {
    // The category, the facet and the unit all come from the family's config,
    // so none is typed again. One row against a family that declares 2,670 is
    // the point of the second number: `receipts.checkRows` refuses it, and the
    // CSV and the receipt are already on disk when it does — a scrape that
    // reported a count and wrote no receipt is the state this package exists to
    // stop.
    const { io, all } = recorder()

    await expect(run(['emuge', NAME], io, serving())).rejects.toThrow(/declares 2670/)

    const written = readFileSync(familyCsv(NAME), 'utf8')
    expect(written).toContain('Material Number')
    expect(written).toContain('ISO Catalog Number')
    expect(written).toContain('Overall length l₁_mm')
    expect(written).toContain('point angle')
    expect(all()).toContain('wrote 1 rows')
    expect(() => checkIdentityColumns('emuge', parseCsv(written).header)).not.toThrow()
    expect(receipts.read(familyCsv(NAME))).toMatchObject({
      brand: 'emuge',
      familyCode: 'FB01',
      rows: 1,
    })
  })

  it('refuses a CSV name no EMUGE-FRANKEN family claims', async () => {
    const { io } = recorder()

    await expect(run(['emuge', 'not_a_family.csv'], io, noNetwork)).rejects.toThrow(
      /EMUGE-FRANKEN family/,
    )
  })
})
