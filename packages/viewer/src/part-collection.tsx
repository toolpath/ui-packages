import { Fragment, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react'
import type { Box3 } from 'three'
import { collectionBounds } from './model/collection.js'
import { PartMesh, type PartMeshProps } from './part-mesh.js'
import type { PartPick } from './render/picking.js'
import { CollectionBoundsContext, CollectionSectionsContext } from './collection-context.js'
import { createCollectionSections, type CollectionSections } from './render/collection-sections.js'
import { SectionView } from './section-view.js'

export interface PartCollectionItem extends Omit<PartMeshProps, 'onPick' | 'onHover'> {
  /** Caller-owned identity, distinct even when two models share a part id. */
  id: string
}

/** An item as `renderItem` receives it, with its pick and hover already reporting to the collection. */
export interface PartCollectionRenderItem
  extends PartCollectionItem,
    Pick<PartMeshProps, 'onPick' | 'onHover'> {}

export interface CollectionPick {
  id: string
  pick: PartPick
}

export interface PartCollectionProps {
  items: ReadonlyArray<PartCollectionItem>
  onPick?: (event: CollectionPick) => void
  /** An item's leave is reported before the next item's entry, including one in front of it. */
  onHover?: (id: string, pick: PartPick | null) => void
  /** Scene tools placed here share the collection's bounds. */
  children?: ReactNode
  /** Supply an application-specific part renderer while retaining the collection's shared bounds. */
  renderItem?: (item: PartCollectionRenderItem) => ReactNode
}

/** Draws an already prepared collection in one coordinate frame. Owns no selection or geometry. */
export const PartCollection = ({
  items,
  onPick,
  onHover,
  children,
  renderItem,
}: PartCollectionProps) => {
  const bounds = useMemo(() => collectionBounds(items), [items])
  const [sections] = useState(createCollectionSections)
  return (
    <CollectionBoundsContext.Provider value={bounds}>
      <CollectionSectionsContext.Provider value={sections}>
        {items.map(({ id, ...item }, index) => {
          // Bodies that lie on one another settle in list order rather than fighting over pixels.
          const props = { ...item, depthLayer: item.depthLayer ?? index }
          const events: Pick<PartMeshProps, 'onPick' | 'onHover'> = {
            onPick: onPick ? (pick) => onPick({ id, pick }) : undefined,
            onHover: onHover ? (pick) => onHover(id, pick) : undefined,
          }
          return renderItem ? (
            <Fragment key={id}>{renderItem({ id, ...props, ...events })}</Fragment>
          ) : (
            <PartMesh key={id} {...props} {...events} />
          )
        })}
        <CollectionSectionViews sections={sections} box={bounds} />
        {children}
      </CollectionSectionsContext.Provider>
    </CollectionBoundsContext.Provider>
  )
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
      box={box}
      plane={group.plane}
      theme={group.theme}
      handleColor={group.handleColor}
      showHandle={group.showHandle}
      onDrag={group.onDrag}
    />
  ))
}
