import { describe, expect, it } from 'vitest'
import { storageFolds, type FoldStorage } from '../../src/model/fold-store.js'

/** A `Storage` held in a map. */
const memory = (
  entries: Record<string, string> = {},
): FoldStorage & { map: Map<string, string> } => {
  const map = new Map(Object.entries(entries))
  return {
    map,
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
  }
}

describe('storageFolds: sections that start shut', () => {
  it('reads a shutAtFirst section as shut until it is opened', () => {
    const storage = memory()
    const folds = storageFolds(storage, 'f.', { shutAtFirst: ['reach'] })

    expect(folds.read('reach')).toBe(false)
    expect(folds.read('rules')).toBeUndefined()
    folds.write('reach', true)
    expect(folds.read('reach')).toBe(true)
  })
})

describe('storageFolds', () => {
  it('keeps each section under the app’s prefix, as open or shut', () => {
    const storage = memory()
    const folds = storageFolds(storage, 'toolpath.fold.')
    folds.write('reach', false)
    folds.write('rules', true)
    expect([...storage.map]).toEqual([
      ['toolpath.fold.reach', 'shut'],
      ['toolpath.fold.rules', 'open'],
    ])
    expect(folds.read('reach')).toBe(false)
    expect(folds.read('rules')).toBe(true)
  })

  it('reads a section never folded, or a value it does not know, as undefined', () => {
    const folds = storageFolds(memory({ 'f.raw': 'sideways' }), 'f.')
    expect(folds.read('reach')).toBeUndefined()
    expect(folds.read('raw')).toBeUndefined()
  })

  it('folds without keeping anything when there is no storage', () => {
    const folds = storageFolds(null, 'f.')
    expect(() => folds.write('reach', false)).not.toThrow()
    expect(folds.read('reach')).toBeUndefined()
  })

  it('folds without keeping anything when the storage refuses', () => {
    const refusing: FoldStorage = {
      getItem: () => {
        throw new Error('denied')
      },
      setItem: () => {
        throw new Error('denied')
      },
    }
    const folds = storageFolds(refusing, 'f.', { shutAtFirst: ['raw'] })
    expect(() => folds.write('reach', false)).not.toThrow()
    expect(folds.read('reach')).toBeUndefined()
    expect(folds.read('raw')).toBe(false)
  })
})
