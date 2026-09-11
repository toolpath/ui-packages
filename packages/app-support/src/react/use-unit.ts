import type { UnitSystem } from '@toolpath/tool-support'
import { useEffect, useState } from 'react'

import { loadUnit, saveUnit } from '../unit-preference.js'

/**
 * The unit a person reads in, as a piece of React state.
 *
 * {@link loadUnit} and {@link saveUnit} are the storage; this is the three
 * lines of React that every consumer of them was otherwise going to write. Two
 * applications in the Toolpath template had written it, character for
 * character, differing only in the key — which is the copy this exists to stop
 * being made a third time.
 *
 * **The key is the caller's**, for the reason `unit-preference.ts` gives: two
 * applications on one origin must be able to hold different units, and that is
 * a decision each of them makes rather than inherits.
 *
 * **Read after mount rather than during render.** A server has no
 * `localStorage`, so reading one while rendering makes the first paint depend
 * on a browser that is not there yet — and a value that differed between the
 * two hydrates as a flash of the wrong numbers. The opening state is therefore
 * always millimetres, and the stored preference arrives on the first effect.
 */
export const useUnit = (key: string): [UnitSystem, (next: UnitSystem) => void] => {
  const [unit, setUnit] = useState<UnitSystem>('millimeters')

  useEffect(() => {
    setUnit(loadUnit(globalThis.localStorage ?? null, key))
  }, [key])

  const choose = (next: UnitSystem) => {
    setUnit(next)
    saveUnit(globalThis.localStorage ?? null, key, next)
  }

  return [unit, choose]
}
