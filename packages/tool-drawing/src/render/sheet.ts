import type { OutlinePart, OutlineSegment } from '../model/outline.js'

/**
 * The sheet the tool is drawn on, and the ink it is drawn in.
 *
 * **Hard colours rather than the application's ramp** (Paul, 2026-09-01): a
 * drawing is a drawing, and a "light grey" written as a zinc utility comes out
 * dark under the flipped ramp. So the sheet, the linework and the two shades a
 * tool has — gold flutes, steel body — are stated here.
 *
 * **One set per theme** (Paul, 2026-09-01: "2d tool visualization can't have
 * the white background in dark mode — make it just barely lighter than any of
 * the other backgrounds"). A white sheet in a dark application is a torch. In
 * dark it is a shade above the card it sits on, and the ink turns over with
 * it: light lines on a dark ground rather than dark lines nobody can see.
 *
 * Stated as literals in this package for a second reason as well: it has no
 * Tailwind, no design-token import and no access to the consumer's ramp, so
 * every colour the drawing uses has to be a colour rather than a class name.
 */
export const SHEETS = {
  light: {
    ground: '#ffffff',
    ink: '#3f4650',
    centre: '#15181c',
    dimension: '#606a76',
    /**
     * The dimension the reader is pointing at.
     *
     * **Not a colour the tool is already drawn in** (Paul, 2026-09-02): the
     * flutes are gold and a struck section is red, so a highlight in either
     * would read as a property of the metal rather than as a pointer. Blue is
     * on neither the tool nor the holder, and it carries on both sheets.
     */
    accent: '#0284c7',
    body: '#c4c8ce',
    flutes: '#e6bf59',
    holder: '#9aa2ad',
    connection: '#78818d',
  },
  dark: {
    // A step above `zinc-900`, which is the card, and above the wash on it.
    ground: '#22252b',
    ink: '#c7cdd6',
    centre: '#e8ebef',
    dimension: '#8d97a4',
    // Lighter than the light sheet's, to hold its own against the dark ground.
    accent: '#38bdf8',
    body: '#5b626c',
    // The gold reads as gold on either ground, a shade deeper here so it does
    // not glare against the greys around it.
    flutes: '#c9a44b',
    holder: '#474d57',
    connection: '#3a4048',
  },
} as const

export type Theme = keyof typeof SHEETS

export type Sheet = (typeof SHEETS)[Theme]

/** The spindle connection: the flange, and the cone nobody states that leads up to it. */
export const isConnection = (segment: OutlineSegment): boolean =>
  segment.part === 'flange' || (segment.part === 'body' && segment.provenance === 'assumed')

/**
 * **Outlined, not blocked in** (Paul, 2026-09-01, against the drawings in the
 * geometry write-up): a drawing of a tool is a silhouette with its sections
 * shaded lightly, so the dimension lines that cross it stay readable. The
 * holder's own parts stay solid, because they are behind the tool rather than
 * part of it.
 *
 * **Every line is solid**: flutes pale yellow, shank one light grey whatever
 * its provenance, the holder grey up to the spindle connection, which is
 * darker. What was derived or assumed is on the element as `data-provenance`,
 * and named in the note under the drawing.
 */
export const sectionFill = (segment: OutlineSegment, sheet: Sheet): string => {
  if (segment.part === 'flutes' || segment.part === 'tip') {
    return sheet.flutes
  }
  if (segment.part === 'shank' || segment.part === 'neck') {
    return sheet.body
  }
  return isConnection(segment) ? sheet.connection : sheet.holder
}

/** What an assumed section is called, in the words the note under the drawing uses. */
const ASSUMED: Partial<Record<OutlinePart, string>> = {
  tip: 'tip angle',
  nose: 'nose length',
  body: 'body cone',
  flange: 'flange thickness',
}

/** Everything the drawing had to assume, named once each, in the order drawn. */
export const assumedNames = (segments: ReadonlyArray<OutlineSegment>): Array<string> => [
  ...new Set(
    segments
      .filter((segment) => segment.provenance === 'assumed')
      .map((segment) => ASSUMED[segment.part] ?? segment.part),
  ),
]
