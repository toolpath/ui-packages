/**
 * Where the feature panel keeps which of its sections are open, so a section
 * put away stays away from one feature to the next, and from one visit to the
 * next. The app supplies it: the package stores nothing of its own.
 *
 * Sections are named by fixed ids — `rules`, `measurements`, `milling`,
 * `reach`, `datasheet`, `raw`, `comparison`, `candidates`, and `candidates-A`,
 * `candidates-B`… while comparing faces.
 */
export interface FoldStore {
  /** Whether a section was left open; undefined for one never folded, which then opens as it starts. */
  read: (id: string) => boolean | undefined
  write: (id: string, open: boolean) => void
}

/**
 * A fold store over a `Storage` — `localStorage`, `sessionStorage` — under a
 * key prefix of the app's: `toolpath.fold.` keeps `toolpath.fold.reach` as
 * `open` or `shut`. A storage that is missing, or that refuses (a private
 * window, say), leaves the sections folding for as long as they are mounted.
 */
export const storageFolds = (
  storage: Pick<Storage, 'getItem' | 'setItem'> | null | undefined,
  prefix: string,
): FoldStore => ({
  read: (id) => {
    try {
      const stored = storage?.getItem(`${prefix}${id}`)
      return stored === 'open' ? true : stored === 'shut' ? false : undefined
    } catch {
      return undefined
    }
  },
  write: (id, open) => {
    try {
      storage?.setItem(`${prefix}${id}`, open ? 'open' : 'shut')
    } catch {
      // Not kept, then: the section folds for as long as it is mounted.
    }
  },
})
