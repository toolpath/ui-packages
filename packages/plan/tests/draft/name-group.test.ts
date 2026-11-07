import { describe, expect, it } from 'vitest'
import { applyDraftAction } from '../../src/draft/actions'
import {
  addGroup,
  addSetup,
  assignInto,
  type DraftSetup,
  findPlaced,
  groupsFromPlan,
  moveGroup,
  type NameGroup,
  nextGroupName,
  parseDraftSetups,
  planFromResults,
  type PlanRules,
} from '../../src/draft/constraints'

/*
  An app names new groups in its own word (`PlanRules.nameGroup`): every edit that makes a group
  names it so, and a stored group with no name too. Left out, a new group is "Group N".
*/

const up = { x: 0, y: 0, z: 1 }
const side = { x: 1, y: 0, z: 0 }

const nameFolder: NameGroup = (taken) => nextGroupName(taken, 'Folder')

/** A setup holding two groups, so an edit inside it adds a group rather than splitting one. */
const tree: Array<DraftSetup> = [
  {
    id: 'top',
    name: 'Top',
    direction: up,
    features: [],
    groups: [
      { id: 'x', name: 'X', features: ['a'], groups: [] },
      { id: 'y', name: 'Y', features: ['b'], groups: [] },
    ],
  },
]

const nameOf = (setups: ReadonlyArray<DraftSetup>, id: string): string | undefined =>
  findPlaced(setups, id)?.group.name

describe('nextGroupName', () => {
  it('numbers past the highest name in the word given, and names a group "Group N" by default', () => {
    expect(nextGroupName(['Folder 2', 'Group 7'], 'Folder')).toBe('Folder 3')
    expect(nextGroupName(['Folder 2'])).toBe('Group 1')
  })

  it('takes each character of the word as itself', () => {
    expect(nextGroupName(['A.B 1', 'AxB 4'], 'A.B')).toBe('A.B 2')
  })
})

describe('nameGroup', () => {
  it('names the group addGroup adds', () => {
    expect(
      nameOf(
        addGroup(tree, { parentId: 'top', id: 'new', workId: 'work', nameGroup: nameFolder }),
        'new',
      ),
    ).toBe('Folder 1')
  })

  it('names the setup addSetup adds', () => {
    expect(addSetup(tree, side, 'new', nameFolder).at(-1)?.name).toBe('Folder 1')
  })

  it('names the group an assignment into a parent adds', () => {
    const result = assignInto(tree, {
      groupId: 'top',
      tag: 'c',
      newId: 'new',
      nameGroup: nameFolder,
    })
    expect('setups' in result && nameOf(result.setups, 'new')).toBe('Folder 1')
  })

  it('names the parent a group dropped on another is wrapped in', () => {
    const moved = moveGroup(tree, {
      id: 'y',
      to: { parentId: 'x', index: 0 },
      newId: 'p',
      nameGroup: nameFolder,
    })
    expect(Array.isArray(moved) && nameOf(moved, 'p')).toBe('Folder 1')
  })

  it('names the groups stated from Toolpath’s plan', () => {
    let count = 0
    const newId = () => `id-${(count += 1)}`
    const planned = [{ orientations: [{ direction: up }] }, { orientations: [{ direction: side }] }]
    expect(groupsFromPlan(planned, newId, nameFolder).map((setup) => setup.name)).toEqual([
      'Folder 1',
      'Folder 2',
    ])
    expect(planFromResults(planned, newId, nameFolder).map((setup) => setup.name)).toEqual([
      'Folder 1',
      'Folder 2',
    ])
  })

  it('names a group stored with no name', () => {
    const parsed = parseDraftSetups(
      [{ id: 's', name: ' ', direction: up, features: [], groups: [] }],
      nameFolder,
    )
    expect(Array.isArray(parsed) && parsed[0]?.name).toBe('Folder 1')
  })

  it('names a group an action adds, from the rules', () => {
    const rules: PlanRules = { regionsOf: () => [], kernel: null, nameGroup: nameFolder }
    const result = applyDraftAction(
      { setups: tree, done: [], doneKernel: null },
      { kind: 'addGroup', parentId: 'top', id: 'new', workId: 'work' },
      rules,
    )
    expect('draft' in result && nameOf(result.draft.setups, 'new')).toBe('Folder 1')
  })
})
