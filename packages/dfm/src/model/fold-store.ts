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

/** The two calls of a web `Storage` a fold store makes: this package has no DOM types. */
export interface FoldStorage {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
}

/** How a fold store starts before anyone has folded anything. */
export interface FoldOptions {
  /**
   * Sections that start shut until someone opens them — a tall drawing, a
   * long record — rather than open as the rest do.
   */
  shutAtFirst?: Iterable<string>
}

/**
 * A fold store over a `Storage` — `localStorage`, `sessionStorage` — under a
 * key prefix of the app's: `toolpath.fold.` keeps `toolpath.fold.reach` as
 * `open` or `shut`. A storage that is missing, or that refuses (a private
 * window, say), leaves the sections folding for as long as they are mounted.
 * Nothing stored reads as undefined, or as shut for a `shutAtFirst` section.
 */
export const storageFolds = (
  storage: FoldStorage | null | undefined,
  prefix: string,
  { shutAtFirst = [] }: FoldOptions = {},
): FoldStore => {
  const shut = new Set(shutAtFirst)
  const stored = (id: string): boolean | undefined => {
    try {
      const value = storage?.getItem(`${prefix}${id}`)
      return value === 'open' ? true : value === 'shut' ? false : undefined
    } catch {
      return undefined
    }
  }
  return {
    read: (id) => stored(id) ?? (shut.has(id) ? false : undefined),
    write: (id, open) => {
      try {
        storage?.setItem(`${prefix}${id}`, open ? 'open' : 'shut')
      } catch {
        // Not kept, then: the section folds for as long as it is mounted.
      }
    },
  }
}
