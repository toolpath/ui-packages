import { describe, expect, it } from 'vitest'

import {
  GEOMETRY_FIELDS,
  convertGeometry,
  geometryField,
  isLengthField,
  type GeometryCode,
  type GeometryField,
} from '../src/index.js'

const codes = Object.keys(GEOMETRY_FIELDS) as GeometryCode[]

describe('the geometry dictionary', () => {
  it('answers null for a code it has not pinned', () => {
    // A vendor states columns nobody has classified. Inventing a meaning for
    // one is how a reader is told a number means something this repository
    // cannot defend.
    expect(geometryField('WOC')).toBeNull()
    expect(geometryField('')).toBeNull()
  })

  it('is not fooled by a name on Object.prototype', () => {
    // `GEOMETRY_FIELDS.constructor` is a function, and a lookup that reached
    // the prototype chain would hand a caller one as a GeometryField.
    expect(geometryField('constructor')).toBeNull()
    expect(geometryField('toString')).toBeNull()
    expect(isLengthField('constructor')).toBe(false)
  })

  it('knows the codes a drawing and a fit both read', () => {
    // The vocabulary the two existing packages already speak between them. One
    // of these going missing is a silent loss of a dimension.
    for (const code of ['DC', 'SFDM', 'OAL', 'LCF', 'RE', 'NOF', 'SIG', 'LBH']) {
      expect(geometryField(code), code).not.toBeNull()
    }
  })

  it('states an ISO counterpart or an honest null for every code', () => {
    // `iso: null` says the standard's counterpart is unpinned. A code that *is*
    // the standard's own must say so under its own name, or a consumer reading
    // the dictionary for interchange gets a rename it cannot see.
    for (const code of codes) {
      const field: GeometryField = GEOMETRY_FIELDS[code]
      expect(field.definition.length, code).toBeGreaterThan(0)
      if (field.iso !== null) expect(field.iso.length, code).toBeGreaterThan(0)
    }
    expect(GEOMETRY_FIELDS.DC.iso).toBe('DC')
    // Autodesk's name for the measurement ISO codes as DMM, kept under the name
    // a consumer recognises with the standard's recorded beside it.
    expect(GEOMETRY_FIELDS.SFDM.iso).toBe('DMM')
    // Derived here, published by nobody.
    expect(GEOMETRY_FIELDS.LBH.iso).toBeNull()
    expect(GEOMETRY_FIELDS.LD.iso).toBeNull()
  })

  it('converts a length and leaves everything else alone', () => {
    // The one question the unit kind exists to answer. A 118-degree drill point
    // converted as a length is 2.36, and it looks like a plausible number.
    expect(convertGeometry('DC', 6, 'millimeters', 'inches')).toBeCloseTo(0.23622, 5)
    expect(convertGeometry('SIG', 118, 'millimeters', 'inches')).toBe(118)
    expect(convertGeometry('NOF', 4, 'millimeters', 'inches')).toBe(4)
    expect(convertGeometry('LD', 4, 'millimeters', 'inches')).toBe(4)
  })

  it('does not convert a code it cannot classify', () => {
    // Same refusal `geometryField` makes. A guessed conversion is a wrong
    // number that looks right; an unconverted one a reader still recognises.
    expect(isLengthField('WOC')).toBe(false)
    expect(convertGeometry('WOC', 6, 'millimeters', 'inches')).toBe(6)
  })

  it('classifies every code it knows', () => {
    for (const code of codes) {
      expect(isLengthField(code), code).toBe(GEOMETRY_FIELDS[code].unit === 'mm')
    }
  })
})
