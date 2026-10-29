/**
 * A categorical palette for telling a file's bodies apart, readable on the
 * light and the dark canvas alike: Tableau 10 without its orange, the viewer's
 * default hover, and its teal, a common highlight, so a lit body stands out.
 */
export const BODY_PALETTE: ReadonlyArray<number> = [
  0x4e79a7, 0xe15759, 0x59a14f, 0xedc948, 0xb07aa1, 0xff9da7, 0x9c755f, 0xbab0ac,
]

/** `a` mixed toward `b` by `t` (0–1), channel by channel. */
const mix = (a: number, b: number, t: number): number =>
  [16, 8, 0].reduce((out, shift) => {
    const from = (a >> shift) & 0xff
    const to = (b >> shift) & 0xff
    return out | (Math.round(from + (to - from) * t) << shift)
  }, 0)

/**
 * A colour for each id, in the order given: the palette once through, then
 * again a step lighter each round, so no two of the first sixteen share one.
 * Copies of one body can share an id, and so a colour.
 */
export const bodyColors = <Id>(ids: ReadonlyArray<Id>): Map<Id, number> => {
  const colors = new Map<Id, number>()
  for (const id of ids) {
    if (colors.has(id)) {
      continue
    }
    const at = colors.size
    const round = Math.floor(at / BODY_PALETTE.length)
    const base = BODY_PALETTE[at % BODY_PALETTE.length]!
    colors.set(id, round === 0 ? base : mix(base, 0xffffff, Math.min(0.6, round * 0.3)))
  }
  return colors
}
