# @toolpath/plan

Plan mode for Toolpath: the plan a person states for a part, every edit they can make to it, and the
plan Toolpath makes from it. A person sets up the ways the part is held, groups work in folders,
pins features where they want them cut and ignores faces that need no work. These are plain
functions over plain data, with no React, no DOM and no database, so a server and a browser can
read the same rules. Use it in any app that plans parts with Toolpath: a quoting app, a planning
app or a CAM tool.

```sh
pnpm add @toolpath/plan
```

```ts
import { actionsFor, applyDraftAction, planPage, statementOf } from '@toolpath/plan'
```

The package is logic only: no React, no DOM and no CSS, and no dependencies. A view over these
rules belongs in `@toolpath/ui`. `@toolpath/plan/parts` and `@toolpath/plan/clicks` are the other
entries (see [The Plan page](#the-plan-page-planpage)). The stock, the tool crib and units are in
[`@toolpath/quoting`](../quoting): `@toolpath/quoting/inputs` and `@toolpath/quoting/units`.

## Your app's own fields

The draft holds only what Toolpath plans from. Your app keeps its own fields beside it, such as
when it was saved, who changed it, or the material picked. `applyDraftAction` takes any object that
holds the constraints and gives it back with your fields as they were:

```ts
import type { Constraints } from '@toolpath/plan'

interface MyDraft extends Constraints {
  savedAt: string | null
}
```

For example, `@toolpath/quoting/plan` is the quoting app's draft, made this way.

## Two layers

A page holds the person's edits until they choose to send them: that step is called Apply in
these docs, and Discard throws the edits away.

Plan mode has two layers:

- **The draft** (`Constraints`): what a person asks for. It holds setups, the folders inside them,
  the features pinned to each folder, and the faces ignored. It starts empty: with nothing stated,
  Toolpath plans the part itself.
- **The plan** (`EnginePlan`): what Toolpath planned. It holds setups, each with its direction and
  its actions, and the issues it could not reach.

The draft goes to Toolpath, and the plan comes back. A person can start a draft from the plan's
setups, each read as a `PlannedSetup`: its directions and the features it takes:

```
draft ──statementOf──▶ job's setupPlan ──▶ Toolpath ──▶ EnginePlan
  ▲                                                       │
  └──────── planFromResults / foldersFromPlan ◀── PlannedSetup
```

Each edit is a function from the draft as it is to the draft as it will be. These always answer a draft:
`addFolder`, `renameFolder`, `removeFolder`, `moveSetup`, `moveWithin`, `unpinFeature`, and, for
ignored faces, `withIgnored` and `withoutIgnored`. These return `{ refused }` with a reason to show
when the edit cannot be made: `setSetupProcess`, `setToolOrientation`, `moveFolder`,
`moveFeature`, `pinInto` and `pinFrom`. Nothing here throws on typed input; read a stored draft
through `parseDraftSetups` first.
`parseDraftSetups` checks stored data before it is used.

`classifyFaces` (in `/parts`) reads what the draft and the plan leave of each face: pinned,
ignored, open, machined or not machined (`COVERAGE_KINDS`). A viewer paints faces from it.

### Trimmed features

A plan's tags (an action's `featureTags`, its `setupPlan`, a setup's `unmachined`) can name a
feature the part's report does not list: what is left of a report feature once a statement keeps
some of its faces away. Ignored faces trim from API 1.30.0; a pinned feature sharing faces with it,
maybe from another direction, trims from the Engine release that plans with tp-kernel 0.29.
Toolpath serves these as the plan's `trimmedFeatures`, which `EnginePlan` holds as optional: null
or absent from an older Engine, read as none (`trimmedFeaturesOf`). Toolpath keeps each trimmed
feature for the part, so a draft can pin its tag and a statement sent back can name it.

`planFeaturesOf(reportFeatures, plan, pinned?)` is the one join of plan tags to features: the
report's features, then each trimmed one shaped as a report feature, marked `trimmed: true` and
with its `fromFeatureTag`. A trimmed tag the report lists already is the report's feature, here
and in a row alike (`unlistedTrimmedFeatures`). Pass it as `features` to `classifyFaces` and
`groupFaces`, so a trimmed feature's faces read as machined where the plan cuts it. The
constraints view passes its pins too: a trimmed feature is in it only where it is pinned. Its faces
never include an ignored face, so pinning one un-ignores nothing.

`planView` and `resultsView` mark a trimmed tag's row `trimmed` and label it from what it was
trimmed from, `Pocket (trimmed)`, or from its own type where Toolpath does not say
(`trimmedFeatureLabel`). The row takes its origin's bore (`featureBore`) where the trimmed type is
the origin's, so a trimmed hole groups with the holes of its bore; where the type changed, it has
none. A tag the part has a type for (`featureType`) is the report's, and reads as the report's row:
`PlanPart` reads the report alone. `draftView(draft, part, plan)` reads a pinned trimmed tag the
same way from the latest plan, and as the part labels it with none. `planFromResults` (and
`fromPlan` with `pins`) pins trimmed tags where they were planned, as it pins any feature.

What the app does:

- Parse the plan's `trimmedFeatures` into `EnginePlan`.
- With `planPage`, nothing more for the views: it passes `planFeaturesOf` to `classifyFaces` and
  `groupFaces`, and the latest plan to `draftView`. An app that builds its page from `/parts`
  passes `planFeaturesOf` with the pins (`pinned`) in the constraints view, without them in the
  results view, and the latest plan to `draftView`.
- Look a tag's faces up for selection, zoom and `PlanRules.regionsOf` through `planFeaturesOf`,
  so a trimmed tag resolves to its own faces.
- DFM: count a trimmed tag's time and flags under its `fromFeatureTag`'s rules. The rules are the
  app's, so the package does not look them up.

## Edits: one menu, one function, one question

A page edits the draft through three things, and nothing else:

- `DraftAction`: every edit a person can make, as one closed list. Each action carries all it
  needs, so the same action on the same draft gives the same plan: a new id for anything it makes,
  which must not be in the draft yet, and for a feature the direction it was read from.
- `applyDraftAction(draft, action, rules, saved)`: carries out any action. It answers `{ draft }`,
  with `facts` for the status line and, where Toolpath's own app opens a folder after it, that
  folder's `folderId`; or `{ refused }`, the reason to show the person. An action that changes
  nothing answers the draft as it was. `saved`, the plan as applied, is what a pick among a click's
  readings puts back; the session passes it.
- `actionsFor(draft, target, rules)`: what can be done here. The target is the part, a folder, a
  feature read from a direction, or faces picked on the part. A page offers these kinds of action,
  and no others. Three follow other controls: the two picks among a click's readings, offered
  where a click read more than one feature, and `fromPlan`, offered while the plan holds no folders
  and Toolpath has planned the part.

A drag says why a drop can't be made while it hovers: try the drop with `applyDraftAction` and show
its `refused`. The tree's top row (the part) is no folder, so a page says "Rows go into a folder."
for a feature's row dropped there itself. A folder dropped where it already is changes nothing, and the page
opens nothing for it.

After a pick among an Ignore click's readings, the pick is the click: send the next pick with
`click: { tag, regions: rules.regionsOf(tag) }` for the feature picked.

`rules` (`PlanRules`) reads the part: the faces of each feature, and the kernel that numbers them.

```ts
import { actionsFor, applyDraftAction, type DraftAction } from '@toolpath/plan'

const offered = actionsFor(draft, { folder: 'holes' }, rules) // show these as buttons

const press = (action: DraftAction) => {
  const result = applyDraftAction(draft, action, rules)
  if ('refused' in result) {
    showMessage(result.refused)
  } else {
    setDraft(result.draft)
  }
}
```

| Kind                  | What it does                                                                                      |
| --------------------- | ------------------------------------------------------------------------------------------------- |
| `addFolder`           | A folder inside another, at the end                                                               |
| `renameFolder`        | A new name                                                                                        |
| `remove`              | What Delete removes: folders (setups too) with all they hold, and pins; every setup is Remove all |
| `moveFolder`          | A folder dropped in the tree: reordered, into a folder, or to the top                             |
| `moveWithin`          | A folder moved up or down beside its neighbors                                                    |
| `addSetup`            | A setup facing a direction nothing faces yet                                                      |
| `setProcess`          | Hold a setup 3 axis, 3+1 or 3+2                                                                   |
| `setToolOrientation`  | A folder in an indexed setup tilted to a direction of its own, or not                             |
| `pinInto`             | In an open folder: a left click pins the feature there, a right click takes out one pinned there  |
| `pinFrom`             | The feature pinned in the folder facing its direction, or a new setup; let go if pinned that way  |
| `moveFeature`         | A feature's row dropped on a folder: pinned there                                                 |
| `unpin`               | The feature let go: Toolpath decides where it is machined                                         |
| `ignore`              | Faces ignored; a pin whose every face is ignored is let go                                        |
| `unignore`            | Faces no longer ignored                                                                           |
| `choosePinReading`    | After a click in a folder read several features: another of them meant instead                    |
| `chooseIgnoreReading` | After an Ignore click read several features: another of them ignored instead                      |
| `fromPlan`            | Start from Toolpath's plan: its setups as folders, and with `pins` its features pinned            |

Each kind makes the plan Toolpath's own app makes for the same click; the package's tests hold each
to the app's own helper. A pin,
of any kind, does what pinning does there: the person's pins whose every face it covers are let go,
and its own faces are no longer ignored. Pinning a feature where it is pinned already lets it go, as
a right click does. A left click on a feature in the open folder already sends nothing: it stays,
and a pick among its readings (`choosePinReading`, `target: 'add'`) pins another beside it. With
Ignore open, `ignoreClick` (in `/clicks`) says what a click does: a left click ignores, a right click lets go.

`facts` say what the action did beyond the draft, for the status line: the pins a pin `replaced`,
the faces it `unignored`, the pins an ignore `unpinned`, whether a pin `added` a setup, whether it
was a second click that `letGo`, and the folder (`home`) it is pinned in or let go from. Toolpath's
own app says nothing of the faces Clear gives back, and a pick among an Ignore click's readings
says only what it ignores (its `unignored` is empty).

A page that asks before adding a setup tries the action first, with the same draft, `saved` and
ids, and sends it only once the person says yes: `applyDraftAction` changes nothing itself.

```ts
const pin: DraftAction = { kind: 'pinFrom', tag, direction, newId: crypto.randomUUID() }
const tried = applyDraftAction(session.draft, pin, rules, session.saved)
if ('refused' in tried || !tried.facts.added || (await confirm('Add a setup for it?'))) {
  send({ type: 'act', action: pin })
}
```

## Undo, Redo, Discard: the session

A page holds the person's edits until Apply in a `PlanSession`. One pure function, `planSession`,
moves it on, so a React page gets Undo, Redo, Discard and the history from one `useReducer`:

```ts
import {
  canUndo,
  isHeld,
  planSession,
  startSession,
  type PlanSession,
  type SessionEvent,
} from '@toolpath/plan'

const [session, send] = useReducer(
  (now: PlanSession<MyDraft>, event: SessionEvent<MyDraft>) => planSession(now, event, rules),
  saved, // the draft as applied, read from your server
  startSession,
)

send({ type: 'act', action: { kind: 'addSetup', direction: up, id: crypto.randomUUID() } })
send({ type: 'undo' })
```

| Event     | What it does                                                                          |
| --------- | ------------------------------------------------------------------------------------- |
| `act`     | A `DraftAction`, as one step. Refused, the draft stays and `session.refused` says why |
| `edit`    | Your app's own fields (a material, a stock), as one step. Never the constraints       |
| `undo`    | One step back                                                                         |
| `redo`    | One step forward                                                                      |
| `discard` | The draft as applied again: one step, which Undo takes back                           |
| `applied` | Your Apply saved this draft: it is now the draft as applied                           |
| `read`    | The draft as applied, read again; held edits stay on it                               |

Edits with the same `coalesce` key, one after another, are one step: use one key while a dialog is
open. Undo reaches back `HISTORY` (100) steps. `isHeld` says whether there is anything to Apply or
Discard; `canUndo` and `canRedo` say whether the buttons work. `session.refused` says why the last
action was refused, `session.folderId` names the folder to open after it, and `session.facts` says
what else it did; the next event clears all three. Copy what they say into the page's own state:
the status line keeps its note after the next event, Undo included.

The session saves nothing. Your app sends `session.draft` on Apply and tells the session how it
went, with `applied`, or with `read` when the plan was applied elsewhere first. Keep save stamps,
such as a version, out of the session's draft, or Undo puts an old one back. Pass the version on
`startSession`, `applied` and `read` instead: a read older than the session's is not taken.

- Start the session once the draft as applied is read, and a new one for each part: in React,
  `key={partId}` on the page that holds it. Edits kept from before a reload start held:
  `startSession(saved, { held: kept, version })`.
- `rules` is `PlanRules` (the part's faces and kernel), and three optional fields. `locked`: the
  plan can't be changed now, so no edit, Undo, Redo or Discard changes it. `same`: whether two
  drafts are the same plan; the default compares values, whatever the order of each object's
  keys. `rebase`: how held edits go onto a plan read again; by default the constraints stay as held,
  and each of your own fields stays as held where it was edited here and follows the plan read
  where it was not.
- `edit` takes a function of the draft as it is now, and answers the fields it changes
  (`AppFields`). It must be pure, because React may call it twice. Setups, folders, pins and
  ignored faces change only through `act`, where every change is checked: any `edit` answers for
  them is passed over.

## Every "no", and why

The package says no only where it must. Each refusal is one of these:

| Refusal                                                                   | Kind         | Why                                                                             |
| ------------------------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------- |
| "… is cut from that direction already."                                   | Engine       | Toolpath takes each direction once                                              |
| "A plan holds at most 64 setups."                                         | Engine       | The most setups Toolpath takes in a stated plan                                 |
| "It is cut from …’s direction, a setup already."                          | Engine       | As a setup it would face its setup's direction twice                            |
| "No folder in … is cut from that direction."                              | Our choice   | Could instead pin the same faces as read from a direction a folder in it faces  |
| "That folder is gone." / "Only a setup has a hold."                       | Bad input    | The action names something that is not there, or not a setup                    |
| "That id is taken: each folder needs an id of its own."                   | Bad input    | Two folders with one id could not be told apart                                 |
| "A folder moves a whole number of places." / "That is not a plan action." | Bad input    | The action is not one the list holds                                            |
| "A folder can’t go inside itself."                                        | Not possible | The tree would loop                                                             |
| "This needs the plan as applied."                                         | Bad input    | A pick among readings puts back what the plan as applied had                    |
| "Start from Toolpath’s plan while the plan holds no folders."             | Our choice   | Could instead add Toolpath's setups after the folders there                     |
| "Folders sit at most 6 below their setup."                                | Our choice   | `MAX_DEPTH` keeps the tree readable                                             |
| "Move or delete its tool orientations first."                             | Our choice   | Could instead make the tilts plain folders, or setups of their own              |
| "Only a 3+1 or 3+2 setup has tool orientations."                          | Our choice   | Could instead index the setup, as dropping a folder from another direction does |
| "Rows stay in folders cut from their own direction."                      | Our choice   | Could instead pin that direction's reading of the same faces                    |
| "Only a folder inside a setup can be a tool orientation."                 | Our choice   | A setup's direction is fixed when it is made                                    |

An "our choice" refusal can become a yes in a later release. Until then, it stays as it is.

## The Plan page: `planPage`

```ts
import { planPage, PART_ROW } from '@toolpath/plan'

const page = planPage({
  draft,
  saved,
  plan,
  part,
  analysis,
  kernel,
  directions,
  planIsOfSaved,
  changedSincePlan,
})
page.constraints.setups // the tree of the constraints
page.results.confirm // the checklist before the part moves on
page.find.pinOf(tag) // the folder a feature is pinned in
page.paint({ tab: 'constraints', openId: PART_ROW, colorOf }) // { faces, hatches }
```

`planPage` gives a Plan page everything it shows, from one set of inputs. Make a new page when an
input changes. Each part is worked out only when it is read, and only once.

- **Inputs.** Toolpath's data only: the constraints held now (`draft`) and as applied (`saved`),
  Toolpath's plan, the part's analysis, the kernel the part is read by, and its directions. Any
  draft that holds the constraints works, with the `kernelVersion` its pins name: a session's
  draft has none, so lay it over the plan as saved (`{ ...saved, ...session.draft }`). The app
  says whether the plan is of `saved` (`planIsOfSaved`) and whether the constraints as applied
  changed since it (`changedSincePlan`).
  `part` is how a tag reads (`PlanPart`), and each feature the checks name.
- **`page.constraints`**: the tree (`setups`, `folders`), each face pinned, ignored or open
  (`coverage`), the faces ignored, the counts, and the checks before Apply.
- **`page.results`**: Toolpath's setups, named by the folders they are from while the plan is of
  `saved`; each face machined, ignored or not machined; the Not machined list; the counts; whether
  the constraints changed since; and the checklist before the part moves on (`confirm`, `allClear`).
- **`page.find`**: a folder, its path, a pin, where a pin from a direction goes, the setup that
  machines a feature, and whether a folder or a setup holds one.
- **`page.paint(view)`**: the colour of each face, and the lines across faces other folders take.
  The app chooses the tab, the open folder, the colour of each direction (`colorOf`), and whether
  every folder paints.

### The other entries

- **`@toolpath/plan/parts`**: the functions `planPage` is built from, for an app whose page is of
  another shape. The trees: `draftView`, `resultsView` (its setups can be passed to
  `planFromResults`), `allFolders`, `folderPath`, `listsTag`. Faces: `classifyFaces`, `groupFaces`,
  `planTags`, `tagSet`, `currentFor`. Checks: `planChecks`, `confirmChecks`, `allClear`,
  `changedSinceResults`. Counts and paint: `planCounts`, `planPaint`, `planHatch` (`DONE_COLOR`,
  `UNMACHINED_FACE_COLOR` and `OTHER_FOLDER_COLOR` are on the main entry). Lookups: `findPlaced`,
  `framesOf`, `pinOf`, `pinnedIn`, `pinTargetOf`, `setupOf`, `machines`.
- **`@toolpath/plan/clicks`**: what a click on the part means. `readingsFor` lists the features a
  click on a face can mean; `ignoreClick`, `ignoreSelection` and `featuresAt` say what a click does
  while Ignore is open; `faceRegions` lists the regions split from the same face.

On the main entry, the edits a click makes: `pinEdit`, `withPin`, `folderClick`, `chooseReading`,
`takeBack` and `replacedBy` for pins, `ignoreEdit` and `unignoreEdit` for Ignore. `flattenFolders`,
`projectFolder` and `gapAt` place a folder being dragged, and say where it lands as a `DropAt`.
`directionAnalysis` says whether a direction has been analyzed.

`tests/sdk-contract.test.ts` checks these types against `@toolpath/api`'s. The type checker
(`pnpm check-types`) runs that check; `vitest` alone does not.
