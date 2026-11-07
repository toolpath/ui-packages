/**
 * A tool crib: the tool libraries a part draws its tools from.
 *
 * A library is implicit when its tools are synthesized from settings, and explicit when they are a
 * shop's catalogued tools. Only implicit libraries exist yet; entries are tagged by kind so explicit
 * ones can join the same list.
 */
export interface ToolCribEntry {
  kind: 'implicit'
  id: string
}

export type ToolCrib = Array<ToolCribEntry>

/** The implicit libraries a crib names, by id, in its order. */
export const implicitLibraryIds = (crib: ReadonlyArray<ToolCribEntry>): Array<string> =>
  crib.filter((entry) => entry.kind === 'implicit').map((entry) => entry.id)

/**
 * Whether a library meant for these material families suits a part cut from `family`. A guide, not
 * a limit: a library meant for no family in particular suits every part, and a part with no material
 * is offered them all.
 */
export const suitsMaterial = (
  materialFamilies: ReadonlyArray<string>,
  family: string | null,
): boolean => family === null || materialFamilies.length === 0 || materialFamilies.includes(family)

/** What a crib picks a library by. */
interface CribLibrary {
  id: string
  isDefault: boolean
  materialFamilies: ReadonlyArray<string>
}

/**
 * The library a crib starts on for a part cut from `family`: the first meant for that family in
 * particular, else the org's default if it suits, else the first that suits — and, when none does,
 * the default anyway, since a part has to be planned with something.
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
    suiting.find((library) => library.isDefault) ??
    suiting[0] ??
    libraries.find((library) => library.isDefault) ??
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

/** The crib with an implicit library added last — the lowest priority — unless it is already in. */
export const addLibrary = (crib: ToolCrib, id: string): ToolCrib =>
  crib.some((entry) => entry.id === id) ? crib : [...crib, { kind: 'implicit', id }]

/** The crib without a library. Its last one may go too: an empty crib is refused at upload or save. */
export const removeLibrary = (crib: ToolCrib, id: string): ToolCrib =>
  crib.filter((entry) => entry.id !== id)

/** The crib with two libraries' places swapped, every other entry left where it is. */
export const swapLibraries = (crib: ToolCrib, a: string, b: string): ToolCrib =>
  crib.map((entry) =>
    entry.id === a ? { ...entry, id: b } : entry.id === b ? { ...entry, id: a } : entry,
  )
