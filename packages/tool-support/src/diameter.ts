/**
 * The diameter a tool cuts at, which for a face mill is not the nominal one.
 */

import type { InsertTool, Tool } from './model.js'

/**
 * The diameter a tool cuts at, mm: a solid tool's `diameter`; for an insert tool, its body's
 * nominal diameter grown over its lead angle across the flute length, as tp-kernel 0.32 sizes a
 * face mill (`face_mill_diameter`, tp-rs `crates/tools/src/convert.rs`) and Fusion states it as
 * `DCX`: `DC + 2 · LCF / tan(lead)`. An insert tool with no lead angle stated is taken at its
 * nominal diameter, as a square shoulder (lead 90°) grows by nothing.
 */
export const cuttingDiameter = (tool: Tool | InsertTool): number => {
  if (tool.type === 'solid') {
    return tool.diameter
  }
  const { diameter, fluteLength } = tool.body
  const lead = tool.insert.leadAngleDeg
  if (lead === undefined || !(lead > 0) || lead >= 90) {
    return diameter
  }
  // Degrees to radians as Rust's `to_radians` rounds, so the figure is the kernel's to the bit.
  return diameter + (2 * fluteLength) / Math.tan(lead * (Math.PI / 180))
}
