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
