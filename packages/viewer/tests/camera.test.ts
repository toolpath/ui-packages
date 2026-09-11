import {
  Box3,
  Group,
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
  PerspectiveCamera,
  PlaneGeometry,
  Vector3,
} from 'three'
import { describe, expect, it } from 'vitest'
import {
  CAD_CAMERA_UP,
  DEFAULT_FIT_MARGIN,
  EXCLUDE_FROM_FRAME,
  MAX_FRAME_RATIO,
  MIN_FRAME_RATIO,
  PERSPECTIVE_FOV,
  adaptedUp,
  applyProjection,
  aspectRatio,
  boundsFromBox,
  cameraLimits,
  contentBounds,
  currentViewDirection,
  defaultBounds,
  fitDistance,
  orthographicHalfHeight,
  perspectiveFitDistance,
  screenLength,
  startPosition,
  targetBoundary,
} from '../src/render/camera.js'

const LANDSCAPE = { width: 1600, height: 900 }
const PORTRAIT = { width: 900, height: 1600 }

function box(size: number): Box3 {
  return new Box3(new Vector3(0, 0, 0), new Vector3(size, size, size))
}

describe('boundsFromBox', () => {
  it('frames a sphere, so the fit is the same from every angle', () => {
    const bounds = boundsFromBox(box(50.8))

    expect(bounds.center.toArray()).toEqual([25.4, 25.4, 25.4])
    // Half the diagonal, not half the width: a cube seen corner-on is wider
    // than its side, and framing the side clips it.
    expect(bounds.radius).toBeCloseTo((50.8 * Math.sqrt(3)) / 2, 6)
  })

  it('gives an empty scene a frustum with volume', () => {
    expect(boundsFromBox(new Box3()).radius).toBe(defaultBounds().radius)
  })

  it('gives a perfectly flat part a frustum with volume', () => {
    const flat = new Box3(new Vector3(0, 0, 0), new Vector3(0, 0, 0))

    expect(boundsFromBox(flat).radius).toBe(1)
  })
})

describe('aspectRatio', () => {
  it('falls back to square for a container laid out at zero size', () => {
    // A degenerate aspect makes a NaN projection matrix that never recovers.
    expect(aspectRatio({ width: 0, height: 0 })).toBe(1)
    expect(aspectRatio({ width: 800, height: 0 })).toBe(1)
  })
})

describe('fitting a sphere', () => {
  it('frames on the narrower angle, so a portrait viewport frames on width', () => {
    const radius = 10
    const landscape = perspectiveFitDistance(PERSPECTIVE_FOV, aspectRatio(LANDSCAPE), radius)
    const portrait = perspectiveFitDistance(PERSPECTIVE_FOV, aspectRatio(PORTRAIT), radius)

    // The portrait viewport is narrower, so it has to stand further back.
    expect(portrait).toBeGreaterThan(landscape)
  })

  it('grows an orthographic frustum vertically when the viewport is portrait', () => {
    expect(orthographicHalfHeight(2, 10)).toBe(10)
    expect(orthographicHalfHeight(0.5, 10)).toBe(20)
  })

  it('keeps the whole sphere inside the frustum', () => {
    const radius = 10
    const distance = perspectiveFitDistance(PERSPECTIVE_FOV, 1, radius)
    const halfAngle = Math.asin(radius / distance)

    expect(halfAngle).toBeCloseTo((PERSPECTIVE_FOV * Math.PI) / 360, 6)
  })
})

describe('applyProjection', () => {
  it('derives near and far from the bounds rather than the camera distance', () => {
    const camera = new PerspectiveCamera()
    const bounds = boundsFromBox(box(50.8))

    applyProjection(camera, LANDSCAPE, bounds)
    const { near, far } = camera

    // Dollying must not need them recomputed, so moving the camera changes
    // neither.
    camera.position.set(0, 0, 5000)
    applyProjection(camera, LANDSCAPE, bounds)
    expect(camera.near).toBe(near)
    expect(camera.far).toBe(far)
    expect(camera.fov).toBe(PERSPECTIVE_FOV)
  })

  it('lets an orthographic near plane sit behind the camera', () => {
    const camera = new OrthographicCamera()

    applyProjection(camera, LANDSCAPE, boundsFromBox(box(10)))

    // Otherwise pushing the camera back clips the part out of existence.
    expect(camera.near).toBeLessThan(0)
    expect(camera.right - camera.left).toBeGreaterThan(camera.top - camera.bottom)
  })
})

describe('startPosition', () => {
  it('stands far enough back to frame the part', () => {
    const bounds = boundsFromBox(box(50.8))
    const position = startPosition('perspective', LANDSCAPE, bounds)

    expect(position.distanceTo(bounds.center)).toBeCloseTo(
      fitDistance('perspective', LANDSCAPE, bounds, DEFAULT_FIT_MARGIN),
      6,
    )
  })
})

describe('contentBounds', () => {
  /**
   * The reason this is not just `setFromObject`: a 100 mm grid around a 6 mm
   * part frames the grid, and the part becomes a speck.
   */
  it('ignores the grid and axes', () => {
    const root = new Group()
    const part = new Mesh(new PlaneGeometry(2, 2), new MeshBasicMaterial())
    const furniture = new Mesh(new PlaneGeometry(200, 200), new MeshBasicMaterial())
    furniture.userData[EXCLUDE_FROM_FRAME] = true
    root.add(part, furniture)

    const bounds = contentBounds(root, new Box3())

    expect(bounds.radius).toBeCloseTo(Math.SQRT2, 6)
  })

  it('ignores the children of something excluded', () => {
    const root = new Group()
    const part = new Mesh(new PlaneGeometry(2, 2), new MeshBasicMaterial())
    const group = new Group()
    group.userData[EXCLUDE_FROM_FRAME] = true
    group.add(new Mesh(new PlaneGeometry(200, 200), new MeshBasicMaterial()))
    root.add(part, group)

    expect(contentBounds(root, new Box3()).radius).toBeCloseTo(Math.SQRT2, 6)
  })

  it('falls back to default bounds when nothing is framable', () => {
    expect(contentBounds(new Group(), new Box3()).radius).toBe(defaultBounds().radius)
  })
})

describe('currentViewDirection', () => {
  it('reports the direction the camera is looking from, so Fit can keep it', () => {
    const camera = new PerspectiveCamera()
    camera.position.set(0, 0, 42)

    expect(currentViewDirection(camera, new Vector3(), new Vector3()).toArray()).toEqual([0, 0, 1])
  })

  it('falls back rather than normalizing a zero vector', () => {
    const camera = new PerspectiveCamera()
    camera.position.set(3, 3, 3)

    const direction = currentViewDirection(camera, new Vector3(3, 3, 3), new Vector3())
    expect(direction.length()).toBeCloseTo(1, 6)
  })
})

/**
 * The wheel used to be able to leave the viewport empty from either end, and
 * both cameras could do it: sixty notches took an orthographic `camera.zoom` to
 * 1e30, and eight took a perspective camera to 2.5 mm from its target — inside
 * a 50 mm part. Both rendered nothing, and the way back was a double middle
 * click that nothing on screen advertises.
 */
describe('cameraLimits', () => {
  const bounds = boundsFromBox(box(50.8))

  it('lets an orthographic wheel cross the fitted framing and no further', () => {
    // `zoom` 1 is the fitted frustum, so the two ratios say what they look like
    // they say: a quarter of the view, or ten times it.
    const limits = cameraLimits('orthographic', LANDSCAPE, bounds)

    expect(limits.minZoom).toBe(MIN_FRAME_RATIO)
    expect(limits.maxZoom).toBe(MAX_FRAME_RATIO)
  })

  it('keeps an orthographic camera clear of the part it is looking at', () => {
    // Distance is not apparent size under an orthographic camera, so these are
    // not the zoom clamps again — they stop the camera walking through the part
    // while the frustum, which is what is actually being scaled, does not move.
    const limits = cameraLimits('orthographic', LANDSCAPE, bounds)
    const fit = fitDistance('orthographic', LANDSCAPE, bounds)

    expect(limits.minDistance).toBeCloseTo(bounds.radius * DEFAULT_FIT_MARGIN, 6)
    expect(limits.minDistance).toBeLessThan(fit)
    expect(limits.maxDistance).toBeGreaterThan(fit)
  })

  it('reads the same rule off distance under a perspective camera', () => {
    // Apparent size is the inverse of distance there, so ten times the size is
    // a tenth of the way out — the ratios swap sides, and the rule does not.
    const limits = cameraLimits('perspective', LANDSCAPE, bounds)
    const fit = fitDistance('perspective', LANDSCAPE, bounds)

    expect(limits.minDistance).toBeCloseTo(fit / MAX_FRAME_RATIO, 6)
    expect(limits.maxDistance).toBeCloseTo(fit / MIN_FRAME_RATIO, 6)
  })

  it('leaves the fitted framing reachable, whichever camera and viewport', () => {
    // A clamp that excluded the framing Fit asks for would fight every Fit.
    for (const projection of ['orthographic', 'perspective'] as const) {
      for (const size of [LANDSCAPE, PORTRAIT]) {
        const limits = cameraLimits(projection, size, bounds)
        const fit = fitDistance(projection, size, bounds)

        expect(fit).toBeGreaterThanOrEqual(limits.minDistance)
        expect(fit).toBeLessThanOrEqual(limits.maxDistance)
        expect(limits.minZoom).toBeLessThanOrEqual(1)
        expect(limits.maxZoom).toBeGreaterThanOrEqual(1)
      }
    }
  })

  it('scales with the part, so a 6 mm insert and a 900 mm plate clamp alike', () => {
    const small = cameraLimits('perspective', LANDSCAPE, boundsFromBox(box(6)))
    const large = cameraLimits('perspective', LANDSCAPE, boundsFromBox(box(900)))

    expect(large.maxDistance / small.maxDistance).toBeCloseTo(900 / 6, 6)
  })

  /**
   * `frameBox` on something much smaller than the part.
   *
   * The band is about the scene, and a view of a 3 mm hole in a 100 mm plate is
   * nowhere near it: the framing needs about 37× and the wheel's ceiling is 10×.
   * Both cameras refused it, in opposite directions — orthographic clamped the
   * `zoomTo` and reported success, perspective let `setLookAt` past the floor
   * `dolly` then enforced, so the first notch of the wheel threw the framing
   * away.
   */
  describe('framed on something smaller than the scene', () => {
    const plate = boundsFromBox(box(100))
    const hole = boundsFromBox(box(3))

    it('reaches the zoom an orthographic framing of a small feature needs', () => {
      const limits = cameraLimits('orthographic', LANDSCAPE, plate, DEFAULT_FIT_MARGIN, hole)
      // The zoom `frameBounds` asks for, written the way it writes it.
      const reach = plate.radius / hole.radius

      expect(reach).toBeGreaterThan(MAX_FRAME_RATIO)
      expect(limits.maxZoom).toBeGreaterThanOrEqual(reach)
    })

    it('leaves a perspective framing of a small feature standing', () => {
      const limits = cameraLimits('perspective', LANDSCAPE, plate, DEFAULT_FIT_MARGIN, hole)
      // Where `frameBounds` puts the camera. The wheel's own dolly clamps to
      // `minDistance`, so a framing inside it survives exactly until the first
      // notch and then jumps outward.
      const framedFit = fitDistance('perspective', LANDSCAPE, hole)

      expect(framedFit).toBeGreaterThanOrEqual(limits.minDistance)
      expect(framedFit).toBeLessThanOrEqual(limits.maxDistance)
    })

    it('keeps the whole part reachable from a framed feature', () => {
      // The point of widening rather than moving. A band that simply followed
      // the last framing would put "far enough out to see what the hole is in"
      // outside itself, and the wheel could not get back to the part.
      for (const projection of ['orthographic', 'perspective'] as const) {
        const scene = cameraLimits(projection, LANDSCAPE, plate)
        const framed = cameraLimits(projection, LANDSCAPE, plate, DEFAULT_FIT_MARGIN, hole)
        const fit = fitDistance(projection, LANDSCAPE, plate)

        expect(fit).toBeGreaterThanOrEqual(framed.minDistance)
        expect(fit).toBeLessThanOrEqual(framed.maxDistance)
        expect(framed.minZoom).toBeLessThanOrEqual(scene.minZoom)
        expect(framed.maxZoom).toBeGreaterThanOrEqual(scene.maxZoom)
        expect(framed.maxDistance).toBeGreaterThanOrEqual(scene.maxDistance)
      }
    })

    it('is the scene band again when the framing is the scene', () => {
      for (const projection of ['orthographic', 'perspective'] as const) {
        expect(cameraLimits(projection, LANDSCAPE, plate, DEFAULT_FIT_MARGIN, plate)).toEqual(
          cameraLimits(projection, LANDSCAPE, plate),
        )
      }
    })

    it('ignores a framing with no extent rather than clamping to infinity', () => {
      // An empty box has radius 0, and the zoom it implies is `Infinity`.
      const empty = { center: plate.center, radius: 0 }

      for (const projection of ['orthographic', 'perspective'] as const) {
        expect(cameraLimits(projection, LANDSCAPE, plate, DEFAULT_FIT_MARGIN, empty)).toEqual(
          cameraLimits(projection, LANDSCAPE, plate),
        )
      }
    })
  })
})

/**
 * Zoom-to-cursor moves the orbit *target*, and goes on moving it after the zoom
 * clamp has bitten: forty notches walked the target of this part out to
 * (2124, −2697). No zoom clamp catches that, because by then the zoom is not
 * what is changing.
 */
describe('targetBoundary', () => {
  const bounds = boundsFromBox(box(50.8))

  it('holds the target within a few frames of the part', () => {
    const boundary = targetBoundary(bounds, new Box3())

    expect(boundary.containsPoint(bounds.center)).toBe(true)
    expect(boundary.containsPoint(new Vector3(2124, -2697, 25.4))).toBe(false)
  })

  it('leaves enough slack that panning does not feel walled in', () => {
    // Four fitted frames: far enough that a deliberate pan never reaches it,
    // near enough that a runaway cannot get out of sight.
    const boundary = targetBoundary(bounds, new Box3())
    const reach = bounds.radius * DEFAULT_FIT_MARGIN * 4

    expect(boundary.max.x - bounds.center.x).toBeCloseTo(reach, 6)
  })

  it('writes into the box it is given, so the per-frame path allocates nothing', () => {
    const into = new Box3()

    expect(targetBoundary(bounds, into)).toBe(into)
  })
})

describe('adaptedUp', () => {
  /*
   * The opening pose the perspective camera is framed from, as the direction
   * the camera looks *along* — the negated start direction, which is what the
   * controls hand `adaptedUp` once the frame has landed.
   */
  const openingView = new Vector3(2, 1.2, -2.5).normalize().negate()

  /*
   * Where the camera sits before anything has framed it: `CadCameraControls`
   * builds it at (1, -1, 1) looking at the origin. Nothing is ever meant to be
   * seen from here — it is the pose the opening frame replaces.
   */
  const unframedView = new Vector3(1, -1, 1).normalize().negate()

  it('squares the CAD up vector against the view it is given', () => {
    const up = adaptedUp(openingView, CAD_CAMERA_UP.clone(), new Vector3())

    expect(up.dot(openingView)).toBeCloseTo(0, 6)
    expect(up.x).toBeCloseTo(0.626994, 5)
    expect(up.y).toBeCloseTo(0.376196, 5)
    expect(up.z).toBeCloseTo(0.682169, 5)
  })

  it('changes nothing on a second run at the same view', () => {
    const once = adaptedUp(openingView, CAD_CAMERA_UP.clone(), new Vector3())
    const twice = adaptedUp(openingView, once.clone(), new Vector3())

    expect(twice.x).toBeCloseTo(once.x, 6)
    expect(twice.y).toBeCloseTo(once.y, 6)
    expect(twice.z).toBeCloseTo(once.z, 6)
  })

  /**
   * The reason a canonical pose has to state its own up vector.
   *
   * This is a projection, so the component it removes is gone. Run it at a pose
   * the camera is only passing through and the roll that leaves behind is still
   * there at the pose that matters — 51° off, here, which is a part visibly
   * turned in the viewport rather than a rounding difference.
   *
   * It is not hypothetical: applying the camera limits used to run the controls
   * once while the camera was still unframed, and this is the arithmetic of the
   * result. `viewer.tsx` now applies them after the look-at and squares the up
   * vector at `resetContent`; if either regresses, the opening view of every
   * part rolls and only an end-to-end click test would notice.
   */
  it('carries the roll of a pose the camera only passed through', () => {
    const direct = adaptedUp(openingView, CAD_CAMERA_UP.clone(), new Vector3())

    const throughUnframed = adaptedUp(
      openingView,
      adaptedUp(unframedView, CAD_CAMERA_UP.clone(), new Vector3()),
      new Vector3(),
    )

    // Still a legal up vector — which is why nothing else looked wrong.
    expect(throughUnframed.dot(openingView)).toBeCloseTo(0, 6)

    expect(throughUnframed.x).toBeCloseTo(-0.004357, 5)
    expect(throughUnframed.y).toBeCloseTo(0.90287, 5)
    expect(throughUnframed.z).toBeCloseTo(0.429892, 5)

    const rolledBy = (Math.acos(direct.dot(throughUnframed)) * 180) / Math.PI
    expect(rolledBy).toBeGreaterThan(50)
  })

  /*
   * The function is exported and takes an out-parameter, so "may I pass the
   * same vector twice?" is a question a consumer will ask. The answer is yes,
   * and it rests on three.js caching all six components of `crossVectors`
   * before it writes any — someone else's implementation detail, which is
   * exactly the kind of thing worth pinning rather than trusting.
   */
  it('gives the same answer when the result is written over an argument', () => {
    const separate = adaptedUp(openingView, CAD_CAMERA_UP.clone(), new Vector3())

    const overView = openingView.clone()
    adaptedUp(overView, CAD_CAMERA_UP.clone(), overView)

    const up = CAD_CAMERA_UP.clone()
    adaptedUp(openingView, up, up)

    for (const aliased of [overView, up]) {
      expect(aliased.x).toBeCloseTo(separate.x, 12)
      expect(aliased.y).toBeCloseTo(separate.y, 12)
      expect(aliased.z).toBeCloseTo(separate.z, 12)
    }
  })

  // Not an error and not a legal up vector: the caller is responsible for never
  // asking. `freeOrbit` and a squared `up` at every canonical pose are what keep
  // the viewer away from it.
  it('returns a zero vector when the view and the up vector are parallel', () => {
    const up = adaptedUp(CAD_CAMERA_UP.clone(), CAD_CAMERA_UP.clone(), new Vector3())

    expect(up.lengthSq()).toBe(0)
  })
})

describe('screenLength', () => {
  it('holds a control the same size on screen however far away it is', () => {
    const camera = new PerspectiveCamera(30, 1, 0.1, 1000)
    camera.position.set(0, 0, 100)
    const near = screenLength(camera, new Vector3(0, 0, 50), { width: 800, height: 600 }, 78)
    const far = screenLength(camera, new Vector3(0, 0, -50), { width: 800, height: 600 }, 78)

    // Further away means more world units per pixel, so the handle grows.
    expect(far).toBeGreaterThan(near)
  })

  it('reads an orthographic frustum rather than a distance', () => {
    const camera = new OrthographicCamera(-10, 10, 10, -10)
    const length = screenLength(camera, new Vector3(), { width: 800, height: 400 }, 40)

    // 20 world units over 400 pixels, so 40 pixels is 2 units — wherever the
    // camera happens to be.
    expect(length).toBeCloseTo(2, 9)
  })
})
