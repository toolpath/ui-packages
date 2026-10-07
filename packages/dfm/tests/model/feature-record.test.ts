import { describe, expect, it } from 'vitest'
import { datasheetFields, MAX_DATASHEET_FIELDS } from '../../src/model/feature-record.js'

describe('datasheetFields', () => {
  it('reads every leaf by its dotted and indexed path', () => {
    const { fields, more } = datasheetFields({
      zMin: -12.123456,
      facts: { kind: 'Hole', bevel: { angleDeg: 45 } },
      pinchPoints: [{ center: { x: 1, y: 2 }, diameter: 3 }],
      reachCurve: { horizontalOffset: [0, 1.5, 3] },
      empty: [],
      none: {},
      gone: null,
    })
    expect(fields).toEqual([
      { path: 'zMin', value: '-12.1235' },
      { path: 'facts.kind', value: 'Hole' },
      { path: 'facts.bevel.angleDeg', value: '45' },
      { path: 'pinchPoints[0].center.x', value: '1' },
      { path: 'pinchPoints[0].center.y', value: '2' },
      { path: 'pinchPoints[0].diameter', value: '3' },
      { path: 'reachCurve.horizontalOffset', value: '0, 1.5, 3' },
      { path: 'empty', value: '[]' },
      { path: 'none', value: '{}' },
      { path: 'gone', value: 'null' },
    ])
    expect(more).toBe(false)
  })

  it(`stops at ${MAX_DATASHEET_FIELDS} rows and says there are more`, () => {
    const long = Object.fromEntries(
      Array.from({ length: MAX_DATASHEET_FIELDS + 5 }, (_, at) => [`f${at}`, at]),
    )
    const { fields, more } = datasheetFields(long)
    expect(fields).toHaveLength(MAX_DATASHEET_FIELDS)
    expect(more).toBe(true)
  })

  it('has nothing for no datasheet', () => {
    expect(datasheetFields(null)).toEqual({ fields: [], more: false })
  })
})
