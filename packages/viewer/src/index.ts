// Engine integrations should import from `@toolpath/viewer/engine`, which keeps
// the generic scene API and the Engine adapter boundary explicit. The root
// re-exports the adapter's entry points for callers that only ever render a
// report.
export { EnginePart, normalizePartReport, smoothRegionNormals } from './engine/index.js'
export { regionAdjacency } from './render/adjacency.js'
export { PartMesh } from './part-mesh.js'
export { Axes, Grid, ViewCube } from './primitives.js'
export { DirectionArrows } from './direction-arrows.js'
export { SectionView, resolveSectionPlane } from './section-view.js'
export {
  HANDLE_PIXELS,
  PICKED_SURFACE_LABEL,
  SECTION_RENDER_ORDER,
  dragPlane,
  pickedStartDepth,
  sectionBounds,
  sectionConstant,
  sectionDepth,
  sectionDepthConstant,
  sectionDepthRange,
  sectionFromPick,
  sectionOffset,
  sectionPlane,
} from './render/section.js'
export { arrowPlacement } from './render/directions.js'
export { useContentBox } from './content-box.js'
export { useTapGuard } from './tap.js'
export { DOUBLE_TAP_MS, TAP_SLOP, movedFar, trackDoubleTaps, trackTaps } from './render/tap.js'
export {
  CHAMFER,
  VIEW_NAMES,
  VIEW_SIGNS,
  cubeOutlineGeometry,
  cubeZones,
  labelGeometry,
  labelTexture,
  panelGeometry,
  squaredUp,
  viewKind,
  viewUp,
  viewVector,
} from './render/view-cube.js'
export { gridGeometry, gridSpec } from './render/grid.js'
export { regionEdgesGeometry } from './render/edges.js'
export { visualSurfaces } from './model/surfaces.js'
export { CadCameraControls } from './camera.js'
export {
  CAD_CAMERA_UP,
  DEFAULT_FIT_MARGIN,
  EXCLUDE_FROM_FRAME,
  MAX_FRAME_RATIO,
  MIN_FRAME_RATIO,
  PERSPECTIVE_FOV,
  adaptedUp,
  applyProjection,
  aspectRatio,
  boundsFromBox,
  cadViewDirections,
  cameraLimits,
  contentBounds,
  currentViewDirection,
  defaultBounds,
  fitDistance,
  orthographicHalfHeight,
  perspectiveFitDistance,
  screenLength,
  startPosition,
  targetBoundary,
} from './render/camera.js'
export { ExtendedCameraControls } from './render/controls.js'
export { useRetarget, useViewerControls, Viewer } from './viewer.js'
export { PartReportFormatError, UnsupportedKernelVersionError } from './model/errors.js'
export { buildRegionIndex } from './model/region-index.js'
export {
  directionIndexOf,
  directionLabel,
  groupByDirection,
  sameDirection,
} from './model/directions.js'
export { regionNormals } from './model/normals.js'
export {
  DEFAULT_THEME,
  DIRECTION_COLORS,
  HIGHLIGHT_COLORS,
  directionColor,
  resolveTheme,
  themesEqual,
} from './render/theme.js'
export {
  FEATURE_TYPE_RANKS,
  bestOwner,
  cycleOwner,
  featureTypeRank,
  rankOwners,
} from './render/selection.js'
export {
  REGION_ATTRIBUTE,
  buildRegionAttribute,
  buildRegionTexels,
  createPart,
} from './render/part.js'
export {
  CANDIDATE_WEIGHT,
  HIGHLIGHT_WEIGHT,
  HOVER_WEIGHT,
  applyHighlightLayers,
} from './render/paint.js'
export { NO_MODIFIERS, buildPick, focusForPick, viewDirection } from './render/picking.js'
export { retargetPose } from './render/retarget.js'
export type { RetargetPose } from './render/retarget.js'
export {
  ORBIT_TARGET_COLOR,
  ORBIT_TARGET_FADE_MS,
  ORBIT_TARGET_FLASH_MS,
  ORBIT_TARGET_PIXELS,
  ORBIT_TARGET_RING_COLOR,
  ORBIT_TARGET_RING_OPACITY,
  ORBIT_TARGET_RING_PIXELS,
  ORBIT_TARGET_RING_WIDTH,
  orbitTargetOpacity,
} from './render/target.js'
export type { BuildPickInput, PartPick, PickModifiers } from './render/picking.js'
export type { ViewerControls, ViewerHandle, ViewerView } from './types.js'
export type {
  FeatureTag,
  FeatureType,
  KnownFeatureType,
  KnownShapeKind,
  PartMeshRefs,
  PartModel,
  PartModelFeature,
  PartModelRegion,
  RegionIndex,
  ShapeKind,
  TriangleRange,
  Vec3,
} from './model/types.js'
export type { DirectionGroup } from './model/directions.js'
export type { SurfaceOf } from './model/surfaces.js'
export type { RankingContext } from './render/selection.js'
export type { PartObject, RegionPaint } from './render/part.js'
export type { FeatureHighlight, HighlightLayers, RegionHighlight } from './render/paint.js'
export type { ViewerTheme } from './render/theme.js'
export type { PartMeshProps } from './part-mesh.js'
export type { AxesProps, GridProps, ViewCubeProps } from './primitives.js'
export type { CubeZone, ViewKind, ViewName } from './render/view-cube.js'
export type { DirectionArrowsProps, NamedDirection } from './direction-arrows.js'
export type { ArrowPlacement } from './render/directions.js'
export type { SectionOptions, SectionState } from './section-view.js'
export type { SectionAnchor, SectionBounds, SectionPlacement } from './render/section.js'
export type { GridSpec } from './render/grid.js'
export type { DoubleTapPoint, DoubleTapTracker, TapPoint, TapTracker } from './render/tap.js'
export type { CadCameraControlsProps } from './camera.js'
export type {
  CameraLimits,
  Projection,
  SceneBounds,
  ViewerCamera,
  ViewportSize,
} from './render/camera.js'
export type { ControlScheme, ExtendedCameraControlsOptions } from './render/controls.js'
export type { Retarget, ViewerProps } from './viewer.js'
