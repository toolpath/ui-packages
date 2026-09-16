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
export { SectionTool } from './section-tool.js'
export { MEASURE_LABEL_CLASS, MeasureTool } from './measure-tool.js'
export {
  ANGLE_ARC_FRACTION,
  AXIS_COLORS,
  ANGLE_ARC_SEGMENTS,
  DELTA_DASH_PIXELS,
  MEASURE_LINE_PIXELS,
  MEASURE_MARKER_PIXELS,
  MEASURE_RENDER_ORDER,
  POINTS_PER_MEASUREMENT,
  SNAP_MARKER_PIXELS,
  SNAP_PIXELS,
  angleArc,
  angleArcRadius,
  angleAt,
  deltaBetween,
  deltaLegs,
  distanceBetween,
  formatDegrees,
  formatMillimetres,
  lockToAxis,
  measurementFromPoints,
  measurementLabel,
  measurementLabelAnchor,
  midpoint,
  nextMeasurementId,
  screenPoint,
  snapAt,
} from './render/measure.js'
export {
  AXES_PLANE_OFFSET,
  AXES_PLANE_SCALE,
  CAP_HATCH,
  DEFAULT_SECTION_NORMAL,
  DISABLED_SECTION,
  HANDLE_PIXELS,
  OUTLINE_SCALE,
  PICKED_SURFACE_LABEL,
  PREVIEW_SCALE,
  SECTION_RENDER_ORDER,
  axesPlanes,
  dragPlane,
  hitUnderRay,
  pickedStartDepth,
  sectionAnchor,
  sectionBounds,
  sectionConstant,
  sectionDepth,
  sectionDepthConstant,
  sectionDepthRange,
  sectionFromPick,
  sectionOffset,
  sectionOptionsFromState,
  sectionPlane,
  surfaceUnderRay,
} from './render/section.js'
export { createSectionStore } from './render/section-store.js'
export {
  applyCapTheme,
  createCapMaterial,
  createMaskMaterial,
  createMaskTarget,
  createStencilMaterials,
} from './render/section-cap.js'
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
  excludedFromFrame,
  defaultBounds,
  fitDistance,
  orthographicHalfHeight,
  perspectiveFitDistance,
  screenLength,
  startPosition,
  targetBoundary,
} from './render/camera.js'
export { ExtendedCameraControls } from './render/controls.js'
export { useRetarget, useSectionStore, useViewerControls, Viewer } from './viewer.js'
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
export type {
  AxesPlane,
  SectionAnchor,
  SectionBounds,
  SectionOptions,
  SectionPlacement,
  SectionState,
  SurfaceHit,
} from './render/section.js'
export type { SectionStore } from './render/section-store.js'
export type { CapMaterial, CapUniforms } from './render/section-cap.js'
export type { SectionToolProps } from './section-tool.js'
export type { MeasureToolProps } from './measure-tool.js'
export type {
  AngleMeasurement,
  Axis,
  AxisLock,
  DeltaLeg,
  DistanceMeasurement,
  MeasureMode,
  Measurement,
  Snap,
  SnapEdges,
  SnapHit,
  SnapKind,
} from './render/measure.js'
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
