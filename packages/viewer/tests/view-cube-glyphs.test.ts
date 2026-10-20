import { describe, expect, it } from 'vitest'
import glyphs from '../src/render/view-cube-glyphs.json'
import { VIEW_NAMES, viewKind } from '../src/render/view-cube.js'

describe('the view cube’s glyphs', () => {
  it('cover every letter of every face name', () => {
    const letters = new Set(
      VIEW_NAMES.filter((name) => viewKind(name) === 'face').flatMap((name) => [
        ...name.toUpperCase(),
      ]),
    )

    for (const letter of letters) expect(glyphs.glyphs, letter).toHaveProperty(letter)
  })

  it('carry the font’s metrics and licence', () => {
    expect(glyphs.license).toBe('Apache-2.0 — Droid Sans Bold, from three/examples/fonts/droid')
    expect(glyphs.resolution).toBe(1000)
    expect(glyphs.boundingBox).toBeDefined()
  })
})
