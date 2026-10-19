import { PRESENCE_METRIC, TYPE_SUBJECT, define } from './dfm-metrics.js'
import type { DfmMetric, DfmSubject, RuleVocabulary } from './dfm-metrics.js'
import type { DfmFeature } from './geometry.js'

/*
 * What a turning rule can test, and which features it can test it on: the
 * figures the Engine's turning datasheet reports (API 1.29.0,
 * `TurningDatasheet` and its per-kind `facts`), a few worked out from them —
 * diameters from radii, L/D from the end a feature is cut from — and "any
 * size". Turning is experimental in the API, so every figure is read
 * defensively (`turned-check.ts`): a field it does not find is no figure,
 * never an error.
 */

/** A turning datasheet's `facts.kind`, and `Unknown` for a stretch the Engine could not name. */
export type TurnedFactsKind =
  | 'AxialHole'
  | 'Face'
  | 'FaceGroove'
  | 'FaceProfile'
  | 'IdGroove'
  | 'IdProfile'
  | 'IdThread'
  | 'OdGroove'
  | 'OdProfile'
  | 'OdThread'
  | 'Unknown'

const OD_KINDS: readonly TurnedFactsKind[] = ['OdProfile', 'OdGroove', 'OdThread']
/** The kinds of inside work: bored, grooved or threaded in a hole, not the hole itself. */
export const ID_KINDS: readonly TurnedFactsKind[] = ['IdProfile', 'IdGroove', 'IdThread']
const FACE_KINDS: readonly TurnedFactsKind[] = ['Face', 'FaceProfile', 'FaceGroove']
const GROOVE_KINDS: readonly TurnedFactsKind[] = ['OdGroove', 'IdGroove', 'FaceGroove']
const THREAD_KINDS: readonly TurnedFactsKind[] = ['OdThread', 'IdThread', 'AxialHole']
const PROFILE_KINDS: readonly TurnedFactsKind[] = ['OdProfile', 'IdProfile', 'FaceProfile']
const HOLE_KINDS: readonly TurnedFactsKind[] = ['AxialHole']

const SIZE = 'Size'
const GROOVES = 'Grooves'
const THREADS = 'Threads'
const HOLES = 'Holes'
const TOOLS = 'Tool access'
const TOLERANCE = 'Tolerance'

const TURNING_METRICS: readonly DfmMetric[] = [
  PRESENCE_METRIC,

  define({
    key: 'maxDiameter',
    label: 'diameter',
    group: SIZE,
    quantity: 'length',
    op: 'gte',
    start: { mm: 100, inch: 101.6 },
    hint: 'Its largest diameter: what the lathe must swing, or the bar it is cut from',
  }),
  define({
    key: 'minDiameter',
    label: 'smallest diameter',
    group: SIZE,
    quantity: 'length',
    op: 'lte',
    start: { mm: 6, inch: 6.35 },
    kinds: ['OdProfile', 'IdProfile', 'OdGroove', 'IdGroove', 'OdThread', 'IdThread', 'AxialHole'],
    hint: 'Its smallest diameter: how thin the outside gets, or how narrow a bore. Not for faces',
  }),
  define({
    key: 'length',
    label: 'length along the axis',
    group: SIZE,
    quantity: 'length',
    op: 'gte',
    start: { mm: 50, inch: 50.8 },
    kinds: [
      'AxialHole',
      'FaceGroove',
      'FaceProfile',
      'IdGroove',
      'IdProfile',
      'IdThread',
      'OdGroove',
      'OdProfile',
      'OdThread',
      'Unknown',
    ],
    hint: 'How far it runs along the spindle axis. None for a flat face',
  }),
  define({
    key: 'ld',
    label: 'L/D from the end',
    group: SIZE,
    quantity: 'ratio',
    op: 'gte',
    start: 4,
    kinds: ['AxialHole', 'IdProfile', 'IdGroove', 'IdThread'],
    hint: 'How far in a boring bar or drill reaches over the bore it goes through: a hole’s depth over its narrowest step; inside work, from the end it is cut from to its far end, over its entry diameter. Cut from both ends, the easier end',
  }),

  define({
    key: 'grooveWidth',
    label: 'groove width',
    group: GROOVES,
    quantity: 'length',
    op: 'lte',
    start: { mm: 1.5, inch: 1.5875 },
    kinds: GROOVE_KINDS,
    hint: 'How wide the groove is: the narrowest insert that cuts it in one plunge',
  }),
  define({
    key: 'grooveDepth',
    label: 'groove depth',
    group: GROOVES,
    quantity: 'length',
    op: 'gte',
    start: { mm: 5, inch: 5.08 },
    kinds: GROOVE_KINDS,
    hint: 'How far the groove goes in: radially on the outside or in a bore, along the axis in a face',
  }),
  define({
    key: 'grooveAspect',
    label: 'groove depth/width',
    group: GROOVES,
    quantity: 'ratio',
    op: 'gte',
    start: 3,
    kinds: GROOVE_KINDS,
    hint: 'Its depth over its width: how far a grooving insert reaches past its own width',
  }),

  define({
    key: 'threadPitch',
    label: 'thread pitch',
    group: THREADS,
    quantity: 'length',
    op: 'lte',
    start: { mm: 0.5, inch: 0.4233 },
    kinds: THREAD_KINDS,
    hint: 'The distance between thread crests (0.423 mm is 60 TPI)',
  }),
  define({
    key: 'threadDiameter',
    label: 'thread diameter',
    group: THREADS,
    quantity: 'length',
    op: 'lte',
    start: { mm: 6, inch: 6.35 },
    kinds: THREAD_KINDS,
    hint: 'The catalog thread’s nominal major diameter. None where the catalog lists no thread for it',
  }),
  define({
    key: 'threadDepth',
    label: 'thread depth',
    group: THREADS,
    quantity: 'length',
    op: 'gte',
    start: { mm: 1, inch: 1.27 },
    kinds: ['OdThread', 'IdThread'],
    hint: 'How deep the thread form is cut',
  }),

  define({
    key: 'holeDiameter',
    label: 'hole diameter',
    group: HOLES,
    quantity: 'length',
    op: 'lte',
    start: { mm: 3, inch: 3.175 },
    kinds: HOLE_KINDS,
    hint: 'Its narrowest step: the drill it is drilled with',
  }),
  define({
    key: 'holeDepth',
    label: 'hole depth',
    group: HOLES,
    quantity: 'length',
    op: 'gte',
    start: { mm: 50, inch: 50.8 },
    kinds: HOLE_KINDS,
    hint: 'How far it runs along the axis',
  }),
  define({
    key: 'holeSteps',
    label: 'number of steps',
    group: HOLES,
    quantity: 'count',
    op: 'gte',
    start: 2,
    kinds: HOLE_KINDS,
    hint: 'How many diameters it steps through, from the mouth inward',
  }),
  define({
    key: 'flatBottom',
    label: 'a flat bottom',
    group: HOLES,
    quantity: 'flag',
    op: 'gte',
    start: 0,
    kinds: HOLE_KINDS,
    hint: 'A blind hole that ends flat rather than in a drill point',
  }),

  define({
    key: 'cornerRadius',
    label: 'inside corner radius',
    group: TOOLS,
    quantity: 'length',
    op: 'lte',
    start: { mm: 0.4, inch: 0.3969 },
    hint: 'The radius of its tightest concave corner, which an insert’s nose radius must fit — zero when sharp. None where it has no inside corner',
  }),
  define({
    key: 'sharpCorner',
    label: 'a sharp inside corner',
    group: TOOLS,
    quantity: 'flag',
    op: 'gte',
    start: 0,
    hint: 'A concave corner with no radius, which no insert makes',
  }),
  define({
    key: 'entryDiameter',
    label: 'entry diameter',
    group: TOOLS,
    quantity: 'length',
    op: 'lte',
    start: { mm: 10, inch: 9.525 },
    hint: 'For a feature in a hole, the narrowest diameter a bar passes on its way in from the end it is cut from. None where nothing stands between',
  }),
  define({
    key: 'axialTool',
    label: 'an axially mounted tool',
    group: TOOLS,
    quantity: 'flag',
    op: 'gte',
    start: 0,
    hint: 'Only a tool mounted along the spindle axis reaches it: a drill, or a face-grooving tool',
  }),

  define({
    key: 'tolerance',
    label: 'tolerance',
    group: TOLERANCE,
    quantity: 'length',
    op: 'lte',
    start: { mm: 0.01, inch: 0.0127 },
    hint: 'The most it may deviate from the model',
  }),
]

/** The broad sorts of turned feature. */
const GROUP_SUBJECTS: readonly DfmSubject[] = [
  { value: 'any', label: 'Any turned feature', group: 'Groups' },
  { value: 'od', label: 'Outside (OD) features', group: 'Groups', kinds: OD_KINDS },
  { value: 'id', label: 'Inside (ID) features', group: 'Groups', kinds: ID_KINDS },
  { value: 'face', label: 'End-face features', group: 'Groups', kinds: FACE_KINDS },
  { value: 'groove', label: 'Grooves', group: 'Groups', kinds: GROOVE_KINDS },
  { value: 'thread', label: 'Threads', group: 'Groups', kinds: THREAD_KINDS },
  { value: 'hole', label: 'Axial holes', group: 'Groups', kinds: HOLE_KINDS },
  { value: 'throughHole', label: 'Through holes', group: 'Groups', kinds: HOLE_KINDS },
  { value: 'blindHole', label: 'Blind holes', group: 'Groups', kinds: HOLE_KINDS },
  { value: 'threadedHole', label: 'Threaded holes', group: 'Groups', kinds: HOLE_KINDS },
  { value: 'profile', label: 'Profiles', group: 'Groups', kinds: PROFILE_KINDS },
]

/** Every turned feature type the Engine reports (`featureType`), one subject each. */
const TYPES: readonly [type: string, label: string, kind: TurnedFactsKind][] = [
  ['od_profile', 'OD profiles', 'OdProfile'],
  ['od_groove', 'OD grooves', 'OdGroove'],
  ['od_thread', 'OD threads', 'OdThread'],
  ['face', 'Faces', 'Face'],
  ['face_profile', 'Face profiles', 'FaceProfile'],
  ['face_groove', 'Face grooves', 'FaceGroove'],
  ['axial_hole', 'Axial hole features', 'AxialHole'],
  ['id_profile', 'ID profiles', 'IdProfile'],
  ['id_groove', 'ID grooves', 'IdGroove'],
  ['id_thread', 'ID threads', 'IdThread'],
  ['unknown', 'Unknown features', 'Unknown'],
]

const TURNING_SUBJECTS: readonly DfmSubject[] = [
  ...GROUP_SUBJECTS,
  ...TYPES.map(([type, label, kind]) => ({
    value: `${TYPE_SUBJECT}${type}`,
    label,
    group: 'Feature types',
    kinds: [kind],
  })),
]

/** The common turning subjects, in the order they are offered. */
const QUICK_TURNING_SUBJECTS: readonly string[] = [
  'any',
  'od',
  'id',
  'face',
  'groove',
  'thread',
  'hole',
]

/** The measures a quick look at a turned part is about. */
const QUICK_TURNING_METRICS: readonly string[] = [
  'present',
  'maxDiameter',
  'length',
  'ld',
  'grooveWidth',
  'grooveDepth',
  'threadPitch',
  'holeDiameter',
  'holeDepth',
  'cornerRadius',
  'sharpCorner',
  'entryDiameter',
]

/** The words a turned type's abbreviations are written in capitals. */
const CAPITALS: Readonly<Record<string, string>> = { od: 'OD', id: 'ID' }

/**
 * `od_groove` as `OD groove`, `axial_hole` as `Axial hole`. The Engine's
 * turned feature types are open-ended snake case, so a type it adds later
 * reads as its words.
 */
export const turnedTypeLabel = (featureType: string): string => {
  const words = featureType
    .split('_')
    .filter((word) => word !== '')
    .map((word) => CAPITALS[word] ?? word)
    .join(' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/**
 * Which ends a stretch is cut from, as words to follow its name or
 * "Machined": `from both ends`. Its copies' approaches where it carries them
 * (`turnedStretches`), else its direction along the axis.
 */
const endLabel = (feature: Pick<DfmFeature, 'machiningDirection'>): string => {
  const approaches: readonly unknown[] =
    'approaches' in feature && Array.isArray(feature.approaches)
      ? feature.approaches
      : feature.machiningDirection.z > 0
        ? ['PlusZ']
        : feature.machiningDirection.z < 0
          ? ['MinusZ']
          : []
  const plus = approaches.includes('PlusZ')
  const minus = approaches.includes('MinusZ')
  return plus && minus
    ? 'from both ends'
    : plus
      ? 'from the +Z end'
      : minus
        ? 'from the −Z end'
        : ''
}

/** Turning rules: the measures and subjects of the Engine's turned features. */
export const TURNING_RULES: RuleVocabulary = {
  process: 'turning',
  metrics: TURNING_METRICS,
  subjects: TURNING_SUBJECTS,
  quickSubjects: QUICK_TURNING_SUBJECTS,
  quickMetrics: QUICK_TURNING_METRICS,
  fallbackMetric: PRESENCE_METRIC,
  featureLabel: (feature) => ({
    name: turnedTypeLabel(feature.featureType),
    detail: endLabel(feature),
  }),
  considerationsTitle: 'Turning considerations',
  fileName: 'dfm-turning-rules.json',
}
