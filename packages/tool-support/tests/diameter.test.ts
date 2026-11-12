import { describe, expect, it } from 'vitest'

import { readFusionEntry } from '../src/import/fusion/index.js'
import { cuttingDiameter, MM_PER_INCH, type InsertTool } from '../src/index.js'

describe('a tool’s cutting diameter', () => {
  it('is a face mill’s nominal diameter grown over its lead angle, as the kernel sizes it', () => {
    // A 2" face mill, 45° lead, 0.248" of flute: the kernel's 2.496" (its DCX).
    const face = readFusionEntry({
      type: 'face mill',
      unit: 'inches',
      geometry: { DC: 2, LCF: 0.248, TA: 45, LB: 1.5, NOF: 4 },
    })
    expect(face?.tool.type).toBe('insert')
    expect((face?.tool as InsertTool).body.diameter).toBeCloseTo(2 * MM_PER_INCH, 9)
    expect(cuttingDiameter(face!.tool) / MM_PER_INCH).toBeCloseTo(2.496, 9)
  })

  it('is the nominal diameter for a face mill with no lead stated, or a square shoulder', () => {
    const insert = (leadAngleDeg?: number): InsertTool => ({
      type: 'insert',
      kind: 'FaceEndmill',
      name: 'fm',
      body: { diameter: 50, fluteLength: 6 },
      insert: leadAngleDeg === undefined ? {} : { leadAngleDeg },
    })
    expect(cuttingDiameter(insert())).toBe(50)
    expect(cuttingDiameter(insert(90))).toBe(50)
  })

  it('is a solid tool’s own diameter', () => {
    expect(
      cuttingDiameter({
        type: 'solid',
        kind: 'FlatEndmill',
        name: 'em',
        diameter: 6,
        fluteLength: 12,
      }),
    ).toBe(6)
  })
})
