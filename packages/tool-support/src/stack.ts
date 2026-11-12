/**
 * A body's cone stack, read for what a holder, a sweep and a CAM format ask of
 * it.
 *
 * A tool states what stands above its flutes as one stack, `shaft`, tip end
 * first, as a holder and an extension state theirs as `layers`. Its shank, its
 * length and its neck are not stated beside it: they are read off it here, so
 * no two readers can take the same stack two ways.
 *
 * Clamping reads the stack down from its top. The **shank run** is the topmost
 * stretch of straight layers at the shank's diameter, and everything below it
 * is {@link unclampableLength}. A tapered top layer makes the run empty: a
 * taper is not a shank a collet or a bore clamps, so the whole shaft is then
 * unclampable, as intended.
 *
 * Two necks are read, because two questions are asked. {@link neckOf} is
 * clamping's: what below the shank run is narrower than the shank, which a
 * collet must not close on. {@link reachNeckOf} is the
 * kernel's reach question: what above the flutes is narrower than the cut, and
 * so follows the cutter down a wall.
 */

import { cuttingDiameter } from './diameter.js'
import type { Cone, CuttingTool, Extension } from './model.js'
import { dimensionsOf } from './tool.js'

/**
 * A hair, because a shoulder and a shank that are the same nominal size are the
 * same float only until one of them has been through a unit conversion: 3/8" is
 * 9.525 on the collet's sheet and 9.524999999999999 on the tool's.
 */
export const EPSILON = 1e-6

/** Whether two diameters are one, within a conversion's last bit. */
export const sameDiameter = (a: number, b: number): boolean => Math.abs(a - b) <= EPSILON

/** Whether a layer stands narrower than `diameter` at its widest: a neck against a shank, or a cut. */
export const narrowerThan = (layer: Cone, diameter: number): boolean =>
  Math.max(layer.bottomDiameter, layer.topDiameter) < diameter - EPSILON

/** A section of a stack: its length from the top of the flutes, and its narrowest diameter. */
export interface Neck {
  readonly length: number
  readonly diameter: number
}

/** A stack's height, mm: its layers' thicknesses summed. */
export const stackHeight = (layers: ReadonlyArray<Cone>): number => {
  let height = 0
  for (const layer of layers) {
    height += layer.thickness
  }
  return height
}

/**
 * The part of a stack from its bottom up to `height`, mm, a layer that
 * straddles it cut there in proportion: a tool's shaft cut at its stickout is
 * what stands out of the holder.
 */
export const sliceAt = (layers: ReadonlyArray<Cone>, height: number): Array<Cone> => {
  const slice: Array<Cone> = []
  let bottom = 0
  for (const layer of layers) {
    if (bottom >= height) {
      break
    }
    const top = bottom + layer.thickness
    if (top <= height) {
      slice.push(layer)
    } else {
      const share = (height - bottom) / layer.thickness
      slice.push({
        thickness: height - bottom,
        bottomDiameter: layer.bottomDiameter,
        topDiameter: layer.bottomDiameter + (layer.topDiameter - layer.bottomDiameter) * share,
      })
    }
    bottom = top
  }
  return slice
}

/** A tool's stated shaft, or none where it states none or an empty one. */
const shaftLayers = (tool: CuttingTool): ReadonlyArray<Cone> => tool.shaft ?? []

/** The top layer of a stack that has any height: a layer of none is a step, not the top. */
const topLayer = (layers: ReadonlyArray<Cone>): Cone | undefined => {
  for (let index = layers.length - 1; index >= 0; index--) {
    const layer = layers[index]
    if (layer !== undefined && layer.thickness > 0) {
      return layer
    }
  }
  return undefined
}

/**
 * The diameter a holder clamps, mm: the top of the shaft's top layer, or null
 * where the tool states no shaft. Geometric: where a reader guessed it,
 * {@link statedShank} is null.
 */
export const shankOf = (tool: CuttingTool): number | null =>
  topLayer(shaftLayers(tool))?.topDiameter ?? null

/**
 * Tip to the end of the tool, mm: the flutes and the shaft above them, or null
 * where it states none. Geometric: where a reader guessed it,
 * {@link statedOverallLength} is null.
 */
export const overallLengthOf = (tool: CuttingTool): number | null => {
  const shaft = shaftLayers(tool)
  return shaft.length === 0 ? null : dimensionsOf(tool).fluteLength + stackHeight(shaft)
}

/**
 * {@link shankOf}, or null where `provenance.shank` is `assumed`: a reader
 * filled the stack at a diameter nobody stated, as a Fusion entry with no
 * `SFDM` is filled at its cut. Holding, clamping and the exporters read this.
 */
export const statedShank = (tool: CuttingTool): number | null =>
  tool.provenance?.['shank'] === 'assumed' ? null : shankOf(tool)

/**
 * {@link overallLengthOf}, or null where `provenance.overallLength` is
 * `assumed`: the stack stops where a reader stopped it, not at the end of the
 * tool, as a Fusion entry with no `OAL` ends at `LB`.
 */
export const statedOverallLength = (tool: CuttingTool): number | null =>
  tool.provenance?.['overallLength'] === 'assumed' ? null : overallLengthOf(tool)

/** Whether a layer is a straight cylinder at `diameter`. */
const straightAt = (layer: Cone, diameter: number): boolean =>
  sameDiameter(layer.bottomDiameter, diameter) && sameDiameter(layer.topDiameter, diameter)

/**
 * Where the shank run starts, as an index into `layers`: the topmost
 * contiguous layers that are straight cylinders at the shank's diameter, what a
 * collet or a bore closes on. `layers.length` where the run is empty: a tapered
 * top layer is not a shank a collet or a bore clamps, so such a shaft is
 * unclampable whole.
 */
const shankRunStart = (layers: ReadonlyArray<Cone>, shank: number | null): number => {
  let start = layers.length
  if (shank === null) {
    return start
  }
  for (let index = layers.length - 1; index >= 0; index--) {
    const layer = layers[index]
    if (layer === undefined || layer.thickness <= 0) {
      continue
    }
    if (!straightAt(layer, shank)) {
      break
    }
    start = index
  }
  return start
}

/** The layers below the shank run, from the top of the flutes. */
const unclampableLayers = (tool: CuttingTool): ReadonlyArray<Cone> => {
  const shaft = shaftLayers(tool)
  return shaft.slice(0, shankRunStart(shaft, shankOf(tool)))
}

/**
 * The length above the flutes a collet cannot close on, mm: everything below
 * the shank run, a neck and a shoulder wider than the shank alike. A relief as
 * wide as the shank is shank. Zero where the tool states no shaft.
 */
export const unclampableLength = (tool: CuttingTool): number => stackHeight(unclampableLayers(tool))

/** What a layer of a shaft is to a collet ({@link shaftParts}). */
export type ShaftPart = 'neck' | 'shank'

/**
 * Each of `layers` as a {@link ShaftPart}: `neck` where it lies below the
 * shank run and is narrower than the shank, the stretch {@link neckOf}
 * measures, else `shank`, a shoulder wider than the shank included. `layers`
 * is the tool's `shaft` or a slice of it from the bottom ({@link sliceAt}).
 * The clearance sweep and the drawing both label through this.
 */
export const shaftParts = (
  tool: CuttingTool,
  layers: ReadonlyArray<Cone> = shaftLayers(tool),
): Array<ShaftPart> => {
  const shank = shankOf(tool)
  const start = shankRunStart(shaftLayers(tool), shank)
  return layers.map((layer, index) =>
    index < start && shank !== null && narrowerThan(layer, shank) ? 'neck' : 'shank',
  )
}

/**
 * The narrowest stretch from the top of the flutes, and how far it reaches,
 * among `layers` narrower than `diameter`; undefined where none is.
 */
const narrowStretch = (layers: ReadonlyArray<Cone>, diameter: number): Neck | undefined => {
  let height = 0
  let length = 0
  let narrowest = Infinity
  for (const layer of layers) {
    height += layer.thickness
    if (layer.thickness > 0 && narrowerThan(layer, diameter)) {
      length = height
      narrowest = Math.min(narrowest, layer.bottomDiameter, layer.topDiameter)
    }
  }
  return length > 0 ? { length, diameter: narrowest } : undefined
}

/**
 * Clamping's neck: the stretch below the shank run that is narrower than the
 * shank, from the top of the flutes to its last such layer, at its narrowest;
 * undefined where there is none. A shoulder wider than the shank is no neck,
 * though a collet cannot close on it either.
 */
export const neckOf = (tool: CuttingTool): Neck | undefined => {
  const shank = shankOf(tool)
  return shank === null ? undefined : narrowStretch(unclampableLayers(tool), shank)
}

/** Whether the tool has clamping's neck ({@link neckOf}). */
export const hasNeck = (tool: CuttingTool): boolean => neckOf(tool) !== undefined

/**
 * The kernel's reach neck: the run of the shaft from the top of the flutes that
 * is narrower than the cutting diameter, at its narrowest; undefined where the
 * first layer of any height is not. A reduced shank is all reach neck. Distinct from
 * {@link neckOf}: a relief wider than the cut and narrower than the shank is a
 * neck to a collet and none to the kernel.
 */
export const reachNeckOf = (tool: CuttingTool): Neck | undefined => {
  const shaft = shaftLayers(tool)
  const cut = cuttingDiameter(tool)
  const end = shaft.findIndex((layer) => layer.thickness > 0 && !narrowerThan(layer, cut))
  return narrowStretch(end === -1 ? shaft : shaft.slice(0, end), cut)
}

/** The diameter a holder clamps on an extension, mm: its top layer's top, or null where it states no shape. */
export const extensionShank = (extension: Pick<Extension, 'layers'>): number | null =>
  extension.layers.at(-1)?.topDiameter ?? null

/** An extension's overall length, mm: its layers' height. */
export const extensionLength = (extension: Pick<Extension, 'layers'>): number =>
  stackHeight(extension.layers)
