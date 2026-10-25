/**
 * Line-based diffs and a three-way merge for managed text. Files under
 * management are small (instructions, configs, workflows), so an exact LCS is
 * cheap and keeps the result predictable.
 */

type Edit = { kind: 'keep' | 'delete' | 'insert'; line: string }

/** Lines with their newlines; a final line without one stays without one. */
const splitLines = (text: string): Array<string> => {
  if (text === '') {
    return []
  }
  const lines = text.split('\n')
  const terminated = lines.at(-1) === ''
  if (terminated) {
    lines.pop()
  }
  return lines.map((line, index) => (index < lines.length - 1 || terminated ? `${line}\n` : line))
}

/** The edit script turning `a` into `b`, from a longest common subsequence. */
const diffLines = (a: ReadonlyArray<string>, b: ReadonlyArray<string>): Array<Edit> => {
  const rows = a.length + 1
  const columns = b.length + 1
  const lengths = new Uint32Array(rows * columns)
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      lengths[i * columns + j] =
        a[i] === b[j]
          ? (lengths[(i + 1) * columns + j + 1] ?? 0) + 1
          : Math.max(lengths[(i + 1) * columns + j] ?? 0, lengths[i * columns + j + 1] ?? 0)
    }
  }
  const edits: Array<Edit> = []
  let i = 0
  let j = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      edits.push({ kind: 'keep', line: a[i] ?? '' })
      i += 1
      j += 1
    } else if ((lengths[(i + 1) * columns + j] ?? 0) >= (lengths[i * columns + j + 1] ?? 0)) {
      edits.push({ kind: 'delete', line: a[i] ?? '' })
      i += 1
    } else {
      edits.push({ kind: 'insert', line: b[j] ?? '' })
      j += 1
    }
  }
  for (; i < a.length; i += 1) {
    edits.push({ kind: 'delete', line: a[i] ?? '' })
  }
  for (; j < b.length; j += 1) {
    edits.push({ kind: 'insert', line: b[j] ?? '' })
  }
  return edits
}

interface Hunk {
  /** Base line range `[start, end)` this hunk replaces. */
  start: number
  end: number
  lines: Array<string>
}

const hunks = (base: ReadonlyArray<string>, other: ReadonlyArray<string>): Array<Hunk> => {
  const result: Array<Hunk> = []
  let position = 0
  let current: Hunk | undefined
  for (const edit of diffLines(base, other)) {
    if (edit.kind === 'keep') {
      if (current) {
        result.push(current)
      }
      current = undefined
      position += 1
      continue
    }
    current ??= { start: position, end: position, lines: [] }
    if (edit.kind === 'delete') {
      position += 1
      current.end = position
    } else {
      current.lines.push(edit.line)
    }
  }
  if (current) {
    result.push(current)
  }
  return result
}

const overlaps = (a: Hunk, b: Hunk): boolean =>
  a.start < b.end && b.start < a.end
    ? true
    : a.start === b.start && (a.start === a.end || b.start === b.end)

export type MergeResult = { ok: true; text: string } | { ok: false; conflicts: number }

/**
 * Merges `ours` (the repository's current text) and `theirs` (the new managed
 * text) against `base` (what was last generated). Non-overlapping changes from
 * both sides are kept; overlapping changes are a conflict, never resolved by
 * discarding either side.
 */
export const mergeThreeWay = (base: string, ours: string, theirs: string): MergeResult => {
  if (ours === base) {
    return { ok: true, text: theirs }
  }
  if (theirs === base || theirs === ours) {
    return { ok: true, text: ours }
  }
  const baseLines = splitLines(base)
  const ourHunks = hunks(baseLines, splitLines(ours))
  const theirHunks = hunks(baseLines, splitLines(theirs))
  let conflicts = 0
  for (const ourHunk of ourHunks) {
    for (const theirHunk of theirHunks) {
      if (!overlaps(ourHunk, theirHunk)) {
        continue
      }
      const same =
        ourHunk.start === theirHunk.start &&
        ourHunk.end === theirHunk.end &&
        ourHunk.lines.join('') === theirHunk.lines.join('')
      if (!same) {
        conflicts += 1
      }
    }
  }
  if (conflicts > 0) {
    return { ok: false, conflicts }
  }
  const all = [
    ...ourHunks,
    ...theirHunks.filter((hunk) => !ourHunks.some((ourHunk) => overlaps(ourHunk, hunk))),
  ].sort((a, b) => a.start - b.start || a.end - b.end)
  const output: Array<string> = []
  let position = 0
  for (const hunk of all) {
    output.push(...baseLines.slice(position, hunk.start), ...hunk.lines)
    position = hunk.end
  }
  output.push(...baseLines.slice(position))
  return { ok: true, text: output.join('') }
}

/** A unified diff of two texts, for dry runs and proposed patches. */
export const unifiedDiff = (
  path: string,
  before: string | undefined,
  after: string | undefined,
  context = 3,
): string => {
  const a = splitLines(before ?? '')
  const b = splitLines(after ?? '')
  const edits = diffLines(a, b)
  if (edits.every((edit) => edit.kind === 'keep')) {
    return ''
  }
  const header = `--- ${before === undefined ? '/dev/null' : `a/${path}`}\n+++ ${after === undefined ? '/dev/null' : `b/${path}`}\n`
  const body: Array<string> = []
  let index = 0
  while (index < edits.length) {
    while (index < edits.length && edits[index]?.kind === 'keep') {
      index += 1
    }
    if (index >= edits.length) {
      break
    }
    const start = Math.max(0, index - context)
    let end = index
    let lastChange = index
    while (end < edits.length) {
      if (edits[end]?.kind !== 'keep') {
        lastChange = end
      } else if (end - lastChange > context * 2) {
        break
      }
      end += 1
    }
    end = Math.min(edits.length, lastChange + context + 1)
    let aLine = 1
    let bLine = 1
    for (const edit of edits.slice(0, start)) {
      if (edit.kind !== 'insert') {
        aLine += 1
      }
      if (edit.kind !== 'delete') {
        bLine += 1
      }
    }
    const slice = edits.slice(start, end)
    const aCount = slice.filter((edit) => edit.kind !== 'insert').length
    const bCount = slice.filter((edit) => edit.kind !== 'delete').length
    body.push(
      `@@ -${aCount === 0 ? aLine - 1 : aLine},${aCount} +${bCount === 0 ? bLine - 1 : bLine},${bCount} @@\n`,
    )
    for (const edit of slice) {
      const prefix = edit.kind === 'keep' ? ' ' : edit.kind === 'delete' ? '-' : '+'
      body.push(
        `${prefix}${edit.line.endsWith('\n') ? edit.line : `${edit.line}\n\\ No newline at end of file\n`}`,
      )
    }
    index = end
  }
  return header + body.join('')
}
