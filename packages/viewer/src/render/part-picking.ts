import type { Mesh } from 'three'

const nothing = (): void => {}

/**
 * Speeds up the part's raycasts, and returns what undoes that, for the part's
 * dispose.
 *
 * On the web it leaves three's own raycast, which tests every triangle: under a
 * JIT that keeps up with a pointer moving over a large part. It is a function
 * behind one module, so a slower runtime can do more in one place (React
 * Native's does).
 */
export function acceleratePicking(_mesh: Mesh): () => void {
  return nothing
}
