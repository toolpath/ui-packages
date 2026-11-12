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
 * A {@link Holder}'s cone stack already runs from the nose up, so its outline
 * (`conesToProfile`, `[z, r]` with `z` up from the nose) is that polyline with
 * its two coordinates swapped and converted.
 */

import { conesToProfile } from '../../cones.js'
import { trimToGauge } from '../../holder.js'
import type { Holder } from '../../model.js'
import { convertLength } from '../../units.js'
import { camGaugeLength, camIdentity } from '../catalog.js'
import type { ExportNote } from '../report.js'
import { derivedGuid, guidBytes, namedGuid, EMPTY_GUID } from './guid.js'
import type { RowSet } from './rows.js'

export interface HolderResult {
  /** `null` where the holder states no shape this format can draw, or no guid. */
  readonly written: { readonly guid: string } | null
  readonly notes: readonly ExportNote[]
}

/** A vertex of the Mastercam polyline: a radius and a height above the nose. */
type Vertex = readonly [radius: number, height: number]

const inches = (millimetres: number): number => convertLength(millimetres, 'millimeters', 'inches')

/**
 * Write one holder, or say why it could not be written.
 *
 * The polyline is closed onto the axis at both ends, which the reference does
 * and which is what makes the revolved solid a solid rather than a tube.
 */
export const mastercamHolder = (entry: Holder, rows: RowSet): HolderResult => {
  const notes: ExportNote[] = []
  const identity = camIdentity(entry)
  if (identity === null) {
    notes.push({
      subject: entry.name ?? '',
      kind: 'skipped',
      field: 'guid',
      message: 'the holder states no valid guid, and every Mastercam row is keyed by one',
    })
    return { written: null, notes }
  }
  const { guid } = identity
  // The holder as mounted: a measured taper above the gauge line is inside the spindle.
  const walked = conesToProfile(trimToGauge(entry).layers).map(([z, r]): Vertex => [
    inches(r),
    inches(z),
  ])

  const first = walked[0]
  const last = walked[walked.length - 1]
  if (first === undefined || last === undefined || walked.length < 2) {
    notes.push({
      subject: guid,
      kind: 'skipped',
      field: 'TlProfileData',
      message: 'the holder states no shape, so it has nothing to draw',
    })
    return { written: null, notes }
  }

  const id = guidBytes(guid)
  const vertices: Vertex[] = [[0, first[1]], ...walked, [0, last[1]]]

  const manufacturer = entry.vendor === undefined ? EMPTY_GUID : namedGuid(entry.vendor)
  rows.addOnce('TlAssemblyItem', guid, {
    ID: id,
    CatalogID: entry.productId ?? '',
    GeometryFile: '',
    IsMetric: 0,
    Location: '',
    TlToolMaterialID: EMPTY_GUID,
    TlToolTypeID: EMPTY_GUID,
    TlManufacturerID: manufacturer,
    Name: entry.name ?? entry.productId ?? guid,
    Description: entry.description ?? '',
    Quantity: 0,
    ThruCoolant: 0,
    IsCatalogItem: 0,
    GaugeLength: inches(camGaugeLength(entry)),
    GaugeDiameter: 0,
    TlGraphicsFileCollectionID: derivedGuid(guid, 'graphics'),
    ModelFileID: EMPTY_GUID,
    MachineSideConnectionID: derivedGuid(guid, 'connection'),
    WorkpieceSideConnectionMapID: derivedGuid(guid, 'connection-map'),
    MachineSideProjectionAdjustment: 0,
    IsProjectionAdjustmentEditable: 0,
  })
  const locator = derivedGuid(guid, 'locator')
  rows.addOnce('TlLocator', guid, {
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
  rows.addOnce('TlConnection', guid, {
    ID: derivedGuid(guid, 'connection'),
    Type: '',
    Size: '',
    LocatorID: locator,
    IsRound: 0,
    Thickness: 0,
    Width: 0,
    Name: '',
  })
  rows.addOnce('TlHolder', guid, {
    ID: id,
    LibraryName: '',
    HolderType: 0,
    UpperConnectionType: 0,
    UpperConnectionSize: '',
    LowerConnectionType: 0,
    LowerConnectionSize: '',
    CustomDisplayType: 0,
    TlAccessoryCollectionID: derivedGuid(guid, 'accessories'),
  })

  vertices.slice(0, -1).forEach((from, index) => {
    const to = vertices[index + 1] as Vertex
    // Keyed per segment, not per holder: a holder shipped twice writes its
    // silhouette once, and every segment of it.
    rows.addOnce('TlProfileData', `${guid}#${index}`, {
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
  return { written: { guid }, notes }
}
