# @toolpath/quoting

## 0.3.2

### Patch Changes

- Updated dependencies [5734e4c]
  - @toolpath/plan@0.4.0

## 0.3.1

### Patch Changes

- Updated dependencies [979d260]
  - @toolpath/plan@0.3.0

## 0.3.0

### Minor Changes

- 52136d5: `PartInputsHeld` holds the part's DFM rule sets (`dfmRuleSetIds`), and `InputField` names them
  (`'dfmRules'`). `sameIntent` compares them in any order, and `rebaseIntent` keeps rule sets chosen
  in this session over another tab's.

### Patch Changes

- Updated dependencies [52136d5]
  - @toolpath/plan@0.2.0

## 0.2.0

### Minor Changes

- 360ecca: `@toolpath/quoting/pipeline` is the quoting app's rules for sending a part to Toolpath and following
  its job, with no database and no network:
  - What a part is planned from: `planInputsOf`, and `fingerprintText`, the one text its fingerprint
    hashes (the app hashes it). `draftStatement`, `draftDone`, `stockSent` and `baselineFacts` read
    the app's rows.
  - Whether to send it: `runDecision` answers `available`, `pending`, `wait`, `reanalyze` or `start`.
    A failed run of the same inputs waits for a person to ask again (`tryAgain`): a save that left
    them as they were sends nothing.
  - What a job's answer moves the part to: `jobStep` and `timesStep`, with `SENDING_MS` and the
    messages a failed plan shows.
  - Whether the page shows the part's inputs: `changedFrom`, `timesChangedFrom`, `hasPlanned`,
    `toolpathHas` and `isWaitingPart`.
  - Whether Apply can save: `applyRefusal` (`locked`, `not_in_plan`, `stale`, or a stock that can't be
    sent).

- 360ecca: `@toolpath/quoting/plan` is the quoting app's plan draft: `PlanDraft` is
  `@toolpath/plan`'s `Constraints` with the kernel the pins were made by, the save's fields and the
  part's inputs held until Apply (`PartInputsHeld`, `Intent`). `StockState`, `StockProfileInput` and
  `StockProfileSummary` are a part's saved stock and the shop's stock profiles. `intentSessionRules`
  (with `intentOf`, `sameIntent` and `rebaseIntent`) is what the Plan page's `planSession` needs for
  the inputs. The package now
  depends on `@toolpath/plan`; the root entry and `/model` are unchanged and import nothing.

### Patch Changes

- Updated dependencies [360ecca]
  - @toolpath/plan@0.1.0

## 0.1.0

### Minor Changes

- db9c134: Add `@toolpath/quoting`: the quote flow from the quoting app, on the root entry and again as
  `/model`. Part state, stages and moves (`partStateOf`, `PART_STAGES`, `moveFor`), what each stage
  needs (`partArtifactsOf`), quote status (`quoteStatus`), the parts an offer holds
  (`documentParts`), revision state (`revisionStateOf`), expiry (`isQuoteExpired`) and the payment
  page's status (`payStatusOf`), as plain rules over plain data. Logic only — no React, no DOM and
  no CSS: views over these rules belong in `@toolpath/ui`.
