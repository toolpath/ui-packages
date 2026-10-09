import type { FeatureSheet, FeatureSheets, FeatureUndercut } from './feature-sheet.js'
import type { ClearanceFit } from './pinch.js'
import { featureLd, featureTypeLabel, partTop, type DfmFeature } from './geometry.js'
import { MM_PER_INCH } from '@toolpath/tool-support'
import { LENGTH_PLACES, type Units } from './units.js'

/*
 * Taken from the quoting app (quoting-ui `src/plan/feature-details.ts`): the
 * same handful of questions for every feature, answered from whichever
 * datasheet fields its kind uses.
 */

/** One row of a feature's details. */
export interface Measurement {
  /** Stable, so a list can key its rows. */
  readonly key: string
  readonly label: string
  readonly value: string
  /** The same number in the other unit. Absent on a ratio or a count. */
  readonly alt?: string
  /**
   * How it was worked out from the datasheet, a line at a time: the fields it
   * reads, by their path in the raw record, and the arithmetic, in the
   * Engine's millimetres.
   */
  readonly derivation: readonly string[]
  /**
   * A machining consideration rather than a measurement of the feature's own
   * shape: the tool that cuts it, and how far it has to reach. The panel lists
   * these under their own heading, for every kind of feature.
   */
  readonly milling?: true
  /** A row that stands for a tool the viewer can draw on the part, by its kind. */
  readonly tool?: SurfaceToolKind
}

/** Which of a surface's finishing tools: a ball nose, or a bull nose with a flat between its corners. */
export type SurfaceToolKind = 'ball' | 'bull'

/** A datasheet figure as the derivations quote it: millimetres, to four places. */
const mm = (value: number): string => `${trim(value, 4)} mm`

/** A tolerance, which runs to thousandths of a millimetre and finer. */
const tol = (value: number): string => `${trim(value, 6)} mm`

/**
 * How the tolerance was taken out of a clearance, line by line, to match
 * `clearanceFit`: the widest tool at two tolerances, the line through them
 * run back to none.
 */
const clearanceDerivation = (fit: ClearanceFit, clearance: number): string[] => {
  const { bandPath, strict, loose, atStrict, atLoose } = fit
  const lines = [`⌀₁ = ${bandPath}.ignore.min = ${mm(strict)}`]
  if (
    loose === undefined ||
    atStrict === undefined ||
    atLoose === undefined ||
    atLoose <= atStrict
  ) {
    lines.push(
      `${bandPath}.deviate.min or a tolerance is missing, so the tolerance cannot be taken out:`,
      `clearance ≤ ⌀₁ = ${mm(clearance)}`,
    )
    return lines
  }
  const growth = (loose - strict) / (atLoose - atStrict)
  lines.push(
    `   at t₁ = toleranceBand.atolIgnore = ${tol(atStrict)}`,
    `⌀₂ = ${bandPath}.deviate.min = ${mm(loose)}`,
    `   at t₂ = toleranceBand.atolDeviate = ${tol(atLoose)}`,
  )
  if (growth <= 0) {
    lines.push('The tool does not grow with tolerance (a gap, not a corner): clearance = ⌀₁')
  } else {
    lines.push(
      `k = (⌀₂ − ⌀₁) / (t₂ − t₁) = ${trim(growth, 3)}`,
      `slack = k × t₁ = ${mm(growth * atStrict)}, what the tolerance adds to every tool`,
      `clearance = ⌀₁ − slack`,
    )
  }
  lines.push(`clearance = ${mm(clearance)}`)
  return lines
}

const trim = (value: number, places: number): string => String(Number(value.toFixed(places)))

/** A length in the reader's units: `0.46 in`, or `0.46"` with `inchMark`. */
const formatLength = (mm: number, units: Units, inchMark = false): string =>
  units === 'inch'
    ? `${trim(mm / MM_PER_INCH, LENGTH_PLACES.inch)}${inchMark ? '"' : ' in'}`
    : `${trim(mm, LENGTH_PLACES.mm)} mm`

/**
 * Feature types read as a surface rather than walls and floors: what they
 * admit is a ball or bull nose tool, and their fillet radius is their own.
 */
const SURFACE_TYPES: ReadonlySet<string> = new Set([
  'contour_surface',
  'inner_fillet',
  'outer_fillet',
  'fillet',
])

/** Whether a feature type is read as a surface: see `SURFACE_TYPES`. */
export const isSurfaceType = (featureType: string): boolean => SURFACE_TYPES.has(featureType)

/**
 * The biggest ball nose a surface admits, mm: a ball's corner radius is half
 * its diameter, so it is held under the tool fit's diameter and corner radius
 * at once. None where the surface reports no fit, or admits no corner at all.
 */
export const maxBallDiameter = (
  sheet: Pick<FeatureSheet, 'fitToolDiameter' | 'fitCornerRadius'>,
): number | undefined => {
  const { fitToolDiameter: diameter, fitCornerRadius: corner } = sheet
  if (corner === undefined || corner <= 0) return undefined
  return diameter !== undefined && diameter > 0 ? Math.min(diameter, 2 * corner) : 2 * corner
}

/**
 * The order rows read in: the feature's own geometry first; then the
 * machining considerations in their own order, the tool that cuts it before
 * the reach it makes to get there.
 */
const ROW_ORDER: readonly string[] = [
  'featureDepth',
  'undercutWidth',
  'floorWidth',
  'openingWidth',
  'undercutDepth',
  'taper',
  'diameter',
  'cornerRadius',
  'filletRadius',
  'floorFillet',
  'tipAngle',
  'thread',
  'bevelAngle',
  'finishTool',
  'undercutCutter',
  'maxShaft',
  'pinch',
  'fitCornerRadius',
  'maxBull',
  'maxBall',
  'depthBelowTop',
  'ld',
  'featureLd',
  'topLd',
]

/**
 * The rows a feature gets, in {@link ROW_ORDER}: its own geometry first, then
 * where it sits in the part and the reach that makes, then the tools a
 * surface admits. A row is left out rather than shown empty: "—" against a
 * field this kind never reports reads as a measurement that failed.
 */
export const featureMeasurements = ({
  features,
  feature,
  sheets,
  units,
  inchMark = false,
}: {
  features: readonly DfmFeature[]
  feature: DfmFeature
  sheets: FeatureSheets
  units: Units
  /** Writes inches as `0.46"` rather than `0.46 in`. */
  inchMark?: boolean
}): Measurement[] => {
  const other: Units = units === 'inch' ? 'mm' : 'inch'
  const length = (mm: number) => ({
    value: formatLength(mm, units, inchMark),
    alt: formatLength(mm, other, inchMark),
  })
  const sheet = sheets[feature.tag.toLowerCase()]
  const rows: Measurement[] = []
  // An undercut's cutter band is its cutter's head, not a tool between walls: it has rows of its own.
  const undercut = sheet?.undercut
  const tslot = sheet?.kind === 'Tslot'

  const top = sheet ? partTop(features, sheets, feature.machiningDirection) : null
  const bottom = sheet?.zMin
  // The feature the part's top is read from: the one standing highest, cut the same way.
  const topFrom =
    top === null
      ? undefined
      : features.find((each) => sheets[each.tag.toLowerCase()]?.extendedZMax === top)
  const topLine =
    top === null
      ? ''
      : `Top of part = the highest extendedZMax of the features machined from this direction = ${mm(top)}${topFrom ? ` (${featureTypeLabel(topFrom.featureType)} ${topFrom.tag})` : ''}`
  if (top !== null && bottom !== undefined) {
    rows.push({
      key: 'depthBelowTop',
      label: 'Depth below top of part',
      milling: true,
      ...length(top - bottom),
      derivation: [topLine, `Top − zMin = ${mm(top)} − ${mm(bottom)} = ${mm(top - bottom)}`],
    })
  }
  if (sheet?.zMax !== undefined && bottom !== undefined && !(undercut && tslot)) {
    rows.push({
      key: 'featureDepth',
      label: 'Feature depth',
      ...length(sheet.zMax - bottom),
      derivation: [`zMax − zMin = ${mm(sheet.zMax)} − ${mm(bottom)} = ${mm(sheet.zMax - bottom)}`],
    })
  }
  if (sheet?.diameter !== undefined) {
    rows.push({
      key: 'diameter',
      label: 'Diameter',
      ...length(sheet.diameter),
      derivation: [`facts.diameter = ${mm(sheet.diameter)}`],
    })
  }
  /*
   * The tightest inside corner between the feature's walls, as a radius: half
   * its minimum clearance with the tolerance it was measured to taken out.
   * Marked sharp when there is next to none, which no end mill makes.
   */
  if (sheet?.cornerRadius !== undefined && !undercut) {
    const radius = length(sheet.cornerRadius)
    rows.push({
      key: 'cornerRadius',
      label: sheet.sharpCorners ? 'Minimum radius (sharp)' : 'Minimum radius',
      // Measured at one tolerance only, it is the most the modelled radius can be, not the radius itself.
      ...(sheet.cornerRadiusUnresolved
        ? { value: `≤ ${radius.value}`, alt: `≤ ${radius.alt}` }
        : radius),
      derivation: [
        'The tightest corner between walls: half the minimum clearance, the widest tool that reaches every point with the tolerance it was measured to taken out.',
        ...(sheet.clearance ? clearanceDerivation(sheet.clearance, 2 * sheet.cornerRadius) : []),
        `R = clearance / 2 = ${mm(sheet.cornerRadius)}${sheet.sharpCorners ? ' (under 0.01 mm: sharp)' : ''}`,
      ],
    })
  }
  /*
   * Where the feature is tightest, as the width of the gap: the tightest
   * pinch disc, or twice the corner radius where the Engine reports no pinch
   * points. A sharp corner has no clearance at all, so no tool to name.
   */
  if (!sheet?.sharpCorners && !undercut) {
    const clearance =
      sheet?.pinchDiameter ??
      (sheet?.cornerRadius !== undefined ? 2 * sheet.cornerRadius : undefined)
    if (clearance !== undefined) {
      const width = length(clearance)
      const places = sheet?.pinchPlaces
      // A filleted floor makes the tool a bull nose: its corner radius is the fillet's.
      const floor =
        !SURFACE_TYPES.has(feature.featureType) &&
        sheet?.filletRadius !== undefined &&
        sheet.filletRadius > 0
          ? length(sheet.filletRadius)
          : undefined
      const atMost = sheet?.cornerRadiusUnresolved ? '≤ ' : ''
      rows.push({
        key: 'pinch',
        label: 'Max tool diameter',
        milling: true,
        // Measured at one tolerance only, it is the most the clearance can be, not the clearance itself.
        value: `${atMost}⌀ ${width.value}${floor ? ` · R ${floor.value}` : ''}`,
        alt: `${atMost}⌀ ${width.alt}${floor ? ` · R ${floor.alt}` : ''}`,
        derivation: [
          'The widest circle that fits where the feature is tightest: twice an inside corner’s radius, or the width of a gap between walls.',
          ...(places !== undefined
            ? [
                `pinchPoints: where the feature narrows to its tightest clearance, a disc each; ${places} ${places === 1 ? 'place' : 'places'} that tight, the tightest drawn.`,
                `min(pinchPoints[].diameter) is the cutter band’s min, measured to a tolerance (t) the widest tool grows with: run back to none from two tolerances.`,
              ]
            : [
                'No pinch points reported: the cutter band’s min, measured to a tolerance (t) the widest tool grows with, run back to none from two tolerances.',
              ]),
          ...(sheet?.clearance ? clearanceDerivation(sheet.clearance, clearance) : []),
          ...(floor && sheet?.filletRadius !== undefined
            ? [
                `A bull nose, its corner radius the floor fillet’s: facts.filletRadius = ${mm(sheet.filletRadius)}`,
              ]
            : []),
        ],
      })
    }
  }
  if (sheet && undercut) rows.push(...undercutRows(sheet, undercut, top, length))
  const surface = SURFACE_TYPES.has(feature.featureType)
  /*
   * A surface has no walls to take a radius from: what it admits is a tool.
   * The Engine gives the largest full-diameter tool its shape admits and the
   * corner radius it admits (`toolFit`): together the biggest bull nose; and
   * the biggest ball is the one that fits under both limits at once.
   */
  if (surface && sheet) {
    const diameter = sheet.fitToolDiameter
    const corner = sheet.fitCornerRadius
    const fit = sheet.toolFitPath ?? 'facts.toolFit'
    const ball = maxBallDiameter(sheet)
    rows.push({
      key: 'finishTool',
      label: 'Finishing tool',
      milling: true,
      value: sheet.ballOnly ? 'Ball end mill' : 'Ball or bull nose',
      derivation: [
        `facts.useOnlyBallToolsForFinish (or facts.three.…) is ${sheet.ballOnly ? 'true' : 'not true'}`,
      ],
    })
    // The corner the surface's own shape admits: the limit every finishing tool is held to.
    if (corner !== undefined && corner > 0) {
      rows.push({
        key: 'fitCornerRadius',
        label: 'Max corner radius',
        milling: true,
        ...length(corner),
        derivation: [
          'The tightest the surface turns inward: a tool with a larger corner radius cannot follow it.',
          `${fit}.cornerRadius = ${mm(corner)}`,
        ],
      })
    }
    // A bull nose only where one suits, and where the corner limit leaves it any flat: at half the diameter it is a ball.
    const sized = diameter !== undefined && diameter > 0
    if (
      !sheet.ballOnly &&
      corner !== undefined &&
      corner > 0 &&
      (!sized || ball === undefined || ball < diameter)
    ) {
      const size = sized ? length(diameter) : undefined
      const radius = length(corner)
      rows.push({
        key: 'maxBull',
        label: 'Max bull nose',
        milling: true,
        // Drawable only at a diameter the fit gives: "any" is no size to draw.
        ...(sized ? { tool: 'bull' as const } : {}),
        value: `${size ? `⌀ ${size.value}` : 'any ⌀'} · R ${radius.value}`,
        alt: `${size ? `⌀ ${size.alt}` : 'any ⌀'} · R ${radius.alt}`,
        derivation: [
          sized
            ? 'The largest full-diameter tool the surface’s shape admits, with the largest corner radius it admits.'
            : 'The surface limits only the tool’s corner radius, not its diameter: a bull nose of any size with a corner no larger than this.',
          ...(sized
            ? [`⌀ = ${fit}.toolDiameter = ${mm(diameter)}`]
            : [`${fit}.toolDiameter is not reported`]),
          `R = ${fit}.cornerRadius = ${mm(corner)}`,
        ],
      })
    }
    if (ball !== undefined && corner !== undefined) {
      const size = length(ball)
      rows.push({
        key: 'maxBall',
        label: 'Max ball nose',
        milling: true,
        tool: 'ball',
        value: `⌀ ${size.value}`,
        alt: `⌀ ${size.alt}`,
        derivation: [
          'A ball’s corner radius is half its diameter, so it must fit under the corner limit, and the diameter limit where there is one:',
          ...(diameter !== undefined && diameter > 0
            ? [
                `min(${fit}.toolDiameter, 2 × ${fit}.cornerRadius)`,
                `= min(${mm(diameter)}, ${mm(2 * corner)}) = ${mm(ball)}`,
              ]
            : [`2 × ${fit}.cornerRadius = ${mm(ball)} (${fit}.toolDiameter is not reported)`]),
        ],
      })
    }
  }
  /*
   * How far the tool reaches against how wide it can be. A drilled hole has
   * one: the drill comes down from the top of the part. A milled feature has
   * two, over the same D: its own depth, which is what its walls ask of the
   * cutter, and its depth below the top of the part, which is how far down
   * the cutter has to go to get there.
   */
  const ld = featureLd(features, feature, sheets)
  if (ld && !undercut && top !== null && bottom !== undefined) {
    const across =
      ld.basis === 'bore'
        ? `D = facts.diameter = ${mm(ld.across)}`
        : ld.basis === 'pinch'
          ? `D = widest tool (the tightest pinch disc, tolerance taken out) = ${mm(ld.across)}${ld.atLeast ? ' (at most, so L/D is at least)' : ''}`
          : `D = widest tool = 2 × inside corner radius = ${mm(ld.across)}${ld.atLeast ? ' (at most, so L/D is at least)' : ''} (no pinch points reported)`
    const ratioOf = (depth: number): string => {
      const ratio = (depth / ld.across).toFixed(3)
      return ld.atLeast ? `≥ ${ratio}` : ratio
    }
    if (ld.drilling) {
      rows.push({
        key: 'ld',
        label: 'Drilling L/D',
        milling: true,
        value: ratioOf(top - bottom),
        derivation: [
          `L = depth below top of part = ${mm(top - bottom)}`,
          across,
          `L / D = ${mm(top - bottom)} / ${mm(ld.across)} = ${ld.ratio.toFixed(3)}`,
        ],
      })
    } else {
      if (sheet?.zMax !== undefined) {
        rows.push({
          key: 'featureLd',
          label: 'Feature L/D',
          milling: true,
          value: ratioOf(sheet.zMax - bottom),
          derivation: [
            `L = feature depth = zMax − zMin = ${mm(sheet.zMax - bottom)}`,
            across,
            `L / D = ${mm(sheet.zMax - bottom)} / ${mm(ld.across)} = ${((sheet.zMax - bottom) / ld.across).toFixed(3)}`,
          ],
        })
      }
      rows.push({
        key: 'topLd',
        label: 'L/D to top of part',
        milling: true,
        value: ratioOf(top - bottom),
        derivation: [
          `L = depth below top of part = ${mm(top - bottom)}`,
          across,
          `L / D = ${mm(top - bottom)} / ${mm(ld.across)} = ${ld.ratio.toFixed(3)}`,
        ],
      })
    }
  }
  if (sheet?.tipAngle !== undefined) {
    const flat = Math.abs(sheet.tipAngle - 180) < 0.05
    rows.push({
      key: 'tipAngle',
      label: 'Tip angle',
      value: `${trim(sheet.tipAngle, 3)}°${flat ? ' (flat)' : ''}`,
      derivation: [
        `facts.fullConeDeg = ${trim(sheet.tipAngle, 3)}°${flat ? ' (180°: flat bottom)' : ''}`,
      ],
    })
  }
  if (sheet?.threading) {
    rows.push({
      key: 'thread',
      label: 'Thread',
      value: `${formatLength(sheet.threading.basicDiameter, units, inchMark)} × ${formatLength(sheet.threading.threadPitch, units, inchMark)} pitch`,
      derivation: [
        `facts.threading.spec.basicDiameter = ${mm(sheet.threading.basicDiameter)}`,
        `facts.threading.spec.threadPitch = ${mm(sheet.threading.threadPitch)}`,
      ],
    })
  }
  if (surface) {
    // A surface's own blend, signed by which way it turns: the radius is the size of it.
    if (sheet?.filletRadius !== undefined && sheet.filletRadius !== 0) {
      rows.push({
        key: 'filletRadius',
        label: 'Fillet radius',
        ...length(Math.abs(sheet.filletRadius)),
        derivation: [
          `|facts.filletRadius| = |${mm(sheet.filletRadius)}| (signed: + over an edge, − into a corner)`,
        ],
      })
    }
  } else if (sheet?.filletRadius !== undefined && sheet.filletRadius > 0) {
    rows.push({
      key: 'floorFillet',
      label: 'Floor fillet radius',
      ...length(sheet.filletRadius),
      derivation: [`facts.filletRadius = ${mm(sheet.filletRadius)}`],
    })
  }
  if (sheet?.chamferAngle !== undefined) {
    rows.push({
      key: 'bevelAngle',
      label: 'Chamfer angle',
      value: `${sheet.chamferAngle.toFixed(3)}°`,
      derivation: [`facts.bevel.angleDeg = ${trim(sheet.chamferAngle, 3)}°`],
    })
  }
  return rows.sort((a, b) => ROW_ORDER.indexOf(a.key) - ROW_ORDER.indexOf(b.key))
}

/** What an undercut's cutter row is called, a T-slot's or a dovetail's. */
const CUTTING_DIAMETER = 'Max cutting diameter'

/**
 * An undercut's rows — a T-slot's or a dovetail's: how wide and how deep the
 * groove runs, and the biggest cutter it takes, with the shaft that has to
 * come down through its opening to get there and how far it reaches.
 */
const undercutRows = (
  sheet: FeatureSheet,
  undercut: FeatureUndercut,
  /** The top of the part along the feature's direction, where the cutter comes down from. */
  top: number | null,
  length: (mm: number) => { value: string; alt: string },
): Measurement[] => {
  const rows: Measurement[] = []
  const tslot = sheet.kind === 'Tslot'
  const { zMin, zMax } = sheet
  const width = tslot && zMin !== undefined && zMax !== undefined ? zMax - zMin : undefined
  if (width !== undefined && zMin !== undefined && zMax !== undefined) {
    rows.push({
      key: 'undercutWidth',
      label: 'Undercut width',
      ...length(width),
      derivation: [
        'The groove’s height along the tool: the widest cutter it takes in one pass.',
        `zMax − zMin = ${mm(zMax)} − ${mm(zMin)} = ${mm(width)}`,
      ],
    })
  }
  const { floorWidth: floor, topOpeningWidth: opening } = undercut
  if (floor !== undefined) {
    rows.push({
      key: 'floorWidth',
      label: 'Floor width',
      ...length(floor),
      derivation: ['The widest clearance over the floor', `facts.floorWidth = ${mm(floor)}`],
    })
  }
  if (opening !== undefined) {
    rows.push({
      key: 'openingWidth',
      label: 'Opening width',
      ...length(opening),
      derivation: [
        'The clearance through the opening at the top of the groove',
        `facts.topOpeningWidth = ${mm(opening)}`,
      ],
    })
  }
  if (undercut.undercutDepth !== undefined) {
    rows.push({
      key: 'undercutDepth',
      label: 'Undercut depth',
      ...length(undercut.undercutDepth),
      derivation: [
        'How far the groove runs back from its opening: what the cutter’s head reaches past its shaft.',
        `facts.undercutDepth = ${mm(undercut.undercutDepth)}`,
      ],
    })
  } else if (
    floor !== undefined &&
    opening !== undefined &&
    floor > opening &&
    !undercut.isExternal
  ) {
    // A closed dovetail overhangs evenly on both sides; one that runs out has no single depth.
    const depth = (floor - opening) / 2
    rows.push({
      key: 'undercutDepth',
      label: 'Undercut depth',
      ...length(depth),
      derivation: [
        'How far each overhang runs back over the floor: what the cutter’s head reaches past its shaft.',
        `(facts.floorWidth − facts.topOpeningWidth) / 2 = (${mm(floor)} − ${mm(opening)}) / 2 = ${mm(depth)}`,
      ],
    })
  }
  if (undercut.taperDeg !== undefined) {
    rows.push({
      key: 'taper',
      label: 'Dovetail angle',
      value: `${trim(undercut.taperDeg, 3)}° from the tool axis`,
      derivation: [
        `facts.taperDeg = ${trim(undercut.taperDeg, 3)}°, between the overhanging wall and the tool axis`,
      ],
    })
  }

  if (undercut.unmeasured) {
    rows.push({
      key: 'undercutCutter',
      label: CUTTING_DIAMETER,
      milling: true,
      value: 'Not measured',
      derivation: [
        'The Engine could not measure the groove (facts.isInvalidGeometry or facts.cd.measurementFailed), so its figures offer no cutter.',
      ],
    })
    return rows
  }
  /*
   * The head: the biggest that reaches every point of the groove. A closed
   * T-slot has no open end to slide it in from, so it comes down through the
   * opening above, and is no wider than that either.
   */
  const band = sheet.maxTool !== undefined && sheet.maxTool > 0 ? sheet.maxTool : undefined
  const entry = tslot ? undercut.maxEntry : undefined
  const dropsIn = tslot && undercut.isClosed === true && entry !== undefined
  const head =
    band === undefined ? undefined : dropsIn && entry !== undefined ? Math.min(band, entry) : band
  const headLines = [
    'The biggest head that reaches every point of the groove.',
    ...(band !== undefined ? [`facts.cd.ignore.min = ${mm(band)}`] : []),
    ...(dropsIn && entry !== undefined
      ? [
          `A closed slot: the head comes down through the opening above it, facts.maxEntryCd = ${mm(entry)}`,
        ]
      : []),
  ]
  if (sheet.noToolFits || head === 0) {
    rows.push({
      key: 'undercutCutter',
      label: CUTTING_DIAMETER,
      milling: true,
      value: 'None fits',
      derivation: sheet.noToolFits
        ? ['facts.cd.ignore.max is next to nothing: no cutter fits anywhere in the groove.']
        : [...headLines, 'Nothing comes down through the opening.'],
    })
  } else if (head !== undefined) {
    // The head's size, its angle in a dovetail, and the corner its blend asks for.
    const size = length(head)
    const fillet =
      sheet.filletRadius !== undefined && sheet.filletRadius > 0
        ? length(sheet.filletRadius)
        : undefined
    const angle = !tslot && undercut.taperDeg !== undefined ? `${trim(undercut.taperDeg, 3)}°` : ''
    const describe = (unit: 'value' | 'alt'): string =>
      [`⌀ ${size[unit]}`, ...(angle ? [angle] : []), ...(fillet ? [`R ${fillet[unit]}`] : [])].join(
        ' · ',
      )
    rows.push({
      key: 'undercutCutter',
      label: CUTTING_DIAMETER,
      milling: true,
      value: describe('value'),
      alt: describe('alt'),
      derivation: [
        ...headLines,
        `⌀ = ${mm(head)}`,
        ...(angle ? [`Angle = facts.taperDeg = ${angle}, from the tool axis`] : []),
        ...(fillet && sheet.filletRadius !== undefined
          ? [`R = facts.filletRadius = ${mm(sheet.filletRadius)}, the blend the head’s corners cut`]
          : []),
      ],
    })
    // How far the cutter comes down from the top of the part, against the head it carries.
    if (top !== null && zMin !== undefined) {
      const reach = top - zMin
      rows.push({
        key: 'topLd',
        label: 'L/D to top of part',
        milling: true,
        value: (reach / head).toFixed(3),
        derivation: [
          `L = depth below top of part = ${mm(reach)}`,
          `D = max cutting diameter = ${mm(head)}`,
          `L / D = ${mm(reach)} / ${mm(head)} = ${(reach / head).toFixed(3)}`,
        ],
      })
    }
  }
  /*
   * The shaft comes down through the opening above the groove: a T-slot's
   * entry, a dovetail's top. A T-slot's head also has to stand out past it
   * by the undercut on each side to reach the back of the groove, so the
   * shaft is no wider than the head less twice the undercut either.
   */
  const opensTo = tslot ? entry : opening
  const depth = tslot ? undercut.undercutDepth : undefined
  const behind = tslot && head !== undefined && depth !== undefined ? head - 2 * depth : undefined
  const limits = [opensTo, behind].filter((each): each is number => each !== undefined)
  if (limits.length > 0) {
    const shaft = Math.max(Math.min(...limits), 0)
    const size = length(shaft)
    rows.push({
      key: 'maxShaft',
      label: 'Max shaft diameter',
      milling: true,
      ...(shaft > 0 ? { value: `⌀ ${size.value}`, alt: `⌀ ${size.alt}` } : { value: 'None fits' }),
      derivation: [
        'The most the cutter’s shaft can be: what comes down through the opening above the groove, and leaves the head reaching the back of it.',
        ...(opensTo !== undefined
          ? [`Opening: ${tslot ? 'facts.maxEntryCd' : 'facts.topOpeningWidth'} = ${mm(opensTo)}`]
          : []),
        ...(behind !== undefined && head !== undefined && depth !== undefined
          ? [
              `Reach: max cutting diameter − 2 × undercut depth = ${mm(head)} − 2 × ${mm(depth)} = ${mm(behind)}`,
            ]
          : []),
        `Max shaft = ${mm(shaft)}`,
      ],
    })
  } else if (tslot) {
    rows.push({
      key: 'maxShaft',
      label: 'Max shaft diameter',
      milling: true,
      value: 'No limit',
      derivation: [
        'facts.maxEntryCd is not reported and the head or undercut depth is not known: nothing limits the shaft.',
      ],
    })
  }
  return rows
}
