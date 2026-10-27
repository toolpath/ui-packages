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

export interface CollectionPick {
  id: string
  pick: PartPick
}

export interface PartCollectionProps {
  items: ReadonlyArray<PartCollectionItem>
  onPick?: (event: CollectionPick) => void
  onHover?: (id: string, pick: PartPick | null) => void
  /** Scene tools placed here share the collection's bounds. */
  children?: ReactNode
  /** Supply an application-specific part renderer while retaining the collection's shared bounds. */
  renderItem?: (item: PartCollectionItem) => ReactNode
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
        {items.map(({ id, ...props }) =>
          renderItem ? (
            <Fragment key={id}>{renderItem({ id, ...props })}</Fragment>
          ) : (
            <PartMesh
              key={id}
              {...props}
              onPick={onPick ? (pick) => onPick({ id, pick }) : undefined}
              onHover={onHover ? (pick) => onHover(id, pick) : undefined}
            />
          ),
        )}
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
