/**
 * `@toolpath/dfm/model` — the DFM rules and the checker, with no React and
 * no DOM: what a rule is, how a part's features break it, and the rule-set
 * file it is shared in.
 *
 * A named list, not `export *`: everything here is public for good once it
 * ships, so a helper becomes public only when an app needs it.
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
export type { DfmMetric, DfmOp, DfmQuantity, FactsKind } from './dfm-metrics.js'
export {
  CRITICAL_COLOR,
  RULE_COLORS,
  WARNING_COLOR,
  compareColors,
  describeRule,
  makeRule,
  parseRules,
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
} from './feature-sheet.js'
export type { FeatureRecord } from './feature-record.js'
export { dfmFeatures, type DfmFeature, type ReportFeature } from './geometry.js'
export { sameDepth } from './hole-groups.js'
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
export type { Units } from './units.js'
