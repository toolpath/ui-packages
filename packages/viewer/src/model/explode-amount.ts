/** An application-controlled amount with subscriptions for demand-driven canvases. */
export interface ExplodeAmount {
  readonly value: number
  set: (value: number) => void
  subscribe: (listener: () => void) => () => void
}

/** Read the same bounded amount for surfaces, source ghost, and picking. */
export const readExplodeAmount = (amount: number | ExplodeAmount): number => {
  const value = typeof amount === 'number' ? amount : amount.value
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0
}

/** Owns no clock or easing. Setting a changed value requests a frame from attached viewers. */
export const createExplodeAmount = (initial = 0): ExplodeAmount => {
  let value = readExplodeAmount(initial)
  const listeners = new Set<() => void>()
  return {
    get value() {
      return value
    },
    set: (next) => {
      next = readExplodeAmount(next)
      if (next === value) {
        return
      }
      value = next
      for (const listener of listeners) {
        listener()
      }
    },
    subscribe: (listener) => {
      // Two components in the same canvas may subscribe with the same invalidate function.
      const subscription = () => listener()
      listeners.add(subscription)
      return () => {
        listeners.delete(subscription)
      }
    },
  }
}
