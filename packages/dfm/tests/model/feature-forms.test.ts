import { isToolForm } from '@toolpath/tool-support'
import { describe, expect, it } from 'vitest'
import { FEATURE_TOOL_FORMS, formsFor } from '../../src/model/feature-forms.js'
import { featureSheet } from '../../src/model/feature-sheet.js'

describe('formsFor: which tool forms may cut a feature', () => {
  it('lets a through hole be drilled or milled, the drill first', () => {
    expect(formsFor('ThroughHole')).toEqual([
      'drill',
      'flat end mill',
      'bull nose end mill',
      'ball end mill',
    ])
  })

  it('reads the report’s snake case and the SDK’s Pascal case as one type', () => {
    expect(formsFor('through_hole')).toEqual(formsFor('ThroughHole'))
    expect(formsFor('u_slot')).toEqual(['ball end mill', 'bull nose end mill'])
  })

  it('leads a filleted pocket with a bull nose and admits a ball; a plain one neither', () => {
    expect(formsFor('pocket', { filletRadius: 1 })).toEqual([
      'bull nose end mill',
      'flat end mill',
      'ball end mill',
    ])
    expect(formsFor('pocket', { filletRadius: 0 })).toEqual(['flat end mill', 'bull nose end mill'])
    expect(formsFor('pocket')).toEqual(['flat end mill', 'bull nose end mill'])
  })

  it('mills a flat-bottomed blind hole first, and drills a pointed one first', () => {
    expect(formsFor('blind_hole', { tipAngle: 180 })).toEqual([
      'flat end mill',
      'bull nose end mill',
      'drill',
    ])
    expect(formsFor('blind_hole', { tipAngle: 118 })?.[0]).toBe('drill')
    // The same half-degree slack isDrilled allows.
    expect(formsFor('blind_hole', { tipAngle: 179.6 })?.[0]).toBe('flat end mill')
    expect(formsFor('blind_hole', { tipAngle: 179.4 })?.[0]).toBe('drill')
    // First match wins: a flat bottom with a fillet is read as flat.
    expect(formsFor('blind_hole', { tipAngle: 180, filletRadius: 1 })?.[0]).toBe('flat end mill')
  })

  it('takes a feature sheet as it is', () => {
    const flatBottom = featureSheet({
      zMin: -10,
      zMax: 0,
      facts: { kind: 'Hole', diameter: 8, fullConeDeg: 180, filletRadius: 0 },
    })

    expect(formsFor('BlindHole', flatBottom)?.[0]).toBe('flat end mill')
  })

  it('is null for a type it does not know, so the caller shows every tool', () => {
    expect(formsFor('hyperboloid_groove')).toBeNull()
    expect(formsFor('')).toBeNull()
  })

  it('names only forms the tool package knows, and ends every type on a plain row', () => {
    for (const row of FEATURE_TOOL_FORMS) {
      for (const form of row.forms) expect(isToolForm(form)).toBe(true)
    }
    const types = new Set(FEATURE_TOOL_FORMS.map((row) => row.feature))
    for (const type of types) expect(formsFor(type)).not.toBeNull()
  })
})
