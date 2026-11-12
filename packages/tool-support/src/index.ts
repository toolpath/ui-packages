/**
 * The cutting-tool domain: what a tool, a holder, a collet and an assembly
 * _are_, and the arithmetic that follows from them.
 *
 * This package takes no runtime dependency but `zod`, in which the shared tool
 * record is stated, and imports no React, no DOM, no `fs` and no Toolpath SDK.
 * Everything else that speaks about cutting tools depends on it and it depends
 * on none of them — which is what lets a Node ingest script, a server route and
 * a React renderer share one answer instead of three.
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
 * The record — a tool, a holder, a collet and the assembly they make, stated as
 * Zod schemas with each type inferred from its schema — and the vocabulary
 * around it: kinds, units, provenance, the ISO geometry dictionary, the
 * measured profile, the reach curve and what a feature demands of a tool.
 * Everything is plain data or a pure function over it — no classes,
 * deliberately, because a class loses structural typing at a package boundary
 * and `instanceof` breaks across duplicate installs.
 *
 * On them, the arithmetic that had been written more than once: {@link hasNeck}
 * and {@link shankOf}, {@link heightAt} and the gauge-line cut ({@link trimToGauge}) each had two
 * copies with a note beside each saying the two must agree and nothing watching
 * whether they did — and {@link stickoutRange}, which had four. A tool's shank,
 * length and necks are read off its one cone stack (`stack.ts`), never stated
 * beside it.
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
  CLAMPINGS,
  COLLET_KINDS,
  CatalogSchema,
  ColletSchema,
  ConeSchema,
  CuttingToolSchema,
  ExtensionSchema,
  HolderSchema,
  ISO_MATERIAL_GROUPS,
  InsertToolSchema,
  RotatingToolAssemblySchema,
  SHANK_FORMS,
  ToolLibrarySchema,
  ToolSchema,
  type Catalog,
  type Clamping,
  type Collet,
  type ColletKind,
  type Cone,
  type CuttingTool,
  type Extension,
  type Holder,
  type InsertTool,
  type IsoMaterialGroup,
  type RotatingToolAssembly,
  type ShankForm,
  type Tool,
  type ToolLibrary,
} from './model.js'

export {
  KERNEL_TOOL_KINDS,
  TOOL_KINDS,
  isInsertKind,
  isKernelKind,
  isTapKind,
  isToolKind,
  type KernelToolKind,
  type ToolKind,
} from './kinds.js'

export {
  THREAD_METHODS,
  dimensionsOf,
  isThreadMethod,
  type ThreadMethod,
  type ToolDimensions,
} from './tool.js'

export {
  EPSILON,
  extensionLength,
  extensionShank,
  hasNeck,
  narrowerThan,
  neckOf,
  overallLengthOf,
  reachNeckOf,
  sameDiameter,
  shaftParts,
  shankOf,
  sliceAt,
  stackHeight,
  statedOverallLength,
  statedShank,
  unclampableLength,
  type Neck,
  type ShaftPart,
} from './stack.js'

export { type MeasuredProfile, type ProfileDatum, type ProfilePoint } from './profile.js'

export {
  measuredHolder,
  parametricHolder,
  trimToGauge,
  type HolderDimensions,
  type HolderFacts,
} from './holder.js'

export { conesToProfile, profileToCones } from './cones.js'

export { assemblyFromSummary, toolFromSummary, type KernelToolSummary } from './kernel.js'

export { cuttingDiameter } from './diameter.js'

export {
  canHold,
  clampedShank,
  colletFitsHolder,
  defaultStickout,
  gripRanges,
  gripsAnyShank,
  gripsShank,
  holdBand,
  holderTakesTool,
  maxStickout,
  stickoutLimits,
  type ClampedShank,
  type Grip,
  type GripRanges,
  type HoldBand,
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
} from './stickout.js'

export { heightAt, type ReachCurve } from './reach.js'

export type { FeatureDemand } from './demand.js'

export { DRILLING_KINDS, fitAgainst, fitTools, type FitFailure, type ToolFit } from './fit.js'

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
  extensionSilhouette,
  holderSilhouette,
  toolCollisions,
  toolSilhouette,
  type Clearance,
  type Collision,
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
