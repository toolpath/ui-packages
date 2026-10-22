/**
 * The plan types against the Toolpath API's own, as `@toolpath/api` declares them: what a draft
 * sends fits the request, and what a plan serves fits what the draft reads back. Checked by the type
 * checker (`check-types`); the package itself imports no SDK.
 */

import type {
  PartJobRequestSetupPlan,
  QueuePartJobResponseSetupPlan,
  UpdatePartRequestDirectionsInner,
} from '@toolpath/api'
import { describe, expectTypeOf, it } from 'vitest'
import type { PlanDirection, SetupPlan } from '../src/engine-plan'
import type { Statement } from '../src/plan-draft'

describe('the plan types and the Toolpath API', () => {
  it('sends a statement as the setupPlan a job takes', () => {
    expectTypeOf<Statement>().toExtend<PartJobRequestSetupPlan>()
  })

  it('reads a served setupPlan as a SetupPlan', () => {
    expectTypeOf<QueuePartJobResponseSetupPlan>().toExtend<SetupPlan>()
  })

  it('names a direction as the API does, both ways', () => {
    expectTypeOf<PlanDirection>().toEqualTypeOf<UpdatePartRequestDirectionsInner>()
  })
})
