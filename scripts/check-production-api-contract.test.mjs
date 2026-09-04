import assert from 'node:assert/strict'
import test from 'node:test'
import {
  assertProductionContractVersion,
  changesSdkContract,
  versionOf,
} from './check-production-api-contract.mjs'

const document = (version) => ({ info: { version } })

test('accepts a candidate SDK contract deployed to production', () => {
  assert.equal(assertProductionContractVersion(document('1.3.1'), document('1.3.1')), '1.3.1')
})

test('rejects a candidate SDK contract ahead of production', () => {
  assert.throws(
    () => assertProductionContractVersion(document('1.3.1'), document('1.1.0')),
    /candidate SDK targets Engine API 1\.3\.1, but production serves 1\.1\.0/,
  )
})

test('rejects an OpenAPI document without an API version', () => {
  assert.throws(
    () => versionOf({}, 'Production'),
    /Production does not declare an OpenAPI info.version/,
  )
})

test('runs only when a pull request changes the TypeScript SDK contract', () => {
  assert.equal(changesSdkContract(['packages/ui/src/button.tsx']), false)
  assert.equal(changesSdkContract(['openapi/openapi.json']), true)
  assert.equal(changesSdkContract(['packages/sdk-typescript/src/generated/JobsApi.ts']), true)
})
