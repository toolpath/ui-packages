import { createContext, useContext } from 'react'
import type { BufferGeometry } from 'three'
import type { PartModel } from './model/types.js'

/**
 * The part an overlay is drawn on: its model and the mesh `<PartMesh>` draws.
 *
 * `<EnginePart>` loads its mesh itself, so a child of it has no other way to
 * reach the geometry — and an overlay placed on the part, such as
 * `<ToolMarks>` at a feature's faces, needs the triangles it is drawn against.
 */
export interface PartContextValue {
  readonly model: PartModel
  /** In the coordinates the part is drawn in: the caller's, whatever it did to centre it. */
  readonly geometry: BufferGeometry
}

export const PartContext = createContext<PartContextValue | null>(null)

/**
 * The part this is drawn inside: a child of `<PartMesh>` or `<EnginePart>`.
 * Throws anywhere else, as `useViewerControls` does outside `<Viewer>`.
 */
export const usePartContext = (): PartContextValue => {
  const part = useContext(PartContext)
  if (!part) throw new Error('usePartContext must be used inside <PartMesh> or <EnginePart>')
  return part
}
