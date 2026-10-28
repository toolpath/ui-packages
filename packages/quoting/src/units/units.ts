/**
 * The one place a physical value is turned from what we store into what a person reads.
 *
 * Units are a display preference, never a data one. Everything an app persists or sends is metric —
 * lengths in millimetres, density in kg/m³, weight in kilograms — the same system the Engine
 * speaks. These functions convert *for the screen only*, into whichever system the reader has
 * chosen; nothing here is written back. Kept pure and free of React so the conversions can be
 * tested as arithmetic.
 *
 * Metric is the identity, so a value passes through unchanged in `mm` and is converted only for a
 * reader who has asked for `in`.
 */

import { MM_PER_INCH } from '@toolpath/tool-support'

export type Units = 'in' | 'mm'

export const isUnits = (value: unknown): value is Units => value === 'in' || value === 'mm'

/** Millimetres in an inch, from `@toolpath/tool-support`: the one place the repo states it. */
export { MM_PER_INCH }
/** 1 lb/in³ in kg/m³. */
const KG_M3_PER_LB_IN3 = 27679.9047
/** Pounds in a kilogram. */
const LB_PER_KG = 2.2046226
/** Feet in a metre — surface speed reads as SFM (surface feet per minute) in imperial. */
const FT_PER_M = 3.2808399

/** A number to at most `places` decimals, trailing zeros dropped: `2.000` → `2`, `6.35` → `6.35`. */
const trim = (value: number, places: number): string => String(Number(value.toFixed(places)))

/**
 * A length in millimetres — a tool diameter, a cut length, a step, a stock edge.
 *
 * Millimetres to three decimals, inches to four: an inch reading is a tenth the count of a millimetre
 * one, so it needs the extra place to tell a chip load of 0.02" from 0.025".
 */
export const formatLength = (mm: number, units: Units): string =>
  units === 'mm' ? `${trim(mm, 3)} mm` : `${trim(mm / MM_PER_INCH, 4)}"`

/** A part or stock size in millimetres, as `50.8 x 38.1 x 12.7 mm` / `2 x 1.5 x 0.5 in`. */
export const formatDimensions = (
  sizeMm: { length: number; width: number; height: number },
  units: Units,
  shape: 'box' | 'cylinder' = 'box',
): string => {
  const axes =
    shape === 'cylinder'
      ? [sizeMm.length, sizeMm.height]
      : [sizeMm.length, sizeMm.width, sizeMm.height]
  const prefix = shape === 'cylinder' ? 'Ø ' : ''
  return units === 'mm'
    ? `${prefix}${axes.map((value) => trim(value, 2)).join(' x ')} mm`
    : `${prefix}${axes.map((value) => trim(value / MM_PER_INCH, 3)).join(' x ')} in`
}

/** An area in mm², as `125.5 mm²` / `0.195 in²`. */
export const formatArea = (mm2: number, units: Units): string =>
  units === 'mm' ? `${trim(mm2, 1)} mm²` : `${trim(mm2 / MM_PER_INCH ** 2, 3)} in²`

/** A feed rate in mm/min. */
export const formatFeed = (mmPerMin: number, units: Units): string =>
  units === 'mm' ? `${Math.round(mmPerMin)} mm/min` : `${trim(mmPerMin / MM_PER_INCH, 1)} in/min`

/** A surface speed figured in m/min; imperial reads it as SFM (surface feet per minute). */
export const formatSurfaceSpeed = (mPerMin: number, units: Units): string =>
  units === 'mm' ? `${trim(mPerMin, 1)} m/min` : `${Math.round(mPerMin * FT_PER_M)} SFM`

/** A stock weight in kilograms, as `0.8 kg` / `1.76 lb`. */
export const formatWeight = (kg: number, units: Units): string =>
  units === 'mm' ? `${trim(kg, 3)} kg` : `${trim(kg * LB_PER_KG, 3)} lb`

// --- The profiles' data inputs, which reunit but persist canonical (kg/m³, $/kg, mm).

/**
 * A quantity a profile stores canonical and a person types in either system. Ratios, angles and
 * counts have no unit to convert, but share the table so every field is shown and stored the same way.
 */
export type Quantity = 'density' | 'length' | 'ratio' | 'angle' | 'count'

/**
 * Decimal places each quantity is shown, typed and stored at, per system.
 *
 * One table so the three can never disagree: a field's `step` is its places, the number shown is
 * rounded to them, and the value saved is rounded to the metric places — which is also what the
 * server stores. The imperial places are chosen so a figure typed in imperial, stored in metric and
 * shown again reads back exactly as typed: one step of the stored metric value is always less than
 * half a step of the imperial one.
 */
export const PRECISION: Record<Quantity, Record<Units, number>> = {
  // A tenth of a kg/m³ is under 0.000004 lb/in³, well inside the fourth place a datasheet prints.
  density: { mm: 1, in: 4 },
  // A thousandth of a millimetre is 0.00004", inside half a ten-thousandth of an inch.
  length: { mm: 3, in: 4 },
  // Unitless: the same in either system.
  ratio: { mm: 2, in: 2 },
  angle: { mm: 1, in: 1 },
  // Whole things — flutes — in either system.
  count: { mm: 0, in: 0 },
}

/** How many of each quantity's imperial unit are in one of its metric: lb/in³ per kg/m³, and so on. */
const IMPERIAL_PER_METRIC: Record<Quantity, number> = {
  density: 1 / KG_M3_PER_LB_IN3,
  length: 1 / MM_PER_INCH,
  ratio: 1,
  angle: 1,
  count: 1,
}

/** A number to exactly `places` decimals, as a number. */
export const roundTo = (value: number, places: number): number => Number(value.toFixed(places))

/** A canonical value at the precision it is stored at — what the server keeps. */
export const toStored = (quantity: Quantity, value: number): number =>
  roundTo(value, PRECISION[quantity].mm)

/** The stored canonical value as the number to show in the field for this system. */
export const toInput = (quantity: Quantity, canonical: number, units: Units): number =>
  roundTo(
    units === 'mm' ? canonical : canonical * IMPERIAL_PER_METRIC[quantity],
    PRECISION[quantity][units],
  )

/** A value typed in this system, back to canonical at the precision it is stored at. */
export const fromInput = (quantity: Quantity, shown: number, units: Units): number =>
  toStored(quantity, units === 'mm' ? shown : shown / IMPERIAL_PER_METRIC[quantity])

/** The field's `step`: one unit in its last shown place, so every value it shows is valid. */
export const stepFor = (quantity: Quantity, units: Units): string => {
  const places = PRECISION[quantity][units]
  return places === 0 ? '1' : `0.${'0'.repeat(places - 1)}1`
}

export const densityUnit = (units: Units): string => (units === 'in' ? 'lb/in³' : 'kg/m³')

/**
 * A tool length typed in `units`, back to canonical millimetres — undefined when it does not read
 * as a length. Inches take what a machinist writes: `0.25`, `.25`, `1/4`, `1-1/4`, `1 1/4`, with or
 * without a trailing `"` or `in`.
 */
export const parseToolLength = (text: string, units: Units): number | undefined => {
  const cleaned = text
    .trim()
    .replace(/\s*("|in|mm)$/i, '')
    .trim()
  const mixed = /^(?:(\d+)[\s-]+)?(\d+)\/(\d+)$/.exec(cleaned)
  const shown = mixed
    ? Number(mixed[1] ?? 0) + Number(mixed[2]) / Number(mixed[3])
    : /^(\d+\.?\d*|\.\d+)$/.test(cleaned)
      ? Number(cleaned)
      : Number.NaN
  return Number.isFinite(shown) && shown >= 0 ? fromInput('length', shown, units) : undefined
}
