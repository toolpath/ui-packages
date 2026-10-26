import { Fragment, useMemo, type ReactNode } from 'react'
import { collectionBounds } from './model/collection.js'
import { PartMesh, type PartMeshProps } from './part-mesh.js'
import type { PartPick } from './render/picking.js'
import { CollectionBoundsContext } from './collection-context.js'

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
  return (
    <CollectionBoundsContext.Provider value={bounds}>
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
      {children}
    </CollectionBoundsContext.Provider>
  )
}
