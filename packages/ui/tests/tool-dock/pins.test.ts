import { describe, expect, it } from 'vitest'
import { toolsIn, togglePin } from '../../src/tool-dock/pins'
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
})
