import { describe, expect, it } from 'vitest'
import { flattenFolders, gapAt, projectFolder, type FlatFolder } from '../src/folder-sort'

const INDENT = 25
const MAX = 6

/*
  Two setups, the first holding a folder that holds another:

    A
      A1
        A1a
    B
*/
const tree = [
  {
    id: 'A',
    parentId: null,
    depth: 0,
    folders: [
      {
        id: 'A1',
        parentId: 'A',
        depth: 1,
        folders: [{ id: 'A1a', parentId: 'A1', depth: 2, folders: [] }],
      },
    ],
  },
  { id: 'B', parentId: null, depth: 0, folders: [] },
]
const open = () => true

describe('flattenFolders', () => {
  it('lists the folders shown in tree order, with how deep each one carries', () => {
    expect(flattenFolders(tree, open)).toEqual([
      { id: 'A', parentId: null, depth: 0, height: 2 },
      { id: 'A1', parentId: 'A', depth: 1, height: 1 },
      { id: 'A1a', parentId: 'A1', depth: 2, height: 0 },
      { id: 'B', parentId: null, depth: 0, height: 0 },
    ])
  })

  it('leaves out what a closed folder holds, and what the carried one does', () => {
    expect(flattenFolders(tree, (id) => id !== 'A1').map((item) => item.id)).toEqual([
      'A',
      'A1',
      'B',
    ])
    expect(flattenFolders(tree, open, 'A').map((item) => item.id)).toEqual(['A', 'B'])
  })
})

describe('gapAt', () => {
  it('counts the rows above the pointer, leaving the carried one out', () => {
    const centres = [
      { id: 'A', centreY: 15 },
      { id: 'B', centreY: 45 },
      { id: 'C', centreY: 75 },
    ]
    expect(gapAt(centres, 'B', 50)).toBe(1)
    expect(gapAt(centres, 'B', 5)).toBe(0)
    expect(gapAt(centres, 'B', 90)).toBe(2)
  })
})

describe('projectFolder', () => {
  const items: Array<FlatFolder> = flattenFolders(tree, open)

  it('lands where it already is as no drop at all', () => {
    // B's own gap: after the three folders above it.
    expect(projectFolder(items, 'B', 3, 0, INDENT, MAX)?.at).toBeNull()
  })

  it('moves a setup to before another, kept at the top level', () => {
    expect(projectFolder(items, 'B', 0, 0, INDENT, MAX)).toEqual({
      depth: 0,
      parentId: null,
      at: { id: 'A', zone: 'before' },
    })
  })

  it('goes into a folder from the gap under its row, before what is already in it', () => {
    // Between A and A1: no shallower than A1, so inside A, ahead of it.
    expect(projectFolder(items, 'B', 1, 0, INDENT, MAX)).toEqual({
      depth: 1,
      parentId: 'A',
      at: { id: 'A1', zone: 'before' },
    })
  })

  it('goes inside the folder above when dragged a level right, at the end of it', () => {
    expect(projectFolder(items, 'B', 3, INDENT, INDENT, MAX)).toEqual({
      depth: 1,
      parentId: 'A',
      at: { id: 'A1', zone: 'after' },
    })
    // Further right: inside A1a, the folder just above it.
    expect(projectFolder(items, 'B', 3, INDENT * 3, INDENT, MAX)).toEqual({
      depth: 3,
      parentId: 'A1a',
      at: { id: 'A1a', zone: 'inside' },
    })
  })

  it('comes back out when dragged left, no shallower than the folder after it', () => {
    // A1a, carried to the end, dragged two levels left: a setup after B.
    expect(projectFolder(items, 'A1a', 3, -INDENT * 2, INDENT, MAX)).toEqual({
      depth: 0,
      parentId: null,
      at: { id: 'B', zone: 'after' },
    })
  })

  it('never goes deeper than the plan allows with the folders it carries', () => {
    const carried = flattenFolders(tree, open, 'A')
    // A carries two levels: with a limit of 2 it can sit no deeper than the top.
    expect(projectFolder(carried, 'A', 1, INDENT * 4, INDENT, 2)?.depth).toBe(0)
  })
})
