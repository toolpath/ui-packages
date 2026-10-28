import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

describe('the entry points resolve for every consumer', () => {
  const manifest = JSON.parse(
    readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../package.json'), 'utf8'),
  ) as { exports: Record<string, string | Record<string, string>> }

  // A resolver that asks for `require` — Jest under jest-expo asks for
  // `require` and `react-native` — finds nothing in an entry that offers
  // `import` alone.
  it.each(Object.keys(manifest.exports).filter((entry) => entry !== './package.json'))(
    '%s has a default beside its import',
    (entry) => {
      const conditions = manifest.exports[entry] as Record<string, string>
      expect(conditions.default).toBe(conditions.import)
    },
  )
})
