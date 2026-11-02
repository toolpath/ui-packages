import assert from 'node:assert/strict'
import { test } from 'node:test'

import { planPrerelease } from './sdk-prerelease-plan.mjs'

const now = new Date('2026-11-02T08:20:26.123Z')
const served = { sha256: 'served', apiVersion: '1.38.0' }
const latest = {
  version: '0.11.0',
  toolpath: { openApiSha256: 'stable', openApiVersion: '1.29.1' },
}
const staging = (sha256, openApiVersion = '1.37.0') => ({
  version: '0.11.1-staging.20261030082026.g99c753b',
  toolpath: { openApiSha256: sha256, openApiVersion },
})

test('skips a contract that staging already carries', () => {
  const plan = planPrerelease({ served, staging: staging('served', '1.38.0'), latest, now })
  assert.match(plan.skip, /staging\) already carries/)
})

test('skips a contract that latest already carries', () => {
  const plan = planPrerelease({ served: { ...served, sha256: 'stable' }, latest, now })
  assert.match(plan.skip, /latest\) already carries/)
})

test('publishes a patch snapshot of latest when the staging tag is missing', () => {
  assert.deepEqual(planPrerelease({ served, staging: undefined, latest, now }), {
    version: '0.11.1-staging.20261102082026',
  })
})

test('bases the version on npm latest, whatever the staging tag holds', () => {
  const plan = planPrerelease({ served, staging: staging('older'), latest, now })
  assert.equal(plan.version, '0.11.1-staging.20261102082026')
})

test('publishes a contract whose version did not move', () => {
  const plan = planPrerelease({
    served: { sha256: 'served', apiVersion: '1.29.1' },
    staging: staging('older', '1.29.1'),
    latest,
    now,
  })
  assert.equal(plan.version, '0.11.1-staging.20261102082026')
})

test('refuses a contract older than the one on staging', () => {
  assert.throws(
    () => planPrerelease({ served, staging: staging('newer', '1.39.0'), latest, now }),
    /older than the 1\.39\.0/,
  )
})

test('refuses to publish without a latest version to base it on', () => {
  assert.throws(() => planPrerelease({ served, latest: undefined, now }), /no latest version/)
})
