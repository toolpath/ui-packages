/**
 * One string comparator, so every ordered output in this package is ordered
 * the same way.
 *
 * By code unit rather than `localeCompare`: an assumptions document, a receipt
 * and a scraped row order all have to be byte-stable for a diff or a gate to
 * read them, and collation is a machine's locale setting rather than a
 * property of the data.
 */
export function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}
