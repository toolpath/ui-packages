/**
 * The stock types against the Toolpath API's own, as `@toolpath/api` declares them. Checked by the
 * type checker (`check-types`); the package itself imports no SDK.
 */

import type { BodyStock as ApiBodyStock } from '@toolpath/api'
import { describe, expectTypeOf, it } from 'vitest'
import type { BodyStock } from '../../src/inputs/stock'

describe('the stock types and the Toolpath API', () => {
  it('names a body of the part’s file as stock as the API does, both ways', () => {
    expectTypeOf<BodyStock>().toEqualTypeOf<ApiBodyStock>()
  })
})
