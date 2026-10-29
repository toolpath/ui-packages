/**
 * `@toolpath/dfm` — the DFM rules and the checker, with no React and no DOM:
 * what a rule is, how a part's features break it, and the rule-set file it is
 * shared in. The root entry and `/model` are this one barrel.
 *
 * A named list, not `export *`: everything here is public for good once it
 * ships, so a helper becomes public only when an app needs it. The rule list,
 * feature panel and reach chart in `@toolpath/ui` count as an app: the rule
 * editing, field and unit helpers here are what those views read.
 */

export { brokenRules, featureColor, type BrokenRule } from './broken-rules.js'
export { featureTypeLabel, hitFigure } from './dfm-explain.js'
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
  invalidFeatureTags,
  isNoReading,
  unplannableFeatureTags,
  type FeatureSheet,
  type FeatureSheets,
  type FeatureThreading,
  type FeatureUndercut,
} from './feature-sheet.js'
export { MAX_DATASHEET_FIELDS, datasheetFields, type FeatureRecord } from './feature-record.js'
export { dfmFeatures, type DfmFeature, type ReportFeature } from './geometry.js'
export { directionLabel } from './direction-label.js'
export { featureRows, sameDepth, type FeatureRow } from './hole-groups.js'
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
  FILE_KIND,
  llmRulePrompt,
  parseRuleSetFile,
  serializeRuleSet,
  type RuleSetFile,
} from './rule-set-file.js'
export {
  checkTurnedPart,
  turnedStretches,
  type TurnedReportFeature,
  type TurnedStretch,
} from './turned-check.js'
export { TURNING_RULES, turnedTypeLabel, type TurnedFactsKind } from './turning-metrics.js'
export { lengthValue, unitLabel, type Units } from './units.js'
export {
  bodiesByRule,
  combineBodyChecks,
  featureSeverities,
  featuresByType,
  ruleSeverity,
  type BodyDfmCheck,
  type BodyDfmFeature,
  type BodyDfmViolation,
  type BodyDfmSummary,
  type DfmSeverity,
} from './body-checks.js'
