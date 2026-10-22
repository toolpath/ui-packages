import { describe, expect, it } from 'vitest'
import { MILLING_RULES } from '../../src/model/dfm-metrics.js'
import { metricChoices, subjectChoices } from '../../src/model/options.js'

const values = (group: { choices: readonly { value: string }[] } | undefined) =>
  group?.choices.map((choice) => choice.value) ?? []

describe('subjectChoices', () => {
  const quick = MILLING_RULES.quickSubjects

  it('offers the short list, and more on asking', () => {
    const choices = subjectChoices(quick[0] ?? '', false)
    expect(values(choices.groups[0])).toEqual([...quick])
    expect(choices.more).toBe('More feature types…')
  })

  it('adds the rule’s own subject when it is not on the short list', () => {
    const other = MILLING_RULES.subjects.find((each) => !quick.includes(each.value))?.value ?? ''
    expect(values(subjectChoices(other, false).groups[0])).toEqual([...quick, other])
  })

  it('lists every other type once asked, without repeating the short list', () => {
    const choices = subjectChoices(quick[0] ?? '', true)
    expect(choices.groups[1]?.heading).toBe('More feature types')
    expect(values(choices.groups[1]).some((value) => quick.includes(value))).toBe(false)
    expect(choices.more).toBeUndefined()
  })
})

describe('metricChoices', () => {
  it('puts the short list first, in its own order', () => {
    const first = values(metricChoices('any', '', false).groups[0])
    const order = first.map((key) => MILLING_RULES.quickMetrics.indexOf(key))
    expect(order).toEqual([...order].sort((a, b) => a - b))
  })

  it('adds the rule’s own measure when it is not on the short list', () => {
    const everything = metricChoices('any', '', true)
    const other = everything.groups.slice(1).flatMap(values)[0] ?? ''
    expect(values(metricChoices('any', other, false).groups[0])).toContain(other)
  })

  it('lists everything else under headings once asked, each measure once', () => {
    const groups = metricChoices('any', '', true).groups
    expect(groups.slice(1).every((group) => group.heading)).toBe(true)
    const all = groups.flatMap(values)
    expect(new Set(all).size).toBe(all.length)
  })
})
