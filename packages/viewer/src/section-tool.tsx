import { type ThreeEvent, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import {
  type Box3,
  BufferGeometry,
  DoubleSide,
  Group,
  Quaternion,
  Raycaster,
  Vector2,
  Vector3,
} from 'three'
import { useContentBox } from './content-box.js'
import { EXCLUDE_FROM_FRAME } from './render/camera.js'
import { AXIS_COLORS } from './render/measure.js'
import {
  type AxesPlane,
  OUTLINE_SCALE,
  PREVIEW_SCALE,
  SECTION_RENDER_ORDER,
  type SectionOptions,
  type SurfaceHit,
  axesPlanes,
  pickedStartDepth,
  sectionAnchor,
  sectionFromPick,
  surfaceUnderRay,
} from './render/section.js'
import { type ViewerTheme, resolveTheme } from './render/theme.js'
import { resolveSectionPlane } from './section-view.js'
import { useTapGuard } from './tap.js'
import { useSectionStore } from './viewer.js'

const FURNITURE = { [EXCLUDE_FROM_FRAME]: true }
const Z = new Vector3(0, 0, 1)

const AXIS_ROTATIONS = {
  x: [0, Math.PI / 2, 0],
  y: [Math.PI / 2, 0, 0],
  z: [0, 0, 0],
} as const

/** How far the preview floats off the face, as a fraction of the diagonal. */
const PREVIEW_LIFT = 0.002
/** How far the sheet sits behind the cap, so the two do not fight for the pixel. */
const SHEET_SETBACK = 0.001

export interface SectionToolProps {
  theme?: Partial<ViewerTheme>
}

/**
 * The interactive way to cut a part open. Mount it beside `<PartMesh>`.
 *
 * With no cut in place it offers two: hover a face and a small square previews
 * a cut through it — click to make it — or click one of the three global
 * planes standing behind the part to sweep along that axis. Once there is a
 * cut it draws the cutting plane as a translucent sheet with an outline, and
 * `Escape` clears it. The handle that drags the cut, and the hatched cap, are
 * the part's own and appear whether or not this is mounted.
 *
 * Nothing needs wiring. The cut lives in the viewer, `<PartMesh>` follows it
 * when it is given no `section` of its own, and `ViewerHandle.setSection` is
 * the way to set or clear it from outside the canvas. While this is mounted
 * the part reports no hovers or picks: a click on a face cuts through it
 * without also selecting it, and a cut part is looked at rather than picked
 * at. Unmounting it hands the pointer back. While it is offering a cut — up,
 * with none placed yet — a `<MeasureTool>` beside it waits too, so the click
 * that chooses the cut does not also place a measurement point.
 */
export const SectionTool = ({ theme }: SectionToolProps) => {
  const store = useSectionStore()
  const section = useSyncExternalStore(store.subscribe, store.get, store.get)
  const box = useContentBox()
  const resolved = useMemo(() => resolveTheme(theme), [theme])

  // For as long as this is up, the part reports no hovers or picks.
  useEffect(() => {
    store.setEngaged(true)
    return () => store.setEngaged(false)
  }, [store])

  useEffect(() => {
    if (!section) return undefined
    const clear = (event: KeyboardEvent) => {
      if (event.key === 'Escape') store.set(null)
    }
    window.addEventListener('keydown', clear)
    return () => window.removeEventListener('keydown', clear)
  }, [section, store])

  // Nothing is sized until the part has been measured; see `useContentBox`.
  if (box.isEmpty()) return null

  return (
    <group userData={FURNITURE}>
      {section ? (
        <CutSheet box={box} section={section} theme={resolved} />
      ) : (
        <Picker box={box} theme={resolved} />
      )}
    </group>
  )
}

/** A unit square as a closed line, scaled to whatever needs outlining. */
const useSquare = () => {
  const square = useMemo(
    () =>
      new BufferGeometry().setFromPoints([
        new Vector3(-1, 1, 0),
        new Vector3(1, 1, 0),
        new Vector3(1, -1, 0),
        new Vector3(-1, -1, 0),
      ]),
    [],
  )
  useEffect(() => () => square.dispose(), [square])
  return square
}

interface PickerProps {
  box: Box3
  theme: ViewerTheme
}

/**
 * Where a cut could go: a preview on the face under the pointer, and the three
 * global planes.
 *
 * The preview is moved from a `pointermove` listener on the canvas and never
 * through React state — a pointer crossing a face is not a render — and the
 * ray is this component's own rather than the part's, because the part does
 * not know this is mounted and has no reason to report hovers to it.
 */
const Picker = ({ box, theme }: PickerProps) => {
  const store = useSectionStore()
  const camera = useThree((state) => state.camera)
  const scene = useThree((state) => state.scene)
  const domElement = useThree((state) => state.gl.domElement)
  const invalidate = useThree((state) => state.invalidate)
  const isTap = useTapGuard()
  const square = useSquare()

  const previewRef = useRef<Group>(null)
  const hover = useRef<SurfaceHit | null>(null)
  const [hoveredPlane, setHoveredPlane] = useState<AxesPlane['axis'] | null>(null)

  const span = useMemo(() => box.getSize(new Vector3()).length(), [box])
  const centre = useMemo(() => box.getCenter(new Vector3()), [box])
  const previewSize = span * PREVIEW_SCALE

  // For as long as a cut is being offered, the next click on the part is this
  // component's: a measure tool up beside it waits. See `render/section-store.ts`.
  useEffect(() => {
    store.setPicking(true)
    return () => store.setPicking(false)
  }, [store])

  useEffect(() => {
    const raycaster = new Raycaster()
    const pointer = new Vector2()
    const aim = new Vector3()

    const hide = () => {
      if (!hover.current) return
      hover.current = null
      if (previewRef.current) previewRef.current.visible = false
      invalidate()
    }

    const move = (event: PointerEvent) => {
      const rect = domElement.getBoundingClientRect()
      pointer.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      )
      raycaster.setFromCamera(pointer, camera)
      const hit = surfaceUnderRay(raycaster, scene)
      const preview = previewRef.current
      if (!hit || !preview) {
        hide()
        return
      }
      hover.current = hit
      preview.position.copy(hit.point).addScaledVector(hit.normal, span * PREVIEW_LIFT)
      preview.lookAt(aim.copy(hit.point).add(hit.normal))
      preview.visible = true
      invalidate()
    }

    // The cut goes where the preview was, and a hair inside it: a plane
    // exactly on the face cuts nothing and fights the face for the pixel.
    const up = (event: PointerEvent) => {
      const hit = hover.current
      if (event.button !== 0 || !hit || !isTap(event)) return
      store.set({
        enabled: true,
        plane: sectionFromPick({ point: hit.point, normal: hit.normal }),
        depth: pickedStartDepth(box),
      })
    }

    domElement.addEventListener('pointermove', move)
    domElement.addEventListener('pointerleave', hide)
    domElement.addEventListener('pointerup', up)
    return () => {
      domElement.removeEventListener('pointermove', move)
      domElement.removeEventListener('pointerleave', hide)
      domElement.removeEventListener('pointerup', up)
    }
  }, [box, camera, domElement, invalidate, isTap, scene, span, store])

  // The global planes stand on whichever side of the part the camera is not,
  // so they move only when the camera crosses an axis — a render then, and not
  // on every frame of an orbit.
  const [planes, setPlanes] = useState(() => axesPlanes(box, camera.position))
  const key = planes.map((plane) => plane.sign).join()
  useFrame(() => {
    const next = [camera.position.x, camera.position.y, camera.position.z]
      .map((eye, axis) => (eye - [centre.x, centre.y, centre.z][axis]! < 0 ? -1 : 1))
      .join()
    if (next !== key) setPlanes(axesPlanes(box, camera.position))
  })

  const planeHandlers = (plane: AxesPlane) => ({
    // A plane is behind the part, and the part does not stop propagation: a
    // click on a face reaches the plane behind it too. The preview says which
    // one the pointer is really on.
    onPointerOver: (event: ThreeEvent<PointerEvent>) => {
      if (hover.current) return
      event.stopPropagation()
      setHoveredPlane(plane.axis)
      invalidate()
    },
    onPointerOut: () => {
      setHoveredPlane((held) => (held === plane.axis ? null : held))
      invalidate()
    },
    onClick: (event: ThreeEvent<MouseEvent>) => {
      if (hover.current || !isTap(event.nativeEvent)) return
      event.stopPropagation()
      store.set(plane.options)
    },
  })

  return (
    <>
      <group ref={previewRef} visible={false}>
        <mesh renderOrder={SECTION_RENDER_ORDER.outline} raycast={() => null}>
          <planeGeometry args={[previewSize, previewSize]} />
          <meshBasicMaterial
            color={theme.sectionOutline}
            transparent
            opacity={0.2}
            side={DoubleSide}
            depthWrite={false}
          />
        </mesh>
        <lineLoop
          geometry={square}
          scale={previewSize / 2}
          renderOrder={SECTION_RENDER_ORDER.outline}
          raycast={() => null}
        >
          <lineBasicMaterial
            color={theme.sectionOutline}
            transparent
            opacity={0.5}
            depthTest={false}
            depthWrite={false}
          />
        </lineLoop>
      </group>

      {planes.map((plane) => (
        <group
          key={plane.axis}
          position={[plane.position.x, plane.position.y, plane.position.z]}
          rotation={AXIS_ROTATIONS[plane.axis]}
        >
          <mesh renderOrder={SECTION_RENDER_ORDER.outline} {...planeHandlers(plane)}>
            <planeGeometry args={[plane.size, plane.size]} />
            <meshBasicMaterial
              color={AXIS_COLORS[plane.axis]}
              transparent
              opacity={hoveredPlane === plane.axis ? 0.45 : 0.3}
              side={DoubleSide}
              depthWrite={false}
            />
          </mesh>
          <lineLoop
            geometry={square}
            scale={plane.size / 2}
            renderOrder={SECTION_RENDER_ORDER.outline}
            raycast={() => null}
          >
            <lineBasicMaterial color={AXIS_COLORS[plane.axis]} transparent opacity={0.7} />
          </lineLoop>
        </group>
      ))}
    </>
  )
}

interface CutSheetProps {
  box: Box3
  section: SectionOptions
  theme: ViewerTheme
}

/**
 * The cutting plane, drawn: a translucent sheet larger than the part with an
 * outline that shows through it. The cap covers the sheet where the plane is
 * inside material, so what reads as the sheet is the plane's extent past the
 * part — which is what says "this is a plane" rather than "this is a face".
 */
const CutSheet = ({ box, section, theme }: CutSheetProps) => {
  const square = useSquare()
  const cut = useMemo(() => resolveSectionPlane(section, box), [box, section])
  const span = useMemo(() => box.getSize(new Vector3()).length(), [box])

  const placement = useMemo(() => {
    if (!cut) return null
    const position = sectionAnchor(box, cut.plane).addScaledVector(
      cut.plane.normal,
      -span * SHEET_SETBACK,
    )
    return { position, quaternion: new Quaternion().setFromUnitVectors(Z, cut.plane.normal) }
  }, [box, cut, span])

  if (!placement) return null

  const size = span * OUTLINE_SCALE

  return (
    <group position={placement.position} quaternion={placement.quaternion}>
      <mesh renderOrder={SECTION_RENDER_ORDER.outline} raycast={() => null}>
        <planeGeometry args={[size, size]} />
        <meshBasicMaterial
          color={theme.sectionOutline}
          transparent
          opacity={0.1}
          side={DoubleSide}
          depthWrite={false}
        />
      </mesh>
      <lineLoop
        geometry={square}
        scale={size / 2}
        renderOrder={SECTION_RENDER_ORDER.outline}
        raycast={() => null}
      >
        <lineBasicMaterial
          color={theme.sectionOutline}
          transparent
          opacity={0.5}
          depthTest={false}
          depthWrite={false}
        />
      </lineLoop>
    </group>
  )
}
