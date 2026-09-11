/**
 * A JavaScript object literal inlined in a page -> JSON. No Harvey knowledge.
 *
 * Harvey Tool serves its whole variant table as `var tableData1 = [{...}]` in a
 * ~557 KB `<script>` block, with bare identifier keys that `JSON.parse` refuses.
 * This module is the smallest thing that turns one into JSON, and it is separate
 * from every other file here because it knows nothing about tools: it takes a
 * document and a variable name and hands back a value.
 *
 * ## The obvious regex is a silent data corruptor
 *
 * The reflex is `/([{,])\s*(\w+)\s*:/` -> `'$1"$2":'` and then `JSON.parse`. It
 * is wrong, and wrong in the worst way — it produces a document that parses.
 *
 * Harvey's cells carry HTML with quotes and colons in them:
 *
 * ```js
 * t:"color:#70C0FF"
 * d:"<a href=\"/products/tool-details-24502\">24502</a>"
 * ```
 *
 * `color:` inside that first string is not an object key, and a `{x:1}` in a
 * product description is not an object. A regex has no way to know, so it
 * rewrites text inside strings and the result is a scrape that still produces
 * rows, still passes a row count, and has wrong data in it.
 *
 * So this walks the source once, tracking whether it is inside a string and
 * whether the last character was an escape, and quotes a bare key only when it
 * is genuinely at an object-key position. That is about sixty lines and it is
 * the difference between a parser and a coincidence.
 *
 * ## Two passes over the same scan
 *
 * {@link findLiteral} locates `var <name> =` by index and then brace-matches
 * forward with the same string-aware rules, so a whole 720 KB document is never
 * handed to a regex engine more than once per variable. 18 MB of HTML goes
 * through this code on a full scrape; a repeated whole-document match is what
 * turns that into minutes of CPU.
 */

import { VendorResponseError } from '../../errors.js'

/** Opening brackets, and the closer each one expects. */
const CLOSERS: Record<string, string> = { '{': '}', '[': ']' }

/** True where `ch` can begin a bare JavaScript identifier. */
function identifierStart(ch: string): boolean {
  return /[A-Za-z_$]/.test(ch)
}

/** True where `ch` can continue one. */
function identifierPart(ch: string): boolean {
  return /[A-Za-z0-9_$]/.test(ch)
}

/**
 * The source text of the bracketed value assigned to `var <name>`.
 *
 * Returns null when the document declares no such variable, which is an
 * ordinary answer: Harvey emits `cols1` through `cols10` on every page and
 * leaves the unused ones empty, and a page with one table simply has no
 * `tableData2`.
 *
 * Throws when the assignment is there but its brackets never balance, because
 * that is a truncated response rather than an absent one, and returning null
 * would report it as a page with fewer tables.
 */
export function findLiteral(source: string, name: string): string | null {
  const declaration = new RegExp(`\\bvar\\s+${name}\\s*=\\s*`, 'g')
  const match = declaration.exec(source)
  if (match === null) return null

  // The regex has already consumed the whitespace after `=`, so the literal
  // starts here or nowhere. Searching forward for the next bracket instead
  // would happily find one inside the *next* variable's string.
  const start = match.index + match[0].length
  if (source[start] !== '[' && source[start] !== '{') {
    throw new VendorResponseError(name, 'is assigned something that is not an array or object')
  }

  const end = matchBracket(source, start, name)
  return source.slice(start, end + 1)
}

/**
 * The index of the bracket closing the one at `start`, string-aware.
 *
 * The whole reason this is not a depth counter over the raw text: a `}` inside
 * a `d` cell's HTML would close an object that is still open, and every
 * following column would land one key to the left.
 */
function matchBracket(source: string, start: number, what: string): number {
  const stack: string[] = []
  let inString = false
  let escaped = false

  for (let i = start; i < source.length; i++) {
    const ch = source[i]!

    if (inString) {
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === '"') inString = false
      continue
    }

    if (ch === '"') {
      inString = true
    } else if (ch === '{' || ch === '[') {
      stack.push(CLOSERS[ch]!)
    } else if (ch === '}' || ch === ']') {
      const expected = stack.pop()
      if (expected !== ch) {
        throw new VendorResponseError(
          what,
          `has ${JSON.stringify(ch)} at offset ${i - start} where ` +
            `${expected === undefined ? 'nothing was open' : JSON.stringify(expected)} was due`,
        )
      }
      if (stack.length === 0) return i
    }
  }

  throw new VendorResponseError(
    what,
    'is not closed before the end of the document — a truncated response',
  )
}

/**
 * A JavaScript object literal as JSON text: bare keys quoted, everything else
 * byte for byte.
 *
 * Only *keys* are rewritten. A bare word at a value position — `undefined`, a
 * single-quoted string — is left where it is and `JSON.parse` refuses it, which
 * is the right outcome: the page changed shape, and inventing a reading for a
 * token this has never seen is how a scraper starts authoring data.
 */
export function toJson(literal: string, what: string): string {
  const out: string[] = []
  // Whether the innermost bracket is an object, and whether the next token in
  // it is a key. Both are needed: `[{a:1}]` is at key position after `{` but
  // not after `[`, and `{a:[1,2]}` is not at key position after that comma.
  const objects: boolean[] = []
  let expectKey = false
  let inString = false
  let escaped = false

  for (let i = 0; i < literal.length; i++) {
    const ch = literal[i]!

    if (inString) {
      out.push(ch)
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === '"') inString = false
      continue
    }

    if (ch === '"') {
      inString = true
      expectKey = false
      out.push(ch)
      continue
    }

    if (ch === '{' || ch === '[') {
      objects.push(ch === '{')
      expectKey = ch === '{'
      out.push(ch)
      continue
    }

    if (ch === '}' || ch === ']') {
      objects.pop()
      expectKey = false
      out.push(ch)
      continue
    }

    if (ch === ',') {
      expectKey = objects[objects.length - 1] === true
      out.push(ch)
      continue
    }

    if (ch === ':') {
      expectKey = false
      out.push(ch)
      continue
    }

    if (/\s/.test(ch)) {
      out.push(ch)
      continue
    }

    if (expectKey && identifierStart(ch)) {
      let end = i
      while (end < literal.length && identifierPart(literal[end]!)) end++
      out.push(JSON.stringify(literal.slice(i, end)))
      i = end - 1
      expectKey = false
      continue
    }

    if (ch === "'") {
      // Never seen on a Harvey page, and re-escaping one into a JSON string is
      // guesswork about what the vendor meant. Refuse loudly instead.
      throw new VendorResponseError(what, `has a single-quoted string at offset ${i}`)
    }

    expectKey = false
    out.push(ch)
  }

  return out.join('')
}

/**
 * The value of `var <name>` in `source`, parsed.
 *
 * Null where the variable is absent — see {@link findLiteral}.
 */
export function readLiteral<T>(source: string, name: string): T | null {
  const literal = findLiteral(source, name)
  if (literal === null) return null

  try {
    return JSON.parse(toJson(literal, name)) as T
  } catch (error) {
    throw new VendorResponseError(
      name,
      `is not a readable object literal: ${(error as Error).message}`,
    )
  }
}
