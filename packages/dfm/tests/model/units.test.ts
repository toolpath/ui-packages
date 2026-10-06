import { describe, expect, it } from 'vitest'
import { lengthValue, unitLabel } from '../../src/model/units.js'

describe('lengthValue', () => {
  it('writes millimetres to a micron', () => {
    expect(lengthValue(11.684, 'mm')).toBe('11.684')
  })

  it('writes inches to a thousandth', () => {
    expect(lengthValue(11.684, 'inch')).toBe('0.460')
  })
})

describe('unitLabel', () => {
  it('names each unit as a drawing does', () => {
    expect(unitLabel('mm')).toBe('mm')
    expect(unitLabel('inch')).toBe('in')
  })
})
