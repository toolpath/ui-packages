import { describe, expect, it } from 'vitest'
import { headingOf, isSwitch, lineOf } from '../../src/tool-dock/tools'
import type { DockTool } from '../../src/tool-dock/types'

const tool = (id: string, extra: Partial<DockTool> = {}): DockTool => ({
  id,
  label: id,
  icon: null,
  onClick: () => {},
  ...extra,
})

describe('tool dock tools', () => {
  it('reads a gated tool and an action as no switch', () => {
    expect(isSwitch(tool('grid', { on: false }))).toBe(true)
    expect(isSwitch(tool('fit'))).toBe(false)
    expect(isSwitch(tool('hover', { on: false, gate: 'Click a feature first' }))).toBe(false)
  })

  it("gives a gated tool's reason in place of its note", () => {
    expect(lineOf(tool('grid', { note: 'Show the grid' }))).toBe('Show the grid')
    expect(lineOf(tool('hover', { note: 'Show it', gate: 'Click a feature first' }))).toBe(
      'Click a feature first',
    )
  })

  it('heads a group with its title, or else its label', () => {
    expect(headingOf({ id: 'view', label: 'View', tools: [] })).toBe('View')
    expect(headingOf({ id: 'view', label: 'View', title: 'Camera', tools: [] })).toBe('Camera')
  })
})
