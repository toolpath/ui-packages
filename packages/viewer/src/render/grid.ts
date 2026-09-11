import { type Box3, BufferGeometry, Float32BufferAttribute, Vector3 } from 'three'

/** Steps a machinist reads without doing arithmetic, in millimetres. */
const STEPS = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000] as const

/** Roughly how many cells should span the part itself. */
const TARGET_CELLS = 10
/** How far past the part the grid extends, as a multiple of its size. */
const OVERHANG = 1.6

export interface GridSpec {
  /** Cell size in part units (millimetres). */
  readonly step: number
  /** Half-width of the grid, so it spans `2 × extent`. */
  readonly extent: number
  /** The plane the grid sits on: the bottom of the part, snapped to a step. */
  readonly z: number
  readonly center: Vector3
}

/**
 * Sizes a ground grid for a part.
 *
 * The step comes from a 1-2-5 progression rather than a fixed size, so the same
 * code reads sensibly for a 12 mm insert and a 900 mm plate — the Engine emits
 * millimetres but says nothing about scale.
 *
 * The plane is the *bottom* of the part, not `z = 0`: parts usually sit on
 * `z = 0` and then the two agree, but one modelled about its centre would
 * otherwise be sliced in half by its own grid.
 *
 * **Give this a measured box.** The plane is `box.min.z`, which is `+Infinity`
 * for an empty one. Nothing else in the spec shows it — `getSize` and
 * `getCenter` both short-circuit to zero for an empty `Box3` — so the step and
 * the extent come back looking ordinary and {@link gridGeometry} then builds
 * every vertex on a plane at infinity, which three.js reports as "Computed
 * radius is NaN" once per mount.
 *
 * `useContentBox` hands back an empty box until the scene has been
 * measured, so a caller pairing the two wants `if (box.isEmpty()) return null`
 * ahead of this. That is what the package's own `Grid` does, and it is why it
 * draws nothing on the opening frame rather than a grid nobody asked for.
 */
export function gridSpec(box: Box3): GridSpec {
  const size = box.getSize(new Vector3())
  const center = box.getCenter(new Vector3())
  const largest = Math.max(size.x, size.y, 1e-6)

  // The largest readable step that still gives at least `TARGET_CELLS` across
  // the part. Rounding up instead would leave a 50.8 mm cube on 10 mm cells —
  // five squares, which is a border rather than a grid.
  const ideal = largest / TARGET_CELLS
  const step = [...STEPS].reverse().find((candidate) => candidate <= ideal) ?? STEPS[0]

  // Snap outwards to a whole number of cells so the part sits inside the grid
  // rather than ending part-way through a square.
  const extent = Math.ceil((largest * OVERHANG) / 2 / step) * step

  return { step, extent, z: box.min.z, center }
}

/**
 * A ground grid on the part's Z-up base plane.
 *
 * Built directly rather than with `GridHelper`, which lays out on XZ for a Y-up
 * world and has to be rotated into place — the Engine is Z-up, and a rotated
 * helper is a thing to remember rather than a thing that is true.
 */
export function gridGeometry(spec: GridSpec): BufferGeometry {
  const { step, extent, z, center } = spec
  const positions: number[] = []

  for (let offset = -extent; offset <= extent + 1e-9; offset += step) {
    positions.push(
      center.x + offset,
      center.y - extent,
      z,
      center.x + offset,
      center.y + extent,
      z,
      center.x - extent,
      center.y + offset,
      z,
      center.x + extent,
      center.y + offset,
      z,
    )
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))

  return geometry
}

interface GridOptions {
  /** Cell size in part units (millimetres). Sized from the box when omitted. */
  readonly step?: number
  /** Half-width of the grid. Snapped out to whole cells when omitted. */
  readonly extent?: number
}

/**
 * The grid for a part's bounds, or `null` when there is nothing to size against.
 *
 * The emptiness check is here rather than in the component because it is the
 * whole of the decision and it is pure: an unmeasured scene hands back an empty
 * `Box3`, whose `min.z` is `+Infinity`, so {@link gridSpec} puts the plane there
 * and {@link gridGeometry} builds every vertex on it. three.js cannot bound that
 * geometry and reports it as "Computed radius is NaN" on every mount.
 *
 * `boundsFromBox` and `resolveSectionPlane` answer the same question about the
 * same box in the same layer.
 */
export function gridFor(box: Box3, options: GridOptions = {}): BufferGeometry | null {
  if (box.isEmpty()) return null

  const spec = gridSpec(box)
  const cell = options.step ?? spec.step

  return gridGeometry({
    ...spec,
    step: cell,
    // Snapped outwards to a whole number of cells, so the part sits inside the
    // grid rather than ending part-way through a square.
    extent: options.extent ?? Math.ceil(spec.extent / cell) * cell,
  })
}
