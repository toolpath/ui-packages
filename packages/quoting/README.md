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
entry under a second name. A view over these rules, such as a stage timeline, belongs in
`@toolpath/ui`.

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
