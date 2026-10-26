import { createContext } from 'react'
import type { Box3 } from 'three'

export const CollectionBoundsContext = createContext<Box3 | null>(null)
