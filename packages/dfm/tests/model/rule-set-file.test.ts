import { describe, expect, it } from 'vitest'
import { FEATURE_METRICS, FEATURE_SUBJECTS } from '../../src/model/dfm-metrics.js'
import type { DfmRule } from '../../src/model/dfm-rules.js'
import {
  FILE_KIND,
  llmRulePrompt,
  parseRuleSetFile,
  serializeRuleSet,
} from '../../src/model/rule-set-file.js'

const first: DfmRule = {
  id: 'a',
  subject: 'hole',
  metric: 'ld',
  op: 'gte',
  value: 8,
  color: '#ffd60a',
}
const rules: DfmRule[] = [
  first,
  {
    id: 'b',
    subject: 'milled',
    metric: 'featureLd',
    op: 'between',
    value: 4,
    max: 8,
    lowOp: 'gte',
    highOp: 'lt',
    color: '#f76b15',
  },
]

describe('the rule-set file', () => {
  it('round-trips, with its name and kind', () => {
    const text = serializeRuleSet(rules, { name: 'Shop A' })
    const file = JSON.parse(text)
    expect(file).toMatchObject({ kind: FILE_KIND, version: 1, units: 'mm', name: 'Shop A' })
    const read = parseRuleSetFile(text)
    expect(read).toMatchObject({ rules, skipped: 0, name: 'Shop A' })
  })

  it('accepts a bare array, which an LLM may well hand back', () => {
    const read = parseRuleSetFile(JSON.stringify(rules))
    expect('rules' in read && read.rules.length).toBe(2)
  })

  it('refuses a file whose lengths are not in millimetres, rather than read them as millimetres', () => {
    const inches = JSON.stringify({ kind: FILE_KIND, version: 1, units: 'inch', rules })
    expect(parseRuleSetFile(inches)).toEqual({
      error: 'Its lengths are in "inch"; only "mm" can be read.',
    })
    expect(parseRuleSetFile(JSON.stringify({ rules }))).toMatchObject({ rules })
  })

  it('gives missing and colliding ids fresh ones', () => {
    const { id: _dropped, ...noId } = first
    const read = parseRuleSetFile(JSON.stringify([first, first, noId]))
    if (!('rules' in read)) throw new Error(read.error)
    expect(read.rules).toHaveLength(3)
    expect(new Set(read.rules.map((each) => each.id)).size).toBe(3)
  })

  it('counts the rules it had to skip, and refuses a file with none it can read', () => {
    const read = parseRuleSetFile(JSON.stringify({ rules: [first, { subject: 'x' }] }))
    expect(read).toMatchObject({ skipped: 1 })
    expect(parseRuleSetFile('{"rules":[{"subject":"x"}]}')).toEqual({
      error: 'None of its rules could be read.',
    })
    expect(parseRuleSetFile('nope')).toEqual({ error: 'This is not JSON.' })
    expect(parseRuleSetFile('{"name":"empty"}')).toMatchObject({ error: expect.any(String) })
  })
})

describe('the LLM prompt', () => {
  it('names every subject and metric the parser accepts, and the file kind', () => {
    const prompt = llmRulePrompt()
    for (const subject of FEATURE_SUBJECTS) expect(prompt).toContain(`\`${subject.value}\``)
    for (const metric of FEATURE_METRICS) expect(prompt).toContain(`\`${metric.key}\``)
    expect(prompt).toContain(FILE_KIND)
    expect(prompt).toContain('```json')
  })

  it('carries the current rules when there are any, and not otherwise', () => {
    expect(llmRulePrompt(rules)).toContain("The user's current rules")
    expect(llmRulePrompt()).not.toContain("The user's current rules")
  })

  it('shows an example the parser itself reads back', () => {
    const prompt = llmRulePrompt()
    const example = prompt.split('## Example')[1]?.split('```json')[1]?.split('```')[0] ?? ''
    const read = parseRuleSetFile(example)
    expect('rules' in read && read.rules.length).toBe(4)
  })
})
