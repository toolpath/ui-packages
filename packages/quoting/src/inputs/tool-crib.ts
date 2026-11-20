/**
 * A tool crib: the tool libraries a part draws its tools from.
 *
 * A library is implicit when its tools are synthesized from settings, and explicit when they are a
 * shop's catalogued tools — an uploaded Fusion library, say. Entries are tagged by kind, and every
 * explicit library comes before every implicit one (`normalizeCrib`), so a shop's own tools are
 * reached for before synthesized ones.
 */
export interface ToolCribEntry {
  kind: ToolLibraryKind
  id: string
}

export type ToolLibraryKind = 'implicit' | 'explicit'

export type ToolCrib = Array<ToolCribEntry>

/** The most libraries a crib holds: the Engine plans with at most sixteen. */
export const MAX_CRIB_LIBRARIES = 16

/** Whether a value names a kind of tool library. */
export const isToolLibraryKind = (value: unknown): value is ToolLibraryKind =>
  value === 'implicit' || value === 'explicit'

/**
 * A crib as it is kept: every explicit library first, then every implicit one, each group in the
 * order given, each entry its kind and id alone. Every path that keeps a crib goes through this, so
 * no saved order puts a synthesized library ahead of a shop's own. It never cuts a crib: one saved
 * longer than {@link MAX_CRIB_LIBRARIES} stays as long, and `addLibrary` and the server keep new
 * ones within it.
 */
export const normalizeCrib = (crib: ReadonlyArray<ToolCribEntry>): ToolCrib =>
  [
    ...crib.filter(({ kind }) => kind === 'explicit'),
    ...crib.filter(({ kind }) => kind !== 'explicit'),
  ].map(({ kind, id }) => ({ kind, id }))

const idsOf = (crib: ReadonlyArray<ToolCribEntry>, kind: ToolLibraryKind): Array<string> =>
  crib.filter((entry) => entry.kind === kind).map((entry) => entry.id)

/** The implicit libraries a crib names, by id, in its order. */
export const implicitLibraryIds = (crib: ReadonlyArray<ToolCribEntry>): Array<string> =>
  idsOf(crib, 'implicit')

/** The explicit libraries a crib names, by id, in its order. */
export const explicitLibraryIds = (crib: ReadonlyArray<ToolCribEntry>): Array<string> =>
  idsOf(crib, 'explicit')

/**
 * Whether a library meant for these material families suits a part cut from `family`. A guide, not
 * a limit: a library meant for no family in particular suits every part, and a part with no material
 * is offered them all.
 */
export const suitsMaterial = (
  materialFamilies: ReadonlyArray<string>,
  family: string | null,
): boolean => family === null || materialFamilies.length === 0 || materialFamilies.includes(family)

/**
 * Whether a library is the org's fallback, by either name: `isFallback`, or the deprecated
 * `isDefault`. Where both are given, `isFallback` wins.
 */
type FallbackFlag =
  | {
      /** The org's fallback library: planned last behind uploaded ones, started on where none suits. */
      isFallback: boolean
      /** @deprecated Use `isFallback`. */
      isDefault?: boolean
    }
  | {
      isFallback?: boolean
      /** @deprecated Use `isFallback`. */
      isDefault: boolean
    }

/** What a crib picks a library by: its id, the families it is meant for, and whether it is the fallback. */
type CribLibrary = {
  id: string
  materialFamilies: ReadonlyArray<string>
} & FallbackFlag

/** Whether a library is the org's fallback: `isFallback`, else the deprecated `isDefault`. */
const isFallbackLibrary = (library: FallbackFlag): boolean =>
  library.isFallback ?? library.isDefault ?? false

/**
 * The library a crib starts on for a part cut from `family`: the first meant for that family in
 * particular, else the org's fallback if it suits, else the first that suits — and, when none does,
 * the fallback anyway, since a part has to be planned with something.
 */
export const startingLibrary = <Library extends CribLibrary>(
  libraries: ReadonlyArray<Library>,
  family: string | null,
): Library | undefined => {
  const suiting = libraries.filter((library) => suitsMaterial(library.materialFamilies, family))
  return (
    (family === null
      ? undefined
      : suiting.find((library) => library.materialFamilies.includes(family))) ??
    suiting.find(isFallbackLibrary) ??
    suiting[0] ??
    libraries.find(isFallbackLibrary) ??
    libraries[0]
  )
}

/**
 * The libraries a crib offers to add for a part cut from `family`: every one not already in it, those
 * that suit the material first. One meant for another material is still offered — the picker says
 * whom it is meant for, and a shop may know better.
 */
export const offeredLibraries = <Library extends CribLibrary>(
  libraries: ReadonlyArray<Library>,
  inCrib: ReadonlyArray<string>,
  family: string | null,
): Array<Library> => {
  const left = libraries.filter((library) => !inCrib.includes(library.id))
  const suits = (library: Library) => suitsMaterial(library.materialFamilies, family)
  return [...left.filter(suits), ...left.filter((library) => !suits(library))]
}

/** A crib of one implicit library. */
export const cribOf = (library: CribLibrary): ToolCrib => [{ kind: 'implicit', id: library.id }]

/**
 * Whether a crib looks as the dialog would have started it for a part cut from `family`: empty, or
 * just the library that material starts on. Only a saved part is judged this way, since nothing
 * records whether its crib was picked by hand; a crib edited in the open dialog is known to be.
 */
export const cribUntouched = (
  crib: ReadonlyArray<ToolCribEntry>,
  libraries: ReadonlyArray<CribLibrary>,
  family: string | null,
): boolean => {
  const start = startingLibrary(libraries, family)
  return crib.length === 0 || (start !== undefined && crib.length === 1 && crib[0]?.id === start.id)
}

/**
 * The crib with a library added last of its kind — the lowest priority among them — unless it is
 * already in or the crib is full: an explicit one after the other explicit ones, still ahead of every
 * implicit one.
 */
export const addLibrary = (
  crib: ToolCrib,
  id: string,
  kind: ToolLibraryKind = 'implicit',
): ToolCrib =>
  crib.some((entry) => entry.id === id) || crib.length >= MAX_CRIB_LIBRARIES
    ? crib
    : normalizeCrib([...crib, { kind, id }])

/** The crib without a library. Its last one may go too: an empty crib is refused at upload or save. */
export const removeLibrary = (crib: ToolCrib, id: string): ToolCrib =>
  crib.filter((entry) => entry.id !== id)

/**
 * The crib with two libraries' places swapped, every other entry left where it is. Libraries of
 * different kinds keep their places: no swap puts an implicit library above an explicit one.
 */
export const swapLibraries = (crib: ToolCrib, a: string, b: string): ToolCrib => {
  const first = crib.find((entry) => entry.id === a)
  const second = crib.find((entry) => entry.id === b)
  if (!first || !second || first.kind !== second.kind) {
    return crib
  }
  return crib.map((entry) => (entry === first ? second : entry === second ? first : entry))
}

/** Whether a crib names an explicit library: one of a shop's uploaded libraries. */
const hasExplicit = (crib: ReadonlyArray<ToolCribEntry>): boolean =>
  crib.some(({ kind }) => kind === 'explicit')

/**
 * Whether a family no library in the crib supplies is filled in at the kernel's defaults, in its
 * first library: only in a crib of implicit libraries alone. A crib with explicit libraries falls
 * back on the org's fallback library instead (`plansDefaultLast`) and gets no default families.
 */
export const fillsDefaultFamilies = (crib: ReadonlyArray<ToolCribEntry>): boolean =>
  !hasExplicit(crib)

/**
 * Whether the org's fallback implicit library (`defaultId`) is planned last behind a crib's
 * libraries, for what the shop's own tools cannot do: only behind a crib with explicit libraries
 * that does not name the fallback already and has room for it within {@link MAX_CRIB_LIBRARIES}.
 * `crib` is the crib as it is planned: the entries whose libraries were found, in their order.
 */
export const plansDefaultLast = (
  crib: ReadonlyArray<ToolCribEntry>,
  defaultId: string | null | undefined,
): boolean =>
  defaultId !== null &&
  defaultId !== undefined &&
  hasExplicit(crib) &&
  crib.length < MAX_CRIB_LIBRARIES &&
  !crib.some(({ kind, id }) => kind === 'implicit' && id === defaultId)

/**
 * A changed crib's entries as they are kept, in their order: those whose library is live — one the
 * org has and has not deleted (`isLive`). An entry whose library is not, but which the crib as saved
 * (`saved`) names, is dropped without a word: its library was deleted since it was chosen. Any other
 * is unknown, and the crib is refused (`refused`). A picker editing a crib passes the crib itself as
 * `saved`, so it starts each edit from what would be kept.
 */
export const keptEntries = <Entry extends ToolCribEntry>(
  entries: ReadonlyArray<Entry>,
  isLive: (entry: Entry) => boolean,
  saved: ReadonlyArray<ToolCribEntry>,
): { kept: Array<Entry>; refused: boolean } => ({
  kept: entries.filter(isLive),
  refused: entries.some(
    (entry) =>
      !isLive(entry) && !saved.some(({ kind, id }) => kind === entry.kind && id === entry.id),
  ),
})
