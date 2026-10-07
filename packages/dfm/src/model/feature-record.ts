/**
 * Everything the API said about one feature: its entry in the part report and
 * its datasheet, both as sent, so fields newer than any SDK are still there.
 */
export interface FeatureRecord {
  readonly feature: unknown
  /** Null where the API sent no datasheet for the feature. */
  readonly datasheet: unknown
}

/** One leaf of a datasheet: where it sits — `facts.bevel.angleDeg` — and what it says. */
export interface DatasheetField {
  readonly path: string
  readonly value: string
}

/** More rows than this and the list stops, rather than read a long curve out point by point. */
export const MAX_DATASHEET_FIELDS = 500

const formatLeaf = (value: unknown): string =>
  typeof value === 'number'
    ? String(Number(value.toFixed(4)))
    : typeof value === 'string'
      ? value
      : value === null
        ? 'null'
        : String(value)

/**
 * Every leaf of a datasheet by its path, as sent: millimetres and degrees,
 * numbers to four places. A list of plain values is one row; a list of records
 * is walked by index; an empty list or record is a row of its own. Stops at
 * {@link MAX_DATASHEET_FIELDS}, and says so with `more`.
 */
export const datasheetFields = (
  datasheet: unknown,
): { fields: DatasheetField[]; more: boolean } => {
  const fields: DatasheetField[] = []
  let more = false
  const walk = (value: unknown, path: string): void => {
    if (fields.length >= MAX_DATASHEET_FIELDS) {
      more = true
      return
    }
    if (Array.isArray(value)) {
      if (value.every((each) => typeof each !== 'object' || each === null)) {
        fields.push({ path, value: value.length === 0 ? '[]' : value.map(formatLeaf).join(', ') })
      } else {
        value.forEach((each, index) => walk(each, `${path}[${index}]`))
      }
    } else if (typeof value === 'object' && value !== null) {
      const entries = Object.entries(value)
      if (entries.length === 0) fields.push({ path, value: '{}' })
      for (const [key, each] of entries) walk(each, path ? `${path}.${key}` : key)
    } else {
      fields.push({ path, value: formatLeaf(value) })
    }
  }
  if (datasheet !== null && datasheet !== undefined) walk(datasheet, '')
  return { fields, more }
}
