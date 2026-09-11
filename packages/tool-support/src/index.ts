/**
 * The cutting-tool domain: what a tool, a holder, a collet and an assembly
 * _are_, and the arithmetic that follows from them.
 *
 * This package takes no runtime dependencies and imports no React, no DOM, no
 * `fs` and no Toolpath SDK. Everything else that speaks about cutting tools
 * depends on it and it depends on nothing — which is what lets a Node ingest
 * script, a server route and a React renderer share one answer instead of three.
 *
 * ## Why it exists
 *
 * A scraper produced tool data, a drawing consumed it, and every application in
 * between re-derived what a tool assembly is. The same fact was declared three
 * times over — two names for one unit constant, three for one unit vocabulary,
 * three provenance types, two `PROFILES_VERSION`s compared against each other
 * under an alias, and three shapes called "holder" of which no two agreed on
 * which fields exist.
 *
 * That is not a tidiness complaint. How far a tool stands out of its holder was
 * computed in four unconnected places and disagreed by a factor of two on an
 * ordinary tool: a details table printed one number and the drawing beside it
 * drew another, and the dimension line ran past the holder nose into the holder
 * body. It was fixed inside one application, so the next consumer of the same
 * two packages reproduces it from scratch. The quantity that went wrong is a
 * pure function of the tool, the collet and a shop's policy, and it had no home.
 *
 * ## What is here
 *
 * The vocabulary and the contracts: units, provenance, the geometry dictionary,
 * the form list, the holder union, the collet, the profile, the reach curve and
 * what a feature demands of a tool. Everything is a readonly interface or a pure
 * function over one — no classes, deliberately, because a class loses structural
 * typing at a package boundary and `instanceof` breaks across duplicate installs.
 *
 * On them, the arithmetic that had been written more than once: {@link hasNeck}
 * and {@link shankOf}, {@link heightAt} and {@link belowGageLine} each had two
 * copies with a note beside each saying the two must agree and nothing watching
 * whether they did — and {@link stickoutRange}, which had four.
 *
 * With those, the decisions that follow from them: what holds what
 * ({@link holderTakesTool}, {@link gripRanges}), what a shop keeps clamped
 * ({@link clampWanted}), whether a tool cuts a feature ({@link fitAgainst}),
 * whether the whole stack clears the material around it ({@link clearance},
 * {@link assemblyAgainst}), and the feature in section ({@link sectionOutline})
 * that draws what the sweep checked.
 */

export {
  MM_PER_INCH,
  UNIT_ABBREVIATION,
  UNIT_SYSTEMS,
  convertArea,
  convertLength,
  decimalsFor,
  formatArea,
  formatLength,
  type UnitSystem,
} from './units.js'

export { PROVENANCE, type Provenance, type ProvenanceMap } from './provenance.js'

export {
  GEOMETRY_FIELDS,
  convertGeometry,
  geometryField,
  isLengthField,
  type Geometry,
  type GeometryCode,
  type GeometryField,
  type GeometryUnit,
} from './geometry.js'

export {
  MILLING_FORMS,
  TAP_FORMS,
  TOOL_FORMS,
  isTapForm,
  isToolForm,
  type ToolForm,
  type ToolFormEntry,
} from './forms.js'

export {
  THREAD_METHODS,
  hasNeck,
  isThreadMethod,
  shankOf,
  type Shank,
  type ThreadMethod,
  type Tool,
} from './tool.js'

export {
  PROFILES_VERSION,
  belowGageLine,
  type HolderProfile,
  type ProfileDatum,
  type ProfilePoint,
} from './profile.js'

export {
  canHold,
  colletFitsHolder,
  defaultStickout,
  gripRanges,
  gripsAnyShank,
  gripsShank,
  holdBand,
  holderTakesTool,
  isHolderProfile,
  maxStickout,
  stickoutLimits,
  type Assembly,
  type Clamping,
  type Collet,
  type GripRanges,
  type HoldBand,
  type Holder,
} from './holding.js'

export {
  DEFAULT_CLAMPING,
  clampShortfall,
  clampWanted,
  headLength,
  heldDiameter,
  type ClampingRule,
} from './clamping.js'

export {
  DEFAULT_STICKOUT_POLICY,
  HELD_SHARE,
  minStickout,
  setupStickout,
  stickoutCeiling,
  stickoutRange,
  type StickoutLimit,
  type StickoutPolicy,
  type StickoutRange,
  type StickoutRequest,
  type StickoutTool,
} from './stickout.js'

export { heightAt, type ReachCurve } from './reach.js'

export type { FeatureDemand } from './demand.js'

export { DRILLING_FORMS, fitAgainst, fitTools, type FitFailure, type ToolFit } from './fit.js'

export {
  ASSEMBLY_PARTS,
  NO_MARGINS,
  SILHOUETTE_PARTS,
  type AssemblyPart,
  type Margins,
  type Silhouette,
  type SilhouettePart,
} from './parts.js'

export { materialProfile, type OutlinePoint } from './material.js'

export {
  clearance,
  describeCollision,
  holderSilhouette,
  toolCollisions,
  toolSilhouette,
  type Clearance,
  type Collision,
  type SweptAssembly,
} from './clearance.js'

export {
  FLOOR_BAND,
  REACH,
  sectionOutline,
  type FeatureSection,
  type Section,
  type SectionKind,
  type SectionPoint,
} from './section.js'

export { NOT_MODELLED, assemblyAgainst, type AssemblyFit } from './assembly-fit.js'
