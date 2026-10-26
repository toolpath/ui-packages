import { describe, expect, it } from 'vitest'
import { isSwitch, toolsIn, togglePin } from '../../src/tool-dock/pins'
import type { DockGroup, DockTool } from '../../src/tool-dock/types'

const tool = (id: string, extra: Partial<DockTool> = {}): DockTool => ({
  id,
  label: id,
  icon: null,
  onClick: () => {},
  ...extra,
})

const GROUPS: Array<DockGroup> = [
  { id: 'scene', label: 'Scene', tools: [tool('grid', { on: true }), tool('axes', { on: false })] },
  { id: 'view', label: 'View', tools: [tool('fit')] },
]

describe('tool dock pins', () => {
  it('lists the tools in the order asked, and passes over an id with no tool', () => {
    expect(toolsIn(GROUPS, ['fit', 'gone', 'grid']).map(({ id }) => id)).toEqual(['fit', 'grid'])
  })

  it('takes a pinned tool off, and puts an unpinned one last', () => {
    expect(togglePin(['grid', 'fit'], 'grid')).toEqual(['fit'])
    expect(togglePin(['grid'], 'fit')).toEqual(['grid', 'fit'])
  })

  it('reads a gated tool and an action as no switch', () => {
    expect(isSwitch(tool('grid', { on: false }))).toBe(true)
    expect(isSwitch(tool('fit'))).toBe(false)
    expect(isSwitch(tool('hover', { on: false, gate: 'Click a feature first' }))).toBe(false)
  })
})
