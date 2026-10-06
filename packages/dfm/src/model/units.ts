import { MM_PER_INCH } from '@toolpath/tool-support'

/** The unit a length is shown in. The Engine's meshes are always millimetres. */
export type Units = 'mm' | 'inch'

/**
 * How many places a length is written to: a micron, or a tenth of a thousandth
 * of an inch. Two places of a millimetre rounded away figures a tolerance turns
 * on. One table, so a rule's field, a feature's details and the reach chart
 * write one length as one number.
 */
export const LENGTH_PLACES: Record<Units, number> = { mm: 3, inch: 4 }

const UNIT_LABELS: Record<Units, string> = { mm: 'mm', inch: 'in' }

const inUnits = (mm: number, units: Units): number => (units === 'inch' ? mm / MM_PER_INCH : mm)

/** The number alone, for a line of several lengths that names the unit once. */
export const lengthValue = (mm: number, units: Units): string =>
  inUnits(mm, units).toFixed(LENGTH_PLACES[units])

export const unitLabel = (units: Units): string => UNIT_LABELS[units]
