import { useRef } from 'react'

/**
 * The list, with an identity that changes only when an entry does: callers hand
 * over a fresh array with every render, and what is built from it should not be
 * rebuilt for each one. `same` says whether two entries are the same.
 */
export const useStableList = <T>(
  list: ReadonlyArray<T>,
  same: (held: T, next: T) => boolean = (held, next) => held === next,
): ReadonlyArray<T> => {
  const held = useRef<ReadonlyArray<T> | null>(null)
  if (
    held.current === null ||
    held.current.length !== list.length ||
    held.current.some((each, index) => !same(each, list[index]!))
  ) {
    held.current = list
  }
  return held.current
}
