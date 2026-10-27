import { Color } from 'three'
import { describe, expect, it } from 'vitest'
import type { ExplodeGroup } from '../src/model/explode.js'
import { explodeRegionColors, explodeTint } from '../src/render/explode-paint.js'
import { EXPLODE_TINTS, resolveExplodeTheme } from '../src/render/explode-theme.js'
import { HIGHLIGHT_WEIGHT } from '../src/render/paint.js'
import { DEFAULT_THEME } from '../src/render/theme.js'
import { cubeModel } from './fixtures.js'

const group = (id: string, regionIdxs: Array<number>, color = 0x3b82f6): ExplodeGroup => ({
  id,
  regionIdxs,
  offset: { x: 0, y: 0, z: 0 },
  color,
})

/** A color covering the white part by `weight`, as `<PartMesh>` stores and draws it. */
const washed = (hex: number, weight: number) =>
  new Color(0xffffff).lerp(new Color(hex), Math.round(weight * 255) / 255).getHex()

describe('explodeRegionColors', () => {
  it('paints pieces as the assembled part is painted: features, then faces over them', () => {
    const model = cubeModel()
    const feature = model.features.find((entry) => entry.regionIdxs.length > 1)!
    const [first, second] = feature.regionIdxs
    const elsewhere = model.regions.find((region) => !feature.regionIdxs.includes(region.idx))!.idx
    const groups = [group('piece', [first!, second!]), group('bare', [elsewhere])]
    const colors = explodeRegionColors(model, groups, {
      highlights: [{ tag: feature.tag, color: 0xff0000 }],
      regionHighlights: [{ region: second!, color: 0x00ff00, weight: 1 }],
    })!
    expect(colors.get('piece')?.get(first!)).toBe(washed(0xff0000, HIGHLIGHT_WEIGHT))
    expect(colors.get('piece')?.get(second!)).toBe(0x00ff00)
    // A piece with nothing painted keeps its own color.
    expect(colors.has('bare')).toBe(false)
  })

  it('lets the application’s own region colors win, and passes them through with no paint', () => {
    const model = cubeModel()
    const feature = model.features[0]!
    const region = feature.regionIdxs[0]!
    const own = new Map([['piece', new Map([[region, 0x123456]])]])
    const groups = [group('piece', [region])]
    const painted = explodeRegionColors(
      model,
      groups,
      { highlights: [{ tag: feature.tag, color: 0xff0000, weight: 1 }] },
      own,
    )!
    expect(painted.get('piece')?.get(region)).toBe(0x123456)
    expect(explodeRegionColors(model, groups, {}, own)).toBe(own)
    expect(explodeRegionColors(model, groups, {})).toBeUndefined()
  })
})

describe('explodeTint', () => {
  const pieces = (colors: Array<number>) =>
    colors.map((color, index) => group(`p${index}`, [index], color))

  it('keeps the warm selection colors on the plan’s cool direction colors', () => {
    const directions = [0x84cc16, 0x22c55e, 0x14b8a6, 0x0ea5e9, 0x3b82f6, 0x6366f1, 0x8b5cf6]
    expect(explodeTint(pieces(directions))).toBe('warm')
    expect(explodeTint(pieces([0x5bd6cb, 0xb59aff, 0xffc27a, 0x77b8ff]))).toBe('warm')
  })

  it('turns cool where the pieces are painted in warm rule colors', () => {
    const rules = [0xdc2626, 0xea580c, 0xeab308].map((hex) => washed(hex, 0.85))
    expect(explodeTint(pieces(rules))).toBe('cool')
    expect(explodeTint(pieces([0xdc2626, 0xea580c, 0xeab308]))).toBe('cool')
    // The colors shown count, region paint over a piece's own color included.
    const covered = pieces([0x3b82f6, 0x6366f1])
    const paint = new Map(covered.map((piece, index) => [piece.id, new Map([[index, 0xeab308]])]))
    expect(explodeTint(covered, undefined, paint)).toBe('cool')
    expect(explodeTint([])).toBe('warm')
  })

  it('is a default: a theme’s own highlight and hover win over it', () => {
    expect(resolveExplodeTheme(undefined, 'cool')).toMatchObject({
      selected: EXPLODE_TINTS.cool.highlight,
      hovered: EXPLODE_TINTS.cool.hover,
    })
    expect(resolveExplodeTheme({ highlight: 0x111111 }, 'cool')).toMatchObject({
      selected: 0x111111,
      hovered: EXPLODE_TINTS.cool.hover,
    })
    expect(resolveExplodeTheme()).toMatchObject({
      selected: DEFAULT_THEME.highlight,
      hovered: DEFAULT_THEME.hover,
      edge: DEFAULT_THEME.edge,
      edgeOpacity: DEFAULT_THEME.edgeOpacity,
    })
  })
})
