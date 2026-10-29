import type { ThreeEvent } from '@react-three/fiber'
import { useThree } from '@react-three/fiber'
import {
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import { type BufferGeometry, type Group, Vector3 } from 'three'
import type { FeatureTag, PartModel } from './model/types.js'
import { PartContext, PartPaintContext } from './part-context.js'
import type { FeatureHighlight, RegionHighlight } from './render/paint.js'
import { applyHighlightLayers } from './render/paint.js'
import { focusStateKey, type FocusOptions } from './render/focus.js'
import {
  DISABLED_SECTION,
  type SectionOptions,
  type SectionState,
  sectionBounds,
  sectionCutDistance,
  sectionDepth,
  sectionOffset,
  sectionOptionsFromState,
} from './render/section.js'
import { usePickGestures } from './pick-gestures.js'
import { createPart, type PartDisplay } from './render/part.js'
import { type SharpCornerOptions, sharpCornerKey } from './render/sharp-corners.js'
import { type ThreadOptions, threadKey } from './render/threads.js'
import { regionAdjacency } from './render/adjacency.js'
import { type PartPick, buildPick, viewDirection } from './render/picking.js'
import { readTarget } from './render/orbit-target.js'
import { useSectionStore, useViewerControls } from './viewer.js'
import { SectionView, resolveSectionPlane } from './section-view.js'
import { useContentBox } from './content-box.js'
import { CollectionSectionsContext } from './collection-context.js'
import { type ViewerTheme, resolveTheme, themesEqual } from './render/theme.js'
import { EXCLUDE_FROM_FRAME, type ViewerCamera } from './render/camera.js'
import { useHiddenFromRays } from './visibility-group.js'

export interface PartMeshProps {
  /** The normalized report. `engine/normalize.ts` produces it. */
  model: PartModel
  /**
   * The part's mesh, from `loadPartMesh`, which checks the two describe the
   * same artifact. Owned by the caller: this adds a region attribute to it and
   * removes that again, but never disposes it.
   */
  geometry: BufferGeometry
  /**
   * The features being read. The consumer owns this — a feature panel is
   * authoritative for what is selected, because `region → feature` is
   * one-to-many and no scoping rule fixes that.
   */
  selection?: readonly FeatureTag[]
  /**
   * Makes selected feature regions solid and the rest of the part translucent.
   * Omit it for the normal solid view. The application still owns selection.
   */
  focus?: FocusOptions
  /**
   * Every feature a click could have meant, painted faintly in each one's own
   * direction colour, under the selection.
   */
  candidates?: readonly FeatureTag[]
  /** The consumer's own colouring, painted under everything else. */
  highlights?: readonly FeatureHighlight[]
  /** Colours on named faces, over the feature highlights. */
  regionHighlights?: readonly RegionHighlight[]
  /**
   * The faces a click just picked, painted over the reading they resolved to so
   * that holding a second face shows what it did even when the reading is
   * unchanged.
   */
  pickedRegions?: readonly number[]
  /**
   * Features to show as hovered from outside the viewport — a list row under
   * the pointer. The face under the pointer *in* the viewport is tracked here
   * and needs no prop.
   */
  hoveredFeatureIds?: readonly FeatureTag[]
  /**
   * Whether moving across the part paints and reports a hovered face. Turn it
   * off for an application-level "feature hover" control; picks still work.
   */
  hover?: boolean
  /**
   * Scopes a pick to one machining direction, as an index into the model's
   * `candidateDirections`. A face that direction cannot reach then picks to
   * nothing, which is a real answer rather than a missed click.
   */
  activeDirection?: number | null
  /**
   * The section cut. Pass `enabled: false` for none.
   *
   * Either sweep an axis — `normal` points into the half that stays and
   * `offset` runs 0 (whole) to 1 (gone) — or key the cut off one surface with
   * `plane`, which `depth` then moves in model units. `sectionFromPick` turns a
   * pick into that placement with the normal the right way round.
   *
   * **Omit it** and the part follows the cut the viewer holds for itself — the
   * one `<SectionTool>` places and `ViewerHandle.setSection` sets — and shows
   * the handle whenever there is one. Passing it takes that over: the cut is
   * then the consumer's, and the viewer's own is ignored.
   */
  section?: SectionOptions
  /**
   * The cut changed, including when the handle was dragged. Emitted only on a
   * real change, so echoing it into state is safe. A cut going away is
   * reported as `enabled: false`, once.
   */
  onSectionChange?: (state: SectionState) => void
  /**
   * Which faces touch which, once the mesh is in.
   *
   * The consumer cannot work this out: it has a region table with areas and
   * shape kinds, and the topology only exists in the geometry. Handed over
   * rather than queried, because it is computed once per mesh and the consumer
   * needs it to answer questions about faces it has not clicked yet.
   */
  onAdjacency?: (adjacency: ReadonlyMap<number, ReadonlySet<number>>) => void
  /**
   * A feature to frame. Framed when it changes, so setting it to the feature
   * already framed does nothing — a zoom is a request, not a state to hold.
   */
  focusFeature?: FeatureTag | null
  onHover?: (pick: PartPick | null) => void
  /**
   * A click on the part.
   *
   * Never `null`: a mesh's own "missed" event fires whenever *it* was not hit,
   * including when the click landed on an arrow or a section handle, so
   * emitting an empty pick from here made pressing an arrow clear the
   * selection. Clicking nothing at all is a fact about the scene, and
   * `<Viewer onPointerMissed>` is where it is reported.
   */
  onPick?: (pick: PartPick) => void
  theme?: Partial<ViewerTheme>
  showEdges?: boolean
  /**
   * Draws the sharp corners of the features the DFM rules flag — `features`,
   * those whose `featureSheet(datasheet).sharpCorners` is set — bold, and
   * faintly through the part where it hides them. The rules decide which
   * corners; the mesh only says where they are. Off when omitted or `null`.
   * Coloured by the theme's `sharpCorner`.
   */
  sharpCorners?: SharpCornerOptions | null
  /**
   * Draws threads into the bores they are cut in: each mark's pitch, as a
   * helix of light and shade over the hole's cylinders. The Engine cuts a
   * modeled internal thread out of the mesh, so without this a tapped hole is
   * a plain bore. Off when omitted or `null`. See `threadMark` in `/engine`.
   */
  threads?: ThreadOptions | null
  /** Wireframe shows region boundaries and any hovered/painted faces, with no triangle diagonals. */
  display?: PartDisplay
  /**
   * The whole part's opacity, 0–1. Below 1 it is see-through: drawn after the
   * solid parts and writing no depth, so it never hides one, with its edges
   * faded alike. It still takes the pointer. 1 by default.
   */
  opacity?: number
  /**
   * Where this part's surface lies on another part's, as the bodies of a file
   * saved one on another do, the part on the lower layer is drawn rather than
   * the two fighting over each pixel. 0 to 63, 0 by default; `PartCollection`
   * gives each item its position in `items` unless it sets one.
   */
  depthLayer?: number
  /**
   * False hides the part — its surfaces, edges, overlays and section — from drawing and
   * every raycast, so it reports no hover or pick and a part behind it takes the pointer. It
   * stays mounted, so its paint, selection and cut come back as they were, at once. A lone
   * part is left out of framing; in a `PartCollection` a hidden item still counts toward the
   * shared bounds, so the frame, grid and section do not jump. Children are not hidden with
   * it: an `<ExplodedPart>` inside stands in for the part it hides. True by default.
   */
  visible?: boolean
  /**
   * Objects drawn on the part, such as `<ToolMarks>`. They can read its model
   * and mesh with `usePartContext`.
   */
  children?: ReactNode
}

/**
 * The part, as one mesh with one material.
 *
 * Highlighting writes texels rather than swapping materials or rebuilding draw
 * groups — see `render/part.ts` — so a repaint costs one texture upload. That is
 * why the paint runs in a layout effect against a ref rather than being
 * expressed as JSX, and why moving the pointer over the part repaints with no
 * React render at all: the hovered face lives in a ref, and routing it through
 * state is what this rewrite exists to stop doing.
 */
export const PartMesh = ({
  model,
  geometry,
  selection = [],
  focus,
  candidates = [],
  highlights = [],
  regionHighlights: ownRegionHighlights = [],
  pickedRegions = [],
  hoveredFeatureIds = [],
  hover = true,
  activeDirection = null,
  section,
  onSectionChange,
  onAdjacency,
  focusFeature = null,
  onHover,
  onPick,
  theme,
  showEdges = true,
  sharpCorners = null,
  threads = null,
  display = 'solid',
  opacity = 1,
  depthLayer = 0,
  visible = true,
  children,
}: PartMeshProps) => {
  const { camera, controls, invalidate, size } = useThree()
  const context = useMemo(() => ({ model, geometry }), [model, geometry])
  // What a tool drawn inside the part paints, over the consumer's own (`PartPaintContext`).
  const [toolPaint, setToolPaint] = useState<readonly RegionHighlight[]>(NO_PAINT)
  const regionHighlights = useMemo(
    () => (toolPaint.length === 0 ? ownRegionHighlights : [...ownRegionHighlights, ...toolPaint]),
    [ownRegionHighlights, toolPaint],
  )
  const viewerControls = useViewerControls()
  const resolved = useStableTheme(theme)
  // The part is built once per mesh and re-themed in place: a colour change is
  // two material writes, not a rebuilt region attribute and state texture.
  const currentTheme = useRef(resolved)
  currentTheme.current = resolved
  const part = useMemo(() => createPart(model, geometry, currentTheme.current), [geometry, model])
  const hoverRegion = useRef<number | null>(null)
  // The sharp corner under the pointer, which takes the hover from its face.
  const hoverCorner = useRef<number | null>(null)
  // Read from effects that must clear a card after its callback changes, while
  // keeping the pointer handlers stable enough to avoid a React round-trip.
  const onHoverRef = useRef(onHover)
  onHoverRef.current = onHover
  const box = useContentBox()
  // Controlled when `section` is given, whatever its value; the viewer's own
  // cut is only consulted when the consumer has said nothing.
  const store = useSectionStore()
  const shared = useSyncExternalStore(store.subscribe, store.get, store.get)
  const controlled = section !== undefined
  const options = controlled ? section : (shared ?? undefined)
  const cut = useMemo(() => resolveSectionPlane(options, box), [box, options])
  // While a `<SectionTool>` is mounted the pointer is its, not the part's: no
  // hover, no pick. See `render/section-store.ts`.
  const engaged = useSyncExternalStore(store.subscribe, store.isEngaged, store.isEngaged)

  // Every layer the paint reads, held so a pointer move can repaint without a
  // render. Refreshed here because a render is exactly when the props are new.
  const layers = useRef({
    selection,
    candidates,
    highlights,
    regionHighlights,
    pickedRegions,
    hoveredFeatureIds,
  })
  layers.current = {
    selection,
    candidates,
    highlights,
    regionHighlights,
    pickedRegions,
    hoveredFeatureIds,
  }

  const repaint = useCallback(() => {
    const { hoveredFeatureIds: hoveredFeatures, ...rest } = layers.current
    applyHighlightLayers(
      part,
      {
        ...rest,
        hoveredFeatures,
        // On a corner the corner is what is hovered, in the hover colour; the
        // face it lies on is not painted as if the pointer meant it.
        hoverRegion: hoverCorner.current === null ? hoverRegion.current : null,
      },
      currentTheme.current,
    )
    invalidate()
  }, [invalidate, part])

  /** Puts the hover down, wherever it was, and says so. */
  const dropHover = useCallback(() => {
    hoverRegion.current = null
    hoverCorner.current = null
    part.setHoveredSharpCorner(null)
    repaint()
    onHoverRef.current?.(null)
  }, [part, repaint])

  useEffect(() => () => part.dispose(), [part])

  // Once per mesh: the topology is a property of the geometry, and a report
  // gaining a feature does not move a single triangle.
  const adjacency = useMemo(() => regionAdjacency(model, geometry), [model, geometry])
  useEffect(() => {
    onAdjacency?.(adjacency)
  }, [adjacency, onAdjacency])

  const framed = useRef<FeatureTag | null>(null)
  useEffect(() => {
    if (focusFeature === null || focusFeature === framed.current) return
    framed.current = focusFeature
    const box = part.boxForFeature(focusFeature)
    if (box) viewerControls.frameBox(box)
  }, [focusFeature, part, viewerControls])

  useLayoutEffect(() => {
    part.setTheme(resolved)
    repaint()
  }, [part, repaint, resolved])

  const focusRef = useRef(focus)
  focusRef.current = focus
  const selectionRef = useRef(selection)
  selectionRef.current = selection
  const focusKey = focusStateKey(focus, selection)
  useLayoutEffect(() => {
    part.setFocus(selectionRef.current, focusRef.current)
    invalidate()
  }, [focusKey, invalidate, part])

  useLayoutEffect(() => {
    part.setDisplay(display, showEdges)
    invalidate()
  }, [display, invalidate, part, showEdges])

  useLayoutEffect(() => {
    part.setOpacity(opacity)
    invalidate()
  }, [invalidate, opacity, part])

  useLayoutEffect(() => {
    part.setDepthLayer(depthLayer)
    invalidate()
  }, [depthLayer, invalidate, part])

  useLayoutEffect(() => {
    part.setVisible(visible)
    invalidate()
  }, [invalidate, part, visible])

  useLayoutEffect(() => {
    part.setClippingPlanes(cut ? [cut.plane] : null)
    invalidate()
  }, [cut, invalidate, part])

  // Keyed by content, like the focus above: callers pass object literals.
  const sharpCornersRef = useRef(sharpCorners)
  sharpCornersRef.current = sharpCorners
  const sharpKey = sharpCorners ? sharpCornerKey(sharpCorners) : ''
  useLayoutEffect(() => {
    part.setSharpCorners(sharpCornersRef.current)
    // The corners just changed under a hover that named one of them.
    if (hoverCorner.current !== null) dropHover()
    invalidate()
  }, [dropHover, invalidate, part, sharpKey])

  const threadsRef = useRef(threads)
  threadsRef.current = threads
  const threadsKey = threadKey(threads)
  useLayoutEffect(() => {
    part.setThreads(threadsRef.current)
    invalidate()
  }, [invalidate, part, threadsKey])

  const reportedSection = useRef<string>('')
  useLayoutEffect(() => {
    const state = cut?.state ?? null
    const key = state
      ? `${state.constant}|${state.normal.x},${state.normal.y},${state.normal.z}`
      : ''
    if (key === reportedSection.current) return
    // Going away is reported only if there was something to go away from, so
    // a part mounted without a cut says nothing rather than "still none".
    const was = reportedSection.current
    reportedSection.current = key
    if (state) onSectionChange?.(state)
    else if (was !== '') onSectionChange?.(DISABLED_SECTION)
  }, [cut, onSectionChange])

  // Keyed by content: callers pass inline arrays and object literals, so
  // identity would repaint on every unrelated render.
  const layerKey = [
    selection.join(' '),
    candidates.join(' '),
    pickedRegions.join(' '),
    hoveredFeatureIds.join(' '),
    highlights.map((entry) => `${entry.tag}:${entry.color}:${entry.weight ?? ''}`).join(' '),
    regionHighlights
      .map((entry) => `${entry.region}:${entry.color}:${entry.weight ?? ''}`)
      .join(' '),
  ].join('|')

  useLayoutEffect(() => {
    repaint()
  }, [layerKey, repaint])

  const pickFor = (
    event: ThreeEvent<PointerEvent | MouseEvent>,
    doubled = false,
  ): PartPick | null => {
    const triangleIndex = event.faceIndex
    if (triangleIndex == null) return null
    const region = model.regionIndex.regionForTriangle(triangleIndex)
    if (region === null) return null

    // The owner whose machining direction most nearly faces the viewer wins a
    // tie, so which reading a click means depends on where it was made from.
    const target = readTarget(controls)
    const normal = event.face?.normal ?? UP
    const source = event.nativeEvent

    const pick = buildPick({
      model,
      region,
      triangleIndex,
      point: [event.point.x, event.point.y, event.point.z],
      normal: [normal.x, normal.y, normal.z],
      pointer: { clientX: source.clientX, clientY: source.clientY },
      activeDirection,
      doubled,
      viewDirection: viewDirection(camera, target),
      modifiers: {
        alt: source.altKey,
        ctrl: source.ctrlKey,
        meta: source.metaKey,
        shift: source.shiftKey,
        secondary: 'button' in source && source.button === 2,
      },
    })
    const corner = part.sharpCornerAt({ point: event.point, region }, camera as ViewerCamera, size)
    return corner ? { ...pick, sharpCorner: corner } : pick
  }

  // Hover is region-level, so moving between triangles of one face is not a new
  // hover — and repainting is a texel write, so it happens here rather than
  // through a state update the consumer would have to round-trip.
  const emitHover = (next: PartPick | null) => {
    const region = next?.region ?? null
    const corner = next?.sharpCorner?.index ?? null
    if (hoverRegion.current === region && hoverCorner.current === corner) return
    hoverRegion.current = region
    hoverCorner.current = corner
    part.setHoveredSharpCorner(corner)
    repaint()
    onHover?.(next)
  }

  // A hover toggle must make the current feedback go away immediately — not
  // leave a painted face and an application card around until the pointer next
  // crosses a region boundary.
  useLayoutEffect(() => {
    if (hover || hoverRegion.current === null) return
    dropHover()
  }, [dropHover, hover])

  // A tool taking the pointer takes the hover with it, or the face under the
  // pointer at that moment would stay painted until the pointer left the part.
  // So does hiding the part.
  useLayoutEffect(() => {
    if ((!engaged && visible) || hoverRegion.current === null) return
    dropHover()
  }, [dropHover, engaged, visible])

  const dragSection = useCallback(
    (constant: number) => {
      if (!cut) return
      const anchor = options?.plane?.point
      const bounds = sectionBounds(box, cut.state.normal)
      const offset = sectionOffset(bounds, constant)
      const state: SectionState = {
        ...cut.state,
        constant,
        offset,
        depth: anchor ? sectionDepth(cut.state.normal, anchor, constant) : null,
        cutDistance: sectionCutDistance(box, cut.state.normal, constant),
      }
      // The viewer's own cut moves itself; a consumer's is theirs to move.
      if (!controlled) store.set(sectionOptionsFromState(state))
      onSectionChange?.(state)
    },
    [box, controlled, cut, onSectionChange, options, store],
  )

  const showHandle = !controlled || onSectionChange !== undefined
  const onDrag = !controlled || onSectionChange ? dragSection : undefined
  const handleColor = theme?.sectionHandle
  // In a collection the collection draws the cut once over every item: one cap
  // stenciled from all of them and one handle, rather than one stacked per body.
  const sections = useContext(CollectionSectionsContext)
  useLayoutEffect(() => {
    sections?.set(
      part,
      cut && visible
        ? { geometry, plane: cut.plane, theme: resolved, handleColor, showHandle, onDrag }
        : null,
    )
  }, [cut, geometry, handleColor, onDrag, part, resolved, sections, showHandle, visible])
  useLayoutEffect(() => () => sections?.set(part, null), [part, sections])

  // A press over the part is the part's, and still reaches what is behind it. Hidden, the part
  // takes no rays.
  const gestures = usePickGestures<PartPick>({
    visible,
    engaged,
    hover,
    claim: false,
    pick: pickFor,
    onPick: (pick) => onPick?.(pick),
    onMove: (event) => emitHover(pickFor(event)),
    onLeave: () => emitHover(null),
  })
  // In a collection the nearest body answers, and the bodies behind it do not.
  const handlers = useMemo(
    () =>
      sections
        ? {
            ...gestures,
            onPointerMove: (event: ThreeEvent<MouseEvent>) => {
              event.stopPropagation()
              gestures.onPointerMove(event)
            },
            onClick: (event: ThreeEvent<MouseEvent>) => {
              event.stopPropagation()
              gestures.onClick(event)
            },
            onPointerUp: (event: ThreeEvent<MouseEvent>) => {
              if (event.nativeEvent.button === 2) {
                event.stopPropagation()
              }
              gestures.onPointerUp(event)
            },
          }
        : gestures,
    [gestures, sections],
  )

  // Last, so what this render's effects added to the part is hidden with it.
  const shown = useRef<Group>(null)
  useHiddenFromRays(shown, !visible)

  return (
    <>
      <group
        ref={shown}
        visible={visible}
        // A collection frames its shared bounds, hidden items included.
        userData={{ [EXCLUDE_FROM_FRAME]: !visible && !sections }}
      >
        <primitive object={part.object} {...handlers} />
        {cut && !sections ? (
          <SectionView
            geometry={geometry}
            box={box}
            plane={cut.plane}
            theme={resolved}
            handleColor={handleColor}
            showHandle={showHandle}
            onDrag={onDrag}
          />
        ) : null}
      </group>
      {children ? (
        <PartContext.Provider value={context}>
          <PartPaintContext.Provider value={setToolPaint}>{children}</PartPaintContext.Provider>
        </PartContext.Provider>
      ) : null}
    </>
  )
}

const NO_PAINT: readonly RegionHighlight[] = []

const UP = new Vector3(0, 0, 1)

/**
 * The resolved theme, with an identity that changes only when a colour does.
 *
 * `theme={{ part: 0xffffff }}` is a fresh object on every render, so keying the
 * effects below on its identity would re-apply and request a frame each time.
 */
function useStableTheme(theme: Partial<ViewerTheme> | undefined): ViewerTheme {
  const held = useRef<ViewerTheme | null>(null)
  const next = resolveTheme(theme)
  if (held.current === null || !themesEqual(held.current, next)) held.current = next
  return held.current
}
