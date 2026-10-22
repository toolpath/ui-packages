/**
 * `@toolpath/dfm` — the DFM rules and the checker, with no React and no DOM:
 * what a rule is, how a part's features break it, and the rule-set file it is
 * shared in. The root entry and `/model` are this one barrel.
 *
 * A named list, not `export *`: everything here is public for good once it
 * ships, so a helper becomes public only when an app needs it. The rule list,
 * feature panel and reach chart in `@toolpath/ui` count as an app: the rule
 * editing, field and unit helpers here are what those views read, and so are
 * their data types, pickers' choices, fold store and section drawing's
 * geometry, which a view in another renderer reads the same way.
 */

export {
  brokenRules,
  featureColor,
  ruleListOrder,
  type BrokenRule,
  type ListedRule,
} from './broken-rules.js'
export { featureTypeLabel, hitFigure } from './dfm-explain.js'
export { comparisonRows, faceLetter, type ComparisonRow } from './comparison-rows.js'
export {
  checkPart,
  withSurroundedFaces,
  type DfmCheck,
  type DfmHit,
  type DfmSources,
  type RuleResult,
} from './dfm-flags.js'
export {
  MILLING_RULES,
  PRESENCE_METRIC,
  QUICK_SUBJECTS,
  takesNumber,
  type DfmMetric,
  type DfmOp,
  type DfmQuantity,
  type DfmSubject,
  type FactsKind,
  type RuleProcess,
  type RuleVocabulary,
} from './dfm-metrics.js'
export {
  CRITICAL_COLOR,
  OPS,
  RANGE_HIGHS,
  RANGE_LOWS,
  RULE_COLORS,
  WARNING_COLOR,
  compareColors,
  describeRule,
  formatMeasured,
  fromField,
  highOf,
  lowOf,
  makeRule,
  metricInfo,
  metricsForSubject,
  opSymbol,
  parseRules,
  quantityUnit,
  subjectLabel,
  toField,
  upperOf,
  withMetric,
  withOp,
  withSubject,
  type DfmRule,
  type RangeHigh,
  type RangeLow,
} from './dfm-rules.js'
export {
  featureMeasurements,
  isSurfaceType,
  maxBallDiameter,
  type Measurement,
  type SurfaceToolKind,
} from './feature-details.js'
export {
  PINCH_TOOL_MM,
  featureSheet,
  isNoReading,
  type FeatureSheet,
  type FeatureSheets,
  type FeatureThreading,
  type FeatureUndercut,
} from './feature-sheet.js'
export type {
  CandidateRow,
  Choice,
  ChoiceGroup,
  Choices,
  ComparedFace,
  ComparedFaceList,
  DfmRules,
  FeatureIdentity,
  Hovered,
  InspectedFace,
} from './view-types.js'
export { storageFolds, type FoldOptions, type FoldStorage, type FoldStore } from './fold-store.js'
export { MAX_DATASHEET_FIELDS, datasheetFields, type FeatureRecord } from './feature-record.js'
export { dfmFeatures, type DfmFeature, type ReportFeature } from './geometry.js'
export { directionLabel } from './direction-label.js'
export { featureRows, sameDepth, type FeatureRow } from './hole-groups.js'
export {
  LOW_SYMBOLS,
  ONE_SIDED_CHOICES,
  OP_TITLES,
  comparisonChoices,
  rangeEnd,
  rangeHighChoices,
  rangeLowChoices,
  type OpLabel,
} from './ops.js'
export { metricChoices, subjectChoices } from './options.js'
export { readPinch, type ClearanceFit, type FeaturePinch, type PinchDisc } from './pinch.js'
export { pinchLabel, pinchMark, type PinchMark } from './pinch-mark.js'
export { placePinchTool, type FaceTriangles, type PlacedTool, type Vec3 } from './tool-frame.js'
export {
  featureProfile,
  peakHeight,
  readReachCurve,
  runStart,
  trimmedCurve,
  type FeatureAcross,
  type FeatureProfile,
  type ReachCurve,
} from './reach.js'
export {
  offsetUnder,
  readingAt,
  readingLabelX,
  readingText,
  type ReachReading,
} from './reach-reading.js'
export {
  FILE_KIND,
  importError,
  importNote,
  llmRulePrompt,
  parseRuleSetFile,
  serializeRuleSet,
  type RuleSetFile,
  type RuleSetRead,
} from './rule-set-file.js'
export { sectionGeometry, type SectionGeometry } from './section-geometry.js'
export {
  AXIS_LABEL_HALF_PX,
  DEPTH_WORD_PX,
  FLOOR_STRIP,
  READ_CHAR_PX,
  READ_INSET,
  SECTION_LABEL,
  SECTION_PAD,
  SECTION_TYPE,
  featureBreak,
  type Riser,
} from './section-layout.js'
export {
  checkTurnedPart,
  turnedStretches,
  type TurnedReportFeature,
  type TurnedStretch,
} from './turned-check.js'
export { TURNING_RULES, turnedTypeLabel, type TurnedFactsKind } from './turning-metrics.js'
export { lengthValue, unitLabel, type Units } from './units.js'
