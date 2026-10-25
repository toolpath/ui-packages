/**
 * Markdown link destinations, found the way a CommonMark reader sees them:
 * inline links and images, and reference definitions, but nothing inside fenced
 * code blocks or inline code spans. Asset links are rewritten with this when a
 * file is installed somewhere other than where it lives in the package.
 */

export interface LinkDestination {
  /** The destination as written, without angle brackets. */
  destination: string
  /** Offsets of `destination` in the document. */
  start: number
  end: number
}

const FENCE = /^ {0,3}(`{3,}|~{3,})/
const INLINE_LINK = /\]\((<[^>\n]*>|[^\s)]+)(?:\s+(?:"[^"\n]*"|'[^'\n]*'))?\)/g
const REFERENCE_DEFINITION = /^ {0,3}\[[^\]\n]+\]:[ \t]*(<[^>\n]*>|\S+)/

/** `[start, end)` ranges of inline code spans in one line. */
const codeSpans = (line: string): Array<[number, number]> => {
  const spans: Array<[number, number]> = []
  const runs = [...line.matchAll(/`+/g)]
  for (let index = 0; index < runs.length; index += 1) {
    const open = runs[index]
    if (!open) {
      continue
    }
    const closeIndex = runs.findIndex(
      (candidate, position) => position > index && candidate[0].length === open[0].length,
    )
    const close = runs[closeIndex]
    if (close) {
      spans.push([open.index, close.index + close[0].length])
      index = closeIndex
    }
  }
  return spans
}

const unwrap = (raw: string, offset: number): LinkDestination =>
  raw.startsWith('<') && raw.endsWith('>')
    ? { destination: raw.slice(1, -1), start: offset + 1, end: offset + raw.length - 1 }
    : { destination: raw, start: offset, end: offset + raw.length }

/** Every link destination in `markdown`, in document order. */
export const linkDestinations = (markdown: string): Array<LinkDestination> => {
  const found: Array<LinkDestination> = []
  let fence: { marker: string; length: number } | undefined
  let lineStart = 0
  for (const line of markdown.split('\n')) {
    const fenceMatch = FENCE.exec(line)
    if (fence) {
      if (fenceMatch?.[1]?.startsWith(fence.marker) && fenceMatch[1].length >= fence.length) {
        fence = undefined
      }
    } else if (fenceMatch?.[1]) {
      fence = { marker: fenceMatch[1].charAt(0), length: fenceMatch[1].length }
    } else {
      const spans = codeSpans(line)
      const inCode = (position: number): boolean =>
        spans.some(([start, end]) => position >= start && position < end)
      const reference = REFERENCE_DEFINITION.exec(line)
      if (reference?.[1]) {
        found.push(unwrap(reference[1], lineStart + reference[0].length - reference[1].length))
      }
      for (const match of line.matchAll(INLINE_LINK)) {
        const raw = match[1]
        if (raw === undefined || inCode(match.index)) {
          continue
        }
        found.push(unwrap(raw, lineStart + match.index + 2))
      }
    }
    lineStart += line.length + 1
  }
  return found
}

/** `markdown` with each link destination replaced by `rewrite(destination)`. */
export const rewriteLinkDestinations = (
  markdown: string,
  rewrite: (destination: string) => string,
): string => {
  let result = markdown
  for (const link of linkDestinations(markdown).reverse()) {
    result = result.slice(0, link.start) + rewrite(link.destination) + result.slice(link.end)
  }
  return result
}

/** Whether a destination leaves the document's own file tree (a URL or a same-page anchor). */
export const isExternalDestination = (destination: string): boolean =>
  /^[a-z][a-z0-9+.-]*:/i.test(destination) || destination.startsWith('#')
