# @toolpath/quoting

The quote flow from Toolpath's quoting app: where a part, a quote, a revision and a payment
stand, and what moving a part between stages means. These are plain functions over plain data,
with no React, no DOM and no database, so a server and a browser can read the same rules. Nothing
here stores anything. Each state is read from facts the app keeps, such as a part's stage,
machining times, stamps, payments and purchase orders.

```sh
pnpm add @toolpath/quoting
```

```ts
import { moveFor, partArtifactsOf, partStateOf, quoteStatus } from '@toolpath/quoting'
```

The package is logic only: no React, no DOM and no CSS. `@toolpath/quoting/model` is the same
entry under a second name. `/inputs`, `/units`, `/plan` and `/pipeline` are the other entries.
A view over these rules, such as a stage timeline, belongs in `@toolpath/ui`.

## Part: state

`partStateOf` reads what the app stores about a part — the pipeline at Toolpath, whether it has
machining times, its stage and its approval — and returns its `PartState`:

| Pipeline (stored)       | No times yet      | Has times                                           |
| ----------------------- | ----------------- | --------------------------------------------------- |
| `analyzing`             | `analyzing`       | `analyzing`                                         |
| `analysis_failed`       | `analysis_failed` | `analysis_failed`                                   |
| `sending` or `planning` | `planning`        | `updating` (the last times stand)                   |
| `plan_failed`           | `plan_failed`     | `update_failed` (the last times stand)              |
| `ready`                 | `plan_failed`     | `priced`, with its review: new, confirmed, approved |
| `gone` (no longer made) | `gone`            | `gone`                                              |

A failed run (`plan_failed` or `gone`) for inputs that have changed since is not the part's. A part
with times then reads as `ready`.

A `priced` part whose inputs changed since its times — plan, stock, material, machine or tool
crib — is `edited`. Its review is `new` in Plan Part, Review Plan or while edited, `approved` in
Quote with its estimate approved, and `confirmed` otherwise.

## Part: stage, and what it needs

A part's stage is stored, and only a move or the Plan page's Apply changes it. `PART_STAGES` are the
four, in order:

| Stage       | Page                   | What it needs |
| ----------- | ---------------------- | ------------- |
| Plan Part   | Plan page, Constraints | nothing       |
| Review Plan | Plan page, Results     | a plan        |
| Estimate    | Estimate page          | an estimate   |
| Quote       | the quote's Quote page | an approval   |

`partArtifactsOf` says whether the plan and the estimate are there for the part's inputs as they
stand: `available`, `pending`, `failed` or `not-requested`. It compares fingerprints: the inputs'
own, the last run's and the one the times were stamped with (`artifactStateOf`).

`moveFor(part, to)` says what a move does, or why it is refused. A part may move to any stage, up or
down, in one move:

| Move                                 | Result                                         |
| ------------------------------------ | ---------------------------------------------- |
| into Plan Part or Review Plan        | `move`: the stage alone                        |
| into Estimate                        | `move`; `withoutTimes` when never timed, stuck |
| into Quote, estimate `available`     | `approve`                                      |
| into Quote, no estimate yet          | `move`, the approval waits                     |
| in Quote, estimate landed since      | `approve`                                      |
| out of Quote                         | `move`, the approval taken back                |
| model unread or failed, to be priced | `refused`, with a reason                       |

The app carries out the move: it saves the stage, the approval or the blank estimate. A move never
sends anything to Toolpath.

## Quote status

`quoteStatus` reads a revision's parts and stamps:

```
new ──▶ estimated ──▶ sent ──▶ won or lost
```

- `new`: no parts, or a part not signed off (in Quote, its estimate approved). Any status drops
  back to `new` when a part's sign-off is taken back or the last part is deleted.
- `estimated` ("Ready to send"): every part signed off.
- `sent`: stamped when the quote goes out.
- `won` and `lost`: the outcome a person stamps. It outranks `sent`.

`quotedParts`, `unsignedParts` and `documentParts` say which parts the offer holds. A part set to
No quote is left off. Of the rest, only parts in the Quote stage are priced.

## Revision

`revisionStateOf` returns one of three states:

- `open`: it can change.
- `locked`: a newer revision replaced it.
- `ordered`: the customer paid, or the shop confirmed their purchase order (`isOrdered`).

## Offer end and payment page

`isQuoteExpired` ends the offer at the end of its last day in UTC−12, so every customer gets the
whole date. `defaultExpiry` is a week from today.

`payStatusOf` decides what the customer's page offers. The first check that holds wins:

`paid`/`refunded` → `superseded` → `closed` (lost) → `expired` (unless a purchase order was sent in
time) → `not_ready` (does not price) → `unavailable` (no payments, or already ordered: takes a
purchase order) → `payable`.

## The quoting app's plan draft: `@toolpath/quoting/plan`

```ts
import { quotingPlan, type PlanDraft } from '@toolpath/quoting/plan'

let session = quotingPlan.start(saved)
session = quotingPlan.update(session, { type: 'act', action }, { regionsOf, kernel, locked })
session = quotingPlan.update(session, quotingPlan.read(savedAgain), { regionsOf, kernel, locked })
```

Plan mode itself is [`@toolpath/plan`](../plan): the constraints a person states, every edit to
them, and the plan Toolpath makes. `/plan` here is what the quoting app keeps beside the
constraints on each part:

- `PlanDraft`: the constraints, plus the kernel the pins were made by, when the draft was last
  saved, its saved version, and whether it changed since the part's times.
- `PartInputsHeld`: the material, machine, tool crib and stock, held with the constraints until
  Apply. `Intent` is the two together: what Undo puts back.
- `StockState`, `StockProfileInput` and `StockProfileSummary`: a part's saved stock and the shop's
  stock profiles.
- The Plan page's session holds an `Intent`, with no save stamps (`intentOf`).
  `quotingPlan.start`, `.update` and `.hasEdits` are `@toolpath/plan`'s `startSession`,
  `planSession` and `isHeld` with the app's rules in place: `sameIntent` compares a stock as a
  policy, whatever its key order, and DFM rule sets in any order, and `rebaseIntent` keeps the
  inputs edited here when the plan is read again, and takes the others from it.
  `quotingPlan.read(saved)` is the event for a plan read again. The app gives only what it reads
  of the part (`IntentRules`: `regionsOf`, `kernel`, `locked`). `intentSessionRules(rules)` is the
  same rules, for an app that calls `planSession` itself.

`applyDraftAction` from `@toolpath/plan` takes a `PlanDraft` and gives a `PlanDraft` back, with
these fields as they were. The package depends on `@toolpath/plan` for these, and on
`@toolpath/tool-support` for the inch in `/units`; the root entry and `/model` import nothing.

## A part's stock and tool crib: `@toolpath/quoting/inputs`

```ts
import { parseStock, stockPlacement, stockRequest, startingLibrary } from '@toolpath/quoting/inputs'
```

A part is planned from its constraints and from these inputs:

- **Stock.** `StockOption` is the stock a part is cut from: automatic (Toolpath sizes a flat bar or
  round stock around the model) or fixed (a box or a cylinder of given size). Every length is in
  millimetres. `parseStock` checks a stored stock before it is used, and `sameStock` compares two
  whatever their key order.
  `stockRequest` gives the stock as Toolpath is sent it, for the direction the first setup faces.
  `stockPlacement` says where a stock sits on the model, and `fixedBoxCheck` says whether a fixed
  box can be sent and how far the part stands outside it.
- **Tool crib.** `ToolCrib` is the tool libraries a part draws its tools from. `startingLibrary`
  is the library a crib starts on for a material, and `offeredLibraries` is what it offers to add.
  `addLibrary`, `removeLibrary` and `swapLibraries` edit the list.

## How units show: `@toolpath/quoting/units`

```ts
import { formatLength, fromInput, toInput, type Units } from '@toolpath/quoting/units'
```

The app stores and sends every value in metric. `Units` (`'mm'` or `'in'`) is a person's display
choice only. `formatLength`, `formatArea`, `formatWeight` and the other `format` functions show a
stored value in that choice. `toInput` and `fromInput` turn a stored value into what a field
shows, and what a person types back into the stored value.

## Sending a part to Toolpath: `@toolpath/quoting/pipeline`

```ts
import { fingerprintText, jobStep, planInputsOf, runDecision } from '@toolpath/quoting/pipeline'
```

After Apply the app sends the part to Toolpath, waits on its job, and lands its times. A plan
request is billed, so these rules keep a part to one run for each set of inputs. They read facts
and give answers; the app reads its rows, asks them, and does what they say. Only the app hashes,
writes to its database and calls Toolpath.

- **What the part is planned from.** `planInputsOf(part, draft)` gives its `PlanInputs`: the
  constraints Toolpath is told, the faces ignored, the stock, material, machine and tool crib.
  `fingerprintText(inputs)` is one text for them, every key in order, with no names: hash it
  (SHA-256) to get the part's fingerprint. Every run, plan and estimate is stamped with one, and
  `partArtifactsOf` compares them.
- **Whether to send it.** `runDecision(facts)` reads the fingerprint, the pipeline, the last run
  and the baseline:

  | Answer      | What the app does                                                               |
  | ----------- | ------------------------------------------------------------------------------- |
  | `available` | Nothing: the plan is of these inputs already                                    |
  | `pending`   | Nothing: a run is on its way, and asks again for the newest inputs once it ends |
  | `wait`      | Nothing: the last run, of these same inputs, failed — a person asks again       |
  | `reanalyze` | Read the model again, with its plan (billed)                                    |
  | `start`     | A new plan from the inputs as they stand (billed)                               |

  `tryAgain` is true when a person asked (Try again, Request plan), and false for a save or a run
  that ended. Only a person sends a failed run of the same inputs again.

- **Following the job.** `jobStep` says what Toolpath's answer about the job allows: wait, fail
  with the words to show, go on from the analysis to the plan queued with it, or read the times.
  `timesStep` says whether those times land, fail or are waited for. A send that never said how
  it went fails after `SENDING_MS`.
- **Whether the page shows the part's inputs.** `changedFrom` and `timesChangedFrom` compare the
  fingerprint with the run and the baseline; `toolpathHas` says Toolpath has the part, so its
  inputs can't change under it.
- **Whether Apply can save.** `applyRefusal` answers `locked`, `not_in_plan`, `stale`, a stock
  that can't be sent with these folders, or null.
