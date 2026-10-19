/**
 * A holder as Mastercam's three rows, and the silhouette it draws from.
 *
 * Holders are the half of a library that must carry geometry. Mastercam derives
 * a standard tool's solid from its parametric columns — 109 of the 113 tools in
 * the reference library have no profile at all — but a holder is an arbitrary
 * stepped shape with no parameters to derive it from, so all 63 of the
 * reference's holders carry one, and so must ours.
 *
 * ## The polyline Mastercam wants
 *
 * `TlProfileData` holds `(x, y)` where **x is a radius and y is the distance up
 * from the holder nose**, both in inches, as straight segments; the reference
 * tessellates every arc into chords and uses no arc segments at all. The
 * polyline starts on the axis at the nose, runs out and up the holder, and ends
 * back on the axis at the top — an open path that Mastercam revolves and closes
 * itself.
 *
 * This domain measures the other way round: `belowGageLine` gives `[z, r]` with
 * `z = 0` at the gage line and ascending *toward the cutter*, nose last. So the
 * walk is backwards and `y = far - z`, which is the same reversal the Fusion
 * exporter makes for the same reason — Fusion also stacks its holder from the
 * nose up.
 */

import { convertLength } from '../../units.js'
import { isHolderProfile, type Holder } from '../../holding.js'
import { belowGageLine, type HolderProfile } from '../../profile.js'
import type { ExportNote } from '../report.js'
import { derivedGuid, guidBytes, namedGuid, EMPTY_GUID } from './guid.js'
import type { RowSet } from './rows.js'

export interface CatalogHolder {
  readonly guid: string
  readonly holder: Holder | HolderProfile
  readonly description?: string
  readonly vendor?: string
  readonly catalogNumber?: string
  readonly label?: string
}

export interface HolderResult {
  /** `null` where the holder states no shape this format can draw. */
  readonly written: { readonly guid: string } | null
  readonly notes: readonly ExportNote[]
}

/** A vertex of the Mastercam polyline: a radius and a height above the nose. */
type Vertex = readonly [radius: number, height: number]

const inches = (millimetres: number): number => convertLength(millimetres, 'millimeters', 'inches')

/** A measured silhouette as the nose-up polyline, in inches. */
const fromProfile = (profile: HolderProfile): Vertex[] => {
  const points = belowGageLine(profile)
  const last = points[points.length - 1]
  if (last === undefined || points.length < 2) return []
  const far = last[0]

  const walked: Vertex[] = []
  for (let index = points.length - 1; index >= 0; index -= 1) {
    const point = points[index]
    if (point === undefined) continue
    walked.push([inches(point[1]), inches(far - point[0])])
  }
  return walked
}

/** A published holder as the same polyline, from its nose, body and flange. */
const fromPublished = (holder: Holder): Vertex[] => {
  const { noseDiameter, noseLength, bodyDiameter, bodyLength, flangeDiameter, projection } = holder
  if (noseDiameter === null) return []

  const walked: Vertex[] = [[inches(noseDiameter / 2), 0]]
  let height = noseLength ?? 0
  walked.push([inches(noseDiameter / 2), inches(height)])

  if (bodyDiameter !== null) {
    walked.push([inches(bodyDiameter / 2), inches(height)])
    height += bodyLength ?? 0
    walked.push([inches(bodyDiameter / 2), inches(height)])
  }
  if (flangeDiameter !== null && projection !== null && projection > height) {
    walked.push([inches(flangeDiameter / 2), inches(height)])
    walked.push([inches(flangeDiameter / 2), inches(projection)])
  }
  return walked
}

/**
 * Write one holder, or say why it could not be written.
 *
 * The polyline is closed onto the axis at both ends, which the reference does
 * and which is what makes the revolved solid a solid rather than a tube.
 */
export const mastercamHolder = (entry: CatalogHolder, rows: RowSet): HolderResult => {
  const notes: ExportNote[] = []
  const subject = entry.guid
  const measured = isHolderProfile(entry.holder)
  const walked = measured ? fromProfile(entry.holder) : fromPublished(entry.holder)

  const first = walked[0]
  const last = walked[walked.length - 1]
  if (first === undefined || last === undefined || walked.length < 2) {
    notes.push({
      subject,
      kind: 'skipped',
      field: 'TlProfileData',
      message: measured
        ? 'the measured profile has no segment above its gage line'
        : 'the vendor states no nose diameter, so the holder has no shape to draw',
    })
    return { written: null, notes }
  }

  const id = guidBytes(entry.guid)
  const vertices: Vertex[] = [[0, first[1]], ...walked, [0, last[1]]]

  const manufacturer = entry.vendor === undefined ? EMPTY_GUID : namedGuid(entry.vendor)
  rows.addOnce('TlAssemblyItem', entry.guid, {
    ID: id,
    CatalogID: entry.catalogNumber ?? '',
    GeometryFile: '',
    IsMetric: 0,
    Location: '',
    TlToolMaterialID: EMPTY_GUID,
    TlToolTypeID: EMPTY_GUID,
    TlManufacturerID: manufacturer,
    Name: entry.label ?? entry.catalogNumber ?? entry.guid,
    Description: entry.description ?? '',
    Quantity: 0,
    ThruCoolant: 0,
    IsCatalogItem: 0,
    GaugeLength: last[1],
    GaugeDiameter: 0,
    TlGraphicsFileCollectionID: derivedGuid(entry.guid, 'graphics'),
    ModelFileID: EMPTY_GUID,
    MachineSideConnectionID: derivedGuid(entry.guid, 'connection'),
    WorkpieceSideConnectionMapID: derivedGuid(entry.guid, 'connection-map'),
    MachineSideProjectionAdjustment: 0,
    IsProjectionAdjustmentEditable: 0,
  })
  const locator = derivedGuid(entry.guid, 'locator')
  rows.addOnce('TlLocator', entry.guid, {
    ID: locator,
    IsMetric: 0,
    r00: 1,
    r01: 0,
    r02: 0,
    r10: 0,
    r11: 1,
    r12: 0,
    r20: 0,
    r21: 0,
    r22: 1,
    t0: 0,
    t1: 0,
    t2: 0,
  })
  rows.addOnce('TlConnection', entry.guid, {
    ID: derivedGuid(entry.guid, 'connection'),
    Type: '',
    Size: '',
    LocatorID: locator,
    IsRound: 0,
    Thickness: 0,
    Width: 0,
    Name: '',
  })
  rows.addOnce('TlHolder', entry.guid, {
    ID: id,
    LibraryName: '',
    HolderType: 0,
    UpperConnectionType: 0,
    UpperConnectionSize: '',
    LowerConnectionType: 0,
    LowerConnectionSize: '',
    CustomDisplayType: 0,
    TlAccessoryCollectionID: derivedGuid(entry.guid, 'accessories'),
  })

  vertices.slice(0, -1).forEach((from, index) => {
    const to = vertices[index + 1] as Vertex
    // Keyed per segment, not per holder: a holder shipped twice writes its
    // silhouette once, and every segment of it.
    rows.addOnce('TlProfileData', `${entry.guid}#${index}`, {
      ItemID: id,
      Segment: index,
      // Every segment in the reference is a line; an arc is tessellated before
      // it gets here, and nothing in this tree produces an arc profile.
      Type: 2,
      Color: 1,
      x0: from[0],
      y0: from[1],
      x1: to[0],
      y1: to[1],
      radius: 0,
      StartAngle: 0,
      SweepAngle: 0,
    })
  })

  if (entry.vendor !== undefined) {
    rows.addOnce('TlManufacturer', entry.vendor, {
      ID: manufacturer,
      Name: entry.vendor,
      Description: '',
    })
  }
  return { written: { guid: entry.guid }, notes }
}
