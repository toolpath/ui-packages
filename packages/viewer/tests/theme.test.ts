import { describe, expect, it } from 'vitest'
import {
  DEFAULT_THEME,
  DIRECTION_COLORS,
  HIGHLIGHT_COLORS,
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

describe('directionColor', () => {
  it('wraps at the end of the cycle', () => {
    // Real reports carry ten candidate directions against nine colors, so the
    // wrap is reachable on real data, not just in principle.
    expect(DIRECTION_COLORS).toHaveLength(9)
    expect(directionColor(9)).toBe(directionColor(0))
    expect(directionColor(10)).toBe(directionColor(1))
  })

  it('returns a usable color for an out-of-range index', () => {
    expect(directionColor(-1)).toBe(HIGHLIGHT_COLORS.default)
  })
})
