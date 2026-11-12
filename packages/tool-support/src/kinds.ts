/**
 * What a tool is: the kernel's own head kinds, by the same names, so a kernel
 * summary and a record read from a CAM library speak one vocabulary — and,
 * after them, the kinds a catalog lists that the kernel does not plan with.
 */

/**
 * The kinds tp-kernel plans with: its `ToolHeadTag`, by the same names, and
 * `SpotDrill`, which the kernel holds as a `DrillBit` with `is_spot_drill`.
 */
export const KERNEL_TOOL_KINDS = [
  'FlatEndmill',
  'RadiusEndmill',
  'BallEndmill',
  'FaceEndmill',
  'ChamferEndmill',
  'Countersink',
  'CornerRoundingMill',
  'DrillBit',
  'SpotDrill',
  'ThreadMill',
  'CuttingTap',
  'FormingTap',
  'KeyseatCutter',
  'DovetailCutter',
] as const

/**
 * Every kind a record can be: the kernel's, then the kinds a CAM library or a
 * catalog lists and the kernel does not plan with. A tool of one of those is
 * drawn, checked and exported, never planned.
 *
 * Closed, as every enum here is: see the README's rule for reading a collection.
 */
export const TOOL_KINDS = [
  ...KERNEL_TOOL_KINDS,
  'TaperedEndmill',
  'LollipopMill',
  'CircleSegmentBarrel',
  'CircleSegmentLens',
  'CircleSegmentOval',
  'CircleSegmentTaper',
  'BoringBar',
  'Counterbore',
  'CenterDrill',
  'Reamer',
] as const

/** A tool kind. */
export type ToolKind = (typeof TOOL_KINDS)[number]

/** A kind the kernel plans with: tp-kernel's `ToolHeadTag`, and `SpotDrill`. */
export type KernelToolKind = (typeof KERNEL_TOOL_KINDS)[number]

export const isToolKind = (value: unknown): value is ToolKind =>
  TOOL_KINDS.some((kind) => kind === value)

export const isKernelKind = (value: unknown): value is KernelToolKind =>
  KERNEL_TOOL_KINDS.some((kind) => kind === value)

/** Whether a kind cuts with inserts on a body rather than a ground solid: for now, only a face mill. */
export const isInsertKind = (kind: ToolKind): boolean => kind === 'FaceEndmill'

/** Whether a kind is a tap, cutting or forming: what a square-drive collet takes. */
export const isTapKind = (kind: ToolKind): boolean => kind === 'CuttingTap' || kind === 'FormingTap'
