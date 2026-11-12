import { describe, expect, it } from 'vitest'

import {
  RotatingToolAssemblySchema,
  ToolLibrarySchema,
  assemblyFromSummary,
  type ToolLibrary,
} from '../src/index.js'
import { readFusionEntry } from '../src/import/fusion/index.js'

describe('the record’s schemas', () => {
  it('accept what the readers make', () => {
    const fusion = readFusionEntry({
      type: 'flat end mill',
      unit: 'millimeters',
      description: 'six',
      geometry: { DC: 6, LCF: 12, LB: 30, NOF: 3 },
      holder: {
        description: 'ER16',
        segments: [{ height: 20, 'lower-diameter': 22, 'upper-diameter': 28 }],
      },
      'post-process': { number: 4 },
    })
    const summary = assemblyFromSummary({
      name: 'face',
      key: 'k',
      kind: 'FaceEndmill',
      diameter: 50,
      fluteLength: 5,
      stickout: 40,
      fluteCount: 4,
    })
    expect(RotatingToolAssemblySchema.parse(fusion)).toEqual(fusion)
    expect(RotatingToolAssemblySchema.parse(summary)).toEqual(summary)
  })

  it('refuse a kind they do not know', () => {
    const unknown = {
      ...assemblyFromSummary({
        name: 't',
        key: 'k',
        kind: 'FlatEndmill',
        diameter: 6,
        fluteLength: 12,
        stickout: 30,
        fluteCount: 3,
      }),
    }
    expect(
      RotatingToolAssemblySchema.safeParse({ ...unknown, tool: { ...unknown.tool, kind: 'Spoon' } })
        .success,
    ).toBe(false)
  })

  it('read a library: its tools, holders, and collets and sleeves', () => {
    const library: ToolLibrary = {
      tools: [
        {
          type: 'solid',
          kind: 'FlatEndmill',
          name: 'six',
          diameter: 6,
          fluteLength: 12,
          shaft: [
            { thickness: 8, bottomDiameter: 5.5, topDiameter: 5.5 },
            { thickness: 40, bottomDiameter: 6, topDiameter: 6 },
          ],
          shankForm: 'weldon',
          materialGroups: ['P', 'M'],
          orderNumber: '1234567',
          productLine: 'HARVI I TE',
        },
      ],
      holders: [
        {
          layers: [],
          gaugeLength: 80,
          clamping: 'hydraulic',
          boreDiameter: 20,
          boreDepth: 50,
          clampLength: 45,
          faceContact: true,
          coolantThrough: true,
        },
      ],
      collets: [{ series: 'HC20', kind: 'sleeve', outerDiameter: 20, clampMin: 6, clampMax: 6 }],
    }
    expect(ToolLibrarySchema.parse(library)).toEqual(library)
    expect(
      ToolLibrarySchema.safeParse({
        ...library,
        holders: [{ layers: [], gaugeLength: null, clamping: 'shrink' }],
      }).success,
    ).toBe(false)
  })
})
