import { describe, expect, it } from 'vitest'
import { oklab } from '../src/render/explode-paint.js'
import { HOVER_COLORS } from '../src/render/measure.js'
import {
  DEFAULT_LABELS,
  DEFAULT_THEME,
  DIRECTION_COLORS,
  HIGHLIGHT_COLORS,
  cssHex,
  directionColor,
  resolveTheme,
  themesEqual,
} from '../src/render/theme.js'

describe('resolveTheme', () => {
  it('fills every value when given nothing', () => {
    expect(resolveTheme()).toEqual(DEFAULT_THEME)
  })

  it('overrides only what it is given', () => {
    const theme = resolveTheme({ background: 0x101010 })

    expect(theme.background).toBe(0x101010)
    expect(theme.part).toBe(DEFAULT_THEME.part)
  })

  it('keeps a null background, rather than treating it as absent', () => {
    // `null` means a transparent canvas, which is the default and a real value
    // — a merge that read it as "unset" would paint the background in.
    expect(resolveTheme({ background: null }).background).toBeNull()
  })
})

describe('themesEqual', () => {
  it('compares by value, so an inline literal costs a comparison not a redraw', () => {
    expect(themesEqual(resolveTheme(), resolveTheme())).toBe(true)
    expect(themesEqual(resolveTheme(), resolveTheme({ part: 0x123456 }))).toBe(false)
  })
})

const apart = (a: number, b: number): number => {
  const [x, y] = [oklab(a), oklab(b)]
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2])
}

/** The DFM rules' default colours, and the plan view's critical and warning, as apps paint the part. */
const DFM_COLORS = [0xe5484d, 0xf76b15, 0xffd60a, 0xea580c, 0xeab308]

describe('directionColor', () => {
  it('gives every direction its own colour before it wraps', () => {
    // Real reports carry ten candidate directions, and a plan adds more.
    expect(DIRECTION_COLORS).toHaveLength(18)
    expect(new Set(DIRECTION_COLORS).size).toBe(DIRECTION_COLORS.length)
    expect(directionColor(9)).not.toBe(directionColor(0))
    expect(directionColor(DIRECTION_COLORS.length)).toBe(directionColor(0))
  })

  it('keeps every pair of directions apart, the first ten furthest', () => {
    for (const [i, a] of DIRECTION_COLORS.entries()) {
      for (const [j, b] of DIRECTION_COLORS.entries()) {
        if (j > i) {
          expect(apart(a, b), `${cssHex(a)} against ${cssHex(b)}`).toBeGreaterThan(
            j < 10 ? 0.09 : 0.055,
          )
        }
      }
    }
  })

  it('keeps every direction apart from what the part wears over it', () => {
    const marks = [
      ...DFM_COLORS,
      HIGHLIGHT_COLORS.default,
      HIGHLIGHT_COLORS.geometryIssue,
      DEFAULT_THEME.hover,
      DEFAULT_THEME.picked,
      DEFAULT_THEME.sharpCorner,
      DEFAULT_THEME.part,
      // The grey an app draws a direction it has nothing for in.
      HOVER_COLORS.other,
    ]
    for (const color of DIRECTION_COLORS) {
      for (const mark of marks) {
        expect(apart(color, mark), `${cssHex(color)} against ${cssHex(mark)}`).toBeGreaterThan(
          0.085,
        )
      }
      // What shows only on a feature picked or measured: a tool issue, the face under the pointer.
      for (const mark of [HIGHLIGHT_COLORS.toolIssue, HOVER_COLORS.plane, HOVER_COLORS.cylinder]) {
        expect(apart(color, mark), `${cssHex(color)} against ${cssHex(mark)}`).toBeGreaterThan(0.05)
      }
    }
  })

  it('keeps every direction a colour, not a grey', () => {
    for (const color of DIRECTION_COLORS) {
      const [, a, b] = oklab(color)
      expect(Math.hypot(a, b), cssHex(color)).toBeGreaterThan(0.09)
    }
  })

  it('keeps every direction clear of red, orange and yellow', () => {
    for (const color of DIRECTION_COLORS) {
      const [, a, b] = oklab(color)
      const hue = ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360
      // Pinks reach 0°, the DFM red is 23°, its yellow 95°, and lime starts at 125°.
      expect(hue > 10 && hue < 125, `${cssHex(color)} at ${hue.toFixed(0)}°`).toBe(false)
    }
  })

  it('returns a usable color for an out-of-range index', () => {
    expect(directionColor(-1)).toBe(HIGHLIGHT_COLORS.default)
  })
})

describe('label theme', () => {
  const labels = {
    text: '#1f2330',
    background: 'rgba(255,255,255,0.92)',
    border: '#4f8ef7',
    axis: { x: '#ff6b6b', y: '#6fe08a', z: '#6f9bff' },
    fontSize: 12,
  }

  it('defaults to the measure tool look', () => {
    expect(resolveTheme().labels).toEqual(labels)
    expect(DEFAULT_LABELS.border).toBe(cssHex(DEFAULT_THEME.measure))
  })

  it('compares labels by value', () => {
    expect(themesEqual(resolveTheme({ labels }), resolveTheme({ labels: { ...labels } }))).toBe(
      true,
    )
    expect(
      themesEqual(resolveTheme({ labels }), resolveTheme({ labels: { ...labels, fontSize: 14 } })),
    ).toBe(false)
    expect(
      themesEqual(
        resolveTheme({ labels }),
        resolveTheme({ labels: { ...labels, axis: { ...labels.axis, z: '#000000' } } }),
      ),
    ).toBe(false)
    expect(themesEqual(resolveTheme(), resolveTheme({ labels: undefined }))).toBe(false)
  })
})
