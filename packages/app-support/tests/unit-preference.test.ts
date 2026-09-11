import { describe, expect, it } from 'vitest'

import { loadUnit, saveUnit } from '../src/index.js'

const store = () => {
  const held = new Map<string, string>()
  return {
    held,
    storage: {
      getItem: (key: string) => held.get(key) ?? null,
      setItem: (key: string, value: string) => void held.set(key, value),
    },
  }
}

describe('remembering the unit', () => {
  it('round-trips, and defaults to the unit Toolpath states lengths in', () => {
    const { storage } = store()

    expect(loadUnit(storage, 'app.unit')).toBe('millimeters')
    saveUnit(storage, 'app.unit', 'inches')
    expect(loadUnit(storage, 'app.unit')).toBe('inches')
  })

  it('survives having no storage', () => {
    expect(loadUnit(null, 'app.unit')).toBe('millimeters')
    expect(() => saveUnit(null, 'app.unit', 'inches')).not.toThrow()
  })

  it('writes the current spelling', () => {
    const { held, storage } = store()

    saveUnit(storage, 'app.unit', 'inches')
    expect(held.get('app.unit')).toBe('inches')
  })
})

describe('a preference stored under the old spelling', () => {
  /**
   * `'in'` and `'mm'` were the vocabulary for as long as `@toolpath/domain`
   * held this, and those values are in people's browsers now. A reader that
   * accepts only the current spelling moves every inch shop to metric on the
   * day it deploys — silently, because the fallback is a valid unit.
   */
  it('still reads as inches', () => {
    const { storage } = store()
    saveUnit(storage, 'app.unit', 'inches')
    storage.setItem('app.unit', 'in')

    expect(loadUnit(storage, 'app.unit')).toBe('inches')
  })

  it('still reads as millimetres', () => {
    const { storage } = store()
    storage.setItem('app.unit', 'mm')

    expect(loadUnit(storage, 'app.unit')).toBe('millimeters')
  })

  it('reads anything else as millimetres', () => {
    const { storage } = store()
    storage.setItem('app.unit', 'furlongs')

    expect(loadUnit(storage, 'app.unit')).toBe('millimeters')
  })
})

describe('keying the stored preference', () => {
  /**
   * Two applications on one origin must be able to hold different units, so
   * the key is the caller's rather than this module's.
   */
  it('keeps one application’s unit out of another’s', () => {
    const { storage } = store()

    saveUnit(storage, 'dfm.unit', 'inches')

    expect(loadUnit(storage, 'dfm.unit')).toBe('inches')
    expect(loadUnit(storage, 'catalog.unit')).toBe('millimeters')
  })
})
