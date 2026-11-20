import { describe, expect, it } from 'vitest'
import { applyProcess, PROCESS_KEYS, type ProcessSettings } from '../../src/inputs/process'

const PART = {
  name: 'Bracket',
  materialId: 'steel',
  machineProfileId: 'haas',
  toolCrib: [{ kind: 'implicit' as const, id: 'default-tools' }],
  stockProfileId: 'flat-bar',
  dfmRuleSetIds: ['standard'],
}

const PROCESS: ProcessSettings = {
  materialId: 'aluminium',
  machineProfileId: 'dmg',
  toolCrib: [
    { kind: 'implicit', id: 'fine-tools' },
    { kind: 'explicit', id: 'fusion@v2' },
  ],
  stockProfileId: 'round',
  dfmRuleSetIds: ['deep', 'thin'],
}

describe('applyProcess', () => {
  it('copies every setting the process supplies, its crib kept explicit first', () => {
    expect(applyProcess(PART, PROCESS)).toEqual({
      name: 'Bracket',
      materialId: 'aluminium',
      machineProfileId: 'dmg',
      toolCrib: [
        { kind: 'explicit', id: 'fusion@v2' },
        { kind: 'implicit', id: 'fine-tools' },
      ],
      stockProfileId: 'round',
      dfmRuleSetIds: ['deep', 'thin'],
    })
  })

  it('leaves the target’s value where the process sets none, but always copies its DFM rule sets', () => {
    const unset: ProcessSettings = {
      materialId: null,
      machineProfileId: null,
      toolCrib: [],
      stockProfileId: null,
      dfmRuleSetIds: [],
    }
    expect(applyProcess(PART, unset)).toEqual({ ...PART, dfmRuleSetIds: [] })
  })

  it('applies only the keys given', () => {
    const keys = PROCESS_KEYS.filter((key) => key !== 'materialId' && key !== 'stockProfileId')
    expect(applyProcess(PART, PROCESS, keys)).toMatchObject({
      materialId: 'steel',
      machineProfileId: 'dmg',
      stockProfileId: 'flat-bar',
      dfmRuleSetIds: ['deep', 'thin'],
    })
    expect(applyProcess(PART, PROCESS, [])).toEqual(PART)
  })

  it('changes neither the target nor the process', () => {
    const part = structuredClone(PART)
    const process = structuredClone(PROCESS)
    const applied = applyProcess(part, process)
    expect(part).toEqual(PART)
    expect(process).toEqual(PROCESS)
    expect(applied.dfmRuleSetIds).not.toBe(process.dfmRuleSetIds)
  })
  it('applies to a target that holds only some of the settings', () => {
    const target = { name: 'Bracket', machineProfileId: 'haas' }
    expect(applyProcess(target, PROCESS, ['materialId', 'dfmRuleSetIds'])).toEqual({
      name: 'Bracket',
      machineProfileId: 'haas',
      materialId: 'aluminium',
      dfmRuleSetIds: ['deep', 'thin'],
    })
  })
})
