import { Vector3 } from 'three'

const ORIGIN = new Vector3()
const TARGET = new Vector3()

/**
 * The orbit target, whatever the controls are.
 *
 * `camera-controls` reads its target out into a vector rather than exposing one,
 * and R3F's `controls` slot is typed loosely enough to hold either shape.
 */
export function readTarget(controls: unknown): Vector3 {
  if (controls && typeof (controls as { getTarget?: unknown }).getTarget === 'function') {
    return (controls as { getTarget: (into: Vector3) => Vector3 }).getTarget(TARGET)
  }
  const target = (controls as { target?: Vector3 } | null)?.target
  return target ?? ORIGIN
}
