import type { DockGroup, DockTool } from './types'

/**
 * The tools with these ids, such as the pins, in their order. An id with no
 * tool is passed over, and so is an id given twice, after the first.
 */
export const toolsIn = (
  groups: ReadonlyArray<DockGroup>,
  ids: ReadonlyArray<string>,
): Array<DockTool> => {
  const byId = new Map(groups.flatMap(({ tools }) => tools.map((tool) => [tool.id, tool])))
  return [...new Set(ids)].flatMap((id) => byId.get(id) ?? [])
}

/** The pins with `id` taken off if it was pinned, or put last if it was not. */
export const togglePin = (pins: ReadonlyArray<string>, id: string): Array<string> =>
  pins.includes(id) ? pins.filter((pin) => pin !== id) : [...pins, id]
