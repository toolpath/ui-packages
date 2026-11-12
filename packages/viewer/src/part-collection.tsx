import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import type { Box3, Group } from 'three'
import { collectionBounds, collectionExplodeOffsets, isSubject } from './model/collection.js'
import type { ExplodeAmount } from './model/explode-amount.js'
import { placementKey, placementMatrix } from './model/placement.js'
import type { Axis2, Vec3 } from './model/types.js'
import { PartMesh, type PartMeshProps } from './part-mesh.js'
import { EXCLUDE_FROM_FRAME } from './render/camera.js'
import type { PartDisplay } from './render/part.js'
import type { PartPick } from './render/picking.js'
import type { SectionOptions } from './render/section.js'
import type { ViewerTheme } from './render/theme.js'
import { CollectionBoundsContext, CollectionSectionsContext } from './collection-context.js'
import { createCollectionSections, type CollectionSections } from './render/collection-sections.js'
import {
  createCollectionPlacement,
  offsetsKey,
  type CollectionPlacement,
} from './render/collection-placement.js'
import { SectionView } from './section-view.js'
import { useStableList } from './stable-list.js'

export interface PartCollectionItem extends Omit<PartMeshProps, 'onPick' | 'onHover'> {
  /** Caller-owned identity, distinct even when two models share a part id. */
  id: string
  /**
   * Where the geometry is drawn: its point `p` at
   * `location + p.x·refDirection + p.y·(axis × refDirection) + p.z·axis`, in the collection's
   * frame. Omitted, it is drawn where it lies. Items may share one geometry and model at
   * different placements, each picked, painted and cut as itself.
   */
  placement?: Axis2
}

/** How the assembly's items look: see `ASSEMBLY_APPEARANCE`. */
export interface AssemblyAppearance {
  /** As `PartMeshProps.opacity`. */
  opacity: number
  /**
   * As `PartMeshProps.theme`. A theme over it, the collection's or the item's own, replaces it
   * rather than merging with it, except that `edgeOpacity` stays the default's unless given.
   */
  theme: Partial<ViewerTheme>
  /** As `PartMeshProps.display`. */
  display: PartDisplay
  /** As `PartMeshProps.depthLayer`. */
  depthLayer: number
}

/** The rearmost depth layer, which the assembly's items take so a subject on them is drawn. */
export const ASSEMBLY_DEPTH_LAYER = 63

/** How the assembly's items look by default: translucent grey, solid, under the subjects. */
export const ASSEMBLY_APPEARANCE: Readonly<AssemblyAppearance> = Object.freeze({
  opacity: 0.5,
  theme: Object.freeze({ part: 0x9ca3af, edgeOpacity: 0.6 }),
  display: 'solid',
  depthLayer: ASSEMBLY_DEPTH_LAYER,
})

/** The assembly's items as a set. */
export interface PartCollectionAssembly {
  /**
   * False hides every assembly item, kept mounted, and its children with it, as an assembly
   * item's own `visible: false` does (a subject's own leaves its children shown). The frame,
   * grid and section do not move. True by default.
   */
  visible?: boolean
  /** Over `ASSEMBLY_APPEARANCE`, and under each item's own props. */
  appearance?: Partial<AssemblyAppearance>
}

const NO_SECTION: SectionOptions = Object.freeze({ enabled: false })

/**
 * The props an item is drawn with, as the collection's `subject` and `assembly` say. A subject
 * is returned as it is. An item of the assembly round the subject takes `ASSEMBLY_APPEARANCE`,
 * then `assembly.appearance`, then its own props, inert, with no hover and, unless it passes
 * one, no section. Pure.
 */
export const collectionItemProps = (
  item: PartCollectionItem,
  { subject, assembly }: Pick<PartCollectionProps, 'subject' | 'assembly'> = {},
): PartCollectionItem => {
  if (isSubject(item.id, subject)) {
    return item
  }
  const own = assembly?.appearance
  return {
    ...item,
    opacity: item.opacity ?? own?.opacity ?? ASSEMBLY_APPEARANCE.opacity,
    theme: {
      edgeOpacity: ASSEMBLY_APPEARANCE.theme.edgeOpacity,
      ...(item.theme ?? own?.theme ?? ASSEMBLY_APPEARANCE.theme),
    },
    display: item.display ?? own?.display ?? ASSEMBLY_APPEARANCE.display,
    depthLayer: item.depthLayer ?? own?.depthLayer ?? ASSEMBLY_APPEARANCE.depthLayer,
    inert: true,
    hover: false,
    section: item.section ?? NO_SECTION,
  }
}

/** Pulls a collection's items apart from one another, each item as one whole. */
export interface PartCollectionExplode {
  /**
   * 0 assembled, 1 fully apart; clamped to that range. An `ExplodeAmount` or `ExplodeMotion` is
   * read on each frame it requests, with no React render. The items need no preparation, so
   * the collection never holds a motion.
   */
  amount: number | ExplodeAmount
  /**
   * Each item's displacement at amount 1, in world units, by item id. An item without one stays
   * where it is. Defaults to
   * `collectionExplodeOffsets(items, { subject })`.
   */
  offsets?: ReadonlyMap<string, Vec3>
}

export interface PartCollectionProps {
  items: ReadonlyArray<PartCollectionItem>
  onPick?: (id: string, pick: PartPick) => void
  /** An item's leave is reported before the next item's entry, including one in front of it. */
  onHover?: (id: string, pick: PartPick | null) => void
  /**
   * Moves each item, with everything drawn on it and its children, by its offset times the
   * amount. Picks, hover and the section cap follow the items. While given, the shared bounds
   * hold the items both assembled and fully apart, so the grid and section stay put as they
   * move.
   */
  explode?: PartCollectionExplode
  /**
   * The id of the part being worked on, drawn as the subject; every other item is the assembly
   * round it. It may be drawn outside the collection, by a `<PartMesh>` beside it, say: an id no
   * item has makes every item the assembly. Null or omitted, the whole assembly is the subject:
   * every item is picked, lit and framed. A lone item without one is the subject.
   */
  subject?: string | null
  /** Shows, hides and styles the assembly round the `subject`, as a set. */
  assembly?: PartCollectionAssembly
  /** Scene tools placed here share the collection's bounds. */
  children?: ReactNode
}

/** Draws an already prepared collection in one coordinate frame. Owns no selection or geometry. */
export const PartCollection = ({
  items,
  onPick,
  onHover,
  explode,
  subject = null,
  assembly,
  children,
}: PartCollectionProps) => {
  // Measured again only when an item, its mesh or the subject changes, not whenever the caller
  // rebuilds the list. Hidden items count, so hiding one does not move the frame, grid or section.
  const measured = useStableList(
    items,
    (held, next) =>
      held.id === next.id &&
      held.geometry === next.geometry &&
      placementKey(held.placement) === placementKey(next.placement),
  )
  const offsets = useOffsets(measured, explode, subject)
  const bounds = useMemo(
    () => collectionBounds(measured, { subject, ...(offsets ? { offsets } : {}) }),
    [measured, offsets, subject],
  )
  const [sections] = useState(createCollectionSections)
  const [placement] = useState(createCollectionPlacement)
  usePlacement(placement, offsets, explode?.amount ?? 0)
  return (
    <CollectionBoundsContext.Provider value={bounds}>
      <CollectionSectionsContext.Provider value={sections}>
        {items.map((each, index) => {
          const { id, placement: frame, ...item } = collectionItemProps(each, { subject, assembly })
          const around = !isSubject(id, subject)
          const drawn = item.visible !== false && (!around || assembly?.visible !== false)
          // Bodies that lie on one another settle in list order rather than fighting over pixels.
          const props = { ...item, depthLayer: item.depthLayer ?? index, visible: drawn }
          return (
            <PlacedItem
              key={id}
              id={id}
              frame={frame}
              placement={placement}
              // A subject's children stay shown while it is hidden, as they always have.
              visible={!around || drawn}
              framed={!around}
            >
              <PartMesh
                {...props}
                onPick={onPick ? (pick) => onPick(id, pick) : undefined}
                onHover={onHover ? (pick) => onHover(id, pick) : undefined}
              />
            </PlacedItem>
          )
        })}
        <CollectionSectionViews sections={sections} box={bounds} />
        {children}
      </CollectionSectionsContext.Provider>
    </CollectionBoundsContext.Provider>
  )
}

/**
 * The group an item is placed and moved by. Always there, so starting or ending an explosion,
 * giving or taking a placement, or hiding the assembly does not remount the item. Unframed, the
 * viewer's framing leaves it out.
 */
const PlacedItem = ({
  id,
  frame,
  placement,
  visible,
  framed,
  children,
}: {
  id: string
  frame: Axis2 | undefined
  placement: CollectionPlacement
  visible: boolean
  framed: boolean
  children: ReactNode
}) => {
  const group = useRef<Group>(null)
  const key = placementKey(frame)
  // Keyed by value, so a placement rebuilt with the same figures is not a change.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const matrix = useMemo(() => placementMatrix(frame), [key])
  useLayoutEffect(() => placement.add(id, group.current!, matrix), [id, matrix, placement])
  return (
    <group ref={group} visible={visible} userData={{ [EXCLUDE_FROM_FRAME]: !framed }}>
      {children}
    </group>
  )
}

/**
 * The offsets in use, or `null` without `explode`, with an identity that changes only when an
 * id or an offset does: a map rebuilt with the same contents is not a change.
 */
const useOffsets = (
  measured: ReadonlyArray<PartCollectionItem>,
  explode: PartCollectionExplode | undefined,
  subject: string | null,
): ReadonlyMap<string, Vec3> | null => {
  const exploding = explode !== undefined
  const own = explode?.offsets
  const offsets = useMemo(
    () => (exploding ? (own ?? collectionExplodeOffsets(measured, { subject })) : null),
    [exploding, measured, own, subject],
  )
  const key = offsets ? offsetsKey(offsets) : null
  const [held, setHeld] = useState({ key, offsets })
  if (held.key !== key) {
    setHeld({ key, offsets })
  }
  return held.key === key ? held.offsets : offsets
}

/**
 * Places the items for the amount: after each render, and on each frame for an amount that
 * moves itself, whose changes request those frames.
 */
const usePlacement = (
  placement: CollectionPlacement,
  offsets: ReadonlyMap<string, Vec3> | null,
  amount: number | ExplodeAmount,
) => {
  const invalidate = useThree((state) => state.invalidate)
  const latest = useRef({ offsets, amount })
  useLayoutEffect(() => {
    latest.current = { offsets, amount }
    if (placement.place(offsets, amount)) {
      invalidate()
    }
  })
  useLayoutEffect(() => {
    if (typeof amount !== 'number') {
      return amount.subscribe(invalidate)
    }
  }, [amount, invalidate])
  // Ahead of the section's mask pass at -1, which draws the items where they are this frame.
  useFrame(() => {
    placement.place(latest.current.offsets, latest.current.amount)
  }, -2)
}

/** One cap and handle for each plane the items are cut by — normally just one. */
const CollectionSectionViews = ({ sections, box }: { sections: CollectionSections; box: Box3 }) => {
  const groups = useSyncExternalStore(sections.subscribe, sections.get, sections.get)
  // Keyed by position: a drag moves the plane, and must not remount the view
  // and its render target with every step.
  return groups.map((group, index) => (
    <SectionView
      key={index}
      geometry={group.geometries}
      placements={group.placements}
      box={box}
      plane={group.plane}
      theme={group.theme}
      handleColor={group.handleColor}
      showHandle={group.showHandle}
      onDrag={group.onDrag}
    />
  ))
}
