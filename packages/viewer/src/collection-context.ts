import { createContext } from 'react'
import type { Box3 } from 'three'
import type { CollectionSections } from './render/collection-sections.js'

export const CollectionBoundsContext = createContext<Box3 | null>(null)

/** Where a collection's items hand their cut, so the collection draws it once. */
export const CollectionSectionsContext = createContext<CollectionSections | null>(null)
