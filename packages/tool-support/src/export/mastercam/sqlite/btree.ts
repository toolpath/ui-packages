/**
 * Building SQLite b-trees by bulk load.
 *
 * A general SQLite writer inserts one row at a time and splits pages as they
 * fill. Nothing here does: a library is encoded once, from rows that are all
 * known, so the trees are built **bottom up** — pack the leaves left to right,
 * then pack a level of interior pages over them, and repeat until one page is
 * left. That page is the root.
 *
 * The result is a legal but deliberately right-heavy tree: the last page of
 * each level takes whatever is left rather than being balanced against its
 * neighbour. SQLite does not require balance, only order and the page
 * invariants, and a tree that is never inserted into again has nothing to gain
 * from it.
 *
 * ## The two tree kinds are not symmetric
 *
 * In a **table** b-tree the key is the rowid, and an interior cell holds the
 * largest rowid in the subtree to its left — a copy. Every row still lives in a
 * leaf.
 *
 * In an **index** b-tree the interior cell holds an entry, and that entry lives
 * *only* there — it is not also in a leaf. So bulk loading an index has to
 * promote one entry at each page boundary and leave it out of both neighbours.
 * Duplicating it instead produces a file that reads back with extra rows and
 * passes nothing.
 */

import { encodeVarint, varintSize } from './record.js'

/** Page numbers are 1-based; page 1 carries the 100-byte file header. */
const FILE_HEADER_BYTES = 100

const LEAF_TABLE = 0x0d
const INTERIOR_TABLE = 0x05
const LEAF_INDEX = 0x0a
const INTERIOR_INDEX = 0x02

/** The size limits a page size implies, as the file format defines them. */
export interface Geometry {
  readonly pageSize: number
  readonly usable: number
  readonly tableMaxLocal: number
  readonly indexMaxLocal: number
  readonly minLocal: number
}

export const geometryFor = (pageSize: number): Geometry => {
  if (pageSize < 512 || pageSize > 65536 || (pageSize & (pageSize - 1)) !== 0) {
    throw new Error(`Page size must be a power of two between 512 and 65536, not ${pageSize}`)
  }
  // No reserved region: Mastercam writes none, and every byte of it would be
  // one this encoder has to account for in five places.
  const usable = pageSize
  return {
    pageSize,
    usable,
    tableMaxLocal: usable - 35,
    indexMaxLocal: Math.floor(((usable - 12) * 64) / 255) - 23,
    minLocal: Math.floor(((usable - 12) * 32) / 255) - 23,
  }
}

/** Somewhere to put a page, and a source of page numbers. */
export interface Sink {
  readonly pages: Map<number, Uint8Array>
  allocate(): number
}

/**
 * How much of a payload stays in the cell.
 *
 * Straight from the format: a payload that does not fit keeps `minLocal` plus
 * whatever the remainder allows, unless that overshoots `maxLocal`, in which
 * case it keeps exactly `minLocal`. The remainder term is what stops the last
 * overflow page holding a single byte.
 */
const localSize = (payload: number, maxLocal: number, geometry: Geometry): number => {
  if (payload <= maxLocal) return payload
  const proposed = geometry.minLocal + ((payload - geometry.minLocal) % (geometry.usable - 4))
  return proposed <= maxLocal ? proposed : geometry.minLocal
}

/**
 * A payload split into the part the cell carries and a chain of overflow pages.
 *
 * The chain is written as it is built and the first page's number comes back,
 * because a cell that overflows ends with that number and cannot be sized
 * without it.
 */
const placePayload = (
  payload: Uint8Array,
  maxLocal: number,
  geometry: Geometry,
  sink: Sink,
): { local: Uint8Array; overflow: number | undefined } => {
  const local = localSize(payload.length, maxLocal, geometry)
  if (local === payload.length) return { local: payload, overflow: undefined }

  const perPage = geometry.usable - 4
  const numbers: number[] = []
  for (let at = local; at < payload.length; at += perPage) numbers.push(sink.allocate())
  numbers.forEach((number, index) => {
    const page = new Uint8Array(geometry.pageSize)
    const next = numbers[index + 1] ?? 0
    new DataView(page.buffer).setUint32(0, next, false)
    const start = local + index * perPage
    page.set(payload.subarray(start, Math.min(start + perPage, payload.length)), 4)
    sink.pages.set(number, page)
  })
  return { local: payload.subarray(0, local), overflow: numbers[0] as number }
}

const concat = (parts: readonly Uint8Array[]): Uint8Array => {
  let total = 0
  for (const part of parts) total += part.length
  const out = new Uint8Array(total)
  let at = 0
  for (const part of parts) {
    out.set(part, at)
    at += part.length
  }
  return out
}

const fourBytes = (value: number): Uint8Array => {
  const bytes = new Uint8Array(4)
  new DataView(bytes.buffer).setUint32(0, value, false)
  return bytes
}

/**
 * A b-tree page from its cells.
 *
 * Cell pointers are offsets from the start of the **page**, not from the start
 * of the header, which is the one place page 1's file header matters: its
 * header sits at 100 and its pointers still count from 0.
 */
const serializePage = (
  flags: number,
  cells: readonly Uint8Array[],
  rightChild: number | undefined,
  pageNumber: number,
  geometry: Geometry,
): Uint8Array => {
  const page = new Uint8Array(geometry.pageSize)
  const view = new DataView(page.buffer)
  const base = pageNumber === 1 ? FILE_HEADER_BYTES : 0
  const headerSize = rightChild === undefined ? 8 : 12

  let content = geometry.pageSize
  const pointers: number[] = []
  for (const cell of cells) {
    content -= cell.length
    page.set(cell, content)
    pointers.push(content)
  }

  const pointerEnd = base + headerSize + cells.length * 2
  if (pointerEnd > content) {
    throw new Error(`Page ${pageNumber} was packed past its capacity`)
  }

  page[base] = flags
  view.setUint16(base + 1, 0, false)
  view.setUint16(base + 3, cells.length, false)
  // A content area starting at the very end of a 65536-byte page is recorded as
  // zero, the format's way of fitting 65536 into sixteen bits.
  view.setUint16(base + 5, content === 65536 ? 0 : content, false)
  page[base + 7] = 0
  if (rightChild !== undefined) view.setUint32(base + 8, rightChild, false)
  pointers.forEach((offset, index) => view.setUint16(base + headerSize + index * 2, offset, false))
  return page
}

/** The bytes a page has for its header, pointers and cells. */
const capacityOf = (geometry: Geometry, onPageOne: boolean): number =>
  geometry.usable - (onPageOne ? FILE_HEADER_BYTES : 0)

interface Node {
  readonly page: number
  /** The largest rowid beneath this node — a table tree's interior key. */
  readonly maxRowid: number
}

export interface TableRow {
  readonly rowid: number
  readonly payload: Uint8Array
}

export interface IndexEntry {
  readonly payload: Uint8Array
}

interface BuildOptions {
  readonly geometry: Geometry
  readonly sink: Sink
  /**
   * A page number to use for the root instead of allocating one.
   *
   * `sqlite_master` must be rooted at page 1, and page 1 is spoken for before
   * anything else is built. Every other tree lets its root fall where the
   * allocator puts it.
   */
  readonly forcedRoot?: number
  /**
   * Pack every page as though it were page 1.
   *
   * Used for `sqlite_master`, whose root *is* page 1 but whose identity is not
   * known until the level above is packed. Under-filling a page is always
   * legal, so reserving the header's hundred bytes on all of them costs a page
   * or two and removes the ordering problem entirely.
   */
  readonly reserveHeaderEverywhere?: boolean
}

/**
 * Greedy left-to-right packing.
 *
 * `cost` is what one item adds to a page — its cell plus the two bytes of the
 * pointer to it. The first item of a group is taken unconditionally, so an item
 * too large for an empty page produces a one-item group rather than a loop that
 * never advances; {@link serializePage} is what refuses it, with the page
 * number in hand.
 */
const pack = <T>(
  items: readonly T[],
  capacity: number,
  header: number,
  cost: (item: T) => number,
): T[][] => {
  const groups: T[][] = []
  let group: T[] = []
  let used = header
  for (const item of items) {
    const size = cost(item)
    if (group.length > 0 && used + size > capacity) {
      groups.push(group)
      group = []
      used = header
    }
    group.push(item)
    used += size
  }
  groups.push(group)
  return groups
}

/** The root page of a table b-tree holding `rows`, in rowid order. */
export const buildTableTree = (rows: readonly TableRow[], options: BuildOptions): number => {
  const { geometry, sink } = options
  const capacity = capacityOf(geometry, options.reserveHeaderEverywhere === true)

  const cells = rows.map((row) => {
    const { local, overflow } = placePayload(row.payload, geometry.tableMaxLocal, geometry, sink)
    return {
      rowid: row.rowid,
      bytes: concat([
        encodeVarint(row.payload.length),
        encodeVarint(row.rowid),
        local,
        ...(overflow === undefined ? [] : [fourBytes(overflow)]),
      ]),
    }
  })

  // Page numbers are handed out only once a level's shape is known, so that the
  // single page of the final level can be the forced root. An empty table still
  // gets one leaf: a root page with no cells, which is what a table nobody
  // wrote to looks like.
  const leafGroups = pack(cells, capacity, 8, (cell) => cell.bytes.length + 2)
  const roots = (count: number): number[] =>
    count === 1 && options.forcedRoot !== undefined
      ? [options.forcedRoot]
      : Array.from({ length: count }, () => sink.allocate())

  let level: Node[] = roots(leafGroups.length).map((page, index) => {
    const group = leafGroups[index] as (typeof cells)[number][]
    sink.pages.set(
      page,
      serializePage(
        LEAF_TABLE,
        group.map((cell) => cell.bytes),
        undefined,
        page,
        geometry,
      ),
    )
    return { page, maxRowid: group[group.length - 1]?.rowid ?? 0 }
  })

  while (level.length > 1) {
    // Every child but a group's last costs a cell; the last becomes the page's
    // right-most pointer and costs nothing, so charging all of them only ever
    // under-fills.
    const groups = pack(level, capacity, 12, (child) => 4 + varintSize(child.maxRowid) + 2)
    level = roots(groups.length).map((page, index) => {
      const group = groups[index] as Node[]
      const last = group[group.length - 1] as Node
      const body = group
        .slice(0, -1)
        .map((child) => concat([fourBytes(child.page), encodeVarint(child.maxRowid)]))
      sink.pages.set(page, serializePage(INTERIOR_TABLE, body, last.page, page, geometry))
      return { page, maxRowid: last.maxRowid }
    })
  }
  return (level[0] as Node).page
}

/** The root page of an index b-tree holding `entries`, in key order. */
export const buildIndexTree = (entries: readonly IndexEntry[], options: BuildOptions): number => {
  const { geometry, sink } = options
  const capacity = capacityOf(geometry, options.reserveHeaderEverywhere === true)

  // Placement happens once per entry and the result is carried, because
  // {@link placePayload} *writes* the overflow chain it describes. Calling it
  // twice for one entry — once to measure the cell and once to build it — would
  // leave a second chain that nothing points at, and an unreferenced page is an
  // error `PRAGMA integrity_check` reports rather than ignores.
  const placed = entries.map((entry) => ({
    length: entry.payload.length,
    ...placePayload(entry.payload, geometry.indexMaxLocal, geometry, sink),
  }))
  type Placed = (typeof placed)[number]

  const tail = (entry: Placed): Uint8Array[] => [
    encodeVarint(entry.length),
    entry.local,
    ...(entry.overflow === undefined ? [] : [fourBytes(entry.overflow)]),
  ]
  const leafCell = (entry: Placed): Uint8Array => concat(tail(entry))
  const interiorCell = (entry: Placed, leftChild: number): Uint8Array =>
    concat([fourBytes(leftChild), ...tail(entry)])

  const groups = pack(placed, capacity, 8, (entry) => leafCell(entry).length + 2)

  // Between two leaves sits one entry that belongs to neither: the divider. It
  // is the first entry of each group after the first, lifted out — an index
  // interior cell holds a real entry, not a copy of one below it.
  const dividers = groups.slice(1).map((group) => group[0] as Placed)
  const leafGroups = groups.map((group, index) => (index === 0 ? group : group.slice(1)))

  const roots = (count: number): number[] =>
    count === 1 && options.forcedRoot !== undefined
      ? [options.forcedRoot]
      : Array.from({ length: count }, () => sink.allocate())

  let children: number[] = roots(leafGroups.length).map((page, index) => {
    const group = leafGroups[index] as Placed[]
    sink.pages.set(page, serializePage(LEAF_INDEX, group.map(leafCell), undefined, page, geometry))
    return page
  })
  let separators = dividers

  while (children.length > 1) {
    // A parent takes children until the next divider will not fit; that divider
    // then rises a level and appears in no page at this one.
    const carried: { readonly covers: number[]; readonly cells: Uint8Array[] }[] = []
    const promoted: Placed[] = []
    let covers: number[] = []
    let cells: Uint8Array[] = []
    let used = 12
    for (let index = 0; index < children.length; index += 1) {
      const child = children[index] as number
      if (covers.length === 0) {
        covers.push(child)
        continue
      }
      const divider = separators[index - 1] as Placed
      const cell = interiorCell(divider, covers[covers.length - 1] as number)
      if (used + cell.length + 2 > capacity) {
        carried.push({ covers, cells })
        promoted.push(divider)
        covers = [child]
        cells = []
        used = 12
        continue
      }
      cells.push(cell)
      used += cell.length + 2
      covers.push(child)
    }
    carried.push({ covers, cells })

    children = roots(carried.length).map((page, index) => {
      const parent = carried[index] as (typeof carried)[number]
      const last = parent.covers[parent.covers.length - 1] as number
      sink.pages.set(page, serializePage(INTERIOR_INDEX, parent.cells, last, page, geometry))
      return page
    })
    separators = promoted
  }
  return children[0] as number
}
