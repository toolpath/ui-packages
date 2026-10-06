import { MM_PER_INCH } from '@toolpath/tool-support'
import type { Units } from './units.js'

/*
 * What a DFM rule can test, and which features it can test it on: every
 * figure the Engine's feature datasheet reports (API 1.12.1,
 * `FeatureDatasheet` and its per-kind `facts`), the quoting app's derived
 * measures (L/D, depth below top, corner radius, sharp corner), a few read
 * off the report itself, and "any size", which flags a type of feature
 * whatever its geometry.
 */

/**
 * At or above, above, at or below, below, equal, not equal, or between —
 * equal meaning within half a percent, since figures are measured, and not
 * equal anything further off; between from a low end up to, not including, a
 * high one.
 */
export type DfmOp = 'gte' | 'gt' | 'lte' | 'lt' | 'eq' | 'ne' | 'between'

/**
 * How a figure is read and typed: a length (mm), an area (mm²), an angle
 * (degrees), a plain ratio, a count, a percentage, yes/no, or — for "any
 * size" — nothing at all.
 */
export type DfmQuantity =
  | 'length'
  | 'area'
  | 'angle'
  | 'ratio'
  | 'count'
  | 'percent'
  | 'flag'
  | 'presence'

/** A datasheet's `facts.kind`: which family of measurements the Engine took. */
export type FactsKind =
  | 'Hole'
  | 'Pocket'
  | 'Boss'
  | 'Wall'
  | 'Face'
  | 'Three'
  | 'Chamfer'
  | 'Profile'
  | 'Dovetail'
  | 'Tslot'

export interface DfmMetric {
  key: string
  /** As the rule sentence reads it: "L/D", "depth below top". */
  label: string
  /** The heading it is listed under when choosing. */
  group: string
  quantity: DfmQuantity
  /** Which way is worse, for a new rule: deep is bad (≥), a tiny corner is bad (≤). */
  op: DfmOp
  /** What a new rule starts at: millimetres and inches kept apart, so both read as round numbers. */
  start: Record<Units, number>
  /** What it means, in a few plain words. */
  hint: string
  /** The kinds of datasheet that report it; every kind when left out. */
  kinds?: readonly FactsKind[]
  /**
   * Where it sits in the datasheet, first found wins: a chamfer keeps its
   * cutter band under its surface reading (`facts.three.cd`). Left out for a
   * measure worked out rather than read (see `dfm-flags.ts`).
   */
  path?: readonly string[]
  /** Whether a rule may name a value below zero: a height, or a signed radius. */
  signed?: true
}

interface MetricSpec extends Omit<DfmMetric, 'start' | 'path'> {
  start: number | Record<Units, number>
  path?: string | readonly string[]
}

const define = ({ start, path, ...spec }: MetricSpec): DfmMetric => ({
  ...spec,
  start: typeof start === 'number' ? { mm: start, inch: start } : start,
  ...(path === undefined ? {} : { path: typeof path === 'string' ? [path] : path }),
})

/** Starting values that read as round numbers in both units. */
const SMALL = { mm: 1, inch: 1.27 }
const TOOL = { mm: 3, inch: 3.175 }
const DEEP = { mm: 50, inch: 50.8 }
const AREA = { mm: 1000, inch: 645.16 }

/** A cutter band's bound, where every kind keeps it, and a chamfer under its surface reading. */
const cd = (band: string, bound: 'min' | 'max'): string[] => [
  `facts.cd.${band}.${bound}`,
  `facts.three.cd.${band}.${bound}`,
]

const ALWAYS = 'Always'
const SIZE = 'Size and depth'
const TOOLS = 'Tool access'
const AREAS = 'Surface area'
const MAKE = 'Machining'
const HOLE = 'Holes'
const THREAD = 'Threads'
const CHAMFER = 'Chamfers'
const OUTLINES = 'Floors, fillets and outlines'
const FACES = 'Faces and profiles'
const SURFACE = '3D surfaces'
const UNDERCUT = 'Undercuts'

export const PRESENCE_METRIC = define({
  key: 'present',
  label: 'any size',
  group: ALWAYS,
  quantity: 'presence',
  op: 'gte',
  start: 0,
  hint: 'Flags every feature of this type, whatever its geometry',
})

export const LD_METRIC = define({
  key: 'ld',
  label: 'L/D to top of part',
  group: SIZE,
  quantity: 'ratio',
  op: 'gte',
  start: 5,
  hint: 'How far down the tool reaches: depth below the top of the part over its minimum clearance — a hole’s over its bore; twice its inside corner radius where there are no pinch points. None for a sharp corner with no clearance',
})

/** The feature's own depth over the same clearance: what its walls ask of the cutter, wherever it sits in the part. */
const FEATURE_LD_METRIC = define({
  key: 'featureLd',
  label: 'feature L/D',
  group: SIZE,
  quantity: 'ratio',
  op: 'gte',
  start: 5,
  hint: 'The feature’s own depth (its top to its bottom) over the same clearance as L/D to top of part: what its walls ask of the cutter, however deep in the part it sits',
})

export const FEATURE_METRICS: readonly DfmMetric[] = [
  PRESENCE_METRIC,

  LD_METRIC,
  FEATURE_LD_METRIC,
  define({
    key: 'depthBelowTop',
    label: 'depth below top',
    group: SIZE,
    quantity: 'length',
    op: 'gte',
    start: DEEP,
    hint: 'How far below the top of the part the feature bottoms out',
  }),
  define({
    key: 'featureDepth',
    label: 'feature depth',
    group: SIZE,
    quantity: 'length',
    op: 'gte',
    start: { mm: 25, inch: MM_PER_INCH },
    hint: 'The feature’s own depth, top to bottom',
  }),
  define({
    key: 'faceCount',
    label: 'number of faces',
    group: SIZE,
    quantity: 'count',
    op: 'gte',
    start: 10,
    hint: 'How many faces of the model make it up',
  }),
  define({
    key: 'zMin',
    label: 'bottom (tool-axis Z)',
    group: SIZE,
    quantity: 'length',
    op: 'lte',
    start: 0,
    signed: true,
    path: 'zMin',
    hint: 'The feature’s bottom along its tool axis, in the Engine’s frame',
  }),
  define({
    key: 'zMax',
    label: 'top (tool-axis Z)',
    group: SIZE,
    quantity: 'length',
    op: 'gte',
    start: 0,
    signed: true,
    path: 'zMax',
    hint: 'The feature’s top along its tool axis, in the Engine’s frame',
  }),
  define({
    key: 'extendedZMin',
    label: 'pass bottom (tool-axis Z)',
    group: SIZE,
    quantity: 'length',
    op: 'lte',
    start: 0,
    signed: true,
    path: 'extendedZMin',
    hint: 'Where a pass over it runs out: its bottom, or lower where a chamfer on a far edge deepens it',
  }),
  define({
    key: 'extendedZMax',
    label: 'pass top (tool-axis Z)',
    group: SIZE,
    quantity: 'length',
    op: 'gte',
    start: 0,
    signed: true,
    path: 'extendedZMax',
    hint: 'Where a pass over it starts: its top, or higher where a chamfer or fillet sits on its mouth',
  }),
  define({
    key: 'reachHeight',
    label: 'material height beside it',
    group: SIZE,
    quantity: 'length',
    op: 'gte',
    start: DEEP,
    hint: 'The highest the material stands anywhere outboard of it (its reach curve), which a tool’s holder must clear',
  }),

  define({
    key: 'maxTool',
    label: 'largest tool that fits',
    group: TOOLS,
    quantity: 'length',
    op: 'lte',
    start: TOOL,
    path: cd('ignore', 'min'),
    hint: 'The widest cutter that still reaches every point',
  }),
  define({
    key: 'cornerRadius',
    label: 'inside corner radius',
    group: TOOLS,
    quantity: 'length',
    op: 'lte',
    start: SMALL,
    hint: 'The radius of its tightest corner between walls, as drawn — zero when sharp. Not a floor fillet',
  }),
  define({
    key: 'maxToolSomewhere',
    label: 'largest tool that fits anywhere',
    group: TOOLS,
    quantity: 'length',
    op: 'lte',
    start: TOOL,
    path: cd('ignore', 'max'),
    hint: 'The widest cutter that fits somewhere in it',
  }),
  define({
    key: 'maxToolDeviate',
    label: 'largest tool within tolerance',
    group: TOOLS,
    quantity: 'length',
    op: 'lte',
    start: TOOL,
    path: cd('deviate', 'min'),
    hint: 'The widest cutter that reaches every point, allowing the reported tolerance band',
  }),
  define({
    key: 'maxToolAdaptive',
    label: 'largest adaptive tool',
    group: TOOLS,
    quantity: 'length',
    op: 'lte',
    start: TOOL,
    path: cd('effectiveAdaptive', 'min'),
    hint: 'The widest cutter that reaches every point once adaptive-cutting allowances are applied',
  }),
  define({
    key: 'terminalCornerRadius',
    label: 'finishing corner radius limit',
    group: TOOLS,
    quantity: 'length',
    op: 'lte',
    start: SMALL,
    path: ['facts.cd.terminalCornerRadius', 'facts.three.cd.terminalCornerRadius'],
    hint: 'The corner radius a finishing tool must not exceed',
  }),
  define({
    key: 'maxBottomDiameter',
    label: 'largest tool bottom',
    group: TOOLS,
    quantity: 'length',
    op: 'lte',
    start: TOOL,
    path: ['facts.maxBottomDiameter', 'facts.three.maxBottomDiameter'],
    kinds: ['Pocket', 'Boss', 'Face', 'Three', 'Chamfer'],
    hint: 'The widest bottom a finishing tool may have',
  }),
  define({
    key: 'pinchPoints',
    label: 'tight spots',
    group: TOOLS,
    quantity: 'count',
    op: 'gte',
    start: 2,
    hint: 'How many places it narrows to its tightest clearance (the Engine reports up to ten)',
  }),
  define({
    key: 'pinchDiameter',
    label: 'minimum clearance',
    group: TOOLS,
    quantity: 'length',
    op: 'lte',
    start: TOOL,
    hint: 'The widest circle that fits where it is tightest: its smallest pinch disc, the Engine’s tolerance taken out. Only for the kinds the Engine reports pinch points for; a sharp corner is its own rule',
  }),
  define({
    key: 'sharpCorner',
    label: 'a sharp inside corner',
    group: TOOLS,
    quantity: 'flag',
    op: 'gte',
    start: 0,
    hint: 'A vertical corner between its walls with no radius, which no end mill makes. Not a floor fillet',
  }),
  define({
    key: 'noToolFits',
    label: 'no room for any tool',
    group: TOOLS,
    quantity: 'flag',
    op: 'gte',
    start: 0,
    hint: 'No cutter fits anywhere in it',
  }),
  define({
    key: 'tilted',
    label: 'a tilted tool axis',
    group: TOOLS,
    quantity: 'flag',
    op: 'gte',
    start: 0,
    hint: 'Machined along a direction that is not one of the part’s six square ones: a 5-axis setup',
  }),

  define({
    key: 'surfaceArea',
    label: 'surface area',
    group: AREAS,
    quantity: 'area',
    op: 'gte',
    start: AREA,
    hint: 'Its whole surface: the Engine’s partition of it, or its faces’ areas together',
  }),
  define({
    key: 'projectedFloorArea',
    label: 'floor area (projected)',
    group: AREAS,
    quantity: 'area',
    op: 'gte',
    start: AREA,
    path: ['projectedFloorArea', 'floorishArea'],
    hint: 'Area machined floor-wise, square to the tool axis',
  }),
  define({
    key: 'projectedWallArea',
    label: 'wall area (projected)',
    group: AREAS,
    quantity: 'area',
    op: 'gte',
    start: AREA,
    path: ['projectedWallArea', 'wallishArea'],
    hint: 'Area machined wall-wise, along the tool axis',
  }),
  define({
    key: 'floorArea',
    label: 'floor surface',
    group: AREAS,
    quantity: 'area',
    op: 'gte',
    start: AREA,
    path: 'areas.floorArea',
    hint: 'Surface square to the tool axis',
  }),
  define({
    key: 'wallArea',
    label: 'wall surface',
    group: AREAS,
    quantity: 'area',
    op: 'gte',
    start: AREA,
    path: 'areas.wallArea',
    hint: 'Surface running along the tool axis',
  }),
  define({
    key: 'filletArea',
    label: 'fillet surface',
    group: AREAS,
    quantity: 'area',
    op: 'gte',
    start: AREA,
    path: 'areas.filletArea',
    hint: 'The concave rounds between floors and walls',
  }),
  define({
    key: 'chamferArea',
    label: 'chamfer surface',
    group: AREAS,
    quantity: 'area',
    op: 'gte',
    start: AREA,
    path: 'areas.chamferArea',
    hint: 'The bevels',
  }),
  define({
    key: 'contourArea',
    label: '3D surface',
    group: AREAS,
    quantity: 'area',
    op: 'gte',
    start: AREA,
    path: 'areas.contourArea',
    hint: 'Surface with no flat to stand on',
  }),

  define({
    key: 'hasFloor',
    label: 'a floor',
    group: MAKE,
    quantity: 'flag',
    op: 'gte',
    start: 0,
    path: 'hasFloor',
    hint: 'It has a floor machined square to the tool axis',
  }),
  define({
    key: 'hasWall',
    label: 'a wall',
    group: MAKE,
    quantity: 'flag',
    op: 'gte',
    start: 0,
    path: 'hasWall',
    hint: 'It has a wall machined along the tool axis',
  }),
  define({
    key: 'axialStock',
    label: 'axial stock to leave',
    group: MAKE,
    quantity: 'length',
    op: 'gte',
    start: { mm: 0.1, inch: 0.127 },
    path: 'axialStockToLeave',
    hint: 'Material left along the tool axis for a later operation',
  }),
  define({
    key: 'radialStock',
    label: 'radial stock to leave',
    group: MAKE,
    quantity: 'length',
    op: 'gte',
    start: { mm: 0.1, inch: 0.127 },
    path: 'radialStockToLeave',
    hint: 'Material left radially for a later operation',
  }),
  define({
    key: 'tolIgnore',
    label: 'ignored tolerance',
    group: MAKE,
    quantity: 'length',
    op: 'lte',
    start: { mm: 0.01, inch: 0.0127 },
    path: 'toleranceBand.atolIgnore',
    hint: 'Deviation at or below this is ignored',
  }),
  define({
    key: 'tolDeviate',
    label: 'reported tolerance',
    group: MAKE,
    quantity: 'length',
    op: 'lte',
    start: { mm: 0.02, inch: 0.0254 },
    path: 'toleranceBand.atolDeviate',
    hint: 'Deviation up to this is reported',
  }),
  define({
    key: 'tolMax',
    label: 'tolerance',
    group: MAKE,
    quantity: 'length',
    op: 'lte',
    start: { mm: 0.05, inch: 0.0508 },
    path: 'toleranceBand.atolMax',
    hint: 'The most it may deviate from the model',
  }),
  define({
    key: 'passLength',
    label: 'pass length',
    group: OUTLINES,
    quantity: 'length',
    op: 'gte',
    start: { mm: 500, inch: 508 },
    path: ['facts.wallLength.length', 'facts.length'],
    kinds: ['Pocket', 'Boss', 'Wall', 'Profile'],
    hint: 'How far a pass around its outline travels, with a tool of no width',
  }),

  define({
    key: 'diameter',
    label: 'diameter',
    group: HOLE,
    quantity: 'length',
    op: 'lte',
    start: { mm: 1.5, inch: 1.5875 },
    path: 'facts.diameter',
    kinds: ['Hole'],
    hint: 'What the hole is drilled to — narrower than modelled for a threaded hole',
  }),
  define({
    key: 'coneAngle',
    label: 'tip angle',
    group: HOLE,
    quantity: 'angle',
    op: 'lte',
    start: 118,
    path: 'facts.fullConeDeg',
    kinds: ['Hole'],
    hint: 'The full angle of the cone at its bottom; 180° for a flat bottom',
  }),
  define({
    key: 'counterbore',
    label: 'a counterbore',
    group: HOLE,
    quantity: 'flag',
    op: 'gte',
    start: 0,
    path: 'facts.isCounterbore',
    kinds: ['Hole'],
    hint: 'A larger bore at its mouth',
  }),
  define({
    key: 'maxSpot',
    label: 'largest spot drill',
    group: HOLE,
    quantity: 'length',
    op: 'lte',
    start: TOOL,
    path: 'facts.maxSpotDiameter',
    kinds: ['Hole'],
    hint: 'The widest spot drill that reaches it without collision',
  }),
  define({
    key: 'minDrill',
    label: 'smallest drill',
    group: HOLE,
    quantity: 'length',
    op: 'gte',
    start: TOOL,
    path: 'facts.minDrillDiameter',
    kinds: ['Hole'],
    hint: 'The narrowest drill that leaves it within its undersize',
  }),
  define({
    key: 'maxDrill',
    label: 'largest drill',
    group: HOLE,
    quantity: 'length',
    op: 'lte',
    start: TOOL,
    path: 'facts.maxDrillDiameter',
    kinds: ['Hole'],
    hint: 'The widest drill that leaves it within its oversize',
  }),
  define({
    key: 'maxEndmill',
    label: 'largest endmill',
    group: HOLE,
    quantity: 'length',
    op: 'lte',
    start: TOOL,
    path: 'facts.maxEndmillDiameter',
    kinds: ['Hole'],
    hint: 'The widest endmill that can machine it',
  }),
  define({
    key: 'floorFillet',
    label: 'floor fillet',
    group: OUTLINES,
    quantity: 'length',
    op: 'lte',
    start: { mm: 0.5, inch: 0.396875 },
    path: 'facts.filletRadius',
    kinds: ['Hole', 'Pocket', 'Boss', 'Dovetail', 'Tslot'],
    hint: 'The radius where the floor meets the walls; zero when sharp',
  }),
  define({
    key: 'filletHeight',
    label: 'floor fillet height',
    group: OUTLINES,
    quantity: 'length',
    op: 'gte',
    start: SMALL,
    path: 'facts.filletHeight',
    kinds: ['Hole', 'Pocket', 'Boss'],
    hint: 'How high the floor blend runs; zero when sharp',
  }),

  define({
    key: 'threaded',
    label: 'a thread',
    group: THREAD,
    quantity: 'flag',
    op: 'gte',
    start: 0,
    path: 'facts.threading.spec.threadPitch',
    kinds: ['Hole'],
    hint: 'The model threads it',
  }),
  define({
    key: 'threadPitch',
    label: 'thread pitch',
    group: THREAD,
    quantity: 'length',
    op: 'lte',
    start: { mm: 0.5, inch: 0.4536 },
    path: 'facts.threading.spec.threadPitch',
    kinds: ['Hole'],
    hint: 'A modelled thread’s pitch (0.454 mm is 56 TPI)',
  }),
  define({
    key: 'threadDiameter',
    label: 'thread size',
    group: THREAD,
    quantity: 'length',
    op: 'lte',
    start: { mm: 3, inch: 3.175 },
    path: 'facts.threading.spec.basicDiameter',
    kinds: ['Hole'],
    hint: 'The thread’s nominal major diameter',
  }),
  define({
    key: 'threadMinorMin',
    label: 'thread minor diameter (min)',
    group: THREAD,
    quantity: 'length',
    op: 'lte',
    start: TOOL,
    path: 'facts.threading.spec.minMinorDiameter',
    kinds: ['Hole'],
    hint: 'The smallest minor diameter allowed',
  }),
  define({
    key: 'threadMinorMax',
    label: 'thread minor diameter (max)',
    group: THREAD,
    quantity: 'length',
    op: 'lte',
    start: TOOL,
    path: 'facts.threading.spec.maxMinorDiameter',
    kinds: ['Hole'],
    hint: 'The largest minor diameter allowed',
  }),
  define({
    key: 'threadMajorMin',
    label: 'thread major diameter (min)',
    group: THREAD,
    quantity: 'length',
    op: 'lte',
    start: TOOL,
    path: 'facts.threading.spec.minMajorDiameter',
    kinds: ['Hole'],
    hint: 'The smallest major diameter allowed',
  }),
  define({
    key: 'threadPercentage',
    label: 'thread percentage',
    group: THREAD,
    quantity: 'percent',
    op: 'gte',
    start: 75,
    path: 'facts.threading.spec.threadPercentage',
    kinds: ['Hole'],
    hint: 'How much of the theoretical thread depth is to be formed',
  }),

  define({
    key: 'chamferAngle',
    label: 'chamfer angle',
    group: CHAMFER,
    quantity: 'angle',
    op: 'gte',
    start: 60,
    path: 'facts.bevel.angleDeg',
    kinds: ['Chamfer'],
    hint: 'Between the bevel and the tool axis: the half angle of the tool that cuts it. A standard 90° chamfer mill is 45°',
  }),
  define({
    key: 'chamferSlant',
    label: 'bevel length',
    group: CHAMFER,
    quantity: 'length',
    op: 'gte',
    start: { mm: 2, inch: 2.54 },
    path: 'facts.bevel.slant',
    kinds: ['Chamfer'],
    hint: 'How far the bevel runs along its slope: the cutting edge a tool needs to span it in one pass',
  }),
  define({
    key: 'chamferRoom',
    label: 'room under the bevel (tool-axis Z)',
    group: CHAMFER,
    quantity: 'length',
    op: 'gte',
    start: 0,
    signed: true,
    path: 'facts.bevel.lowerAdjacentZMin',
    kinds: ['Chamfer'],
    hint: 'The highest bottom among the features it stands on: how far a tool can overshoot below it',
  }),
  define({
    key: 'openPocketEdge',
    label: 'an open pocket edge',
    group: CHAMFER,
    quantity: 'flag',
    op: 'gte',
    start: 0,
    path: 'facts.bevel.isOpenPocketBottom',
    kinds: ['Chamfer'],
    hint: 'It breaks the edge along an open pocket’s floor',
  }),
  define({
    key: 'countersink',
    label: 'a countersink',
    group: CHAMFER,
    quantity: 'flag',
    op: 'gte',
    start: 0,
    path: 'facts.bevel.countersink.outerRadius',
    kinds: ['Chamfer'],
    hint: 'The bevel is a countersink of revolution',
  }),
  define({
    key: 'countersinkOuter',
    label: 'countersink radius',
    group: CHAMFER,
    quantity: 'length',
    op: 'gte',
    start: TOOL,
    path: 'facts.bevel.countersink.outerRadius',
    kinds: ['Chamfer'],
    hint: 'The radius it opens to at its upper edge',
  }),
  define({
    key: 'countersinkInner',
    label: 'countersink pilot radius',
    group: CHAMFER,
    quantity: 'length',
    op: 'lte',
    start: SMALL,
    path: 'facts.bevel.countersink.innerRadius',
    kinds: ['Chamfer'],
    hint: 'The radius of the pilot hole it starts from',
  }),

  define({
    key: 'topFace',
    label: 'the top face',
    group: FACES,
    quantity: 'flag',
    op: 'gte',
    start: 0,
    path: 'facts.isTopFace',
    kinds: ['Face'],
    hint: 'The highest surface of the part along the tool axis',
  }),
  define({
    key: 'facing',
    label: 'facing',
    group: FACES,
    quantity: 'flag',
    op: 'gte',
    start: 0,
    path: 'facts.isFacing',
    kinds: ['Face'],
    hint: 'A top face that is to be faced off',
  }),
  define({
    key: 'modifiedProfile',
    label: 'a bridged outline',
    group: FACES,
    quantity: 'flag',
    op: 'gte',
    start: 0,
    path: 'facts.isModified',
    kinds: ['Profile'],
    hint: 'The outline is a bridged reading of the part’s silhouette',
  }),

  define({
    key: 'surfaceRadius',
    label: 'surface blend radius',
    group: SURFACE,
    quantity: 'length',
    op: 'lte',
    start: SMALL,
    signed: true,
    path: ['facts.filletRadius', 'facts.three.filletRadius'],
    kinds: ['Three', 'Chamfer'],
    hint: 'Signed by which way it turns: positive over an edge, negative into a corner',
  }),
  define({
    key: 'maxStepdown',
    label: 'largest stepdown',
    group: SURFACE,
    quantity: 'length',
    op: 'lte',
    start: SMALL,
    path: ['facts.maxStepdown', 'facts.three.maxStepdown'],
    kinds: ['Three', 'Chamfer'],
    hint: 'The deepest cut taken in one pass down it',
  }),
  define({
    key: 'cuspHeight',
    label: 'finish scallop',
    group: SURFACE,
    quantity: 'length',
    op: 'lte',
    start: { mm: 0.01, inch: 0.0127 },
    path: ['facts.surfaceFinishCuspHeight', 'facts.three.surfaceFinishCuspHeight'],
    kinds: ['Three', 'Chamfer'],
    hint: 'How much scallop the finishing pass may leave',
  }),
  define({
    key: 'surfaceSharpCorner',
    label: 'a sharp surface corner',
    group: SURFACE,
    quantity: 'flag',
    op: 'gte',
    start: 0,
    path: ['facts.hasSharpCorner', 'facts.three.hasSharpCorner'],
    kinds: ['Three', 'Chamfer'],
    hint: 'It includes a sharp corner a tool must respect',
  }),
  define({
    key: 'ballOnly',
    label: 'ball-only finishing',
    group: SURFACE,
    quantity: 'flag',
    op: 'gte',
    start: 0,
    path: ['facts.useOnlyBallToolsForFinish', 'facts.three.useOnlyBallToolsForFinish'],
    kinds: ['Three', 'Chamfer'],
    hint: 'Only ball tools suit the finishing pass',
  }),
  define({
    key: 'fitCornerRadius',
    label: 'surface corner radius',
    group: SURFACE,
    quantity: 'length',
    op: 'lte',
    start: SMALL,
    path: ['facts.toolFit.cornerRadius', 'facts.three.toolFit.cornerRadius'],
    kinds: ['Three', 'Chamfer'],
    hint: 'The corner radius its shape admits',
  }),
  define({
    key: 'fitToolDiameter',
    label: 'largest tool its shape admits',
    group: SURFACE,
    quantity: 'length',
    op: 'lte',
    start: TOOL,
    path: ['facts.toolFit.toolDiameter', 'facts.three.toolFit.toolDiameter'],
    kinds: ['Three', 'Chamfer'],
    hint: 'The widest full-diameter tool its shape admits',
  }),
  define({
    key: 'fitToolBottom',
    label: 'largest tool bottom its shape admits',
    group: SURFACE,
    quantity: 'length',
    op: 'lte',
    start: TOOL,
    path: ['facts.toolFit.toolBottomDiameter', 'facts.three.toolFit.toolBottomDiameter'],
    kinds: ['Three', 'Chamfer'],
    hint: 'The widest tool bottom its shape admits',
  }),

  define({
    key: 'undercutDepth',
    label: 'undercut depth',
    group: UNDERCUT,
    quantity: 'length',
    op: 'gte',
    start: { mm: 5, inch: 5.08 },
    path: 'facts.undercutDepth',
    kinds: ['Tslot'],
    hint: 'How far the groove runs back from its opening',
  }),
  define({
    key: 'maxEntry',
    label: 'largest tool that gets in',
    group: UNDERCUT,
    quantity: 'length',
    op: 'lte',
    start: { mm: 6, inch: 6.35 },
    path: 'facts.maxEntryCd',
    kinds: ['Tslot'],
    hint: 'The widest tool that can come down through the opening above it',
  }),
  define({
    key: 'closedSlot',
    label: 'a closed outline',
    group: UNDERCUT,
    quantity: 'flag',
    op: 'gte',
    start: 0,
    path: 'facts.isClosed',
    kinds: ['Tslot'],
    hint: 'Its walls close on themselves in plan view',
  }),
  define({
    key: 'externalUndercut',
    label: 'an external undercut',
    group: UNDERCUT,
    quantity: 'flag',
    op: 'gte',
    start: 0,
    path: 'facts.isExternal',
    kinds: ['Tslot', 'Dovetail'],
    hint: 'It runs around material standing in it, or runs out somewhere',
  }),
  define({
    key: 'taper',
    label: 'dovetail taper',
    group: UNDERCUT,
    quantity: 'angle',
    op: 'gte',
    start: 45,
    path: 'facts.taperDeg',
    kinds: ['Dovetail'],
    hint: 'Between the overhanging wall and the tool axis',
  }),
  define({
    key: 'floorWidth',
    label: 'dovetail floor width',
    group: UNDERCUT,
    quantity: 'length',
    op: 'lte',
    start: { mm: 6, inch: 6.35 },
    path: 'facts.floorWidth',
    kinds: ['Dovetail'],
    hint: 'The widest clearance over the floor',
  }),
  define({
    key: 'topOpening',
    label: 'dovetail top opening',
    group: UNDERCUT,
    quantity: 'length',
    op: 'lte',
    start: { mm: 6, inch: 6.35 },
    path: 'facts.topOpeningWidth',
    kinds: ['Dovetail'],
    hint: 'The clearance through the opening at its top',
  }),
  define({
    key: 'bottomOpening',
    label: 'dovetail bottom opening',
    group: UNDERCUT,
    quantity: 'length',
    op: 'lte',
    start: { mm: 6, inch: 6.35 },
    path: 'facts.bottomOpeningWidth',
    kinds: ['Dovetail'],
    hint: 'The clearance just above the floor, under the overhangs',
  }),
  define({
    key: 'invalidDovetail',
    label: 'unmeasured geometry',
    group: UNDERCUT,
    quantity: 'flag',
    op: 'gte',
    start: 0,
    path: 'facts.isInvalidGeometry',
    kinds: ['Dovetail'],
    hint: 'A width could not be measured, so no tool is offered on its figures',
  }),
]

/* ---------- Subjects ---------- */

export interface DfmSubject {
  value: string
  /** Plural, as the rule sentence starts: "Holes", "Undercut T-slots". */
  label: string
  /** "Groups" or "Feature types", for choosing. */
  group: string
  /** The datasheet kinds its features report; every kind when left out. */
  kinds?: readonly FactsKind[]
}

const HOLE_KINDS: readonly FactsKind[] = ['Hole']
const POCKET_KINDS: readonly FactsKind[] = ['Pocket']
const SURFACE_KINDS: readonly FactsKind[] = ['Three']
const UNDERCUT_KINDS: readonly FactsKind[] = ['Tslot', 'Dovetail']

/** The broad sorts, as the quoting app offers them. */
const GROUP_SUBJECTS: readonly DfmSubject[] = [
  { value: 'any', label: 'Any feature', group: 'Groups' },
  { value: 'milled', label: 'Milled features', group: 'Groups' },
  { value: 'drilled', label: 'Drilled features', group: 'Groups', kinds: HOLE_KINDS },
  { value: 'hole', label: 'Holes', group: 'Groups', kinds: HOLE_KINDS },
  { value: 'threadedHole', label: 'Threaded holes', group: 'Groups', kinds: HOLE_KINDS },
  { value: 'pocket', label: 'Pockets', group: 'Groups', kinds: POCKET_KINDS },
  { value: 'slot', label: 'Slots', group: 'Groups', kinds: UNDERCUT_KINDS },
  { value: 'undercut', label: 'Undercuts', group: 'Groups', kinds: UNDERCUT_KINDS },
  { value: 'boss', label: 'Bosses', group: 'Groups', kinds: ['Boss'] },
  { value: 'countersink', label: 'Countersinks', group: 'Groups', kinds: ['Hole', 'Chamfer'] },
  { value: 'profile', label: 'Profiles', group: 'Groups', kinds: ['Profile'] },
  { value: 'contour', label: '3D surfaces', group: 'Groups', kinds: SURFACE_KINDS },
  { value: 'wall', label: 'Walls', group: 'Groups', kinds: ['Wall'] },
  { value: 'face', label: 'Faces', group: 'Groups', kinds: ['Face', 'Three'] },
  { value: 'fillet', label: 'Fillets', group: 'Groups', kinds: SURFACE_KINDS },
  { value: 'chamfer', label: 'Chamfers', group: 'Groups', kinds: ['Chamfer'] },
]

/** Every feature type the Engine reports (the report's `featureType`), one subject each. */
const TYPES: readonly [type: string, label: string, kinds: readonly FactsKind[]][] = [
  ['through_hole', 'Through holes', HOLE_KINDS],
  ['blind_hole', 'Blind holes', HOLE_KINDS],
  ['filleted_blind_hole', 'Filleted blind holes', HOLE_KINDS],
  ['tapered_through_hole', 'Tapered through holes', HOLE_KINDS],
  ['threaded_through_hole', 'Threaded through holes', HOLE_KINDS],
  ['threaded_blind_hole', 'Threaded blind holes', HOLE_KINDS],
  ['synthetic_hole', 'Synthetic holes', HOLE_KINDS],
  ['thread', 'Threads', HOLE_KINDS],
  ['sink', 'Countersinks', ['Hole', 'Chamfer']],
  ['back_sink', 'Back countersinks', ['Hole', 'Chamfer']],
  ['pocket', 'Closed pockets', POCKET_KINDS],
  ['open_pocket', 'Open pockets', POCKET_KINDS],
  ['through_pocket', 'Through pockets', POCKET_KINDS],
  ['filleted_pocket', 'Filleted pockets', POCKET_KINDS],
  ['filleted_open_pocket', 'Filleted open pockets', POCKET_KINDS],
  ['boss', 'Bosses', ['Boss']],
  ['filleted_boss', 'Filleted bosses', ['Boss']],
  ['wall', 'Wall features', ['Wall']],
  ['face', 'Face features', ['Face']],
  ['slanted_face', 'Slanted faces', ['Face', 'Three']],
  ['profile', 'Profiles', ['Profile']],
  ['chamfer', 'Chamfer features', ['Chamfer']],
  ['back_chamfer', 'Back chamfers', ['Chamfer']],
  ['fillet', 'Fillet features', SURFACE_KINDS],
  ['inner_fillet', 'Inner fillets', SURFACE_KINDS],
  ['outer_fillet', 'Outer fillets', SURFACE_KINDS],
  ['contour_surface', 'Contour surfaces', SURFACE_KINDS],
  ['u_slot', 'U-slots', UNDERCUT_KINDS],
  ['undercut_wall', 'Undercut walls', UNDERCUT_KINDS],
  ['undercut_tslot', 'Undercut T-slots', ['Tslot']],
  ['undercut_filleted_tslot', 'Filleted undercut T-slots', ['Tslot']],
  ['undercut_dovetail', 'Undercut dovetails', ['Dovetail']],
  ['undercut_filleted_dovetail', 'Filleted undercut dovetails', ['Dovetail']],
]

/** A subject naming one feature type exactly: `type:` and the report's `featureType`. */
export const TYPE_SUBJECT = 'type:'

export const FEATURE_SUBJECTS: readonly DfmSubject[] = [
  ...GROUP_SUBJECTS,
  ...TYPES.map(([type, label, kinds]) => ({
    value: `${TYPE_SUBJECT}${type}`,
    label,
    group: 'Feature types',
    kinds,
  })),
]

/*
 * The short lists: what a rule is most often about, and what it most often
 * measures, in the order they are offered. The viewer is for a quick look,
 * so these come first and alone; everything else is one "More…" away.
 */

/** The common subjects, one list — broad groups and the few types worth naming alone. */
export const QUICK_SUBJECTS: readonly string[] = [
  'any',
  'milled',
  'hole',
  'threadedHole',
  'countersink',
  'pocket',
  'boss',
  'wall',
  'face',
  'profile',
  'undercut',
  'fillet',
  'chamfer',
  'contour',
]

/** The measures a quick look is about. */
export const QUICK_METRICS: readonly string[] = [
  'present',
  'ld',
  'featureLd',
  'depthBelowTop',
  'featureDepth',
  'diameter',
  'cornerRadius',
  'maxTool',
  'pinchDiameter',
  'sharpCorner',
  'surfaceArea',
  'floorFillet',
  'threadPitch',
  'chamferAngle',
  'undercutDepth',
  'tilted',
]

export const subjectInfo = (value: string): DfmSubject | undefined =>
  FEATURE_SUBJECTS.find((each) => each.value === value)

export const metricInfo = (key: string): DfmMetric | undefined =>
  FEATURE_METRICS.find((each) => each.key === key)

/**
 * The measures a subject's features can have: those every kind reports, and
 * those its kinds do. Any feature, of whatever kind, can have any of them.
 */
export const metricsForSubject = (subject: string): readonly DfmMetric[] => {
  const kinds = subjectInfo(subject)?.kinds
  if (!kinds) return FEATURE_METRICS
  return FEATURE_METRICS.filter(
    (each) => !each.kinds || each.kinds.some((kind) => kinds.includes(kind)),
  )
}
