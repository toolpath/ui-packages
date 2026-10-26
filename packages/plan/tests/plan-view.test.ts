import { describe, expect, it } from 'vitest'
import type { EnginePlan } from '../src/engine-plan'
import {
  draftView,
  featureGroups,
  featureTypeLabel,
  IGNORE,
  listsTag,
  PART_ROW,
  planCounts,
  OTHER_FOLDER_COLOR,
  UNMACHINED_FACE_COLOR,
  planHatch,
  planPaint,
  planView,
  DONE_COLOR,
  refusalClauses,
  rowsOf,
  type PlanFeatureRow,
  type PlanPart,
  type PlanSetupView,
} from '../src/plan-view'
import { addFolder, moveFolder, moveWithin, type DraftSetup } from '../src/plan-draft'

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

describe('planPaint', () => {
  const colorOf = (o: { directionIndex: number }) => 100 + o.directionIndex
  const face = (region: number, ...owners: Array<string>) => ({ region, area: 1, owners })
  const view = (id: string, directionIndex: number, features: Array<PlanFeatureRow>) => ({
    ...planView(plan(), part)[0]!,
    id,
    orientations: [{ id: `${id}-0`, direction: up, directionIndex, features }],
  })
  // Top holds the pin p; Side the pin q.
  const setups = [
    view('top', 0, [{ tag: 'p', label: 'P' }]),
    view('side', 2, [{ tag: 'q', label: 'Q' }]),
  ]
  const faces = {
    pinned: [face(1, 'p', 'a'), face(3, 'q')],
    ignored: [face(4, 'a')],
    open: [face(2, 'a'), face(5, 'c')],
    machined: [],
    notMachined: [face(6)],
  }

  const ignored = { region: 4, color: DONE_COLOR, weight: 0.6 }
  const notMachined = { region: 6, color: UNMACHINED_FACE_COLOR, weight: 0.6 }

  it('paints each face by its constraint: a pin in its folder’s colour in full, ignored slate, open bare', () => {
    const whole = [
      { region: 1, color: 100, weight: 0.85 },
      { region: 3, color: 102, weight: 0.85 },
      ignored,
      notMachined,
    ]
    expect(planPaint({ faces, setups, openId: PART_ROW, colorOf })).toEqual(whole)
    // Ignore open is no folder open either.
    expect(planPaint({ faces, setups, openId: IGNORE, colorOf })).toEqual(whole)
  })

  it('leaves what no folder covers bare where the DFM flags paint', () => {
    expect(planPaint({ faces, setups, openId: PART_ROW, colorOf, uncovered: false })).toEqual([
      { region: 1, color: 100, weight: 0.85 },
      { region: 3, color: 102, weight: 0.85 },
      ignored,
    ])
  })

  it('paints only the open folder with one open, which wins where they share a face', () => {
    // Face 3 is Side's alone: with Top open it is gray, hatched in Side's colour (`planHatch`).
    expect(planPaint({ faces, setups, openId: 'top', colorOf })).toEqual([
      { region: 1, color: 100, weight: 0.8 },
      { region: 3, color: OTHER_FOLDER_COLOR, weight: 0.75 },
      ignored,
      notMachined,
    ])
    const shared = { ...faces, pinned: [face(1, 'p', 'q')] }
    expect(planPaint({ faces: shared, setups, openId: 'side', colorOf })).toEqual([
      { region: 1, color: 102, weight: 0.8 },
      ignored,
      notMachined,
    ])
  })

  describe('planHatch', () => {
    it.each(['pinned', 'machined'] as const)(
      'hatches secondary colours on shared %s faces at the part level, keeping the first as paint',
      (kind) => {
        const shared = {
          ...faces,
          pinned: [],
          machined: [],
          [kind]: [face(1, 'p', 'q'), face(3, 'q', 'p'), face(7, 'p'), face(8, 'unlisted')],
        }
        const input = { faces: shared, setups, openId: PART_ROW, colorOf }
        expect(planPaint(input)).toEqual([
          { region: 1, color: 100, weight: 0.85 },
          { region: 3, color: 102, weight: 0.85 },
          { region: 7, color: 100, weight: 0.85 },
          ignored,
          notMachined,
        ])
        const hatches = [
          { region: 1, color: 102 },
          { region: 3, color: 100 },
        ]
        expect(planHatch(input)).toEqual(hatches)
        expect(planHatch({ ...input, openId: IGNORE })).toEqual(hatches)
        expect(planHatch({ ...input, everyFolder: false })).toEqual([])
      },
    )

    it('hatches each secondary colour once at the part level, excluding the base colour and ignored faces', () => {
      const repeated = [
        ...setups,
        view('top2', 0, [{ tag: 'r', label: 'R' }]),
        view('side2', 2, [{ tag: 's', label: 'S' }]),
        view('bottom', 1, [{ tag: 't', label: 'T' }]),
      ]
      const shared = {
        ...faces,
        pinned: [face(1, 'p', 'r', 'q', 's', 't')],
        ignored: [face(4, 'p', 'q')],
      }
      expect(planHatch({ faces: shared, setups: repeated, openId: PART_ROW, colorOf })).toEqual([
        { region: 1, color: 102 },
        { region: 1, color: 101 },
      ])
    })

    it('hatches what the other folders take in their colour, with one open', () => {
      expect(planHatch({ faces, setups, openId: 'top', colorOf })).toEqual([
        { region: 3, color: 102 },
      ])
    })

    it('hatches a face the open folder shares with another, over its own colour', () => {
      const shared = { ...faces, pinned: [face(1, 'p', 'q')] }
      expect(planHatch({ faces: shared, setups, openId: 'side', colorOf })).toEqual([
        { region: 1, color: 100 },
      ])
      expect(planPaint({ faces: shared, setups, openId: 'side', colorOf })).toContainEqual({
        region: 1,
        color: 102,
        weight: 0.8,
      })
    })

    it('reads another direction inside the open folder as the others: gray and hatched, never tinted', () => {
      const tilt = { ...view('tilt', 2, [{ tag: 'q', label: 'Q' }]), parentId: 'top' }
      // A follower faces the open folder's own way: it paints as the folder does.
      const follower = { ...view('follow', 0, [{ tag: 'r', label: 'R' }]), parentId: 'top' }
      tilt.orientations[0]!.direction = side
      const nested = [{ ...view('top', 0, [{ tag: 'p', label: 'P' }]), folders: [tilt, follower] }]
      const three = { ...faces, pinned: [face(1, 'p'), face(3, 'q'), face(7, 'r')] }
      const paint = planPaint({ faces: three, setups: nested, openId: 'top', colorOf })
      expect(paint).toContainEqual({ region: 1, color: 100, weight: 0.8 })
      expect(paint).toContainEqual({ region: 7, color: 100, weight: 0.8 })
      expect(paint).toContainEqual({ region: 3, color: OTHER_FOLDER_COLOR, weight: 0.75 })
      expect(planHatch({ faces: three, setups: nested, openId: 'top', colorOf })).toEqual([
        { region: 3, color: 102 },
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
      const both = { ...faces, pinned: [], machined: [face(1, 'p'), face(3, 'q')] }
      const paint = planPaint({ faces: both, setups: [turned], openId: 'setup', colorOf })
      expect(paint).toContainEqual({ region: 1, color: 100, weight: 0.8 })
      expect(paint).toContainEqual({ region: 3, color: OTHER_FOLDER_COLOR, weight: 0.75 })
      expect(planHatch({ faces: both, setups: [turned], openId: 'setup', colorOf })).toEqual([
        { region: 3, color: 102 },
      ])
    })

    it('leaves unshared faces unhatched at the part level, and hatches nothing with direction colours off', () => {
      expect(planHatch({ faces, setups, openId: PART_ROW, colorOf })).toEqual([])
      expect(planHatch({ faces, setups, openId: IGNORE, colorOf })).toEqual([])
      expect(planHatch({ faces, setups, openId: 'top', colorOf, everyFolder: false })).toEqual([])
    })

    it('hatches a colour once per face, and never what is ignored', () => {
      const twice = [...setups, view('side2', 2, [{ tag: 'r', label: 'R' }])]
      const both = { ...faces, pinned: [face(3, 'q', 'r')], ignored: [face(4, 'q')] }
      expect(planHatch({ faces: both, setups: twice, openId: 'top', colorOf })).toEqual([
        { region: 3, color: 102 },
      ])
    })
  })

  it('paints an ignored face slate though a pin includes it: ignored outranks pinned', () => {
    // classifyFaces has put face 1, the pin p's, under ignored: the pin's colour does not reach it.
    const overlap = { ...faces, pinned: [], ignored: [face(1, 'p', 'a')] }
    expect(planPaint({ faces: overlap, setups, openId: PART_ROW, colorOf })).toContainEqual({
      region: 1,
      color: DONE_COLOR,
      weight: 0.6,
    })
    expect(
      planPaint({ faces: overlap, setups, openId: PART_ROW, colorOf }).filter(
        (p) => p.region === 1,
      ),
    ).toHaveLength(1)
  })

  it('paints only the open folder with direction colours off, and no folder at the part level', () => {
    expect(planPaint({ faces, setups, openId: PART_ROW, colorOf, everyFolder: false })).toEqual([
      ignored,
      notMachined,
    ])
    expect(planPaint({ faces, setups, openId: 'top', colorOf, everyFolder: false })).toEqual([
      { region: 1, color: 100, weight: 0.8 },
      ignored,
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
  it('labels a pinned trimmed tag from the latest plan, and as the part does with no plan', () => {
    const draft = {
      setups: [{ id: 's-up', name: 'Top', direction: up, features: ["Y'", 'x'], folders: [] }],
    }
    const trimmedFeatures = [
      {
        featureTag: "y'",
        featureType: 'pocket',
        machiningDirection: up,
        regionIdxs: [2],
        fromFeatureTag: 'y',
      },
      // Not pinned: never a row of the constraints.
      {
        featureTag: "w'",
        featureType: 'pocket',
        machiningDirection: up,
        regionIdxs: [3],
        fromFeatureTag: 'w',
      },
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

  it('lays the draft out in its order, each folder listing its pins in the order pinned', () => {
    const setups = draftView(
      {
        setups: [
          { id: 's-side', name: 'Side first', direction: side, features: ['z'], folders: [] },
          { id: 's-up', name: 'Top', direction: up, features: ['y', 'x'], folders: [] },
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
            folders: [
              { id: 'pockets', name: 'Pockets', features: ['a'], folders: [] },
              { id: 'tilt', name: 'Tilt', direction: side, features: ['z'], folders: [] },
            ],
          },
        ],
      },
      part,
    )
    const [top] = setups
    expect(top!.process).toBe('3+2')
    expect(top!.orientations[0]!.features).toEqual([])
    expect(top!.folders.map((f) => [f.id, f.depth, f.isFrame, f.toolOrientation])).toEqual([
      ['pockets', 1, false, false],
      ['tilt', 1, true, true],
    ])
    expect(top!.folders[0]!.orientations[0]).toMatchObject({
      direction: up,
      features: [{ tag: 'a' }],
    })
    expect(top!.folders[1]!.orientations[0]!.direction).toEqual(side)
    expect(planCounts(setups)).toEqual({ setups: 1, orientations: 2 })
  })

  it('follows the folders as they are moved', () => {
    const two: Array<DraftSetup> = [
      { id: 's-up', name: 'Top', direction: up, features: ['a'], folders: [] },
      { id: 's-down', name: 'Bottom', direction: down, features: ['c'], folders: [] },
    ]
    const rows = (setups: Array<DraftSetup>) => {
      const listed = (views: ReadonlyArray<PlanSetupView>): Array<[string, Array<string>]> =>
        views.flatMap((view) => [
          [view.name, view.orientations[0]!.features.map((f) => f.tag)] as [string, Array<string>],
          ...listed(view.folders),
        ])
      return listed(draftView({ setups }, part))
    }
    const nested = moveFolder(two, 's-down', { parentId: 's-up', index: 0 }, 'parent')
    if (!Array.isArray(nested)) {
      throw new Error(nested.refused)
    }
    expect(rows(nested)).toEqual([
      ['Folder 1', []],
      ['Top', ['a']],
      ['Bottom', ['c']],
    ])
    const split = addFolder(two, 's-up', 'added', 'work')
    expect(rows(moveWithin(split, 'added', -1)).slice(0, 3)).toEqual([
      ['Top', []],
      ['Folder 1', []],
      ['Top', ['a']],
    ])
  })
})

describe('rowsOf and listsTag', () => {
  const folder: PlanSetupView = {
    id: 'f',
    name: 'Folder 1',
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
    toolOrientation: false,
    isFrame: true,
    folders: [],
  }

  it('lists the folder’s rows, and finds a tag among them spelled in any case', () => {
    expect(rowsOf(folder).map((row) => row.tag)).toEqual(['Hole1'])
    expect(listsTag(folder, 'hole1')).toBe(true)
    expect(listsTag(folder, 'other')).toBe(false)
  })
})

describe('refusalClauses', () => {
  it('lists each statement Toolpath refused', () => {
    expect(
      refusalClauses(
        'refused_user_plan: 2 statements of the user plan refused: setup 1, orientation 0: profile FeatureTag(6c74) is planned in the first setup only; setup 2: the direction was already listed; and 3 more',
      ),
    ).toEqual([
      'setup 1, orientation 0: profile FeatureTag(6c74) is planned in the first setup only',
      'setup 2: the direction was already listed',
      'and 3 more',
    ])
  })

  it('is not about any other failure', () => {
    expect(refusalClauses('geometry: the part could not be read')).toBeNull()
    expect(refusalClauses(null)).toBeNull()
  })
})

describe('featureGroups', () => {
  const hole = (tag: string, diameter?: number) => ({
    tag,
    label: `Hole ${tag}`,
    type: 'blind_hole',
    ...(diameter ? { bore: { diameter, label: `⌀${diameter} mm` } } : {}),
  })

  it('groups rows by type in the order first pinned, keeping each row’s pinned order', () => {
    const groups = featureGroups([
      { tag: 'p1', label: 'Pocket 1', type: 'pocket' },
      { tag: 'w1', label: 'Wall 1', type: 'wall' },
      { tag: 'p2', label: 'Pocket 2', type: 'pocket' },
      { tag: 'x', label: 'Feature' },
    ])
    expect(groups.map((group) => [group.label, group.tags])).toEqual([
      ['Pockets', ['p1', 'p2']],
      ['Walls', ['w1']],
      ['Other', ['x']],
    ])
    expect(groups.every((group) => group.groups.length === 0)).toBe(true)
  })

  it('groups a hole type’s rows again by bore, smallest first, unread bores after', () => {
    const [holes] = featureGroups([hole('a', 8), hole('b', 3), hole('c'), hole('d', 8.00001)])
    expect(holes!.label).toBe('Blind holes')
    expect(holes!.groups.map((group) => [group.level, group.label, group.tags])).toEqual([
      ['bore', '⌀3 mm', ['b']],
      ['bore', '⌀8 mm', ['a', 'd']],
    ])
    expect(holes!.rows.map((row) => row.tag)).toEqual(['c'])
    expect(holes!.tags).toEqual(['b', 'a', 'd', 'c'])
  })
})
