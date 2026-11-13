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
entry under a second name. `/inputs`, `/units` and `/pipeline` are the other entries.
A view over these rules, such as a stage timeline, belongs in `@toolpath/ui`. `/inputs` and
`/pipeline` need `@toolpath/plan` and, through `/units`, `@toolpath/tool-support` for the inch; the
root entry and `/model` import nothing.

## Part: state

`partStateOf` reads what the app stores about a part — the pipeline at Toolpath, whether it has
machining times, its stage and its approval — and returns its `PartState`:

| Pipeline (stored)       | No times yet        | Has times                                           |
| ----------------------- | ------------------- | --------------------------------------------------- |
| `inspecting`            | `inspecting`        | —                                                   |
| `inspection_failed`     | `inspection_failed` | —                                                   |
| `analyzing`             | `analyzing`         | `analyzing`                                         |
| `analysis_failed`       | `analysis_failed`   | `analysis_failed`                                   |
| `sending` or `planning` | `planning`          | `updating` (the last times stand)                   |
| `plan_failed`           | `plan_failed`       | `update_failed` (the last times stand)              |
| `ready`                 | `plan_failed`       | `priced`, with its review: new, confirmed, approved |
| `gone` (no longer made) | `gone`              | `gone`                                              |

An uploaded file is `inspecting` while Toolpath reads it for its solid bodies, before any of
them is a part there, and `inspection_failed` when it could not be read or made parts of. Neither
has a model or times yet. A part held (`sending`) while its file's parts are made reads as
`inspecting`, and one held for its first analysis as `analyzing` (`holding`).

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

## Assembly

An assembly is one uploaded file and the parts made from its bodies, one per distinct shape: a
single-body upload is an assembly of one part. The stage, the approval, the quantity and No quote
are the assembly's. Each part keeps its own pipeline, plan and estimate, and is read by the part's
rules above, with its assembly's stage and approval (`partStateInAssembly`). The row an upload is
kept on is the assembly's first part from the start: `inspecting` while the file is read or its
parts are made, `inspection_failed` if that failed.

A part counted 0 per assembly is **not made** (`partMade`): it is not priced or ordered, needs no
plan for the assembly to be signed off, and does not stand for the assembly's state while another
part is made.

A shape of a file is a **body** until the shop marks it a part. A part not marked (`unmarked`;
`partMarked` is false) is counted 0 whatever its shape or override says, so every rule here reads
it as not made; its override is kept for when it is marked again. It takes no copies of a stock
body (`stockBodiesTakenOf`), and its count can't be set (`countRefusal`, `UNMARKED_COUNTED`): mark
it first.

- **State.** `assemblyStateOf(parts)` is the worst made part's state, naming that part: failed
  before working (a file before a model in each), working before priced, and of the parts priced,
  edited before new before confirmed before approved. With no part made, every part is read.
  `combinedArtifact` combines the parts' plans or estimates: `available` once every part's is,
  else `failed`, `pending` or `not-requested`. `assemblySignedOff` holds once a part is made and
  every made part is signed off.
- **Moves.** `moveForAssembly(stage, parts, to)` asks `moveFor` of each made part: the first
  refusal refuses the assembly, naming the part; else `withoutTimes` if any part needs it; else
  `approve` only if every part would. With no part made, only a move back to Plan Part is allowed
  (`NO_PART_MADE`). `assemblyMade` says whether it has a part made, marked and counted above 0;
  `noPartMarked(name)` says why a quote can't be signed off, sent or ordered with one that has none
  (No quote leaves it out).
- **Approval.** One approval covers the whole file. `withdrawnApproval` takes it back, and an
  assembly in Quote goes back to Estimate. `landingWithdrawsApproval` says whether a part's new
  times take it back: any part's new plan does, but the times it was approved on don't. A count
  edited does not, the approved price following it, except a part counted again from 0, which is
  a part added (`countWithdrawsApproval`).
- **Quantity and pieces.** The quantity is in assemblies. A part's `PartCount` is its shape's
  body count in the file, taken when the part was made (`shapeCount`), how many of the shape's
  copies are stock for parts of the assembly (`stockBodiesTaken`), and the shop's override
  (`countOverride`, null to follow the shape), and whether the shop has not marked it
  (`unmarked`). `stockBodiesTakenOf` works it out: a body stands for
  every copy the file places of it, so each part cut from one takes a copy per piece it makes, the
  sum of their counts never more than the shape's count. The parts cut from a shape are resolved
  before it, and a cycle is cut where it closes. `countPerAssembly` is the override, else
  `shapeDefaultCount`: the shape's count less the copies used as stock, never below 0.
  `withCount` sets the shop's count, and setting the shape's own count clears the override.
  `STOCK_LEAVES_NONE_MADE` says why a stock body that would leave no part made is refused.
  `parseCountPerAssembly` takes a whole number, 0 or more, at most `MAX_ASSEMBLY_COUNT`
  (1,000,000, the most an assembly's quantity may be too); `countRefusal` refuses 0 for
  the assembly's last part made (`LAST_PART_MADE`: No quote leaves the assembly out), and
  `deleteRefusal` refuses deleting a part that would leave only parts counted 0
  (`LAST_MADE_DELETED`); the last part goes with its assembly. `piecesOf(quantity, part)` is
  assemblies × count: what the part is priced at.
- **Quote status.** `quotedAssemblyCounts(assemblies)` gives `quoteStatus` its counts by assembly:
  those not set to No quote (`assemblyCount`), and how many of them are signed off
  (`estimatedAssemblyCount`).

## Quote status

`quoteStatus` reads a revision's assemblies (`quotedAssemblyCounts`) and stamps:

```
new ──▶ estimated ──▶ sent ──▶ won or lost
```

- `new`: no assemblies, or one not signed off (in Quote, its estimate approved). Any status drops
  back to `new` when an assembly's sign-off is taken back or the last assembly is deleted.
- `estimated` ("Ready to send"): every assembly signed off.
- `sent`: stamped when the quote goes out.
- `won` and `lost`: the outcome a person stamps. It outranks `sent`.

`quotedParts` and `documentParts` say which parts the offer holds. A part set to
No quote is left off. Of the rest, only parts in the Quote stage are priced. `documentParts` offers
assemblies: a part counted 0 is no part of the offer, and an assembly is priced whole once every
part of it made is signed off, or named as waiting (`documentName`).

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
- **A body of the part's file as stock.** A part made from a multi-body file can be cut from
  another body of that file, taken where it lies (`BodyStock`, `{ mode: 'body', bodyIndex,
  shapeIndex }`, Engine API 1.35). It is one of the part's stock modes, in place of a policy: a
  `PlanStock` is a policy or a body, never both. `shapeIndex` is the app's, which of the file's
  shapes the body is; `effectiveStock(stock)` is the `SentStock` the part is planned from, a body by
  its index alone (`SentBodyStock`, as Toolpath takes it). Send it, fingerprint it and compare it
  from that one rule; `stockBodyIndexOf` names the body. `echoesStock` and `stockEdited` take a
  `SentStock`: a body is echoed only by the same body.
  `STOCK_BODY_REFUSALS` words Toolpath's refusals of a stock body by their code
  (`stock_body_requires_file`, `unknown_body`, `own_body`), and `planFailureWords(error,
  bodyIndex)` words a part that stands outside its stock body (`part_outside_initial_stock:`) as
  `STOCK_BODY_MISFIT`. It also words the failures no run of the same inputs gets past, with what
  to change: the part's body lost to its file (`body_mismatch:`, `body_not_found:`) as
  `PART_BODY_LOST`, its stock body lost as `STOCK_BODY_LOST`, a stock body that is the part's own
  (`own_body:`) as its refusal, and one Toolpath can't use (`stock_body_unusable:`) as
  `STOCK_BODY_UNUSABLE`. `isPermanentPlanFailure(error)` says whether a failure is one of those,
  a misfit, or a stock body Toolpath refused, and `canRetry` offers no Try again for it. `materialFreeRegions(envelope, { plan, report })`
  reads, from a calculation's stock envelope, the part's regions the stock body already leaves at
  their final surface (`StockBody.materialFreeRegions`): pass them to `@toolpath/plan`'s
  `planDetails` or `classifyFaces` as `materialFree`. They are the plan's indices, so there are
  none unless the plan's region space (`planSpec.preparationId`) is the report's
  (`preparationId`, Engine API 1.41). Any other stock has none.
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
  constraints Toolpath is told, the faces ignored, the stock, material, machine and tool crib. The
  stock is `stockOf(part)`: its `machiningStock`, a body of its file or its policy, as
  `effectiveStock` sends it. `stockSent` is that stock as Toolpath is sent it.
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
  | `reinspect` | Make the file parts again: it could not be read or made parts of                |
  | `unmade`    | Nothing: the part is counted 0 in its assembly, so nothing is sent for it       |
  | `reanalyze` | Read the model again, with its plan (billed)                                    |
  | `start`     | A new plan from the inputs as they stand (billed)                               |

  `tryAgain` is true when a person asked (Try again, Request plan), and false for a save or a run
  that ended. Only a person sends a failed run of the same inputs again.

- **Following the job.** `jobStep` says what Toolpath's answer about the job allows: wait, fail
  with the words to show, read an inspected file's bodies, go on from the analysis to the plan
  queued with it, or read the times. `timesStep` says whether those times land, fail or are waited
  for. A send that never said how it went fails after `SENDING_MS`, by what it carried (`holding`).
- **Making parts of a file.** `inspectedStep` says whether an inspected file's distinct shapes are
  made parts: a part of each shape, however many bodies the file has, with at most
  `MAX_FILE_PARTS` shapes — what Toolpath makes from a file in one request; otherwise it fails
  saying why.
- **What a send carries.** `holdingOf` says whether a `sending` part is making its file's parts,
  sending a new part's first analysis, or sending a plan; `heldPipeline` reads the first two as
  `inspecting` and `analyzing`, which `partStateOf` does given `holding`.
- **Whether the page shows the part's inputs.** `changedFrom` and `timesChangedFrom` compare the
  fingerprint with the run and the baseline; `toolpathHas` says Toolpath has the part, so its
  inputs can't change under it.
- **Whether Apply can save.** `applyRefusal` answers `locked`, `not_in_plan`, `stale`, a stock
  that can't be sent with these groups, or null.
