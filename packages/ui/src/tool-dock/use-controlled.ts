import { useCallback, useRef, useState } from 'react'

/**
 * A value the caller may hold, or leave to this hook from a default. Either
 * way a change is reported through `onChange`.
 */
export const useControlled = <T>(
  value: T | undefined,
  defaultValue: T,
  onChange?: (next: T) => void,
): [T, (next: T) => void] => {
  const [own, setOwn] = useState(defaultValue)
  const controlled = value !== undefined
  // Read at call time, so a new `onChange` each render does not make a new setter.
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  const set = useCallback(
    (next: T) => {
      if (!controlled) {
        setOwn(next)
      }
      onChangeRef.current?.(next)
    },
    [controlled],
  )

  return [controlled ? value : own, set]
}
