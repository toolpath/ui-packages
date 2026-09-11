import type { Camera, Vector3 } from 'three'
import type { FeatureTag, PartModel, Vec3 } from '../model/types.js'
import { bestOwner, rankOwners } from './selection.js'

/**
 * Which modifier keys were down when the pick happened.
 *
 * Reported rather than interpreted: "hold this to add to the selection" is a
 * platform convention — command on a Mac, control everywhere else — and which
 * key means what belongs to the app, not to a viewport.
 */
export interface PickModifiers {
  readonly alt: boolean
  readonly ctrl: boolean
  readonly meta: boolean
  readonly shift: boolean
  /** The right button, on a click that did not become a pan. */
  readonly secondary: boolean
}

export const NO_MODIFIERS: PickModifiers = {
  alt: false,
  ctrl: false,
  meta: false,
  shift: false,
  secondary: false,
}

/**
 * A pointer event on the part, resolved to the face it landed on and the
 * features that own it.
 *
 * `owners` travels alongside `best` on purpose. A click resolves to five to
 * eight readings and the ranking puts one of them up; that is a *default*, not
 * a claim of correctness, and a consumer that was handed only the winner could
 * not offer the alternatives it silently discarded.
 */
export interface PartPick {
  readonly region: number
  /** Every feature owning the face, in report order. */
  readonly owners: readonly FeatureTag[]
  /** The same set, ranked for this click. Filtered by an active direction. */
  readonly ranked: readonly FeatureTag[]
  /** The ranked pick, or `null` when nothing here is reachable that way. */
  readonly best: FeatureTag | null
  readonly triangleIndex: number
  readonly point: readonly [number, number, number]
  /** The surface's outward normal in world space — the plane under the cursor. */
  readonly normal: readonly [number, number, number]
  readonly modifiers: PickModifiers
  /**
   * Whether this click completed a double click on the part.
   *
   * Reported rather than interpreted, for the same reason the modifiers are:
   * what a second click means belongs to the app. A viewer that decided —
   * withholding the pick so a double click could not disturb the selection —
   * would be right for a list that walks through a face's readings and wrong
   * for an editor where clicking a face twice puts it in and takes it out
   * again. Both are ordinary, and only the app knows which one it is showing.
   *
   * The viewport still acts on the gesture itself: `retargetOnDoubleClick`
   * re-aims the orbit, which is a question about the view rather than about the
   * part, and is nobody else's to answer.
   */
  readonly doubled: boolean
}

/** A unit vector from the part toward the camera, for the owner ranking. */
export function viewDirection(camera: Camera, target: Vector3): Vec3 {
  const { x, y, z } = camera.position
  const dx = x - target.x
  const dy = y - target.y
  const dz = z - target.z
  const length = Math.sqrt(dx * dx + dy * dy + dz * dz)

  if (length === 0) return { x: 0, y: 0, z: 1 }
  return { x: dx / length, y: dy / length, z: dz / length }
}

export interface BuildPickInput {
  readonly model: PartModel
  readonly region: number
  readonly triangleIndex: number
  readonly point: readonly [number, number, number]
  readonly normal: readonly [number, number, number]
  readonly modifiers?: PickModifiers
  /**
   * The machining direction the pick is scoped to, as an index into
   * `candidateDirections`. Narrows the owners to two, one, or **none** — the
   * empty case is real, and reads as "nothing here in this direction" rather
   * than as a pick that missed.
   */
  readonly activeDirection?: number | null
  readonly viewDirection?: Vec3 | null
  /** Whether this click completed a double click. Defaults to `false`. */
  readonly doubled?: boolean
}

export function buildPick(input: BuildPickInput): PartPick {
  const { model, region } = input
  const owners = model.regionIndex.featuresForRegion(region)
  const context = {
    activeDirection:
      input.activeDirection == null
        ? null
        : (model.candidateDirections[input.activeDirection] ?? null),
    viewDirection: input.viewDirection ?? null,
  }

  return {
    region,
    owners,
    ranked: rankOwners(model, owners, context),
    best: bestOwner(model, owners, context),
    triangleIndex: input.triangleIndex,
    point: input.point,
    normal: input.normal,
    modifiers: input.modifiers ?? NO_MODIFIERS,
    doubled: input.doubled ?? false,
  }
}

/**
 * The owner to focus for a click, given what the last click focused.
 *
 * Clicking the same face again walks its readings — the standard CAD escape
 * hatch for an ambiguous click — while a click on a different face starts from
 * that face's own best answer.
 */
export function focusForPick(
  pick: PartPick,
  previousRegion: number | null,
  previousFocus: FeatureTag | null,
): FeatureTag | null {
  if (pick.ranked.length === 0) return null
  if (previousRegion !== pick.region) return pick.best

  const index = previousFocus === null ? -1 : pick.ranked.indexOf(previousFocus)
  return pick.ranked[(index + 1) % pick.ranked.length] ?? pick.best
}
