import type { SectionOptions } from './section.js'

/**
 * The cut a viewer holds for itself, when nobody else is holding it.
 *
 * `<PartMesh section>` is the controlled path and is untouched by this. The
 * store exists for the other one: `<SectionTool>` mounted beside the part with
 * no wiring at all. The two are siblings and cannot see each other, so the
 * viewer keeps one of these and each reads or writes it — the tool sets the
 * cut, the part clips to it and moves it when the handle is dragged.
 *
 * It also carries whether a tool is **engaged** — mounted at all. While one
 * is, the pointer over the part belongs to it: the part reports no hovers or
 * picks, so clicking a face to cut through it does not also select it, the
 * hover paint does not sit under the tool's own preview, and a cut part is
 * read as a cut rather than picked at. Unmounting the tool hands the pointer
 * back.
 *
 * A subscription rather than React state, so a drag re-renders the two
 * subscribers and not everything under the canvas.
 */
export interface SectionStore {
  get(): SectionOptions | null
  set(next: SectionOptions | null): void
  /** Whether a section tool is mounted, and the part should stay out of the way. */
  isEngaged(): boolean
  setEngaged(engaged: boolean): void
  /** Notified on every change to either the cut or the engaged flag. */
  subscribe(listener: () => void): () => void
}

export function createSectionStore(): SectionStore {
  let current: SectionOptions | null = null
  let engaged = false
  const listeners = new Set<() => void>()
  const notify = () => {
    for (const listener of listeners) listener()
  }

  return {
    get: () => current,
    set: (next) => {
      if (next === current) return
      current = next
      notify()
    },
    isEngaged: () => engaged,
    setEngaged: (next) => {
      if (next === engaged) return
      engaged = next
      notify()
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}
