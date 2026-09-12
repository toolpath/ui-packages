/**
 * A Mastercam tool library, as the bytes of a `.TOOLDB` file.
 *
 * The document is a SQLite database carrying Mastercam's own 79-table schema —
 * `schema.generated.ts` holds it, pinned from a real library by
 * `pnpm mastercam:adopt`. This module fills it: the reference rows Mastercam
 * ships, then a tool's eight rows and a holder's three, then the assemblies
 * that put one in the other.
 *
 * ## Why an assembly is two rows and a number
 *
 * `TlAssemblyComponent` is a flat parent/child list, not a transform tree. The
 * holder is the root, with `ParentID` all zeroes; the tool hangs off it. What
 * sets the stickout is the **root's** `CScalar`, which holds how much of the
 * tool is swallowed by the holder — so `CScalar = overall length − stickout`,
 * and the tool's own `CScalar` is zero.
 *
 * That reading is not inferred from the column name. Every one of the 57
 * assemblies in the reference library states its length below holder in its
 * own name, and `overall length − CScalar` reproduces all 57 exactly.
 *
 * ## Nothing here writes a file
 *
 * What comes back is a `Uint8Array` and an account of what did not travel.
 * Where the bytes go is the caller's, the same split
 * `@toolpath/tool-support/export/fusion` keeps between its document and the
 * text of it — which is half of what lets a browser, a server route and a Node
 * script share this package.
 */

import { convertLength } from '../../units.js'
import type { ExportNote, ExportResult } from '../report.js'
import { derivedGuid, guidBytes, EMPTY_GUID, isGuid } from './guid.js'
import { mastercamHolder, type CatalogHolder } from './holder.js'
import { rowSet } from './rows.js'
import {
  MASTERCAM_SCHEMA_VERSION,
  MASTERCAM_SEED,
  MASTERCAM_TABLES,
  MASTERCAM_VERSION,
} from './schema.generated.js'
import { encodeDatabase, type Row } from './sqlite/index.js'
import { mastercamTool, type MastercamToolRequest } from './tool.js'

export interface LibraryRequest {
  readonly tools?: readonly MastercamToolRequest[]
  /** Holders shipped as entries in their own right, beyond any a tool names. */
  readonly holders?: readonly CatalogHolder[]
}

/** A seed row with its guid columns turned into the bytes the format stores. */
const seedRows = (table: string): readonly Row[] =>
  (MASTERCAM_SEED[table] ?? []).map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([column, value]) => [
        column,
        typeof value === 'string' && isGuid(value) ? guidBytes(value) : value,
      ]),
    ),
  )

/**
 * A library, and everything the exporter could not carry across.
 *
 * A tool that cannot be written is left out and said so. A batch is never
 * refused for one bad record: a catalog of four thousand tools always contains
 * a handful the format cannot hold, and failing the lot for them would make
 * this useless on real data.
 */
export const mastercamLibrary = (request: LibraryRequest): ExportResult<Uint8Array> => {
  const rows = rowSet()
  const notes: ExportNote[] = []

  // Mastercam's own rows first, under the guids it ships them under. A tool
  // that names a grade or a material names one of these.
  for (const table of Object.keys(MASTERCAM_SEED)) {
    for (const row of seedRows(table)) rows.add(table, row)
  }

  // `_Header` carries the schema version and `_UpdateLog` the release that
  // wrote it; both are read when Mastercam decides whether to migrate a file.
  // The header's own id is referenced by nothing, here or in the reference.
  rows.add('_Header', {
    id: EMPTY_GUID,
    version: MASTERCAM_SCHEMA_VERSION,
    DataVersion: 0,
  })
  rows.add('_UpdateLog', {
    Update: 0,
    Date: '',
    PreviousSchemaVersion: MASTERCAM_SCHEMA_VERSION - 1,
    PreviousDataVersion: 0,
    NewSchemaVersion: MASTERCAM_SCHEMA_VERSION,
    NewDataVersion: 0,
    MCMajorVersion: MASTERCAM_VERSION[0],
    MCMinorVersion: MASTERCAM_VERSION[1],
  })

  const holdersWritten = new Set<string>()
  for (const holder of request.holders ?? []) {
    const result = mastercamHolder(holder, rows)
    notes.push(...result.notes)
    if (result.written !== null) holdersWritten.add(holder.guid)
  }

  for (const entry of request.tools ?? []) {
    const written = mastercamTool(entry, rows)
    notes.push(...written.notes)
    if (written.written === null) continue

    const holderGuid = entry.assembly?.holderGuid
    const stickout = entry.assembly?.stickout ?? null
    if (holderGuid === undefined || stickout === null) continue
    if (!holdersWritten.has(holderGuid)) {
      notes.push({
        subject: entry.tool.guid,
        kind: 'dropped',
        field: 'TlAssembly',
        message:
          `the assembly names holder ${holderGuid}, which is not in this library, so the ` +
          `tool is written on its own`,
      })
      continue
    }

    const assembly = derivedGuid(entry.tool.guid, 'assembly')
    const number = entry.tool.number ?? 0
    rows.add('TlAssembly', {
      ID: assembly,
      Name: entry.tool.label ?? entry.tool.catalogNumber ?? entry.tool.guid,
      Description: '',
      MainHolder: guidBytes(holderGuid),
      MainTool: guidBytes(entry.tool.guid),
      ToolNumber: number,
      MachineGroup: 0,
      RelationshipHierarchyXML: '',
      DiameterOffsetNum: number,
      LengthOffsetNum: number,
      MaxRamp: 0,
      IsMetric: 0,
      TlGraphicsFileCollectionID: derivedGuid(entry.tool.guid, 'assembly-graphics'),
      TlAccessoryCollectionID: derivedGuid(entry.tool.guid, 'assembly-accessories'),
      ExternalId: '',
    })
    // The root's CScalar is how much of the tool the holder swallows; the
    // stickout is what is left. Both are inches, like every other length.
    const inside = written.written.overallLength - convertLength(stickout, 'millimeters', 'inches')
    rows.add('TlAssemblyComponent', {
      TlAssemblyID: assembly,
      TlAssemblyItemID: guidBytes(holderGuid),
      ParentID: EMPTY_GUID,
      MTransformID: EMPTY_GUID,
      UTransformID: EMPTY_GUID,
      CTransformID: EMPTY_GUID,
      CScalar: inside,
    })
    rows.add('TlAssemblyComponent', {
      TlAssemblyID: assembly,
      TlAssemblyItemID: guidBytes(entry.tool.guid),
      ParentID: guidBytes(holderGuid),
      MTransformID: EMPTY_GUID,
      UTransformID: EMPTY_GUID,
      CTransformID: EMPTY_GUID,
      CScalar: 0,
    })
  }

  return {
    document: encodeDatabase({ tables: MASTERCAM_TABLES, rows: rows.tables }),
    notes,
  }
}
