import {
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { ignoreRay, viewDirection, type PickModifiers } from './render/picking.js'
import { readTarget } from './render/orbit-target.js'
import { EXCLUDE_FROM_FRAME } from './render/camera.js'
import { regionEdgesGeometry } from './render/edges.js'
import { usePickGestures } from './pick-gestures.js'
import { useOptionalSectionStore } from './viewer.js'
import { PartContext } from './part-context.js'
import type { FeatureTag, PartModel } from './model/types.js'
import {
  DoubleSide,
  Vector4,
  type BufferGeometry,
  type Group,
  type LineBasicMaterial,
  type MeshLambertMaterial,
  type Object3D,
} from 'three'
import { createExplodeBatch } from './render/explode.js'
import { readExplodeAmount } from './model/explode-amount.js'
import type {
  ExplodeGroupIds,
  ExplodeInput,
  ExplodePick,
  ExplodeRegionColors,
} from './model/explode.js'
import {
  type PieceClick,
  hoveredPieces,
  paintKey,
  piecesFor,
  selectionKey,
  settleClick,
} from './model/explode-selection.js'
import { edgeOpacityScale, resolveExplodeTheme, type ExplodeTheme } from './render/explode-theme.js'
import { explodeRegionColors, explodeTint } from './render/explode-paint.js'
import { explodeFits } from './render/explode-layout.js'
import type { FeatureHighlight, RegionHighlight } from './render/paint.js'
import { DEFAULT_THEME, type ViewerTheme } from './render/theme.js'

export interface ExplodedPartProps {
  /**
   * Source report geometry. All region indices must refer to this model. Omitted inside
   * `<PartMesh>` or `<EnginePart>`, the part's own model and mesh are used.
   */
  model?: PartModel
  geometry?: BufferGeometry
  /** Controlled layout and appearance; application metadata stays outside the renderer. */
  explode: ExplodeInput
  /**
   * Application-owned group IDs; independent of feature tags and API feature IDs. Given, it
   * replaces the selection `selectedFeatures` describes.
   */
  selected?: ExplodeGroupIds
  /** Given, it replaces the piece under the pointer and `hoveredFeatures`. */
  hovered?: ExplodeGroupIds
  /**
   * The features being read, as `<PartMesh selection>` takes them: every piece standing for one
   * of them (its `featureTags`) is selected. A clicked piece takes its own features' selection
   * from their other pieces, until the selection that click produced changes; pieces of the
   * other features stay selected.
   */
  selectedFeatures?: readonly FeatureTag[]
  /**
   * Features shown as hovered from outside the viewport, such as a list row. The piece under
   * the pointer is tracked here and needs no prop.
   */
  hoveredFeatures?: readonly FeatureTag[]
  /** Whether the piece under the pointer is lit and reported. Default true; picks still work. */
  hover?: boolean
  /**
   * The application's own colors, as `<PartMesh>` takes them and painted as it paints them, so
   * a piece wears the colors its surfaces wear on the assembled part. `explode.regionColors`
   * win over them.
   */
  highlights?: readonly FeatureHighlight[]
  regionHighlights?: readonly RegionHighlight[]
  /**
   * Scopes a pick's ranked owners to one machining direction, as an index into
   * the model's `candidateDirections`, as `<PartMesh activeDirection>` does.
   */
  activeDirection?: number | null
  /**
   * Part/edge colors, emissive, edge opacity, selection/hover tints, and `picked` source
   * surfaces. Without `highlight` and `hover`, selection tints toward the viewer's selection
   * colors, or toward blue when the pieces' own colors are mostly warm.
   */
  theme?: Partial<ViewerTheme>
  /** False hides rendering, picking, and framing while retaining prepared buffers. Default true. */
  visible?: boolean
  /** Programs and buffers have been warmed for this layout. Optional; no camera change occurs. */
  onReady?: () => void
  onPick?: (pick: ExplodePick) => void
  onHover?: (pick: ExplodePick | null) => void
}

/** The ghost fades out over this first part of the explosion. */
const GHOST_FADE = 0.18

const Ghost = ({
  model,
  geometry,
  explode,
  appearance,
  visible = true,
}: {
  model: PartModel
  geometry: BufferGeometry
  explode: ExplodeInput
  appearance: ExplodeTheme
  visible?: boolean
}) => {
  const material = useRef<MeshLambertMaterial>(null)
  const outline = useRef<LineBasicMaterial>(null)
  const edges = useMemo(() => regionEdgesGeometry(geometry, model), [geometry, model])
  useEffect(() => () => edges.dispose(), [edges])
  useFrame(() => {
    if (!visible) {
      return
    }
    const fade = Math.min(1, readExplodeAmount(explode.amount) / GHOST_FADE)
    if (material.current) {
      material.current.opacity = 1 - 0.88 * fade
      material.current.depthWrite = fade === 0
    }
    if (outline.current) {
      outline.current.opacity = (0.7 - 0.46 * fade) * edgeOpacityScale(appearance)
    }
  }, -1)
  return (
    <group visible={visible} userData={{ [EXCLUDE_FROM_FRAME]: !visible }}>
      <mesh geometry={geometry} raycast={ignoreRay}>
        <meshLambertMaterial
          ref={material}
          color={appearance.ghost}
          emissive={appearance.ghostEmissive}
          transparent
          opacity={0.12}
          depthWrite={false}
          side={DoubleSide}
          forceSinglePass
        />
      </mesh>
      <lineSegments geometry={edges} raycast={ignoreRay}>
        <lineBasicMaterial
          ref={outline}
          color={appearance.ghostEdge}
          transparent
          opacity={0.24 * edgeOpacityScale(appearance)}
          depthWrite={false}
        />
      </lineSegments>
    </group>
  )
}

/** The pointer details a pick reports, read in one place. */
const pointerOf = (
  source: MouseEvent,
): { modifiers: PickModifiers } & Pick<ExplodePick, 'pointer'> => ({
  pointer: { clientX: source.clientX, clientY: source.clientY },
  modifiers: {
    alt: source.altKey,
    ctrl: source.ctrlKey,
    meta: source.metaKey,
    shift: source.shiftKey,
    secondary: source.button === 2,
  },
})

const NO_ENGAGEMENT = () => () => undefined
const NOT_ENGAGED = () => false

interface PiecesProps {
  model: PartModel
  geometry: BufferGeometry
  explode: ExplodeInput
  regionColors: ExplodeRegionColors | undefined
  selected: ExplodeGroupIds
  hovered: ExplodeGroupIds
  hover: boolean
  activeDirection: number | null
  visible: boolean
  appearance: ExplodeTheme
  onReady?: () => void
  onPick: (pick: ExplodePick) => void
  onHover: (pick: ExplodePick | null) => void
}

const Pieces = ({
  model,
  geometry,
  explode,
  regionColors,
  selected,
  hovered,
  hover,
  activeDirection,
  visible,
  appearance,
  onReady,
  onPick,
  onHover,
}: PiecesProps) => {
  const { groups, colors, amount } = explode
  const invalidate = useThree((state) => state.invalidate)
  const camera = useThree((state) => state.camera)
  const controls = useThree((state) => state.controls)
  const gl = useThree((state) => state.gl)
  const scene = useThree((state) => state.scene)
  // While a `<SectionTool>` is mounted the pointer is its, as on `<PartMesh>`.
  const store = useOptionalSectionStore()
  const engaged = useSyncExternalStore(
    store?.subscribe ?? NO_ENGAGEMENT,
    store?.isEngaged ?? NOT_ENGAGED,
    store?.isEngaged ?? NOT_ENGAGED,
  )
  const ready = useRef(onReady)
  useLayoutEffect(() => {
    ready.current = onReady
  }, [onReady])
  const root = useRef<Group>(null)
  const resources = useRef<ReturnType<typeof createExplodeBatch> | null>(null)
  // Whether this batch's shaders and buffers are warm.
  const warm = useRef(false)
  useLayoutEffect(() => {
    const parent = root.current!
    const batch = createExplodeBatch(model, geometry, groups)
    resources.current = batch
    warm.current = false
    parent.add(batch.object)
    invalidate()
    return () => {
      resources.current = null
      parent.remove(batch.object)
      batch.dispose()
    }
  }, [geometry, groups, invalidate, model])
  // A motion holds its move until these pieces are warm.
  const release = useRef<(() => void) | null>(null)
  useLayoutEffect(() => {
    const held = warm.current || typeof amount === 'number' ? null : (amount.hold?.() ?? null)
    release.current = held
    return () => {
      held?.()
      if (release.current === held) {
        release.current = null
      }
    }
  }, [amount, geometry, groups, model])
  useLayoutEffect(() => {
    resources.current?.setAppearance({
      colors,
      regionColors,
      selected,
      hovered,
      theme: appearance,
    })
    resources.current?.setAmount(readExplodeAmount(amount))
    invalidate()
  }, [
    amount,
    appearance,
    colors,
    geometry,
    groups,
    hovered,
    invalidate,
    model,
    regionColors,
    selected,
  ])
  useEffect(() => {
    const batch = resources.current!
    // Warm programs and upload buffers before the animation clock starts. Unlike
    // compileAsync's internal polling, this can be cancelled before a part/Canvas
    // is disposed (including StrictMode effect replay). Nothing is drawn onscreen.
    const scheduled = setTimeout(() => {
      const scissor = gl.getScissor(new Vector4())
      const scissorTest = gl.getScissorTest()
      const parent = root.current!
      const parentVisible = parent.visible
      const visibility = new Map<Object3D, boolean>()
      batch.object.traverse((object) => {
        visibility.set(object, object.visible)
        object.visible = true
      })
      parent.visible = true
      try {
        // A zero-area scissor writes no pixels while using the exact onscreen
        // output/tone-mapping shader variants. A render target changes those.
        gl.setScissor(0, 0, 0, 0)
        gl.setScissorTest(true)
        gl.render(scene, camera)
      } finally {
        gl.setScissor(scissor)
        gl.setScissorTest(scissorTest)
        parent.visible = parentVisible
        for (const [object, visible] of visibility) {
          object.visible = visible
        }
        // Preparation may run after the demand canvas's last frame. Always draw
        // the restored scene, even when onReady leaves application state unchanged.
        invalidate()
      }
      warm.current = true
      release.current?.()
      release.current = null
      ready.current?.()
    }, 0)
    return () => clearTimeout(scheduled)
  }, [camera, geometry, gl, groups, invalidate, model, scene])
  useFrame(() => {
    if (visible) {
      resources.current?.setAmount(readExplodeAmount(amount))
    }
  }, -1)

  // Hover is per piece and face, as on `<PartMesh>`: crossing triangles of one face is not new.
  const hovering = useRef<{ group: string; region: number } | null>(null)
  const dropHover = () => {
    if (hovering.current !== null) {
      hovering.current = null
      onHover(null)
    }
  }
  const hoverLive = visible && hover && !engaged
  const dropHoverRef = useRef(dropHover)
  dropHoverRef.current = dropHover
  useLayoutEffect(() => {
    if (!hoverLive) {
      dropHoverRef.current()
    }
  }, [hoverLive])
  // New pieces drop the hover with the old ones, so the piece under the pointer is reported
  // again on the next move, even with the same id and face.
  useLayoutEffect(() => {
    dropHoverRef.current()
  }, [groups])

  const pick = (event: ThreeEvent<MouseEvent>, doubled: boolean): ExplodePick | null =>
    resources.current?.pick(event, {
      ...pointerOf(event.nativeEvent),
      activeDirection,
      // Ranked from the orbit target, as `<PartMesh>` ranks, not from the point under the cursor.
      viewDirection: viewDirection(camera, readTarget(controls)),
      doubled,
    }) ?? null
  // A pick claims its event; a press that picks nothing passes to what is behind.
  const gestures = usePickGestures<ExplodePick>({
    visible,
    engaged,
    hover,
    claim: true,
    pick,
    onPick,
    onMove: (event) => {
      const hit = pick(event, false)
      if (!hit) {
        dropHover()
        return
      }
      event.stopPropagation()
      const at = hovering.current
      if (at?.group === hit.explodeGroupId && at.region === hit.region) {
        return
      }
      hovering.current = { group: hit.explodeGroupId, region: hit.region }
      onHover(hit)
    },
    onLeave: dropHover,
  })
  /*
   * Hidden as `<VisibilityGroup>` hides, but kept in rays: the batch is added by an effect here,
   * after a group's ray mask would have run, and the warm-up draws the pieces while hidden,
   * which a mask would stop. The gesture rules take no hover or pick while hidden instead.
   */
  return (
    <group
      ref={root}
      name="exploded-part"
      visible={visible}
      userData={{ [EXCLUDE_FROM_FRAME]: !visible }}
      {...gestures}
    />
  )
}

/**
 * `value`, with an identity that changes only when `key` does. Callers pass inline arrays, as
 * they do to `<PartMesh>`, and a fresh array with the same contents is not a change.
 */
const useByContent = <T,>(value: T, key: string): T => {
  const held = useRef<{ key: string; value: T } | null>(null)
  if (held.current === null || held.current.key !== key) {
    held.current = { key, value }
  }
  return held.current.value
}

/** GPU batching preserves each piece's pick map, source highlight, and connector. */
export const ExplodedPart = (props: ExplodedPartProps) => {
  const part = useContext(PartContext)
  const model = props.model ?? part?.model
  const geometry = props.geometry ?? part?.geometry
  if (!model || !geometry) {
    throw new Error(
      'ExplodedPart needs model and geometry, or a <PartMesh> or <EnginePart> around it',
    )
  }
  const { explode, visible = true, hover = true } = props
  const { groups, colors, amount, regionColors: ownRegionColors } = explode
  const fits = useMemo(() => explodeFits(model, groups), [model, groups])
  const highlights = useByContent(props.highlights, paintKey(props.highlights))
  const regionHighlights = useByContent(props.regionHighlights, paintKey(props.regionHighlights))
  const selection = selectionKey(props.selectedFeatures)
  const selectedFeatures = useByContent(props.selectedFeatures, selection)
  const hoveredFeatures = useByContent(props.hoveredFeatures, selectionKey(props.hoveredFeatures))
  // Paint covers the part's own color, as on `<PartMesh>`.
  const partColor = props.theme?.part ?? DEFAULT_THEME.part
  const regionColors = useMemo(
    () =>
      explodeRegionColors(
        model,
        groups,
        { highlights, regionHighlights },
        ownRegionColors,
        partColor,
      ),
    [model, groups, highlights, regionHighlights, ownRegionColors, partColor],
  )
  const tint = useMemo(
    () => explodeTint(groups, colors, regionColors),
    [groups, colors, regionColors],
  )
  const {
    part: ghost,
    partEmissive,
    edge,
    edgeOpacity,
    highlight,
    hover: hoverColor,
    picked,
  } = props.theme ?? {}
  // Inline theme objects must not repaint the batch when their colors are unchanged.
  const appearance = useMemo(
    () =>
      resolveExplodeTheme(
        { part: ghost, partEmissive, edge, edgeOpacity, highlight, hover: hoverColor, picked },
        tint,
      ),
    [ghost, partEmissive, edge, edgeOpacity, highlight, hoverColor, picked, tint],
  )
  // The piece last clicked, and the piece under the pointer.
  const [click, setClick] = useState<PieceClick | null>(null)
  const [pointed, setPointed] = useState<string | null>(null)
  useLayoutEffect(() => {
    setClick(null)
    setPointed(null)
  }, [groups, visible])
  // A click keeps the selection it produced, and lets go once the selection moves on.
  const clicked = settleClick(click, selection)?.id ?? null
  useLayoutEffect(() => {
    setClick((current) => settleClick(current, selection))
  }, [click, selection])
  // Read by a click, for the selection it lands on.
  const selectionAtClick = useRef(selection)
  selectionAtClick.current = selection
  const ownSelected = props.selected
  const ownHovered = props.hovered
  const selected = useMemo(
    () => (ownSelected !== undefined ? ownSelected : piecesFor(groups, selectedFeatures, clicked)),
    [ownSelected, groups, selectedFeatures, clicked],
  )
  const hovered = useMemo(
    () => hoveredPieces(groups, { hovered: ownHovered, hover, pointed, hoveredFeatures }),
    [ownHovered, hover, pointed, groups, hoveredFeatures],
  )
  const invalidate = useThree((state) => state.invalidate)
  useLayoutEffect(() => {
    if (typeof amount !== 'number') {
      const unsubscribe = amount.subscribe(invalidate)
      invalidate()
      return unsubscribe
    }
  }, [amount, invalidate])
  const onPickRef = useRef(props.onPick)
  onPickRef.current = props.onPick
  const onHoverRef = useRef(props.onHover)
  onHoverRef.current = props.onHover
  const handlers = useMemo(
    () => ({
      onPick: (pick: ExplodePick) => {
        if (!pick.modifiers.secondary) {
          setClick({ id: pick.explodeGroupId, before: selectionAtClick.current, after: null })
        }
        onPickRef.current?.(pick)
      },
      onHover: (pick: ExplodePick | null) => {
        setPointed(pick?.explodeGroupId ?? null)
        onHoverRef.current?.(pick)
      },
    }),
    [],
  )
  // Nothing to draw, or more than the pieces' buffers are allowed: see `explodeFits`.
  return groups.length === 0 || !fits ? null : (
    <>
      <Ghost
        model={model}
        geometry={geometry}
        explode={explode}
        appearance={appearance}
        visible={visible}
      />
      <Pieces
        model={model}
        geometry={geometry}
        explode={explode}
        regionColors={regionColors}
        selected={selected}
        hovered={hovered}
        hover={hover}
        activeDirection={props.activeDirection ?? null}
        visible={visible}
        appearance={appearance}
        onReady={props.onReady}
        onPick={handlers.onPick}
        onHover={handlers.onHover}
      />
    </>
  )
}
