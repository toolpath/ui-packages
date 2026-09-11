import { StrictMode, useCallback, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import {
  Axes,
  Grid,
  DirectionArrows,
  ViewCube,
  PartMesh,
  Viewer,
  buildRegionIndex,
  type PartModel,
  type PartPick,
  type Projection,
  type ViewerHandle,
} from '@toolpath/viewer'
import './style.css'

/**
 * What this run asks of the viewer, from the query string.
 *
 * `?projection=orthographic` and `?orbitTarget=on` exist because the package
 * defaults and this example's pin disagree: the package ships orthographic and
 * this page pins perspective (the comment at `<Viewer>` says why), so without a
 * way to ask for it the browser suite could only ever test the camera the
 * package does *not* default to. Two pages, one build.
 *
 * Read once at module load. `<Viewer>` takes `projection` as a mount-time
 * decision — it keys its `<Canvas>` on it — so re-reading per render would say
 * nothing new.
 */
const params = new URLSearchParams(window.location.search)
const projection: Projection =
  params.get('projection') === 'orthographic' ? 'orthographic' : 'perspective'
const showOrbitTarget = params.get('orbitTarget') === 'on'

/**
 * A part the viewer can render, built by hand rather than fetched.
 *
 * A real one comes from `normalizePartReport(report)`. This is the same shape:
 * regions are half-open triangle ranges that tile the mesh completely,
 * `splitOrigin` groups regions derived from one original face, and features
 * name the regions they own. `buildRegionIndex` inverts that mapping and
 * rejects a table with a gap or an overlap.
 */
const cubeFaces = [
  { tag: 'right-face', direction: { x: 1, y: 0, z: 0 } },
  { tag: 'left-face', direction: { x: -1, y: 0, z: 0 } },
  { tag: 'top-face', direction: { x: 0, y: 1, z: 0 } },
  { tag: 'bottom-face', direction: { x: 0, y: -1, z: 0 } },
  { tag: 'front-face', direction: { x: 0, y: 0, z: 1 } },
  { tag: 'back-face', direction: { x: 0, y: 0, z: -1 } },
]

const regions = cubeFaces.map((_face, idx) => ({
  idx,
  // This example has no analysis splits, so every region is its own origin.
  splitOrigin: idx,
  shapeKind: 'Plane',
  area: 25.4 * 25.4,
  triangles: { start: idx * 2, end: idx * 2 + 2 },
}))

const features = cubeFaces.map((face, idx) => ({
  tag: face.tag,
  featureType: 'face',
  machiningDirection: face.direction,
  axis: face.direction,
  regionIdxs: [idx],
}))

const cube: PartModel = {
  partId: 'one-inch-cube',
  kernelVersion: '0.3.0',
  features,
  regions,
  candidateDirections: cubeFaces.map((face) => face.direction),
  mesh: { pointCount: 36, triangleCount: 12, glbUrl: null, stlUrl: null, thumbnailUrl: null },
  regionIndex: buildRegionIndex({ regions, features, triangleCount: 12 }),
  warnings: [],
}

/** Where the camera is, as numbers rather than as pixels. */
interface CameraState {
  /** The orthographic frustum scale. Fixed at 1 under a perspective camera. */
  zoom: number
  /** Camera to orbit target, in millimetres. */
  distance: number
  /** The orbit target — the point the view turns and zooms about. */
  target: readonly [number, number, number]
}

const AT_START: CameraState = { zoom: 1, distance: 0, target: [0, 0, 0] }

const sameCamera = (a: CameraState, b: CameraState) =>
  a.zoom === b.zoom &&
  a.distance === b.distance &&
  a.target[0] === b.target[0] &&
  a.target[1] === b.target[1] &&
  a.target[2] === b.target[2]

/**
 * The camera's own numbers, put on the page.
 *
 * Not something a real app needs, and it is here for one reason: a canvas
 * offers pixels, and the wheel-clamp behaviour this example is asked to prove
 * is not "something moved" but "it moved the wrong way". A screenshot cannot
 * tell a zoom that went 12x -> 13x from one that snapped back to 10x; a number
 * can, and it names the failure when it happens instead of leaving a diff.
 *
 * Consumer-side, using nothing the package does not already hand out: the
 * camera and the controls both come out of R3F's own store, and the target is
 * read through a capability check because that slot is typed as three's
 * `EventDispatcher` while `camera-controls` has a shape of its own.
 */
const CameraReadout = ({ onChange }: { onChange: (state: CameraState) => void }) => {
  const camera = useThree((state) => state.camera)
  const controls = useThree((state) => state.controls) as {
    getTarget?: (into: THREE.Vector3) => THREE.Vector3
  } | null
  const target = useMemo(() => new THREE.Vector3(), [])

  useFrame(() => {
    if (typeof controls?.getTarget !== 'function') return
    controls.getTarget(target)
    onChange({
      zoom: camera.zoom,
      distance: camera.position.distanceTo(target),
      target: [target.x, target.y, target.z],
    })
  })

  return null
}

/**
 * A 2 mm box on the `front-face` (+Z), standing in for one small feature.
 *
 * Small on purpose. `frameBox` widens the wheel's band to take in whatever it
 * framed, and the widening only shows above the plain 10x cap — so a detail
 * that fits inside the cap would frame correctly whether the widening survived
 * a resize or not, and prove nothing. A 2 mm box in a 25.4 mm cube asks for
 * about 13x.
 */
const DETAIL = new THREE.Box3(new THREE.Vector3(-1, -1, 11.7), new THREE.Vector3(1, 1, 13.7))

const App = () => {
  // Non-indexed on purpose. Highlighting is a per-vertex region attribute, and
  // a vertex shared between two regions has no single value to carry — which is
  // why the Engine mesh loader de-indexes too.
  const geometry = useMemo(() => new THREE.BoxGeometry(25.4, 25.4, 25.4).toNonIndexed(), [])
  const viewerRef = useRef<ViewerHandle>(null)
  const [hovered, setHovered] = useState<string[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [cut, setCut] = useState(0.45)
  const [sectioning, setSectioning] = useState(false)
  const [direction, setDirection] = useState<number | null>(null)
  const [pose, setPose] = useState<CameraState>(AT_START)

  // Called from a frame, so it runs whether or not anything changed. Holding
  // the previous object when the numbers match keeps a still camera from
  // re-rendering the page under itself.
  const onCamera = useCallback(
    (next: CameraState) => setPose((held) => (sameCamera(held, next) ? held : next)),
    [],
  )

  return (
    <main>
      <section>
        <p className="eyebrow">@toolpath/viewer</p>
        <h1>One-inch cube</h1>
        <p>
          Left-drag to orbit, middle/right-drag to pan, scroll to zoom, and click a face to select
          it.
        </p>
        <p>
          <strong>Hovered:</strong> {hovered.join(', ') || 'none'}
        </p>
        <p>
          <strong>Selected:</strong> {selected.join(', ') || 'none'}
        </p>
        <p>
          <strong>Cut:</strong> {sectioning ? `${Math.round(cut * 100)}%` : 'off'}
        </p>
        <p>
          <strong>Direction:</strong> {direction === null ? 'all' : String(direction)}
        </p>
        <p>
          <strong>Projection:</strong> {projection}
        </p>
        {/*
          The attributes are what the browser suite reads; the sentence is what
          a person reads. Both come off the same frame, and the attributes carry
          the unrounded value because a clamp that bites lands exactly on its
          limit and rounding is how that stops being visible.
        */}
        <p
          data-testid="camera"
          data-zoom={pose.zoom}
          data-distance={pose.distance}
          data-target={pose.target.join(' ')}
        >
          <strong>Camera:</strong> zoom {pose.zoom.toFixed(2)}, distance {pose.distance.toFixed(1)}{' '}
          mm, target {pose.target.map((axis) => axis.toFixed(1)).join(', ')}
        </p>
      </section>
      <div className="viewer">
        <div className="viewer-toolbar" aria-label="Viewer controls">
          <button type="button" onClick={() => viewerRef.current?.fit()}>
            Fit
          </button>
          <button type="button" onClick={() => viewerRef.current?.reset()}>
            Reset
          </button>
          <button type="button" onClick={() => viewerRef.current?.setView('top')}>
            Top view
          </button>
          <button type="button" onClick={() => viewerRef.current?.frameBox(DETAIL)}>
            Frame detail
          </button>
          <button type="button" onClick={() => setSectioning((on) => !on)}>
            Section
          </button>
          {sectioning ? (
            <label>
              <span className="sr-only">Cut depth</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={cut}
                onChange={(event) => setCut(Number(event.target.value))}
              />
            </label>
          ) : null}
        </div>
        {/*
          Perspective by default here, and the pin is the point rather than the
          value.

          The package default is orthographic, so leaving this off would be the
          more honest demo. What it would also be is a camera that `tests/` is
          coupled to from another package: its click points were scanned by hand
          off the rendered canvas, and flipping the default moved every one of
          them — two of the four tests it then had went red saying "Direction:
          never left all" and "expected back-face, got bottom-face", which is
          four sentences away from "the camera moved".

          So this page is about picking, the section, panning and the view cube,
          and it states the camera those are asked under. The first test in
          `tests/viewer.spec.ts` names what each point hits, so the next camera
          change reports itself once instead of as N downstream failures.

          `?projection=orthographic` is the other page. It has its own scanned
          points, in `tests/orthographic.spec.ts`, and it is where the default
          the package actually ships is exercised — along with the two gestures
          that are on with it: the double-click re-target, and the pivot marker
          under `?orbitTarget=on`.
        */}
        <Viewer
          ref={viewerRef}
          projection={projection}
          showOrbitTarget={showOrbitTarget}
          onPointerMissed={() => setSelected([])}
        >
          <CameraReadout onChange={onCamera} />
          <PartMesh
            model={cube}
            geometry={geometry}
            selection={selected}
            section={{ enabled: sectioning, normal: { x: 0, y: 0, z: -1 }, offset: cut }}
            onSectionChange={(state) => setCut(state.offset)}
            onHover={(pick: PartPick | null) => setHovered(pick ? [...pick.owners] : [])}
            onPick={(pick: PartPick) => setSelected([...pick.ranked])}
          />
          <DirectionArrows
            directions={cube.candidateDirections}
            shownDirection={direction}
            onPickDirection={(index) => setDirection((held) => (held === index ? null : index))}
          />
          <Grid />
          <Axes size={35} />
          <ViewCube />
        </Viewer>
      </div>
    </main>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
