/**
 * A product table's two-row `<thead>` -> one flat column per `cols<N>` entry.
 *
 * Harvey publishes a table's header in the DOM and its data in a JavaScript
 * literal, and the only thing joining them is position: `cols1` is
 * `[{data:"a0"}, {data:"a1"}, ...]` and its Nth entry is the Nth column of the
 * flattened header. That alignment is checked on every table — see
 * `scrape.ts` — because a header that has drifted by one column produces a CSV
 * where every dimension is labelled as its neighbour.
 *
 * ## Flattening
 *
 * The header is exactly two `<tr>`s. A top `<th>` with `rowspan >= 2` is its own
 * column and has no sub-label (only "Add to Cart" is like this); otherwise it
 * consumes `colspan` cells from the second row as its sub-labels. Verified
 * against all 80 tables on the 52 product pages.
 *
 * ## Two things about the text
 *
 * **`<br>` is a space.** `CUTTER <br/>DIAMETER` is the same label as
 * `CUTTER DIAMETER`, and collapsing the tag away instead yields
 * `CUTTERDIAMETER` — a 51st header shape that exists only in the parser.
 *
 * **A sub-label's tolerance is excluded, not stripped afterwards.** The
 * tolerance is rendered in its own `div.hpc-inline`, so skipping that subtree
 * gives `D1` where reading the whole cell gives `D1+.0005"-.0005"`. It matters
 * more than tidiness: Harvey's tolerance text carries typos — `D1+0005"-.0005"`,
 * `R+.001"-001"`, `L2.020"-.000"` are all real — and every one of them would be
 * another spelling for a post-hoc stripper to get right.
 */

import { Parser } from 'htmlparser2'

import { VendorResponseError } from '../../errors.js'

/** The class of the `<div>` holding a sub-label's published tolerance. */
export const TOLERANCE_CLASS = 'hpc-inline'

/** The class Harvey renders an unlabelled annotation column's header with. */
export const HIDDEN_CLASS = 'white-text'

/** Sub-label text that carries nothing. `&nbsp;` collapses to empty here. */
const JUNK = new Set(['', '.', '"', 'X'])

/** True where a header label says nothing about what the column holds. */
export function isJunkLabel(label: string): boolean {
  return JUNK.has(label)
}

/** One `<th>` as parsed: its text, its span, and its class attribute. */
interface HeaderCell {
  text: string
  colspan: number
  rowspan: number
  className: string
}

/** One data column of a table, as the header describes it. */
export interface HeaderColumn {
  /** The top row's label, `<br>`s collapsed to spaces. */
  top: string
  /** The second row's label with its tolerance removed, or null under a rowspan. */
  sub: string | null
  /** The top `<th>`'s class attribute — `white-text` marks a hidden column. */
  topClass: string
  /** How many columns the top `<th>` spanned. 1 unless it is a coating group. */
  span: number
  /** This column's index inside that span. 0 on a column of its own. */
  slot: number
}

/** `" a  b \n"` -> `"a b"`. */
function collapse(text: string): string {
  return text.split(/\s+/).filter(Boolean).join(' ')
}

/**
 * The `<th>` rows of the `<thead>` of the table with this id.
 *
 * Streams the whole document rather than slicing it: a `</table>` inside a cell
 * would end a sliced segment early, and htmlparser2 is already this package's
 * one parser dependency.
 *
 * `decodeEntities` is on because these headers carry `&nbsp;` and `&deg;` —
 * the blank flute sub-label is literally `&nbsp;&nbsp;`, and it has to reach
 * {@link isJunkLabel} as an empty string rather than as two characters.
 */
export function parseHeadRows(html: string, tableId: string): HeaderCell[][] {
  const rows: HeaderCell[][] = []

  let inTable = false
  let inHead = false
  let row: HeaderCell[] | null = null
  let cell: HeaderCell | null = null
  // A depth counter rather than a flag: the tolerance is a `div` inside a `div`,
  // and a flag would re-enable the text on the inner close tag.
  let tolerance = 0
  let depth = 0

  const parser = new Parser(
    {
      onopentag: (tag, attribs) => {
        if (tag === 'table') {
          inTable = attribs['id'] === tableId
          return
        }
        if (!inTable) return
        if (tag === 'thead') {
          inHead = true
        } else if (inHead && tag === 'tr') {
          row = []
        } else if (inHead && tag === 'th' && row !== null) {
          cell = {
            text: '',
            colspan: Number.parseInt(attribs['colspan'] ?? '1', 10) || 1,
            rowspan: Number.parseInt(attribs['rowspan'] ?? '1', 10) || 1,
            className: attribs['class'] ?? '',
          }
          tolerance = 0
          depth = 0
        } else if (cell !== null) {
          depth++
          if (tolerance === 0 && (attribs['class'] ?? '').split(/\s+/).includes(TOLERANCE_CLASS)) {
            tolerance = depth
          }
          if (tag === 'br') cell.text += ' '
        }
      },
      ontext: (text) => {
        if (cell !== null && tolerance === 0) cell.text += text
      },
      onclosetag: (tag) => {
        if (!inTable) return
        if (tag === 'th' && cell !== null) {
          row?.push({ ...cell, text: collapse(cell.text) })
          cell = null
        } else if (tag === 'tr' && row !== null) {
          rows.push(row)
          row = null
        } else if (tag === 'thead') {
          inHead = false
          // Everything after the head is data the literal already carries.
          inTable = false
        } else if (cell !== null) {
          if (tolerance === depth) tolerance = 0
          depth--
        }
      },
    },
    { decodeEntities: true },
  )
  parser.write(html)
  parser.end()

  return rows
}

/**
 * One table's header, flattened to one entry per data column.
 *
 * Throws when the table is not in the document, rather than returning an empty
 * header: a page that stopped serving a table it declares in `cols<N>` is a
 * response that changed shape, and a zero-column table would reach the caller
 * looking like a family the vendor discontinued.
 */
export function flatHeader(html: string, tableId: string): HeaderColumn[] {
  const rows = parseHeadRows(html, tableId)
  if (rows.length === 0) {
    throw new VendorResponseError(tableId, 'has no <thead> on the page — the table changed shape')
  }

  const [top = [], sub = []] = rows
  const columns: HeaderColumn[] = []
  let next = 0

  for (const cell of top) {
    if (cell.rowspan >= 2) {
      columns.push({ top: cell.text, sub: null, topClass: cell.className, span: 1, slot: 0 })
      continue
    }
    for (let slot = 0; slot < cell.colspan; slot++) {
      columns.push({
        top: cell.text,
        sub: sub[next]?.text ?? '',
        topClass: cell.className,
        span: cell.colspan,
        slot,
      })
      next++
    }
  }

  if (next > sub.length) {
    throw new VendorResponseError(
      tableId,
      `spans ${next} sub-labels across its top row but the second row has ` +
        `${sub.length} — the header changed shape`,
    )
  }

  return columns
}

/**
 * The vendor's own symbol for a dimension column — `D1`, `L2`, `R`, `A1`, `#`.
 *
 * Null where the sub-label carries none, which is a real state rather than a
 * fault: `NECK DIA.` publishes no symbol at all, and the ratio columns publish
 * junk.
 *
 * A trailing `(h6)` is part of the shank tolerance class and not of the symbol,
 * so `D2(h6)` and `D2` are the same column.
 */
export function symbolOf(sub: string | null): string | null {
  if (sub === null) return null
  const match = /^([A-Z]+\d*)/.exec(sub)
  return match?.[1] ?? null
}
