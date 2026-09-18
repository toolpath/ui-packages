import { StrictMode, useCallback, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import {
  Axes,
  BoxStock,
  boxStockBounds,
  directionHighlights,
  directionLabel,
  directionColor,
  Grid,
  DirectionArrows,
  ViewCube,
  MeasureTool,
  PartMesh,
  SectionTool,
  Viewer,
  measurementLabel,
  type MeasureMode,
  type Measurement,
  type PartPick,
  type Projection,
  type SectionOptions,
  type SectionState,
  type ViewerHandle,
} from '@toolpath/viewer'
import { MODELS, modelFromQuery } from './models'
import { ViewerToolbar } from './viewer-toolbar'
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
 * `?model=<id>` opens one of the parts in `./models.ts` — a plate with holes,
 * a chamfered block, a pocket, a stepped boss — for the measure tool to work
 * on. The cube is the default, and the one the browser suite is written about.
 */
const startingModel = modelFromQuery(params)

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
  const [part, setPart] = useState(startingModel)
  const viewerRef = useRef<ViewerHandle>(null)
  const [hovered, setHovered] = useState<string[]>([])
  const [selected, setSelected] = useState<string[]>([])
  // The selection put down on entering section mode, to pick up again on the
  // way out. A ref rather than state: nothing renders from it.
  const heldSelection = useRef<string[]>([])
  /**
   * The cut is the viewer's own: `<PartMesh>` below is given no `section`, so
   * it follows whatever `<SectionTool>` places, the slider sets through
   * `setSection`, and the handle drags. `cut` is only what it reports back.
   */
  const [cut, setCut] = useState<SectionState | null>(null)
  const [offset, setOffset] = useState(0.45)
  const [sectioning, setSectioning] = useState(false)
  /**
   * Measuring is the same shape as sectioning: a mode the toolbar enters, with
   * the selection put down on the way in. The list is the tool's own —
   * `<MeasureTool>` below is given no `measurements` — and `measured` is only
   * what it reports back, for the readout.
   */
  const [measuring, setMeasuring] = useState(false)
  const [measureMode, setMeasureMode] = useState<MeasureMode>('distance')
  const [measured, setMeasured] = useState<readonly Measurement[]>([])
  const [direction, setDirection] = useState<number | null>(null)
  const [showStock, setShowStock] = useState(params.get('stock') === 'on')
  const [showAxes, setShowAxes] = useState(true)
  const [showGrid, setShowGrid] = useState(true)
  const [showDirections, setShowDirections] = useState(false)
  const [focus, setFocus] = useState(false)
  const [wireframe, setWireframe] = useState(false)
  const [allowance, setAllowance] = useState(3)
  const stockSize = useMemo(
    () => boxStockBounds(part.geometry, allowance).getSize(new THREE.Vector3()),
    [allowance, part.geometry],
  )
  const highlights = useMemo(
    () => (showDirections ? directionHighlights(part.model, direction) : []),
    [direction, part.model, showDirections],
  )
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
        <h1>{part.name}</h1>
        <label className="model-picker">
          <select
            value={part.id}
            onChange={(event) => {
              const next = MODELS.find((entry) => entry.id === event.target.value)
              if (!next) return
              // A new part is a new scene: the viewer is keyed on it, so it
              // remounts, frames the new part, and drops the cut and the
              // measurements with the tools that made them.
              setPart(next)
              setCut(null)
              setMeasured([])
              setSelected([])
              setHovered([])
              heldSelection.current = []
              setDirection(null)
            }}
          >
            {MODELS.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name}
              </option>
            ))}
          </select>
        </label>
        <p>{part.hint}</p>
        <p>
          <strong>Stock:</strong>{' '}
          {stockSize
            .toArray()
            .map((value) => value.toFixed(2))
            .join(' × ')}{' '}
          mm (X × Y × Z)
        </p>
        <label className="stock-allowance">
          Allowance per side (mm)
          <input
            type="number"
            min="0"
            max="100"
            step="0.5"
            value={allowance}
            onChange={(event) => {
              const value = event.target.valueAsNumber
              if (Number.isFinite(value) && value >= 0 && value <= 100) setAllowance(value)
            }}
          />
        </label>
        <p className="small-note">Demo box stock; adjust the allowance for your setup.</p>
        <button
          className="detail-button"
          type="button"
          onClick={() => viewerRef.current?.frameBox(DETAIL)}
        >
          Frame detail
        </button>
        <p>
          Left-drag to orbit, middle/right-drag to pan, scroll to zoom, and click a face to select
          it. Press <strong>Section</strong>, then click a face to cut through it or one of the
          three planes behind the part to cut along an axis; drag the arrow to move the cut, and
          press Escape to clear it. Press <strong>Measure</strong>, then click two points for a
          distance or three for an angle — the pointer snaps to corners, edges and their midpoints,
          and Shift holds the next point to an axis. Delete removes the last measurement and Escape
          drops one in progress.
        </p>
        <p>
          <strong>Hovered:</strong> {hovered.join(', ') || 'none'}
        </p>
        <p>
          <strong>Selected:</strong> {selected.join(', ') || 'none'}
        </p>
        <p>
          <strong>Cut:</strong> {describeCut(sectioning, cut)}
        </p>
        <p>
          <strong>Measured:</strong> {describeMeasurements(measuring, measured)}
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
        <ViewerToolbar
          stock={showStock}
          axes={showAxes}
          grid={showGrid}
          directions={showDirections}
          focus={focus}
          wireframe={wireframe}
          sectioning={sectioning}
          measuring={measuring}
          onFit={() => viewerRef.current?.fit()}
          onReset={() => viewerRef.current?.reset()}
          onTop={() => viewerRef.current?.setView('top')}
          onStock={() => setShowStock((on) => !on)}
          onAxes={() => setShowAxes((on) => !on)}
          onGrid={() => setShowGrid((on) => !on)}
          onDirections={() => {
            setShowDirections((on) => !on)
            setDirection(null)
            setSelected([])
            heldSelection.current = []
            setWireframe(false)
          }}
          onFocus={() => setFocus((enabled) => !enabled)}
          onWireframe={() => {
            setWireframe((on) => !on)
            setShowDirections(false)
            setDirection(null)
          }}
          onSection={() => {
            if (sectioning) {
              viewerRef.current?.setSection(null)
              setSelected(heldSelection.current)
            } else {
              if (!measuring) heldSelection.current = selected
              setSelected([])
              setMeasuring(false)
              setMeasured([])
            }
            setSectioning((on) => !on)
          }}
          onMeasure={() => {
            if (measuring) {
              setMeasured([])
              setSelected(heldSelection.current)
            } else {
              if (!sectioning) heldSelection.current = selected
              setSelected([])
              viewerRef.current?.setSection(null)
              setSectioning(false)
            }
            setMeasuring((on) => !on)
          }}
        >
          {sectioning ? (
            <div className="viewer-tool-options" role="group" aria-label="Section options">
              {cut ? (
                <>
                  <label>
                    Cut depth
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={offset}
                      onChange={(event) => {
                        const next = Number(event.target.value)
                        setOffset(next)
                        viewerRef.current?.setSection(sweepTo(cut, next))
                      }}
                    />
                  </label>
                  <button type="button" onClick={() => viewerRef.current?.setSection(null)}>
                    Clear cut
                  </button>
                </>
              ) : (
                <span className="viewer-hint">Click a face or a plane · Esc clears</span>
              )}
            </div>
          ) : null}
          {measuring ? (
            <div className="viewer-tool-options" role="group" aria-label="Measure options">
              <button
                type="button"
                aria-pressed={measureMode === 'distance'}
                onClick={() => setMeasureMode('distance')}
              >
                Distance
              </button>
              <button
                type="button"
                aria-pressed={measureMode === 'angle'}
                onClick={() => setMeasureMode('angle')}
              >
                Angle
              </button>
              <span className="viewer-hint">
                {measureMode === 'distance' ? 'Click two points' : 'Click end, vertex, end'} · Shift
                locks an axis · Del removes last · Esc drops
              </span>
            </div>
          ) : null}
          {showDirections && !sectioning && !measuring ? (
            <div
              className="viewer-tool-options direction-legend"
              role="group"
              aria-label="Machining directions"
            >
              <button
                type="button"
                aria-pressed={direction === null}
                onClick={() => setDirection(null)}
              >
                All
              </button>
              {part.model.candidateDirections.map((axis, index) => (
                <button
                  type="button"
                  key={index}
                  aria-pressed={direction === index}
                  onClick={() => setDirection((held) => (held === index ? null : index))}
                >
                  <span
                    className="direction-dot"
                    style={{
                      background: '#' + directionColor(index).toString(16).padStart(6, '0'),
                    }}
                  />
                  {directionLabel(axis)}
                </button>
              ))}
            </div>
          ) : null}
        </ViewerToolbar>
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
          key={part.id}
          ref={viewerRef}
          projection={projection}
          showOrbitTarget={showOrbitTarget}
          onPointerMissed={() => setSelected([])}
        >
          <CameraReadout onChange={onCamera} />
          <PartMesh
            model={part.model}
            geometry={part.geometry}
            selection={selected}
            focus={focus ? {} : undefined}
            display={wireframe ? 'wireframe' : 'solid'}
            regionHighlights={highlights}
            activeDirection={showDirections ? direction : null}
            onSectionChange={(state) => {
              setCut(state.enabled ? state : null)
              if (state.enabled) setOffset(state.offset)
            }}
            onHover={(pick: PartPick | null) => setHovered(pick ? [...pick.owners] : [])}
            onPick={(pick: PartPick) => setSelected([...pick.ranked])}
          />
          {showStock ? <BoxStock partGeometry={part.geometry} allowance={allowance} /> : null}
          <DirectionArrows
            visible={showDirections && !sectioning && !measuring}
            directions={part.model.candidateDirections}
            shownDirection={direction}
            onPickDirection={(index) => setDirection((held) => (held === index ? null : index))}
          />
          {sectioning ? <SectionTool /> : null}
          {measuring ? <MeasureTool mode={measureMode} onChange={setMeasured} /> : null}
          {showGrid ? <Grid /> : null}
          {showAxes ? <Axes size={35} /> : null}
          <ViewCube />
        </Viewer>
      </div>
    </main>
  )
}

/**
 * The cut the slider asks for at `t`, 0 (whole part) to 1 (gone), moved along
 * the cut that is already there rather than along an axis of the slider's own.
 *
 * A sweep keeps its normal, so a cut started from the X plane stays an X cut.
 * A cut placed on a face keeps its anchor and is moved by depth instead — the
 * state reports `depthRange` for exactly this, and its `min` is the depth at
 * which nothing is cut, so `t` maps straight onto it.
 */
function sweepTo(cut: SectionState, t: number): SectionOptions {
  if (cut.plane && cut.depthRange) {
    const { min, max } = cut.depthRange
    return { enabled: true, plane: cut.plane, depth: min + t * (max - min) }
  }
  return { enabled: true, normal: cut.normal, offset: t }
}

/**
 * The cut, in a sentence. A sweep is a fraction of the part; a cut placed on
 * a face is a depth past that face, and says which face.
 */
function describeCut(sectioning: boolean, cut: SectionState | null): string {
  if (!sectioning) return 'off'
  if (!cut) return 'none — click a face, or a plane behind the part'
  if (cut.plane) return `${cut.plane.label ?? 'Part surface'}, ${(cut.depth ?? 0).toFixed(2)} mm in`
  return `${Math.round(cut.offset * 100)}%`
}

/**
 * The measurements, in a sentence: how many there are and what the last one
 * reads, which is the one just made.
 */
function describeMeasurements(measuring: boolean, measured: readonly Measurement[]): string {
  if (!measuring) return 'off'
  const last = measured[measured.length - 1]
  if (!last) return 'none — click two points for a distance, three for an angle'
  const count = measured.length === 1 ? '1 measurement' : `${measured.length} measurements`
  return `${count}, last ${measurementLabel(last)}`
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
