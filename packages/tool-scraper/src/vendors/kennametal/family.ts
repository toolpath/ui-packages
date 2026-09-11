/**
 * A family page's own title, for every brand on Kennametal's AEM platform.
 *
 * `scrape.ts` reads the variant *table* that a family page renders; this reads
 * the heading above it. They are two requests against the same family because
 * they are two different AEM resources — the table is a component node's
 * `.variants.<code>.html` selector and the title is the page — and the second
 * is what nothing else in this package publishes:
 *
 * ```html
 * <h1>KenCut™ FF • HPFT • Square End • 6 Flutes • Plain Shank • Inch</h1>
 * ```
 *
 * ## The slug does not matter
 *
 * The vendor's own links are `fam.<slug>.<code>.html`, and AEM resolves the
 * page off the numeric code alone — `fam.x.100003783.html` answers 200 with
 * exactly the page above. That is what makes this reachable from a
 * `familyCode` and nothing else: `families/kennametal.ts` records the code
 * because the variants endpoint needs it, and no family in it carries a slug.
 *
 * **`fam.<code>.html` — the code with no slug segment at all — 301s**, so the
 * placeholder is load-bearing rather than decoration. {@link FAMILY_SLUG} is
 * what fills it.
 *
 * ## Why the page is trusted to be the right one
 *
 * A URL built from a code that no longer names a family would answer *some*
 * page, and a title read off it would be silently wrong for a whole table. So
 * the page's own `data-product-code` is checked against the code that was
 * asked for, and a mismatch throws. It is the same argument
 * `scrape.parseVariantTable` makes for telling the vendor's no-results notice
 * apart from a response that changed shape: a scrape that reports the wrong
 * answer confidently is worse than one that stops.
 *
 * ## What the title is, and what only part of it is
 *
 * The whole `h1` is the family's name and reaches the CSV whole, under
 * `conventions.FAMILY_TITLE_COLUMN`. Its **leading `•` segment** is the
 * product line — `KenCut™ FF`, `HARVI™ I TE`, `VariMill™ Chip Splitters` —
 * and that is the part `records.ToolRecord.productLine` keeps. Everything
 * after it describes the shape, the flute count, the shank and the unit, which
 * are already canonical geometry on the record.
 *
 * The split is the vendor's own punctuation and not a guess at where a name
 * ends: every family title on both hosts is `•`-separated, and a title with no
 * separator is its own product line.
 */

import { Parser } from 'htmlparser2'

import { VendorResponseError } from '../../errors.js'
import type { Fetcher } from '../../fetch.js'
import { BRANDS, type AemBrandName } from '../../identity.js'

/**
 * The URL shape of a family page.
 *
 * `{host}` and `{code}` are filled; `{slug}` is {@link FAMILY_SLUG}. Stated as
 * one template beside `scrape.BASE` so that the two URLs this adapter builds
 * are readable together.
 */
export const FAMILY_PAGE = 'https://www.{host}/us/en/products/fam.{slug}.{code}.html'

/**
 * What goes where the vendor writes a human-readable slug.
 *
 * AEM ignores it — see the module note — and this package has no slug to put
 * there, because a `familyCode` is the only handle `families/kennametal.ts`
 * records. A word rather than a single letter so that a request showing up in
 * somebody's log says what it is.
 */
export const FAMILY_SLUG = 'family'

/** The vendor's own separator between the parts of a family title. */
export const TITLE_SEPARATOR = '•'

/** The attribute a family page states its own code in. */
const PRODUCT_CODE_ATTR = 'data-product-code'

/** One family page's URL. */
export function familyPageUrl(code: string, brand: AemBrandName = 'kennametal'): string {
  const { host } = BRANDS[brand]
  return FAMILY_PAGE.replace('{host}', host).replace('{slug}', FAMILY_SLUG).replace('{code}', code)
}

/** What {@link parseFamilyPage} reads off a family page. */
export interface FamilyPage {
  /** The `h1`, collapsed. */
  readonly title: string
  /** The code the page states for itself, or null where it states none. */
  readonly code: string | null
}

/**
 * The family title and the page's own code.
 *
 * `htmlparser2` rather than a regex for the same reason `scrape.TableParser`
 * uses it: these pages carry `&deg;`, `&Oslash;` and `&trade;` in their text,
 * and a `KenCut&trade; FF` reaching the CSV as eleven characters is the bug
 * `decodeEntities` exists to prevent. The `™` in every title above is exactly
 * that entity.
 *
 * The **first** `h1` is taken. The pages carry one, and reading the first is
 * what makes a second one added below the fold somebody else's problem rather
 * than a title that changes under a re-scrape.
 */
export function parseFamilyPage(html: string): FamilyPage {
  let title: string | null = null
  let depth = 0
  let text = ''
  let code: string | null = null

  const parser = new Parser(
    {
      onopentag: (tag, attribs) => {
        if (tag === 'h1' && title === null) depth += 1
        const stated = attribs[PRODUCT_CODE_ATTR]
        if (code === null && stated !== undefined && stated !== '') code = stated
      },
      ontext: (chunk) => {
        if (depth > 0) text += chunk
      },
      onclosetag: (tag) => {
        if (tag === 'h1' && depth > 0) {
          depth -= 1
          if (depth === 0) {
            title = text.split(/\s+/).filter(Boolean).join(' ')
            text = ''
          }
        }
      },
    },
    { decodeEntities: true },
  )
  parser.write(html)
  parser.end()

  return { title: title ?? '', code }
}

/**
 * A family title's leading segment — the product line.
 *
 * `''` in and `''` out, which is the one case the caller has to keep: a page
 * with no `h1` states no line, and {@link fetchFamily} answers null for it
 * rather than an empty name. See `records.ToolRecord.productLine`.
 */
export function productLineOf(title: string): string {
  return (title.split(TITLE_SEPARATOR)[0] ?? '').trim()
}

/** A family's title and product line, or nulls where the page states none. */
export interface Family {
  readonly title: string
  readonly productLine: string | null
}

/**
 * One family page, read.
 *
 * The one network call in this module — the seam a test replaces, exactly as
 * `scrape.fetchVariants` is.
 *
 * A page that answers with no `h1` is **not** an error: it is a family the
 * vendor publishes without a heading, and the table below it is still a table
 * of real parts. It comes back with an empty title and a null line, and the
 * rows are written without either column rather than the scrape stopping. A
 * page whose `data-product-code` names a *different* family is the other case
 * and throws — see the module note.
 */
export async function fetchFamily(
  fetcher: Fetcher,
  code: string,
  brand: AemBrandName = 'kennametal',
): Promise<Family> {
  const url = familyPageUrl(code, brand)
  const { title, code: stated } = parseFamilyPage(await fetcher.text(url))

  if (stated !== null && stated !== code) {
    throw new VendorResponseError(
      url,
      `is the page for ${JSON.stringify(stated)} and not ${JSON.stringify(code)} — ` +
        `the family code was retired or redirected, and its title would name the ` +
        `wrong product line for every row of the table`,
    )
  }

  const line = productLineOf(title)
  return { title, productLine: line === '' ? null : line }
}
