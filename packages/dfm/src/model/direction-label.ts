/** How close to an axis, or to zero, a component must be to count as one. */
const EPSILON = 1e-6

/** Three decimals, without the trailing zeros that make a vector unreadable. */
const trim = (value: number): string => Number.parseFloat(value.toFixed(3)).toString()

/**
 * A machining direction as a reader names it: `+Z` along an axis, the vector
 * otherwise. The same words `@toolpath/viewer` uses, kept here so the rule
 * list does not pull in three.js for one label.
 */
export const directionLabel = (direction: {
  readonly x: number
  readonly y: number
  readonly z: number
}): string => {
  const axes = [
    ['X', direction.x],
    ['Y', direction.y],
    ['Z', direction.z],
  ] as const
  const nonZero = axes.filter(([, value]) => Math.abs(value) > EPSILON)
  const [axis] = nonZero
  if (nonZero.length === 1 && axis && Math.abs(Math.abs(axis[1]) - 1) < EPSILON) {
    return `${axis[1] > 0 ? '+' : '−'}${axis[0]}`
  }
  return axes.map(([, value]) => trim(value)).join(', ')
}
