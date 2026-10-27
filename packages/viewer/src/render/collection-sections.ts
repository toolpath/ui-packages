import type { BufferGeometry, Plane } from 'three'
import type { ViewerTheme } from './theme.js'

/** What one item of a collection needs drawn for its cut. */
interface CollectionSection {
  geometry: BufferGeometry
  plane: Plane
  theme: ViewerTheme
  handleColor?: number
  showHandle: boolean
  onDrag?: (constant: number) => void
}

/** The items one plane cuts, drawn as a single cap with a single handle. */
interface CollectionSectionGroup {
  plane: Plane
  geometries: Array<BufferGeometry>
  /** The first item's: one cap takes one theme. */
  theme: ViewerTheme
  handleColor?: number
  showHandle: boolean
  /** Moves every item in the group that can be moved. */
  onDrag?: (constant: number) => void
}

export interface CollectionSections {
  /** Sets the cut an item draws, or removes it with `null`. */
  set(owner: object, section: CollectionSection | null): void
  subscribe(listener: () => void): () => void
  get(): ReadonlyArray<CollectionSectionGroup>
}

/**
 * Groups items by the plane that cuts them, in the order they were first set.
 *
 * The cap's stencil counts every mesh drawn into it, so one cap over several
 * bodies fills and outlines each of them; a cap per body would draw the same
 * region once for each, and only the first would carry its own outline.
 */
const groupSections = (sections: Iterable<CollectionSection>): Array<CollectionSectionGroup> => {
  const groups = new Map<
    string,
    CollectionSectionGroup & { drags: Array<(constant: number) => void> }
  >()
  for (const section of sections) {
    const { normal, constant } = section.plane
    const key = `${normal.x},${normal.y},${normal.z},${constant}`
    let group = groups.get(key)
    if (!group) {
      group = {
        plane: section.plane,
        geometries: [],
        theme: section.theme,
        handleColor: section.handleColor,
        showHandle: false,
        drags: [],
      }
      groups.set(key, group)
    }
    group.geometries.push(section.geometry)
    if (section.onDrag) {
      group.drags.push(section.onDrag)
      group.showHandle ||= section.showHandle
    }
  }
  return Array.from(groups.values(), ({ drags, ...group }) => ({
    ...group,
    onDrag: drags.length
      ? (constant: number) => {
          for (const drag of drags) {
            drag(constant)
          }
        }
      : undefined,
  }))
}

export const createCollectionSections = (): CollectionSections => {
  const sections = new Map<object, CollectionSection>()
  const listeners = new Set<() => void>()
  let groups: ReadonlyArray<CollectionSectionGroup> = []
  return {
    set(owner, section) {
      if (section) {
        sections.set(owner, section)
      } else if (!sections.delete(owner)) {
        return
      }
      groups = groupSections(sections.values())
      for (const listener of listeners) {
        listener()
      }
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    get: () => groups,
  }
}
