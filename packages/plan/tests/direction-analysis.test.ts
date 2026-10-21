import { describe, expect, it } from 'vitest'
import { directionAnalysis } from '../src/direction-analysis'

const up = { x: 0, y: 0, z: 1 }
const side = { x: 1, y: 0, z: 0 }
const back = { x: 0, y: -1, z: 0 }
const known = { analyzed: [up], discovered: [up, side], pending: false }

describe('directionAnalysis', () => {
  it('says whether a direction’s features are in, coming, to be asked for, or never to be had', () => {
    expect(directionAnalysis(up, known)).toBe('analyzed')
    expect(directionAnalysis(side, known)).toBe('unanalyzed')
    expect(directionAnalysis(side, { ...known, pending: true })).toBe('analyzing')
    expect(directionAnalysis(back, known)).toBe('undetected')
    // A report that does not list what it detected offers nothing to analyze.
    expect(directionAnalysis(side, { ...known, discovered: null })).toBe('undetected')
  })

  it('says nothing before the report is read', () => {
    expect(directionAnalysis(side, { analyzed: null, discovered: null, pending: false })).toBe(
      'analyzed',
    )
  })
})
