import { type Box3, type Object3D, OrthographicCamera, PerspectiveCamera, Vector3 } from 'three'

export type Projection = 'orthographic' | 'perspective'

export type ViewerCamera = OrthographicCamera | PerspectiveCamera

export interface ViewportSize {
  readonly width: number
  readonly height: number
}

/** Vertical field of view, in degrees, for the perspective camera. */
export const PERSPECTIVE_FOV = 30

/** Padding around the framed bounds, as a multiple of its radius. */
export const DEFAULT_FIT_MARGIN = 1.2

/** Marks scene furniture — grid, axes — that the camera should not frame. */
export const EXCLUDE_FROM_FRAME = 'viewerExcludeFromFrame'

/**
 * What the camera frames: a bounding *sphere*, not a box.
 *
 * A sphere makes framing rotation-invariant — the part stays fully visible from
 * every angle, and a resize never needs to know the current pose. Framing
 * per-axis box dimensions instead means recomputing the camera distance on
 * every resize, and still clipping on some orientations.
 */
export interface SceneBounds {
  readonly center: Vector3
  readonly radius: number
}

/**
 * Bounds for a scene with nothing in it. A viewer is mounted before it has a
 * part, and a camera with a zero-size frustum renders nothing at all.
 */
export function defaultBounds(): SceneBounds {
  return { center: new Vector3(0, 0, 0), radius: 1 }
}

/**
 * A container can be laid out at zero size, and a degenerate aspect ratio
 * produces a `NaN` projection matrix that never recovers. Fall back to square.
 */
export function aspectRatio(size: ViewportSize): number {
  return size.width > 0 && size.height > 0 ? size.width / size.height : 1
}

/** Guards the divide when the camera sits exactly on the point being measured. */
const SCREEN_LENGTH_EPSILON = 1e-9

/**
 * A world length that covers `pixels` on screen at `point`.
 *
 * Anything sized in world units is a thumbnail on a plate and a wall on an
 * insert; the whole reason a control is measured this way is that it is a
 * control rather than part of the model. The section handle and the orbit
 * target marker both size themselves with it, which is why it lives here with
 * the camera rather than beside either of them.
 *
 * The two projections answer differently on purpose. An orthographic frustum
 * covers the same world height wherever the point is, so distance does not
 * enter; a perspective one covers more the further away it looks, so it does.
 */
export function screenLength(
  camera: ViewerCamera,
  point: Vector3,
  viewport: ViewportSize,
  pixels: number,
): number {
  const height = viewport.height > 0 ? viewport.height : 1
  const zoom = camera.zoom || 1

  const visible =
    camera instanceof OrthographicCamera
      ? (camera.top - camera.bottom) / zoom
      : (2 *
          Math.tan(((camera.fov / 2) * Math.PI) / 180) *
          Math.max(camera.position.distanceTo(point), SCREEN_LENGTH_EPSILON)) /
        zoom

  return (visible / height) * pixels
}

export function boundsFromBox(box: Box3): SceneBounds {
  if (box.isEmpty()) return defaultBounds()

  const center = box.getCenter(new Vector3())
  const radius = box.getSize(new Vector3()).length() / 2

  // A single point, or a perfectly flat part seen edge-on, still needs a
  // frustum with volume.
  return { center, radius: radius > 0 ? radius : 1 }
}

/**
 * The bounds of everything worth framing under `root`.
 *
 * Skips objects flagged with {@link EXCLUDE_FROM_FRAME} and their descendants:
 * a 100 mm grid around a 6 mm part would otherwise frame the grid, and the part
 * would be a speck.
 */
export function contentBounds(root: Object3D, into: Box3): SceneBounds {
  into.makeEmpty()

  root.updateWorldMatrix(true, true)
  root.traverse((object) => {
    if (object.userData[EXCLUDE_FROM_FRAME]) return
    let ancestor: Object3D | null = object.parent
    while (ancestor && ancestor !== root) {
      if (ancestor.userData[EXCLUDE_FROM_FRAME]) return
      ancestor = ancestor.parent
    }
    if ('isMesh' in object || 'isLine' in object || 'isPoints' in object) {
      into.expandByObject(object)
    }
  })

  return boundsFromBox(into)
}

/**
 * The distance at which a sphere of `radius` fits inside a perspective frustum.
 * Uses the narrower of the two field-of-view angles, so a portrait viewport
 * frames on width and a landscape one on height.
 */
export function perspectiveFitDistance(fovDegrees: number, aspect: number, radius: number): number {
  const verticalFov = (fovDegrees * Math.PI) / 180
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * aspect)

  return radius / Math.sin(Math.min(verticalFov, horizontalFov) / 2)
}

/**
 * Half-height of an orthographic frustum that fits a sphere of `radius`. A
 * portrait viewport grows the height so the width still clears the sphere.
 */
export function orthographicHalfHeight(aspect: number, radius: number): number {
  return aspect >= 1 ? radius : radius / aspect
}

/**
 * Near and far planes, deliberately derived from the bounds alone and not from
 * the camera's distance: they then survive dollying and orbiting without
 * needing to be recomputed, and the ratio stays small enough for the depth
 * buffer to behave.
 *
 * A hundred radii rather than the legacy viewer's thousand largest-dimensions.
 * The two were never reconciled, so: `MAX_FRAME_RATIO` bounds how far the
 * camera may travel, and {@link cameraLimits} derives `maxDistance` from the
 * same `fitDistance` this sizes against — so a hundred radii is not a guess at
 * a generous number, it is provably more depth than the clamps can reach. A
 * thousand would only spend depth-buffer precision on volume nothing can enter.
 */
function nearFar(projection: Projection, radius: number): { near: number; far: number } {
  // An orthographic near plane may sit behind the camera, which keeps geometry
  // visible however far the controls push the camera back.
  if (projection === 'orthographic') return { near: -radius * 100, far: radius * 100 }
  return { near: radius / 100, far: radius * 100 }
}

const START_DIRECTION: Record<Projection, readonly [number, number, number]> = {
  orthographic: [1.2, -2.5, 3],
  perspective: [2, 1.2, -2.5],
}

export function fitDistance(
  projection: Projection,
  size: ViewportSize,
  bounds: SceneBounds,
  margin = DEFAULT_FIT_MARGIN,
): number {
  if (projection === 'perspective') {
    return perspectiveFitDistance(PERSPECTIVE_FOV, aspectRatio(size), bounds.radius * margin)
  }
  // Distance does not affect an orthographic framing — the frustum does. The
  // camera only has to sit clear of the geometry.
  return bounds.radius * margin * 4
}

export function startPosition(
  projection: Projection,
  size: ViewportSize,
  bounds: SceneBounds,
  margin = DEFAULT_FIT_MARGIN,
): Vector3 {
  const [x, y, z] = START_DIRECTION[projection]

  return new Vector3(x, y, z)
    .normalize()
    .multiplyScalar(fitDistance(projection, size, bounds, margin))
    .add(bounds.center)
}

/**
 * How far out the wheel may pull, as a fraction of the fitted framing: the part
 * may shrink to a quarter of the view and no further. Past that it is a speck
 * with no cue that Fit is the way back.
 */
export const MIN_FRAME_RATIO = 0.25

/**
 * How far in the wheel may push, as a multiple of the fitted framing.
 *
 * Both ratios are the legacy viewer's `minZoom` 0.25 / `maxZoom` 10
 * (`three-object.tsx:289-311`), which transfer almost exactly: legacy's
 * orthographic frustum was `largestDimension * 2` tall and this one is the
 * fitted bounding sphere, which for a cube agree within a few percent. So the
 * numbers are the ones that shipped, and here they carry a meaning they did not
 * have there — `zoom` 1 *is* the fitted framing, so 0.25 and 10 say exactly
 * what a reader thinks they say.
 */
export const MAX_FRAME_RATIO = 10

/**
 * The bounds the orbit target may not leave, as a multiple of the fitted
 * framing.
 *
 * Zooming to the cursor moves the *target*, not just the camera, and it keeps
 * moving it after the zoom clamp has bitten — forty notches walked the target
 * of a 50 mm part out to (2124, −2697). A zoom clamp cannot catch that because
 * the zoom is no longer changing. Four frames of slack leaves panning feeling
 * unbounded while making the runaway impossible.
 */
const TARGET_BOUNDARY_RATIO = 4

/** How far the camera may travel, in the two units the two cameras travel in. */
export interface CameraLimits {
  readonly minZoom: number
  readonly maxZoom: number
  readonly minDistance: number
  readonly maxDistance: number
}

/**
 * The clamps for a scene, so the wheel cannot leave the viewport empty.
 *
 * Without them it can, from either end, and both cameras can do it: an
 * orthographic `camera.zoom` reaches 1e30 in sixty notches, and a perspective
 * camera dives inside the part in eight, because `minDistance` defaults to
 * `Number.EPSILON`. Fit recovers from both — but Fit is a double middle click
 * and nothing on screen says so, which makes it a way out rather than an
 * answer.
 *
 * One rule for both cameras: the wheel may take the part from a quarter of its
 * fitted size to ten times it. Under an orthographic camera that scale *is* the
 * frustum, so the ratios land on `zoom`; under a perspective camera apparent
 * size is the inverse of distance, so they land on `distance` — which is why
 * they swap sides between the two.
 *
 * Pure, and derived from `bounds`, so it re-derives wherever the scene is
 * re-measured rather than being sampled once at mount.
 *
 * `framed` is what the view has been framed *on*, when that is not the whole
 * scene — `frameBox` on a single feature. The band is then taken about that
 * framing as well as about the scene's, because a band centred on the part is
 * the wrong band for a view of a 3 mm hole in it: ten times the *part's* fitted
 * size can be less than once the hole's, so the framing the caller asked for sat
 * outside the clamps meant to keep it in view. Under an orthographic camera
 * `zoom` is measured against a frustum still sized to the scene, so the framing
 * enters as the zoom ratio it takes to reach; under a perspective one it enters
 * as its own fitted distance.
 *
 * Widened to the union of the two rather than moved onto `framed`, and that is
 * the whole of why this takes both. A band that simply followed the last framing
 * would take the part away: framing a hole would put "far enough out to see what
 * the hole is in" past `maxDistance`, so the wheel could no longer get back to
 * the part it had just been looking at, and Fit — a gesture with nothing on
 * screen to say so — would be the only way. Reaching further in must not cost
 * the reach back out, so each end takes whichever bound is looser. With no
 * `framed`, or one the size of the scene, both ends collapse to the scene's own
 * and this is the function it was before.
 */
export function cameraLimits(
  projection: Projection,
  size: ViewportSize,
  bounds: SceneBounds,
  margin = DEFAULT_FIT_MARGIN,
  framed?: SceneBounds,
): CameraLimits {
  const fit = fitDistance(projection, size, bounds, margin)
  // A degenerate framing — an empty box, a feature with no extent — has no
  // ratio to offer and would poison the clamps with `Infinity`. The scene's own
  // band is the honest answer.
  const framedRadius = framed && framed.radius > 0 ? framed.radius : bounds.radius

  if (projection === 'orthographic') {
    // What `frameBounds` must reach for this framing: `zoom` 1 is the scene
    // fitted, so the scene's radius over the framed one *is* the zoom.
    const reach = bounds.radius > 0 ? bounds.radius / framedRadius : 1

    return {
      minZoom: Math.min(MIN_FRAME_RATIO, MIN_FRAME_RATIO * reach),
      maxZoom: Math.max(MAX_FRAME_RATIO, MAX_FRAME_RATIO * reach),
      // Distance does not change apparent size under an orthographic camera, so
      // these are not the zoom clamps in another form — they only keep the
      // camera clear of the geometry it is looking at, and bounded.
      minDistance: bounds.radius * margin,
      maxDistance: fit / MIN_FRAME_RATIO,
    }
  }

  const framedFit = fitDistance(
    projection,
    size,
    framedRadius === bounds.radius ? bounds : { ...bounds, radius: framedRadius },
    margin,
  )

  return {
    // The wheel is `ACTION.DOLLY` under a perspective camera, so nothing here
    // moves `camera.zoom`. They are set to the same pair anyway: a consumer
    // that does zoom should not find the two cameras disagreeing about how far
    // in is too far.
    minZoom: MIN_FRAME_RATIO,
    maxZoom: MAX_FRAME_RATIO,
    minDistance: Math.min(fit, framedFit) / MAX_FRAME_RATIO,
    maxDistance: Math.max(fit, framedFit) / MIN_FRAME_RATIO,
  }
}

const scratchBoundarySize = new Vector3()

/**
 * The box the orbit target is confined to — the fitted framing, several frames
 * over. Written into `into` so the per-frame path allocates nothing.
 */
export function targetBoundary(bounds: SceneBounds, into: Box3, margin = DEFAULT_FIT_MARGIN): Box3 {
  const reach = bounds.radius * margin * TARGET_BOUNDARY_RATIO

  return into.setFromCenterAndSize(
    bounds.center,
    scratchBoundarySize.set(reach * 2, reach * 2, reach * 2),
  )
}

/**
 * Points an existing camera's frustum at `bounds` for the current viewport.
 * Pose is untouched — that belongs to the controls.
 */
export function applyProjection(
  camera: ViewerCamera,
  size: ViewportSize,
  bounds: SceneBounds,
  margin = DEFAULT_FIT_MARGIN,
): void {
  const aspect = aspectRatio(size)
  const radius = bounds.radius * margin

  if (camera instanceof OrthographicCamera) {
    const halfHeight = orthographicHalfHeight(aspect, radius)
    const halfWidth = halfHeight * aspect

    camera.left = -halfWidth
    camera.right = halfWidth
    camera.top = halfHeight
    camera.bottom = -halfHeight

    const { near, far } = nearFar('orthographic', radius)
    camera.near = near
    camera.far = far
  } else {
    camera.fov = PERSPECTIVE_FOV
    camera.aspect = aspect

    const { near, far } = nearFar('perspective', radius)
    camera.near = near
    camera.far = far
  }

  camera.updateProjectionMatrix()
}

/**
 * The world-up convention. The part data is Z-up (millimetres, no conversion) —
 * not the glTF-conventional Y-up — so the camera has to say so explicitly.
 */
export const CAD_CAMERA_UP = new Vector3(0, 0, 1)

const scratchSide = new Vector3()

/**
 * `up` re-squared against a view direction: the part of it perpendicular to
 * `view`, written into `into`.
 *
 * This is what keeps the horizon level while a free orbit carries the camera
 * over a pole — the up vector follows the view instead of flipping. The
 * controls run it on every update, which is what makes the next sentence the
 * important one.
 *
 * **It is path-dependent.** It is a projection, so it discards the component it
 * removes and cannot put it back: running it at one view and then another does
 * not give what running it once at the second view would. So a camera carries
 * the roll of every pose it has passed through, and any pose that is meant to
 * be canonical — the opening frame, a reset, a named view — has to say what
 * `up` is rather than inherit it. `viewer.tsx` does, at `resetContent`. The
 * test beside this pins both halves.
 *
 * `into` may be `view` or `up` — three.js `crossVectors` reads all six
 * components before it writes any, and the intermediate is this module's own
 * scratch, so writing the result over an input is safe. Said here because this
 * is exported and an out-parameter invites the question; the test beside this
 * pins it, so a three.js change cannot quietly turn the answer around.
 *
 * `view` and `up` being parallel is the one degenerate case: their cross is
 * zero, `normalize` leaves it zero, and the result is a zero vector rather than
 * an error. A caller with a free-orbiting camera reaches that at the pole,
 * which is what `freeOrbit` and a squared `up` at every canonical pose exist to
 * keep it away from.
 */
export function adaptedUp(view: Vector3, up: Vector3, into: Vector3): Vector3 {
  const side = scratchSide.crossVectors(view, up).normalize()

  return into.crossVectors(side, view).normalize()
}

/** Named viewing directions, as unit vectors from the part toward the camera. */
export const cadViewDirections = {
  front: new Vector3(0, -1, 0),
  back: new Vector3(0, 1, 0),
  left: new Vector3(-1, 0, 0),
  right: new Vector3(1, 0, 0),
  top: new Vector3(0, 0, 1),
  bottom: new Vector3(0, 0, -1),
  isometric: new Vector3(1, -1, 1).normalize(),
} as const

export type ViewerView = keyof typeof cadViewDirections

/** The current orbit direction, so Fit can retain the direction being looked from. */
export function currentViewDirection(
  camera: ViewerCamera,
  target: Vector3,
  into: Vector3,
): Vector3 {
  into.subVectors(camera.position, target)
  if (into.lengthSq() <= Number.EPSILON) return into.copy(cadViewDirections.isometric)
  return into.normalize()
}
