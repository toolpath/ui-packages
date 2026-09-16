import { type ThreeEvent, useFrame, useThree } from '@react-three/fiber'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  type Box3,
  type BufferGeometry,
  Color,
  Group,
  Mesh,
  Plane,
  PlaneGeometry,
  Quaternion,
  Raycaster,
  Scene,
  Vector2,
  Vector3,
} from 'three'
import { CONE_AXIS } from './render/directions.js'
import {
  HANDLE_PIXELS,
  SECTION_RENDER_ORDER,
  type SectionOptions,
  type SectionState,
  DEFAULT_SECTION_NORMAL,
  dragPlane,
  sectionAnchor,
  sectionBounds,
  sectionConstant,
  sectionDepth,
  sectionDepthConstant,
  sectionDepthRange,
  sectionOffset,
} from './render/section.js'
import {
  applyCapTheme,
  createCapMaterial,
  createMaskMaterial,
  createMaskTarget,
  createStencilMaterials,
} from './render/section-cap.js'
import { EXCLUDE_FROM_FRAME, type ViewerCamera, screenLength } from './render/camera.js'
import type { ViewerTheme } from './render/theme.js'

export type { SectionOptions, SectionState }

const FURNITURE = { [EXCLUDE_FROM_FRAME]: true }

/** The cut's plane for a set of options, or `null` when there is no cut. */
export function resolveSectionPlane(
  options: SectionOptions | undefined,
  box: Box3,
): { plane: Plane; state: SectionState } | null {
  // An unmeasured box gives infinite bounds and a NaN plane constant, which
  // clips the entire scene away — a blank viewport is a confusing way to find
  // out the part had not loaded yet.
  if (!options?.enabled || box.isEmpty()) return null

  const normal = options.plane?.normal ?? options.normal ?? DEFAULT_SECTION_NORMAL
  const axis = new Vector3(normal.x, normal.y, normal.z)
  if (axis.lengthSq() === 0) axis.set(0, 0, 1)
  axis.normalize()

  const bounds = sectionBounds(box, normal)
  const anchor = options.plane?.point ?? null
  const depth = options.depth ?? null

  const constant =
    anchor === null
      ? sectionConstant(bounds, options.offset ?? 0)
      : sectionDepthConstant(normal, anchor, depth ?? 0)

  return {
    plane: new Plane(axis, constant),
    state: {
      enabled: true,
      normal: { x: axis.x, y: axis.y, z: axis.z },
      offset: sectionOffset(bounds, constant),
      constant,
      plane: options.plane ?? null,
      depth: anchor === null ? null : sectionDepth(normal, anchor, constant),
      depthRange: anchor === null ? null : sectionDepthRange(bounds, normal, anchor),
    },
  }
}

interface SectionViewProps {
  geometry: BufferGeometry
  box: Box3
  plane: Plane
  theme: ViewerTheme
  showHandle: boolean
  onDrag?: (constant: number) => void
}

const Z = new Vector3(0, 0, 1)

/**
 * A clipping plane with a hatched cap over the cut, and an arrow that drags it.
 *
 * The cap is the standard two-pass stencil trick: draw the clipped geometry's
 * back faces incrementing the stencil and its front faces decrementing it, so a
 * non-zero stencil marks exactly where the plane passes through solid material,
 * then fill that region with a quad. Without it a section shows the inside of
 * the far wall and the part reads as hollow.
 *
 * The fill is hatched and outlined — see `render/section-cap.ts` — which takes
 * a pre-pass: the same stencil trick is run once more into a render target on
 * its own, so the cap's shader can find its edge by sampling that mask. That
 * pass draws a scene of its own holding nothing but the stencil meshes and the
 * mask quad, at a priority ahead of R3F's own render.
 *
 * **The renderer must be created with `stencil: true`.** three defaults it to
 * false, and without it every one of those stencil operations is a silent
 * no-op — the cut still happens and the part still looks hollow, which is a
 * confusing way to find out.
 */
export const SectionView = ({
  geometry,
  box,
  plane,
  theme,
  showHandle,
  onDrag,
}: SectionViewProps) => {
  const camera = useThree((state) => state.camera) as ViewerCamera
  const size = useThree((state) => state.size)
  const dpr = useThree((state) => state.viewport.dpr)
  const gl = useThree((state) => state.gl)
  const invalidate = useThree((state) => state.invalidate)
  const controls = useThree((state) => state.controls)
  const domElement = useThree((state) => state.gl.domElement)

  const handleRef = useRef<Group>(null)
  const [hovered, setHovered] = useState(false)
  const dragging = useRef<{ plane: Plane; from: number; constant: number } | null>(null)

  const span = useMemo(() => box.getSize(new Vector3()).length(), [box])
  const clip = useMemo(() => [plane], [plane])

  // Where the cap sits: on the plane, over the part's centre.
  const capPosition = useMemo(() => sectionAnchor(box, plane), [box, plane])

  const capQuaternion = useMemo(() => new Quaternion().setFromUnitVectors(Z, plane.normal), [plane])
  // Aimed out of the material rather than into it. The plane's normal points
  // into the half that stays, so an arrow along it would be buried under the
  // cap it is meant to drag.
  const handleQuaternion = useMemo(
    () => new Quaternion().setFromUnitVectors(CONE_AXIS, plane.normal.clone().negate()),
    [plane],
  )

  // The stencil materials, the mask target and the cap material are built once
  // and updated in place: a drag moves the plane on every pointer event, and
  // rebuilding three materials and a scene for each one is work the GPU has to
  // undo again.
  const stencils = useMemo(() => createStencilMaterials([]), [])
  useEffect(() => () => stencils.forEach((material) => material.dispose()), [stencils])
  useLayoutEffect(() => {
    for (const material of stencils) material.clippingPlanes = clip
  }, [clip, stencils])

  const mask = useMemo(() => createMaskTarget(), [])
  useEffect(() => () => mask.dispose(), [mask])

  const cap = useMemo(() => createCapMaterial(mask.texture), [mask])
  useEffect(() => () => cap.dispose(), [cap])

  // The mask pass's own scene: the same stencil meshes over the same geometry,
  // and a quad that paints white wherever they left the stencil set.
  const quad = useMemo(() => new PlaneGeometry(span * 1.5, span * 1.5), [span])
  useEffect(() => () => quad.dispose(), [quad])

  const maskScene = useMemo(() => {
    const scene = new Scene()
    const [back, front] = stencils
    const backMesh = new Mesh(geometry, back)
    backMesh.renderOrder = SECTION_RENDER_ORDER.stencil
    const frontMesh = new Mesh(geometry, front)
    frontMesh.renderOrder = SECTION_RENDER_ORDER.stencil
    const maskMesh = new Mesh(quad, createMaskMaterial())
    maskMesh.renderOrder = SECTION_RENDER_ORDER.cap
    scene.add(backMesh, frontMesh, maskMesh)
    return { scene, maskMesh }
  }, [geometry, quad, stencils])
  useEffect(() => () => (maskScene.maskMesh.material as { dispose(): void }).dispose(), [maskScene])

  useEffect(() => {
    maskScene.maskMesh.position.copy(capPosition)
    maskScene.maskMesh.quaternion.copy(capQuaternion)
  }, [capPosition, capQuaternion, maskScene])

  // Sized to the drawing buffer rather than to the CSS size: the shader
  // measures in `gl_FragCoord`, which is device pixels. A layout effect, so the
  // first frame the cap draws in is already themed.
  useLayoutEffect(() => {
    const buffer = gl.getDrawingBufferSize(new Vector2())
    mask.setSize(buffer.x, buffer.y)
    cap.uniforms.uResolution.value.copy(buffer)
    applyCapTheme(cap, theme, dpr)
    invalidate()
  }, [cap, dpr, gl, invalidate, mask, size, theme])

  // Before R3F's own render, so the mask the cap samples is this frame's.
  const clearColor = useMemo(() => new Color(), [])
  useFrame(({ gl: renderer, camera: eye }) => {
    const previousAlpha = renderer.getClearAlpha()
    renderer.getClearColor(clearColor)
    renderer.setRenderTarget(mask)
    renderer.setClearColor(0x000000, 1)
    renderer.clear()
    renderer.render(maskScene.scene, eye)
    renderer.setRenderTarget(null)
    renderer.setClearColor(clearColor, previousAlpha)
  }, -1)

  // The handle is a control, so it holds its size on screen: in world units it
  // would be a thumbnail on a plate and a wall on an insert.
  useFrame(() => {
    const handle = handleRef.current
    if (!handle) return
    const length = screenLength(camera, capPosition, size, HANDLE_PIXELS)
    if (Math.abs(handle.scale.x - length) > length * 1e-3) {
      handle.scale.setScalar(length)
      invalidate()
    }
  })

  const setControlsEnabled = useCallback(
    (enabled: boolean) => {
      const target = controls as { enabled?: boolean } | null
      if (target && 'enabled' in target) target.enabled = enabled
    },
    [controls],
  )

  /**
   * The drag runs on the window rather than on the handle.
   *
   * A pointer that has left the arrow is still dragging it — that is what a
   * drag *is* — and an overlay that only tracks while the pointer stays within
   * a 78-pixel arrow stops the moment the cut starts to move.
   */
  const beginDrag = (event: ThreeEvent<PointerEvent>) => {
    if (!onDrag) return
    event.stopPropagation()

    const view = camera.position.clone().sub(capPosition).normalize()
    const surface = dragPlane(plane.normal.clone(), view, capPosition)
    const hit = event.ray.intersectPlane(surface, new Vector3())
    const start = {
      plane: surface,
      from: hit ? hit.dot(plane.normal) : 0,
      constant: plane.constant,
    }
    dragging.current = start
    // A drag that also orbits is a drag nobody can aim.
    setControlsEnabled(false)

    const raycaster = new Raycaster()
    const pointer = new Vector2()

    const move = (native: PointerEvent) => {
      const rect = domElement.getBoundingClientRect()
      pointer.set(
        ((native.clientX - rect.left) / rect.width) * 2 - 1,
        -((native.clientY - rect.top) / rect.height) * 2 + 1,
      )
      raycaster.setFromCamera(pointer, camera)
      const point = raycaster.ray.intersectPlane(start.plane, new Vector3())
      if (!point) return

      // The pointer's travel along the plane's own normal is how far the cut
      // moves; the constant runs the other way, since a larger one clips less.
      onDrag(start.constant - (point.dot(plane.normal) - start.from))
      invalidate()
    }

    const end = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
      dragging.current = null
      setControlsEnabled(true)
    }

    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
  }

  const grab = {
    onPointerDown: beginDrag,
    onPointerOver: (event: ThreeEvent<PointerEvent>) => {
      event.stopPropagation()
      setHovered(true)
      invalidate()
    },
    onPointerOut: () => {
      setHovered(false)
      invalidate()
    },
  }

  return (
    // Excluded from framing, all of it. The cap is a quad half again as wide as
    // the part's diagonal, so a Fit that measured it would frame the cut rather
    // than the part and leave the part a speck in the middle of it.
    <group userData={FURNITURE}>
      {/* The stencil pass. Back faces increment and front faces decrement, so
          what is left marks where the plane is inside solid material. */}
      <mesh
        geometry={geometry}
        material={stencils[0]}
        renderOrder={SECTION_RENDER_ORDER.stencil}
        raycast={() => null}
      />
      <mesh
        geometry={geometry}
        material={stencils[1]}
        renderOrder={SECTION_RENDER_ORDER.stencil}
        raycast={() => null}
      />

      {/* The cap: a quad over the whole cut, filled only where the stencil says
          the plane is inside material. */}
      <mesh
        geometry={quad}
        material={cap}
        position={capPosition}
        quaternion={capQuaternion}
        renderOrder={SECTION_RENDER_ORDER.cap}
        raycast={() => null}
      />

      {showHandle && onDrag ? (
        <group
          ref={handleRef}
          position={capPosition}
          quaternion={handleQuaternion}
          renderOrder={SECTION_RENDER_ORDER.handle}
        >
          {/* Handlers on each mesh rather than on the group. Either works —
              R3F bubbles from the hit mesh to an ancestor — but the ray hits
              both the head and the shaft, and stopping propagation at the mesh
              is what keeps that from counting as two presses. */}
          <mesh position={[0, 0.28, 0]} {...grab}>
            <coneGeometry args={[0.16, 0.34, 20]} />
            <meshBasicMaterial
              color={hovered ? theme.hover : theme.sectionHandle}
              depthTest={false}
            />
          </mesh>
          <mesh position={[0, 0.08, 0]} {...grab}>
            <cylinderGeometry args={[0.045, 0.045, 0.4, 12]} />
            <meshBasicMaterial
              color={hovered ? theme.hover : theme.sectionHandle}
              depthTest={false}
            />
          </mesh>
        </group>
      ) : null}
    </group>
  )
}
