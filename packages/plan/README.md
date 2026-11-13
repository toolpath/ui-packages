# @toolpath/plan

Plan mode for Toolpath: the plan a person states for a part, every edit they can make to it, and the
plan Toolpath makes from it. A person sets up the ways the part is held, sorts work into groups,
assigns features where they want them cut and marks done faces that need no work. These are plain
functions over plain data, with no React, no DOM and no database, so a server and a browser can
read the same rules. Use it in any app that plans parts with Toolpath: a quoting app, a planning
app or a CAM tool.

```sh
pnpm add @toolpath/plan
```

```ts
import { actionsFor, applyDraftAction, planDetails, statementOf } from '@toolpath/plan'
```

The package is logic only: no React, no DOM and no CSS, and no dependencies. A view over these
rules belongs in `@toolpath/ui`. `@toolpath/plan/parts` is the other entry (see
[The plan's details](#the-plans-details-plandetails)). The stock, the tool crib and units are in
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

For example, the quoting app's draft holds the part's material, machine, stock and tool crib this way.

## Two layers

A page holds the person's edits until they choose to send them: that step is called Apply in
these docs, and Discard throws the edits away.

Plan mode has two layers:

- **The draft** (`Constraints`): what a person asks for. It holds setups, the groups inside them,
  the features assigned to each group, and the faces done. It starts empty: with nothing stated,
  Toolpath plans the part itself.
- **The plan** (`EnginePlan`): what Toolpath planned. It holds setups, each with its direction and
  its actions, and the issues it could not reach.

The draft goes to Toolpath, and the plan comes back. A person can start a draft from the plan's
setups, each read as a `PlannedSetup`: its directions and the features it takes:

```
draft ──statementOf──▶ job's setupPlan ──▶ Toolpath ──▶ EnginePlan
  ▲                                                       │
  └──────── planFromResults / groupsFromPlan ◀── PlannedSetup
```

Each edit is a function from the draft as it is to the draft as it will be. These always answer a
draft: `addGroup`, `renameGroup`, `removeGroup`, `moveSetup`, `moveWithin`, `unassignFeature`,
and, for done faces, `withDone` and `withoutDone`. These return `{ refused }`, a `Refusal`, when the
edit cannot be made: `setSetupProcess`, `setOrientation`, `moveGroup`, `moveFeature`,
`assignInto` and `assignFrom`. Nothing here throws on typed input; read a stored draft through
`parseDraftSetups` first. `parseDraftSetups` checks stored data before it is used, and answers
`{ invalid }`, a `DraftInvalid` kind for your app to word, for data it can't read.

`addGroup`, `moveGroup`, `moveFeature`, `assignInto` and `assignFrom` take the draft's setups and
one object of named fields, the same fields as their actions:
`assignFrom(setups, { direction, tag, newId, nameGroup? })`. A field marked `?` may be left out;
each function's `*Options` type (`AssignFromOptions`, …) says what it falls back to.

`classifyFaces` (in `/parts`) reads what the draft and the plan leave of each face: assigned,
at shape in stock, done, open, machined or not machined (`COVERAGE_KINDS`). A viewer paints faces
from it.

### Trimmed features

A plan's tags (an action's `featureTags`, its `setupPlan`, a setup's `unmachined`) can name a
feature the part's report does not list: what is left of a report feature once a statement keeps
some of its faces away. Done faces trim from API 1.30.0; an assigned feature sharing faces with it,
maybe from another direction, trims from the Engine release that plans with tp-kernel 0.29.
Toolpath serves these as the plan's `trimmedFeatures`, which `EnginePlan` holds as optional: null
or absent from an older Engine, read as none (`trimmedFeaturesOf`). Toolpath keeps each trimmed
feature for the part, so a draft can assign its tag and a statement sent back can name it.

`planFeaturesOf(reportFeatures, plan, assigned?)` is the one join of plan tags to features: the
report's features, then each trimmed one shaped as a report feature, marked `trimmed: true` and with
its `fromFeatureTag`. A trimmed tag the report lists already is the report's feature, here and in a
row alike (`unlistedTrimmedFeatures`). Pass it as `features` to `classifyFaces` and `groupFaces`, so
a trimmed feature's faces read as machined where the plan cuts it. The constraints view passes its
assignments too: a trimmed feature is in it only where it is assigned. Its faces never include a
done face, so assigning one unmarks nothing.

`planView` and `resultsView` mark a trimmed tag's row `trimmed` and label it from what it was
trimmed from, `Pocket (trimmed)`, or from its own type where Toolpath does not say or the part has
no type for that feature (`trimmedFeatureLabel`). The row takes its origin's bore (`featureBore`)
where the trimmed type is the origin's, so a trimmed hole groups with the holes of its bore; where
the type changed, it has none. `trimmedOrigin(feature, typeOf)` is that rule: the feature a trimmed
one borrows its datasheet, bore, rules and type from, or null. `trimmedByTag(plan, part)` and
`featureRow(part, trimmed, tag)` are the lookups the views read rows with, for an app that names a
tag the same way elsewhere. A tag the part has a type for (`featureType`) is the report's, and reads as the report's row:
`PlanPart` reads the report alone. `draftView(draft, part, plan)` reads an assigned trimmed tag the
same way from the latest plan, and as the part labels it with none. `planFromResults` (and
`fromPlan` with `assignments`) assigns trimmed tags where they were planned, as it assigns any
feature.

What the app does:

- Parse the plan's `trimmedFeatures` into `EnginePlan`.
- With `planDetails`, nothing more for the views: it passes `planFeaturesOf` to `classifyFaces` and
  `groupFaces`, and the latest plan to `draftView`, and gives each view's list as `features`. An app that builds its page from `/parts` passes
  `planFeaturesOf` with the assignments (`assigned`) in the constraints view, without them in the
  results view, and the latest plan to `draftView`.
- Look a tag's faces up for selection, zoom and `PlanRules.regionsOf` through `planFeaturesOf`,
  so a trimmed tag resolves to its own faces.
- DFM: count a trimmed tag's time and flags as its own, measured by the rules and datasheet of
  its `trimmedOrigin`, else by its own type. The rules are the app's, so the package does not look
  them up.

### Faces at shape in stock

A part cut from another body of its file (`@toolpath/quoting/inputs`' `BodyStock`) can have faces
that body already leaves at their final surface. Pass their regions to `classifyFaces` in the
results view as `materialFree`, or to `planDetails` as `materialFree`: those faces are at shape
(`atShape`), ranked above done, never Not machined, and covered, and `details.faces` shows them as
`atShape`. They are not the shop's done faces: never send them as `doneRegions`. The constraints
view takes none.

## Edits: one menu, one function, one question

A page edits the draft through three things, and nothing else:

- `DraftAction`: every edit a person can make, as one closed list. Each action carries all it
  needs, so the same action on the same draft gives the same plan: a new id for anything it makes,
  which must not be in the draft yet, and for a feature the direction it was read from.
- `applyDraftAction(draft, action, rules, saved)`: carries out any action. It answers `{ draft }`,
  with `facts`: what else it did to the plan. Or it answers `{ refused }`, a `Refusal`: a `kind`
  and its facts, which your app words for the person. An action that changes nothing answers the draft as it was. `saved`, the
  plan as saved, is what a pick among a click's readings puts back; the session passes it.
- `actionsFor(draft, target, rules)`: what can be done here. The target is the part, a group, a
  feature read from a direction, or faces picked on the part. A page offers these kinds of action,
  and no others. Three follow other controls: the two picks among a click's readings, offered
  where a click read more than one feature, and `fromPlan`, offered while the plan holds no groups
  and Toolpath has planned the part.

A drag says why a drop can't be made while it hovers: try the drop with `applyDraftAction` and show
its `refused`, in your app's words. The tree's top row (the part) is no group, so a page says "Rows
go into a group." for a feature's row dropped there itself. A group dropped where it already is
changes nothing, and the page opens nothing for it.

Your app decides which features a click on the part means (its readings) and which faces a Mark done
click takes. After a pick among a Mark done click's readings, the pick is the click: send the next
pick with `click: { tag, regions: rules.regionsOf(tag) }` for the feature picked.

`rules` (`PlanRules`) reads the part: the faces of each feature, and the kernel that numbers them.
Its optional `unplannable` says which features Toolpath plans no pass for whatever the tools: build
it from the part's datasheets with `@toolpath/dfm`'s `unplannableFeatureTags`. Toolpath takes an
assignment of such a feature and plans nothing for it, so an assignment that adds one is refused and
not offered; one assigned already can still be let go or moved. Without it, as before the datasheets
are read, every feature can be assigned. Its optional `nameGroup` names each new group in your app's
word, as `(taken) => nextGroupName(taken, 'Folder')` does; without it, a new group is "Group N".
Code that makes groups outside an action takes the same rule as its last argument: give it to
`parseDraftSetups` for a stored group with no name, and to `groupsFromPlan` and `planFromResults`.

```ts
import { actionsFor, applyDraftAction, type DraftAction } from '@toolpath/plan'

const offered = actionsFor(draft, { group: 'holes' }, rules) // show these as buttons

const press = (action: DraftAction) => {
  const result = applyDraftAction(draft, action, rules)
  if ('refused' in result) {
    showMessage(refusalText(result.refused)) // your app's words for each kind
  } else {
    setDraft(result.draft)
  }
}
```

| Kind                  | What it does                                                                                            |
| --------------------- | ------------------------------------------------------------------------------------------------------- |
| `addGroup`            | A group inside another, at the end                                                                      |
| `renameGroup`         | A new name                                                                                              |
| `remove`              | What Delete removes: groups (setups too) with all they hold, and assignments; every setup is Remove all |
| `moveGroup`           | A group dropped in the tree: reordered, into a group, or to the top                                     |
| `moveWithin`          | A group moved up or down beside its neighbors                                                           |
| `addSetup`            | A setup facing a direction nothing faces yet                                                            |
| `setProcess`          | Hold a setup 3 axis, 3+1 or 3+2                                                                         |
| `setOrientation`      | A group in an indexed setup tilted to a direction of its own, or not                                    |
| `assignInto`          | In an open group: a left click assigns the feature there, a right click takes out one assigned there    |
| `assignFrom`          | The feature assigned in the group facing its direction, or a new setup; let go if assigned that way     |
| `moveFeature`         | A feature's row dropped on a group: assigned there                                                      |
| `unassign`            | The feature let go: Toolpath decides where it is machined                                               |
| `markDone`            | Faces done; an assignment whose every face is done is let go                                            |
| `unmarkDone`          | Faces no longer done                                                                                    |
| `chooseAssignReading` | After a click in a group read several features: another of them meant instead                           |
| `chooseDoneReading`   | After a Mark done click read several features: another of them done instead                             |
| `fromPlan`            | Start from Toolpath's plan: its setups as groups, and with `assignments` its features assigned          |

Each kind makes the plan Toolpath's own app makes for the same click; the package's tests hold each
to the app's own helper. An assignment, of any kind, does what assigning does there: the person's
assignments whose every face it covers are let go, and its own faces are no longer done. Assigning a
feature where it is assigned already lets it go, as a right click does. A left click on a feature in
the open group already sends nothing: it stays, and a pick among its readings
(`chooseAssignReading`, `target: 'add'`) assigns another beside it.

`facts` say what the action did to the plan beyond the draft's own change: the assignments an
assignment `replaced`, the faces it `unmarked`, the assignments that marking done `unassigned`, and
whether an assignment `added` a setup. A pick among a Mark done click's readings says only what it
marks done (its `unmarked` is empty). Where a feature is assigned now, and which group to open,
your app reads from `details.find` and the ids it chose.

A page that asks before adding a setup tries the action first, with the same draft, `saved` and
ids, and sends it only once the person says yes: `applyDraftAction` changes nothing itself.

```ts
const assign: DraftAction = { kind: 'assignFrom', tag, direction, newId: crypto.randomUUID() }
const tried = applyDraftAction(session.draft, assign, rules, session.saved)
if ('refused' in tried || !tried.facts.added || (await confirm('Add a setup for it?'))) {
  send({ type: 'action', action: assign })
}
```

## Undo, Redo, Discard: the session

A page holds the person's edits until Apply in a `PlanSession`. One pure function, `nextSession`,
moves it on, so a React page gets Undo, Redo, Discard and the history from one `useReducer`:

```ts
import {
  canUndo,
  hasEdits,
  nextSession,
  startSession,
  type PlanSession,
  type SessionEvent,
} from '@toolpath/plan'

const [session, send] = useReducer(
  (now: PlanSession<MyDraft>, event: SessionEvent<MyDraft>) => nextSession(now, event, rules),
  saved, // the draft as saved, read from your server
  startSession,
)

send({ type: 'action', action: { kind: 'addSetup', direction: up, id: crypto.randomUUID() } })
send({ type: 'undo' })
```

| Event        | What it does                                                                                        |
| ------------ | --------------------------------------------------------------------------------------------------- |
| `action`     | A `DraftAction`, as one step. Refused, the draft stays and `session.refused` says why (a `Refusal`) |
| `editFields` | Your app's own fields (a material, a stock), as one step. Never the constraints                     |
| `undo`       | One step back                                                                                       |
| `redo`       | One step forward                                                                                    |
| `discard`    | The draft as saved again: one step, which Undo takes back                                           |
| `saved`      | Your Apply saved this draft: it is now the draft as saved                                           |
| `reloaded`   | The draft as saved, read again; the edits stay on it                                                |

Edits with the same `coalesce` key, one after another, are one step: use one key while a dialog is
open. Undo reaches back `UNDO_LIMIT` (100) steps, or your rules' `undoLimit`. `hasEdits` says
whether there is anything to Apply or Discard; `canUndo` and `canRedo` say whether the buttons
work. `session.refused` says why the last action was refused (a `Refusal`), and `session.facts`
says what else it did; the next event clears both. Copy what they say into the page's own state:
the status line keeps its note after the next event, Undo included.

The session saves nothing. Your app sends `session.draft` on Apply and tells the session how it
went, with `saved`, or with `reloaded` when the plan was saved elsewhere first. Keep save stamps,
such as a version, out of the session's draft, or Undo puts an old one back. Pass the version on
`startSession`, `saved` and `reloaded` instead: a reload older than the session's is not taken.

- Start the session once the draft as saved is read, and a new one for each part: in React,
  `key={partId}` on the page that holds it. Edits kept from before a reload start as the draft:
  `startSession(saved, { draft: kept, version })`.
- `rules` is `PlanRules` (the part's faces and kernel), and four optional fields. `locked`: the
  plan can't be changed now, so no edit, Undo, Redo or Discard changes it. `isSame`: whether two
  drafts are the same plan; the default compares values, whatever the order of each object's
  keys. `rebase`: how the edits go onto a plan reloaded; by default the constraints stay as
  edited, and each of your own fields stays as edited where it was edited here and follows the
  plan reloaded where it was not. `undoLimit`: how many steps Undo reaches back.
- `editFields` takes a function of the draft as it is now, and answers the fields it changes
  (`AppFields`). It must be pure, because React may call it twice. Setups, groups, assignments and
  done faces change only through `action`, where every change is checked: any `editFields`
  answers for them is passed over.

## Every "no", and why

The package says no only where it must. Each refusal is a `Refusal`: one of these `kind`s, with
the facts your app needs to word it. A group it names is a `GroupRef` (`id` and `name`).

| `kind` (facts)                 | Because of   | Why                                                                              |
| ------------------------------ | ------------ | -------------------------------------------------------------------------------- |
| `directionTaken` (`group`)     | Engine       | Toolpath takes each direction once                                               |
| `tooManySetups` (`max`: 64)    | Engine       | The most setups Toolpath takes in a stated plan                                  |
| `directionIsSetup` (`setup`)   | Engine       | As a setup it would face its setup's direction twice                             |
| `noGroupFacing` (`group`)      | Our choice   | Could instead assign the same faces as read from a direction a group in it faces |
| `groupGone` / `holdOnlySetup`  | Bad input    | The action names something that is not there, or not a setup                     |
| `idTaken`                      | Bad input    | Two groups with one id could not be told apart                                   |
| `notWholeMove` / `notAnAction` | Bad input    | The action is not one the list holds                                             |
| `intoItself`                   | Not possible | The tree would loop                                                              |
| `needsSaved`                   | Bad input    | A pick among readings puts back what the plan as applied had                     |
| `notEmpty`                     | Our choice   | Could instead add Toolpath's setups after the groups there                       |
| `tooDeep` (`max`: 6)           | Our choice   | `MAX_DEPTH` keeps the tree readable                                              |
| `hasOrientations`              | Our choice   | Could instead make the tilts plain groups, or setups of their own                |
| `orientationNeedsAxes`         | Our choice   | Could instead index the setup, as dropping a group from another direction does   |
| `otherWay`                     | Our choice   | Could instead assign that direction's reading of the same faces                  |
| `orientationOutsideSetup`      | Our choice   | A setup's direction is fixed when it is made                                     |
| `noTool`                       | Our choice   | Toolpath takes the assignment and plans no pass for it (`PlanRules.unplannable`) |

An "our choice" refusal can become a yes in a later release. Until then, it stays as it is.

## The plan's details: `planDetails`

```ts
import { planDetails } from '@toolpath/plan'

const details = planDetails({ draft, saved, plan, part, analysis, planIsOfSaved })
details.constraints.setups // the tree of the constraints
details.results.confirm // the checklist before the part moves on
details.find.assignmentOf(tag) // the group a feature is assigned in
details.faces({ tab: 'constraints', openId: null }) // { faces, shared }, no group open
```

`planDetails` gives an app everything it shows of a plan, from one set of inputs. Call it again when
an input changes. Each part is worked out only when it is read, and only once.

- **Inputs.** Toolpath's data only: the constraints edited now (`draft`) and as saved (`saved`, with
  whether they `changed` since Toolpath's plan), Toolpath's plan, and the part's analysis (its faces
  and features, the `kernelVersion` that read it, and its `directions`). Any draft that holds the
  constraints works, with the `kernelVersion` its assignments name: a session's draft has none, so
  lay it over the plan as saved (`{ ...saved, ...session.draft }`). The app says whether the plan is
  of `saved` (`planIsOfSaved`). `part` is how a tag reads (`PlanPart`), and each feature the checks
  name. `materialFree` is the regions the part's stock body leaves at their final surface, read
  from the plan's stock envelope: at shape in the results.
- **`details.constraints`**: the tree (`setups`, `groups`), each face assigned, done or open
  (`coverage`), the faces done, the counts, and the checks before Apply.
- **`details.results`**: Toolpath's setups, named by the groups they are from while the plan is of
  `saved`, and `tree`, the same setups nested as `saved`'s groups are, each group with what its
  setup machines in it, then each setup Toolpath added; each face at shape in stock, machined, done
  or not machined; the Not machined list; the counts; whether the constraints changed since; and the
  checklist before the part moves on (`confirm`, `allClear`).
- **Checks** (`PlanCheck` before Apply, `ConfirmCheck` before the part moves on) are a `kind` and
  its facts, with a `severity`: `blocking` stops the plan being sent, `warning` and `info` are worth
  a look, and `ok` says a check passed. A confirm check that points somewhere has a `show`. Your app
  words each kind, as it does a refusal.
- **`details.find`**: a group, its path, an assignment, where an assignment from a direction goes,
  the setup that machines a feature, and whether a group or a setup holds one.
- **`details.faces(shown)`**: how each face shows, as a kind (`ShownFace`): in a group's
  `direction`, `otherDirection` (with a group open, only other directions take it), `atShape`,
  `done` or `notMachined`. An open face is not listed. `shared` lists the other directions that take a face
  too. The app chooses the tab, the open group, and whether every group shows; it gives each kind
  and direction its colour.

### The other entries

- **`@toolpath/plan/parts`**: the functions `planDetails` is built from, for an app that shows the plan
  another way. The trees: `draftView`, `resultsView` (its setups can be passed to
  `planFromResults`), `allGroups`, `groupPath`, `listsTag`. Faces: `classifyFaces`, `groupFaces`,
  `planTags`, `tagSet`, `currentFor`. Checks: `planChecks`, `confirmChecks`, `allClear`,
  `changedSinceResults`. Counts and faces: `planCounts`, `shownFaces`, `sharedFaces`. Lookups:
  `findPlaced`, `framesOf`, `assignmentOf`, `assignedIn`, `assignTargetOf`, `setupOf`, `machines`.

On the main entry, the edits a click makes: `assignEdit`, `withAssignment`, `toggleAssignment`,
`chooseReading`, `takeBack` and `replacedBy` for assignments, `markDoneEdit` and `unmarkDoneEdit`
for Mark done. `stateOf` says where a feature is, for a reading to word: its `kind` (`assigned`,
`done`, `open` and the rest, or `partOf` a larger feature, its `whole`) and the `groups` that hold
it; `readingOf` builds the plan it reads from the groups and `classifyFaces`. `projectGroup`
says where a dragged group can land: the app gives the groups it shows (`FlatGroup`), the gap the
pointer is in and the depth it is dragged to, and gets back the depth allowed and a `DropAt`: a
group's id and a zone, or `{ zone: 'first' }` or `{ zone: 'last' }` at the top, with no group named.
The pointer, the rows and the pixels stay in the app.
`directionAnalysis` says whether a direction has been analyzed.

`tests/sdk-contract.test.ts` checks these types against `@toolpath/api`'s. The type checker
(`pnpm check-types`) runs that check; `vitest` alone does not.
