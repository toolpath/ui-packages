import { describe, expect, it } from 'vitest'
import { projectGroup, type FlatGroup } from '../../src/draft/sort'

const MAX = 6

/*
  Two setups, the first holding a group that holds another, all shown:

    A
      A1
        A1a
    B
*/
const items: Array<FlatGroup> = [
  { id: 'A', parentId: null, depth: 0, height: 2 },
  { id: 'A1', parentId: 'A', depth: 1, height: 1 },
  { id: 'A1a', parentId: 'A1', depth: 2, height: 0 },
  { id: 'B', parentId: null, depth: 0, height: 0 },
]

describe('projectGroup', () => {
  it('lands where it already is as no drop at all', () => {
    // B's own gap: after the three groups above it.
    expect(
      projectGroup(items, { activeId: 'B', gap: 3, wantedDepth: 0, maxDepth: MAX })?.at,
    ).toBeNull()
  })

  it('moves a setup to before another, kept at the top level', () => {
    expect(projectGroup(items, { activeId: 'B', gap: 0, wantedDepth: 0, maxDepth: MAX })).toEqual({
      depth: 0,
      parentId: null,
      at: { id: 'A', zone: 'before' },
    })
  })

  it('goes into a group from the gap under its row, before what is already in it', () => {
    // Between A and A1: no shallower than A1, so inside A, ahead of it.
    expect(projectGroup(items, { activeId: 'B', gap: 1, wantedDepth: 0, maxDepth: MAX })).toEqual({
      depth: 1,
      parentId: 'A',
      at: { id: 'A1', zone: 'before' },
    })
  })

  it('goes inside the group above when dragged a level right, at the end of it', () => {
    expect(projectGroup(items, { activeId: 'B', gap: 3, wantedDepth: 1, maxDepth: MAX })).toEqual({
      depth: 1,
      parentId: 'A',
      at: { id: 'A1', zone: 'after' },
    })
    // Further right: inside A1a, the group just above it.
    expect(projectGroup(items, { activeId: 'B', gap: 3, wantedDepth: 3, maxDepth: MAX })).toEqual({
      depth: 3,
      parentId: 'A1a',
      at: { id: 'A1a', zone: 'inside' },
    })
  })

  it('comes back out when dragged left, no shallower than the group after it', () => {
    // A1a, carried to the end, dragged two levels left: a setup after B.
    expect(projectGroup(items, { activeId: 'A1a', gap: 3, wantedDepth: 0, maxDepth: MAX })).toEqual(
      {
        depth: 0,
        parentId: null,
        at: { id: 'B', zone: 'after' },
      },
    )
  })

  it('lands first among the setups, naming no group, with no other setup to go beside', () => {
    const alone: Array<FlatGroup> = [{ id: 'A1', parentId: 'A', depth: 1, height: 0 }]
    expect(projectGroup(alone, { activeId: 'A1', gap: 0, wantedDepth: 0, maxDepth: MAX })).toEqual({
      depth: 0,
      parentId: null,
      at: { zone: 'first' },
    })
  })

  it('never goes deeper than the plan allows with the groups it carries', () => {
    // A shown with what it carries left out of the list.
    const carried: Array<FlatGroup> = [items[0]!, items[3]!]
    // A carries two levels: with a limit of 2 it can sit no deeper than the top.
    expect(
      projectGroup(carried, { activeId: 'A', gap: 1, wantedDepth: 4, maxDepth: 2 })?.depth,
    ).toBe(0)
  })
})
