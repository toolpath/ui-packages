import { useCallback, useEffect, useState } from 'react'

/**
 * A value that clears itself a while after it is set, for feedback that should
 * not linger. Setting it again, even to the same value, starts the wait over.
 */
export const useTimedValue = <Value>(ms: number): [Value | null, (value: Value) => void] => {
  // Boxed, so each set is a new state and restarts the timer.
  const [box, setBox] = useState<{ value: Value } | null>(null)
  useEffect(() => {
    if (box === null) return
    const timer = setTimeout(() => setBox(null), ms)
    return () => clearTimeout(timer)
  }, [box, ms])
  const set = useCallback((value: Value) => setBox({ value }), [])
  return [box?.value ?? null, set]
}
