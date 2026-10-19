import { MM_PER_INCH } from '@toolpath/tool-support'

/** The unit a length is shown in. The Engine's meshes are always millimetres. */
export type Units = 'mm' | 'inch'

/**
 * How many places a length is shown to: a micron, or a thousandth of an inch,
 * which is the unit a shop talks in. One table, so a feature's details, a
 * measured figure and the reach chart show one length as one number. A rule's
 * own field is the one exception: {@link FIELD_LENGTH_PLACES}.
 */
export const LENGTH_PLACES: Record<Units, number> = { mm: 3, inch: 3 }

/**
 * How many places a rule's length field is written to: one more in inches,
 * because a rule's value is typed, not measured, and some start finer than a
 * thousandth (a tolerance of 0.0005", a 1/64" fillet). A ten-thousandth keeps
 * the finest starting values from being hidden.
 */
export const FIELD_LENGTH_PLACES: Record<Units, number> = { mm: 3, inch: 4 }

const UNIT_LABELS: Record<Units, string> = { mm: 'mm', inch: 'in' }

const inUnits = (mm: number, units: Units): number => (units === 'inch' ? mm / MM_PER_INCH : mm)

/** The number alone, for a line of several lengths that names the unit once. */
export const lengthValue = (mm: number, units: Units): string =>
  inUnits(mm, units).toFixed(LENGTH_PLACES[units])

export const unitLabel = (units: Units): string => UNIT_LABELS[units]
