// Writes the view cube's glyphs for the React Native build.
//
// The native cube draws its face names as glyph geometry, and three's npm
// package does not ship `examples/fonts/`, so the font is kept here as three's
// r185 tag has it (`examples/fonts/droid/droid_sans_bold.typeface.json`) and
// cut down to the letters the six face names use.
//
// Run with `node scripts/subset-view-cube-font.mjs` after changing either.
import { readFile, writeFile } from 'node:fs/promises'

const source = new URL('./fonts/droid_sans_bold.typeface.json', import.meta.url)
const target = new URL('../src/render/view-cube-glyphs.json', import.meta.url)

/** The letters of TOP, BOTTOM, FRONT, BACK, LEFT and RIGHT. */
const LETTERS = [...'ABCEFGHIKLMNOPRT']

/** What `FontLoader` reads besides the glyphs. */
const METRICS = [
  'familyName',
  'ascender',
  'descender',
  'lineHeight',
  'underlinePosition',
  'underlineThickness',
  'boundingBox',
  'resolution',
  'cssFontWeight',
  'cssFontStyle',
]

const font = JSON.parse(await readFile(source, 'utf8'))

const glyphs = Object.fromEntries(
  LETTERS.map((letter) => {
    const glyph = font.glyphs[letter]
    if (!glyph) throw new Error(`The font has no glyph for ${letter}`)
    return [letter, glyph]
  }),
)

const subset = {
  license: 'Apache-2.0 — Droid Sans Bold, from three/examples/fonts/droid',
  ...Object.fromEntries(METRICS.filter((key) => key in font).map((key) => [key, font[key]])),
  glyphs,
}

await writeFile(target, `${JSON.stringify(subset, null, 2)}\n`)
