/**
 * One meaning of `clamping` per crib, across every vendor.
 *
 * `holding.ClampingMode` is the axis a picker branches on, and a consumer
 * loading two vendors' catalogs into one list gets one filter over both. So the
 * modes have to mean the same thing in each — which nothing else here can see,
 * because every vendor's config is internally consistent and only the pair is
 * wrong.
 *
 * That is exactly how the bug this guards survived. Until 2026-09-10 Kennametal
 * declared `bore` on its 135 shrink-fit and hydraulic families, derived from the
 * variant table publishing a `D1` and no collet series, while MariTool declared
 * `shrink` and `hydraulic` for the same kinds of holder from its leaf
 * categories. Both are legal values, both kinds of family publish the bore
 * `holding.BORE_CLAMPINGS` requires, and every test passed. A consumer filtering
 * on `clamping === 'hydraulic'` got MariTool's chucks and none of Kennametal's
 * 339.
 *
 * **This reads config and never a scrape**, so unlike `holding-corpus.test.ts`
 * it runs in CI. The fact is a family constant on both vendors that state one —
 * Kennametal and REGO-FIX in `HOLDER_FAMILIES`, MariTool one level down in
 * `LEAVES`, because a MariTool CSV holds three styles and the classification is
 * per leaf. Both shapes are checked here rather than one, since a table nobody
 * reaches is a table that drifts.
 */

import { describe, expect, it } from 'vitest'

import { HOLDER_FAMILIES } from '../src/families/index.js'
import { LEAVES } from '../src/families/maritool.js'
import { CLAMPING_MODES, type ClampingMode } from '../src/holding.js'

/**
 * What a holder's `style` implies about its `clamping`.
 *
 * Keyed on `style` because that is the axis naming the vendor's own product
 * line, and it is the one both vendors already agreed on — Kennametal's
 * `hydraulic-chuck-hydroforce` and MariTool's `hydraulic-chuck` came off the
 * same kind of category while their `clamping` values did not.
 *
 * **An unknown style throws rather than passing.** A new product line is a line
 * here, and a side-lock or shell-mill family arriving with a plain `bore` is
 * somebody saying so deliberately instead of a default letting it through.
 */
const impliedClamping = (style: string): ClampingMode => {
  if (style.startsWith('shrink-fit')) return 'shrink'
  if (style.startsWith('hydraulic-chuck')) return 'hydraulic'
  if (style.endsWith('collet-chuck')) return 'collet'
  throw new Error(`no clamping mode is written down for the holder style ${style}`)
}

describe('a holder style means one clamping mode', () => {
  it('agrees across every family that declares both', () => {
    const styles = new Set<string>()

    for (const [name, config] of Object.entries(HOLDER_FAMILIES)) {
      const { clamping, style } = config.facts ?? {}
      // MariTool declares neither here; its leaves carry them. See below.
      if (clamping === undefined || style === undefined) continue

      styles.add(style.value)
      expect(CLAMPING_MODES, name).toContain(clamping.value)
      expect(clamping.value, `${name} (${style.value})`).toBe(impliedClamping(style.value))
    }

    // Both vendors that declare the pair at this level are really in here, so
    // the check spans them rather than restating one vendor's config to itself.
    expect(styles).toContain('er-collet-chuck')
    expect(styles).toContain('pg-collet-chuck')
    expect(styles.size).toBeGreaterThan(2)
  })

  it("agrees across MariTool's leaves, where the pair is stated per category", () => {
    const styles = new Set<string>()

    for (const [name, leaves] of Object.entries(LEAVES)) {
      for (const leaf of leaves) {
        styles.add(leaf.style)
        expect(CLAMPING_MODES, name).toContain(leaf.clamping)
        expect(leaf.clamping, `${name} (${leaf.style})`).toBe(impliedClamping(leaf.style))
      }
    }

    expect(styles).toEqual(new Set(['er-collet-chuck', 'shrink-fit', 'hydraulic-chuck']))
  })
})
