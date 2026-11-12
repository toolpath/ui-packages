import { describe, expect, it } from 'vitest'
import type { EnginePlan } from '../../src/results/plan'
import {
  draftView,
  featureSections,
  featureTypeLabel,
  listsTag,
  planCounts,
  refusalClauses,
  rowsOf,
  sharedFaces,
  shownFaces,
} from '../../src/details/view'
import {
  planView,
  type PlanFeatureRow,
  type PlanPart,
  type PlanSetupView,
} from '../../src/results/plan-view'
import { addGroup, moveGroup, moveWithin, type DraftSetup } from '../../src/draft/constraints'
import { trimmedFeature } from '../trimmed-feature'

const up = { x: 0, y: 0, z: 1 }
const down = { x: 0, y: 0, z: -1 }
const side = { x: 1, y: 0, z: 0 }

const part: PlanPart = {
  directionIndex: (direction) =>
    [up, down, side].findIndex((d) => d.z === direction.z && d.x === direction.x),
  featureLabel: (tag) => `Pocket ${tag}`,
}

const plan = (overrides: Partial<EnginePlan> = {}): EnginePlan => ({
  planId: 'plan-1',
  jobId: null,
  level: 'toolpathed',
  kernelVersion: '0.17.0',
  issues: [],
  setups: [
    {
      idx: 0,
      direction: up,
      unmachined: ['c'],
      actions: [
        { idx: 0, toolName: 'Face', featureTags: ['a'] },
        { idx: 1, toolName: 'Flat', featureTags: ['b', 'a'] },
      ],
    },
    { idx: 1, direction: side, unmachined: [], actions: [] },
  ],
  setupPlan: null,
  trimmedFeatures: [],
  ...overrides,
})

describe('planView', () => {
  it('reads each setup’s features off its passes when the Engine states no plan', () => {
    const [top, second] = planView(plan(), part)
    expect(top).toMatchObject({
      name: 'Setup 1',
      process: '3axis',
      operations: 2,
      orientations: [
        {
          direction: up,
          directionIndex: 0,
          features: [
            { tag: 'a', label: 'Pocket a' },
            { tag: 'b', label: 'Pocket b' },
          ],
        },
      ],
      notMachined: [{ tag: 'c', label: 'Pocket c' }],
    })
    expect(second!.orientations).toEqual([
      expect.objectContaining({ direction: side, directionIndex: 2, features: [] }),
    ])
  })

  it('says which of what a setup leaves a pass still cuts: roughed, not finished (MP-22)', () => {
    const [top] = planView(
      plan({
        setups: [
          {
            idx: 0,
            direction: up,
            unmachined: ['c', 'b'],
            actions: [{ idx: 0, toolName: 'Flat', featureTags: ['a', 'b'] }],
          },
        ],
      }),
      part,
    )
    expect(top!.notMachined.map((row) => row.tag)).toEqual(['c', 'b'])
    expect(top!.notFinished).toEqual(['b'])
  })

  it('takes every direction of a 3+2 setup from the plan’s own statement', () => {
    const setups = planView(
      plan({
        setupPlan: {
          setups: [
            {
              orientations: [
                { direction: up, features: ['a'] },
                { direction: down, features: ['d'] },
              ],
            },
            { orientations: [{ direction: side, features: [] }] },
          ],
        },
      }),
      part,
    )
    expect(setups[0]!.process).toBe('3+2')
    expect(
      setups[0]!.orientations.map((o) => [o.directionIndex, o.features.map((f) => f.tag)]),
    ).toEqual([
      [0, ['a']],
      [1, ['d']],
    ])
    expect(planCounts(setups)).toEqual({ setups: 2, orientations: 3 })
  })
})

describe('shownFaces', () => {
  const directions = [up, down, side]
  const face = (region: number, ...owners: Array<string>) => ({ region, area: 1, owners })
  const view = (id: string, directionIndex: number, features: Array<PlanFeatureRow>) => ({
    ...planView(plan(), part)[0]!,
    id,
    orientations: [
      { id: `${id}-0`, direction: directions[directionIndex]!, directionIndex, features },
    ],
  })
  // Top holds the assignment p; Side the assignment q.
  const setups = [
    view('top', 0, [{ tag: 'p', label: 'P' }]),
    view('side', 2, [{ tag: 'q', label: 'Q' }]),
  ]
  const faces = {
    assigned: [face(1, 'p', 'a'), face(3, 'q')],
    atShape: [],
    done: [face(4, 'a')],
    open: [face(2, 'a'), face(5, 'c')],
    machined: [],
    notMachined: [face(6)],
  }

  const inDirection = (region: number, directionIndex: number) => ({
    region,
    kind: 'direction',
    direction: directions[directionIndex],
    directionIndex,
  })
  const otherDirection = (region: number) => ({ region, kind: 'otherDirection' })
  const sharedWith = (region: number, directionIndex: number) => ({
    region,
    direction: directions[directionIndex],
    directionIndex,
  })
  const done = { region: 4, kind: 'done' }
  const notMachined = { region: 6, kind: 'notMachined' }

  it('shows each face by its constraint: an assignment in its group’s direction, done, open not listed', () => {
    const whole = [inDirection(1, 0), inDirection(3, 2), done, notMachined]
    expect(shownFaces({ faces, setups, openId: null })).toEqual(whole)
    // An id no group has is no group open either.
    expect(shownFaces({ faces, setups, openId: 'gone' })).toEqual(whole)
  })

  it('shows a face at shape in its stock body as at shape, before the done, where the app shows something else', () => {
    const atShape = { ...faces, atShape: [face(7, 'a')] }
    expect(shownFaces({ faces: atShape, setups, openId: null, uncovered: false })).toEqual([
      inDirection(1, 0),
      inDirection(3, 2),
      { region: 7, kind: 'atShape' },
      done,
    ])
  })

  it('leaves out what no group covers where the app shows something else there', () => {
    expect(shownFaces({ faces, setups, openId: null, uncovered: false })).toEqual([
      inDirection(1, 0),
      inDirection(3, 2),
      done,
    ])
  })

  it('shows only the open group’s direction with one open, which wins where they share a face', () => {
    // Face 3 is Side's alone: with Top open it is another direction's, shared with Side.
    expect(shownFaces({ faces, setups, openId: 'top' })).toEqual([
      inDirection(1, 0),
      otherDirection(3),
      done,
      notMachined,
    ])
    const shared = { ...faces, assigned: [face(1, 'p', 'q')] }
    expect(shownFaces({ faces: shared, setups, openId: 'side' })).toEqual([
      inDirection(1, 2),
      done,
      notMachined,
    ])
  })

  describe('sharedFaces', () => {
    it.each(['assigned', 'machined'] as const)(
      'lists the other directions of shared %s faces at the part level, the first shown',
      (kind) => {
        const shared = {
          ...faces,
          assigned: [],
          machined: [],
          [kind]: [face(1, 'p', 'q'), face(3, 'q', 'p'), face(7, 'p'), face(8, 'unlisted')],
        }
        const input = { faces: shared, setups, openId: null }
        expect(shownFaces(input)).toEqual([
          inDirection(1, 0),
          inDirection(3, 2),
          inDirection(7, 0),
          done,
          notMachined,
        ])
        const others = [sharedWith(1, 2), sharedWith(3, 0)]
        expect(sharedFaces(input)).toEqual(others)
        expect(sharedFaces({ ...input, openId: 'gone' })).toEqual(others)
        expect(sharedFaces({ ...input, everyGroup: false })).toEqual([])
      },
    )

    it('lists each other direction once at the part level, leaving out the first and done faces', () => {
      const repeated = [
        ...setups,
        view('top2', 0, [{ tag: 'r', label: 'R' }]),
        view('side2', 2, [{ tag: 's', label: 'S' }]),
        view('bottom', 1, [{ tag: 't', label: 'T' }]),
      ]
      const shared = {
        ...faces,
        assigned: [face(1, 'p', 'r', 'q', 's', 't')],
        done: [face(4, 'p', 'q')],
      }
      expect(sharedFaces({ faces: shared, setups: repeated, openId: null })).toEqual([
        sharedWith(1, 2),
        sharedWith(1, 1),
      ])
    })

    it('lists what the other groups take in their direction, with one open', () => {
      expect(sharedFaces({ faces, setups, openId: 'top' })).toEqual([sharedWith(3, 2)])
    })

    it('lists the other direction of a face the open group shares, shown in its own', () => {
      const shared = { ...faces, assigned: [face(1, 'p', 'q')] }
      expect(sharedFaces({ faces: shared, setups, openId: 'side' })).toEqual([sharedWith(1, 0)])
      expect(shownFaces({ faces: shared, setups, openId: 'side' })).toContainEqual(
        inDirection(1, 2),
      )
    })

    it('reads another direction inside the open group as the others: another direction’s, shared', () => {
      const tilt = { ...view('tilt', 2, [{ tag: 'q', label: 'Q' }]), parentId: 'top' }
      // A follower faces the open group's own way: it shows as the group does.
      const follower = { ...view('follow', 0, [{ tag: 'r', label: 'R' }]), parentId: 'top' }
      const nested = [{ ...view('top', 0, [{ tag: 'p', label: 'P' }]), groups: [tilt, follower] }]
      const three = { ...faces, assigned: [face(1, 'p'), face(3, 'q'), face(7, 'r')] }
      const shown = shownFaces({ faces: three, setups: nested, openId: 'top' })
      expect(shown).toContainEqual(inDirection(1, 0))
      expect(shown).toContainEqual(inDirection(7, 0))
      expect(shown).toContainEqual(otherDirection(3))
      expect(sharedFaces({ faces: three, setups: nested, openId: 'top' })).toEqual([
        sharedWith(3, 2),
      ])
    })

    it('reads a 3+2 setup’s other ways as other directions, its first the one selected', () => {
      const turned = {
        ...view('setup', 0, []),
        orientations: [
          { id: 's-0', direction: up, directionIndex: 0, features: [{ tag: 'p', label: 'P' }] },
          { id: 's-1', direction: side, directionIndex: 2, features: [{ tag: 'q', label: 'Q' }] },
        ],
      }
      const both = { ...faces, assigned: [], machined: [face(1, 'p'), face(3, 'q')] }
      const shown = shownFaces({ faces: both, setups: [turned], openId: 'setup' })
      expect(shown).toContainEqual(inDirection(1, 0))
      expect(shown).toContainEqual(otherDirection(3))
      expect(sharedFaces({ faces: both, setups: [turned], openId: 'setup' })).toEqual([
        sharedWith(3, 2),
      ])
    })

    it('lists nothing for unshared faces at the part level, nor with direction colours off', () => {
      expect(sharedFaces({ faces, setups, openId: null })).toEqual([])
      expect(sharedFaces({ faces, setups, openId: 'gone' })).toEqual([])
      expect(sharedFaces({ faces, setups, openId: 'top', everyGroup: false })).toEqual([])
    })

    it('lists a direction once per face, and never what is done', () => {
      const twice = [...setups, view('side2', 2, [{ tag: 'r', label: 'R' }])]
      const both = { ...faces, assigned: [face(3, 'q', 'r')], done: [face(4, 'q')] }
      expect(sharedFaces({ faces: both, setups: twice, openId: 'top' })).toEqual([sharedWith(3, 2)])
    })
  })

  it('shows a done face as done though an assignment includes it: done outranks assigned', () => {
    // classifyFaces has put face 1, the assignment p's, under done: the assignment's direction
    // does not reach it.
    const overlap = { ...faces, assigned: [], done: [face(1, 'p', 'a')] }
    const shown = shownFaces({ faces: overlap, setups, openId: null })
    expect(shown.filter((each) => each.region === 1)).toEqual([{ region: 1, kind: 'done' }])
  })

  it('shows only the open group with direction colours off, and no group at the part level', () => {
    expect(shownFaces({ faces, setups, openId: null, everyGroup: false })).toEqual([
      done,
      notMachined,
    ])
    expect(shownFaces({ faces, setups, openId: 'top', everyGroup: false })).toEqual([
      inDirection(1, 0),
      done,
      notMachined,
    ])
  })
})

describe('featureTypeLabel', () => {
  it('says a feature type the way a person does', () => {
    expect(featureTypeLabel('open_pocket')).toBe('Open pocket')
  })
})

describe('draftView', () => {
  it('labels an assigned trimmed tag from the latest plan, and as the part does with no plan', () => {
    const draft = {
      setups: [{ id: 's-up', name: 'Top', direction: up, features: ["Y'", 'x'], groups: [] }],
    }
    const trimmedFeatures = [
      trimmedFeature({ featureTag: "y'", regionIdxs: [2], fromFeatureTag: 'y' }),
      // Not assigned: never a row of the constraints.
      trimmedFeature({ featureTag: "w'", regionIdxs: [3], fromFeatureTag: 'w' }),
    ]
    const rows = (plan: Parameters<typeof draftView>[2]) =>
      draftView(draft, part, plan).flatMap(rowsOf)
    expect(rows({ trimmedFeatures })).toEqual([
      { tag: "Y'", label: 'Pocket y (trimmed)', type: 'pocket', trimmed: true },
      { tag: 'x', label: 'Pocket x', type: undefined },
    ])
    expect(rows(null)).toEqual(draftView(draft, part).flatMap(rowsOf))
    expect(rows(null)[0]).toEqual({ tag: "Y'", label: "Pocket Y'", type: undefined })
  })

  it('lays the draft out in its order, each group listing its assignments in the order assigned', () => {
    const setups = draftView(
      {
        setups: [
          { id: 's-side', name: 'Side first', direction: side, features: ['z'], groups: [] },
          { id: 's-up', name: 'Top', direction: up, features: ['y', 'x'], groups: [] },
        ],
      },
      part,
    )
    expect(setups.map((s) => [s.id, s.name, s.isFrame])).toEqual([
      ['s-side', 'Side first', true],
      ['s-up', 'Top', true],
    ])
    expect(setups[0]!.orientations[0]).toMatchObject({
      direction: side,
      directionIndex: 2,
      features: [{ tag: 'z', label: 'Pocket z' }],
    })
    expect(setups[1]!.orientations[0]!.features.map((f) => f.tag)).toEqual(['y', 'x'])
  })

  it('shows a tilt as a frame of its own, and a follower cut from its parent’s way', () => {
    const setups = draftView(
      {
        setups: [
          {
            id: 's-up',
            name: 'Top',
            direction: up,
            process: '3+2',
            features: [],
            groups: [
              { id: 'pockets', name: 'Pockets', features: ['a'], groups: [] },
              { id: 'tilt', name: 'Tilt', direction: side, features: ['z'], groups: [] },
            ],
          },
        ],
      },
      part,
    )
    const [top] = setups
    expect(top!.process).toBe('3+2')
    expect(top!.orientations[0]!.features).toEqual([])
    expect(top!.groups.map((f) => [f.id, f.depth, f.isFrame, f.orientation])).toEqual([
      ['pockets', 1, false, false],
      ['tilt', 1, true, true],
    ])
    expect(top!.groups[0]!.orientations[0]).toMatchObject({
      direction: up,
      features: [{ tag: 'a' }],
    })
    expect(top!.groups[1]!.orientations[0]!.direction).toEqual(side)
    expect(planCounts(setups)).toEqual({ setups: 1, orientations: 2 })
  })

  it('follows the groups as they are moved', () => {
    const two: Array<DraftSetup> = [
      { id: 's-up', name: 'Top', direction: up, features: ['a'], groups: [] },
      { id: 's-down', name: 'Bottom', direction: down, features: ['c'], groups: [] },
    ]
    const rows = (setups: Array<DraftSetup>) => {
      const listed = (views: ReadonlyArray<PlanSetupView>): Array<[string, Array<string>]> =>
        views.flatMap((view) => [
          [view.name, view.orientations[0]!.features.map((f) => f.tag)] as [string, Array<string>],
          ...listed(view.groups),
        ])
      return listed(draftView({ setups }, part))
    }
    const nested = moveGroup(two, {
      id: 's-down',
      to: { parentId: 's-up', index: 0 },
      newId: 'parent',
    })
    if (!Array.isArray(nested)) {
      throw new Error(nested.refused.kind)
    }
    expect(rows(nested)).toEqual([
      ['Group 1', []],
      ['Top', ['a']],
      ['Bottom', ['c']],
    ])
    const split = addGroup(two, { parentId: 's-up', id: 'added', workId: 'work' })
    expect(rows(moveWithin(split, 'added', -1)).slice(0, 3)).toEqual([
      ['Top', []],
      ['Group 1', []],
      ['Top', ['a']],
    ])
  })
})

describe('rowsOf and listsTag', () => {
  const group: PlanSetupView = {
    id: 'f',
    name: 'Group 1',
    process: '3axis',
    orientations: [
      {
        id: 'f-0',
        direction: up,
        directionIndex: 0,
        features: [{ tag: 'Hole1', label: 'Hole 1' }],
      },
    ],
    depth: 0,
    setupId: 'f',
    parentId: null,
    orientation: false,
    isFrame: true,
    groups: [],
  }

  it('lists the group’s rows, and finds a tag among them spelled in any case', () => {
    expect(rowsOf(group).map((row) => row.tag)).toEqual(['Hole1'])
    expect(listsTag(group, 'hole1')).toBe(true)
    expect(listsTag(group, 'other')).toBe(false)
  })
})

describe('refusalClauses', () => {
  it('lists each statement Toolpath refused', () => {
    expect(
      refusalClauses(
        'refused_user_plan: 2 statements of the user plan refused: setup 1, orientation 0: profile FeatureTag(6c74) is planned in the first setup only; setup 2: the direction was already listed; and 3 more',
      ),
    ).toEqual([
      {
        kind: 'clause',
        text: 'setup 1, orientation 0: profile FeatureTag(6c74) is planned in the first setup only',
      },
      { kind: 'clause', text: 'setup 2: the direction was already listed' },
      { kind: 'clause', text: 'and 3 more' },
    ])
  })

  it('gives faces marked done on another analysis as kinds, with no words of its own', () => {
    expect(refusalClauses('stale_regions: 4, 6 were marked on kernel 0.9')).toEqual([
      { kind: 'staleRegions' },
    ])
    expect(refusalClauses('unknown_regions: 4012')).toEqual([{ kind: 'unknownRegions' }])
  })

  it('is not about any other failure', () => {
    expect(refusalClauses('geometry: the part could not be read')).toBeNull()
    expect(refusalClauses(null)).toBeNull()
  })
})

describe('featureSections', () => {
  const hole = (tag: string, diameter?: number) => ({
    tag,
    label: `Hole ${tag}`,
    type: 'blind_hole',
    ...(diameter ? { bore: { diameter, label: `⌀${diameter} mm` } } : {}),
  })

  it('sections rows by type in the order first assigned, keeping each row’s assigned order', () => {
    const sections = featureSections([
      { tag: 'p1', label: 'Pocket 1', type: 'pocket' },
      { tag: 'w1', label: 'Wall 1', type: 'wall' },
      { tag: 'p2', label: 'Pocket 2', type: 'pocket' },
      { tag: 'x', label: 'Feature' },
    ])
    expect(sections.map((section) => [section.label, section.tags])).toEqual([
      ['Pockets', ['p1', 'p2']],
      ['Walls', ['w1']],
      ['Other', ['x']],
    ])
    expect(sections.every((section) => section.sections.length === 0)).toBe(true)
  })

  it('sections a hole type’s rows again by bore, smallest first, unread bores after', () => {
    const [holes] = featureSections([hole('a', 8), hole('b', 3), hole('c'), hole('d', 8.00001)])
    expect(holes!.label).toBe('Blind holes')
    expect(holes!.sections.map((section) => [section.level, section.label, section.tags])).toEqual([
      ['bore', '⌀3 mm', ['b']],
      ['bore', '⌀8 mm', ['a', 'd']],
    ])
    expect(holes!.rows.map((row) => row.tag)).toEqual(['c'])
    expect(holes!.tags).toEqual(['b', 'a', 'd', 'c'])
  })
})
