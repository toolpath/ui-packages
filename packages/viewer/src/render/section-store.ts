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
 * back. `<MeasureTool>` engages it too — a click that puts a measurement point
 * on a face is not a request to select the face — which is why the flag is a
 * count rather than a boolean: two tools up at once let go one at a time.
 *
 * And whether a tool is **picking** — `<SectionTool>` is up with no cut in
 * place, so the next click on the part chooses where the cut goes. That click
 * is the section tool's alone: `<MeasureTool>` beside it offers no snap and
 * places no point until the cut is chosen or the section tool is unmounted.
 * Counted for the same reason as `engaged`.
 *
 * A subscription rather than React state, so a drag re-renders the two
 * subscribers and not everything under the canvas.
 */
export interface SectionStore {
  get(): SectionOptions | null
  set(next: SectionOptions | null): void
  /** Whether a tool is mounted, and the part should stay out of the way. */
  isEngaged(): boolean
  /** Counted: a tool engages on mount and disengages on unmount, and the part waits for the last. */
  setEngaged(engaged: boolean): void
  /** Whether a section tool is waiting for a click to say where the cut goes. */
  isPicking(): boolean
  /** Counted, as `setEngaged` is: raised while a section tool offers a cut, dropped once one is placed. */
  setPicking(picking: boolean): void
  /** Notified on every change to the cut, the engaged flag, or the picking flag. */
  subscribe(listener: () => void): () => void
}

export function createSectionStore(): SectionStore {
  let current: SectionOptions | null = null
  const listeners = new Set<() => void>()
  const notify = () => {
    for (const listener of listeners) listener()
  }
  const engaged = counted(notify)
  const picking = counted(notify)

  return {
    get: () => current,
    set: (next) => {
      if (next === current) return
      current = next
      notify()
    },
    isEngaged: engaged.is,
    setEngaged: engaged.set,
    isPicking: picking.is,
    setPicking: picking.set,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

/**
 * A flag held by however many tools raised it, and notified only when it
 * changes. A release with nothing held is ignored rather than owed, so a tool
 * that lets go twice does not leave the next one raising the flag for nothing.
 */
function counted(notify: () => void): { is(): boolean; set(next: boolean): void } {
  let held = 0
  return {
    is: () => held > 0,
    set: (next) => {
      const was = held > 0
      held = Math.max(0, held + (next ? 1 : -1))
      if (held > 0 !== was) notify()
    },
  }
}
