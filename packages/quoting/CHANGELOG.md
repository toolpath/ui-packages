# @toolpath/quoting

## 2.0.0

### Major Changes

- a04d352: A body of the part's own file is one mode of its stock, in place of a policy, never kept beside
  one. In `@toolpath/quoting/inputs` and `/pipeline`:

  - **Breaking:** `BodyStock` carries the shape the body is (`shapeIndex`, a number or null), kept
    with it by the app and never sent; `SentBodyStock` (`{ mode: 'body', bodyIndex }`) is the body as
    Toolpath takes it, and `SentStock` is it or a policy. `PlanStock` is still a policy or a
    `BodyStock`.
  - **Breaking:** `effectiveStock(stock)` takes the part's one stock (`PlanStock | null`) in place
    of `{ policy, bodyIndex }`, and answers the `SentStock` it is planned from: a body by its index
    alone, so a body fingerprints as it did.
  - **Breaking:** `FingerprintPart.machiningStock` is a `PlanStock`, and `stockBodyIndex` is gone
    from it; `stockOf` and `stockSent` read the stock alone and answer a `SentStock`, as
    `PlanInputs.stock` and `notQueued` take one. `ApplyFacts.stock` takes a `SentStock`: a body
    needs no first folder.
  - `echoesStock` and `stockEdited` take a `SentStock`, `sameStock` any `PlanStock`; every stock they
    took before reads as it did.
  - New: `bodyStockOf(stock)` and `stockBodyIndexOf(stock)` name the body a stock cuts the part
    from, or null for a policy or none.

## 1.0.1

### Patch Changes

- c792343: A plan that failed `unholdable_initial_stock` (Engine API 1.46.0: stock its fixture can hold in no
  direction the plan may start in) is permanent: `isPermanentPlanFailure` holds and no Try again is
  offered, since the same inputs fail again.

## 1.0.0

### Major Changes

- f0538c0: Assemblies: one uploaded file and the parts made of its distinct shapes, whose stage, approval,
  quantity and No quote are the assembly's. A new `assembly-state` module in `/model` and the root.

  - `partStateInAssembly` reads a part with its assembly's stage and approval. `assemblyStateOf`
    is the worst made part's state, naming the part; `combinedArtifact` combines the parts' plans or
    estimates; `assemblySignedOff` holds once every made part is signed off.
  - `moveForAssembly(stage, parts, to)` combines each made part's `moveFor`: the first refusal, naming
    its part, then `withoutTimes`, then `approve` only if every part would. With no part made, only
    back to Plan Part (`NO_PART_MADE`). `withdrawnApproval` takes the approval back, out of Quote to
    Estimate, and `landingWithdrawsApproval` says whether a part's new times take it back.
  - `PartCount` is a part's count per assembly: `shapeCount`, `stockBodiesTaken` (the shape's copies
    used as stock for parts of the assembly) and `countOverride`. `countPerAssembly` is the override,
    else `shapeDefaultCount` (the shape's count less those bodies, never below 0). A count of 0 is a
    part not made (`partMade`). `countOverridden`, `withCount`, `parseCountPerAssembly`,
    `countRefusal` (`LAST_PART_MADE`), `deleteRefusal` (`LAST_MADE_DELETED`),
    `countWithdrawsApproval`, `stockBodiesTakenOf`, `STOCK_LEAVES_NONE_MADE` and
    `piecesOf(quantity, part)` read, set and check it. `stockBodiesTakenOf` takes each part's
    `StockTaker` (its shape, stock body, `shapeCount` and `countOverride`): a shape's copies taken
    are the sum of the counts of the parts cut from its bodies, never more than its `shapeCount`.
    `MAX_ASSEMBLY_COUNT` (1,000,000) is the most a count, or an assembly's quantity, may be:
    `parseCountPerAssembly` refuses more.
  - A shape of a file is a body until the shop marks it a part. `PartCount` and `StockTaker` require
    `unmarked`: a part not marked counts 0 (`countPerAssembly`, so `partMade` and `piecesOf` too)
    and takes no stock body's copies, its override kept for its marking. `partMarked` says whether
    the shop has marked it. `countRefusal` takes each part's `unmarked` and refuses any count of a
    part not marked (`UNMARKED_COUNTED`): mark it first. `withCount` sets the count alone, without
    `unmarked`. `assemblyMade` says whether an assembly has a part made (marked, counted above 0),
    and `noPartMarked(name)` says why a quote can't be signed off, sent or ordered with one that has
    none. `NO_PART_MADE` and `LAST_MADE_DELETED` are worded for marking.
  - **Breaking:** `quoteStatus` counts assemblies. It takes `assemblyCount` and
    `estimatedAssemblyCount` in place of `partCount` and `estimatedPartCount`, and
    `quotedAssemblyCounts(assemblies)` gives both, leaving out No quote.
  - **Breaking:** `documentParts` offers assemblies. Its parts are `DocumentPart`s, which require
    `assemblyId`, `assemblyName` and `count`. A part counted 0 is neither priced nor named as
    waiting; an assembly is in the quote whole once every part of it made is signed off, or named as
    waiting by `documentName`. `partsByAssembly` groups parts by assembly, and `isSinglePart` says
    whether an assembly's parts made are one part ×1.
  - **Breaking:** `unsignedParts` is removed. Filter `quotedParts` by `isSignedOff`, or use
    `documentParts`' `waiting`.

- f0538c0: Parts made of an uploaded file, and the run rules for parts counted 0 and parts cut from a body of
  their file.

  - **Breaking:** `PartPipeline`, `PartStateKind` and `WaitingPipeline` gain `inspecting` (Toolpath
    reading the file for its solid bodies) and `inspection_failed` (it could not be read or made
    parts of). An exhaustive switch over any of them needs both cases. `initialPipeline` takes an
    optional inspection job, and `holdingOf` and `heldPipeline` read a `sending` part as the file or
    model it carries (`PartStateInput.holding`).
  - **Breaking:** `JobStep` gains `{ step: 'inspected' }`: a file's inspection job ended, so its
    parts can be made. `inspectedStep` says whether they are (one of each shape, up to
    `MAX_FILE_PARTS`), and a lost send fails by what it carried.
  - **Breaking:** `RunFacts.made` is required: whether the part is counted above 0 (`partMade`).
    The new optional `sizeNeeded` says a part counted 0 must still be measured, because a part made
    is cut from a body of its shape and priced from its size.
  - **Breaking:** `RunDecision` gains `reinspect` (make a file's parts again, asked by a person),
    `unmade` (a part counted 0: nothing is sent) and `measure` (a part counted 0 with `sizeNeeded`,
    asked by a person: read its model only, planning nothing). An exhaustive switch needs all three.
  - **Breaking:** `PlanInputs.stock` is a `PlanStock` (`@toolpath/quoting/inputs`): a stock policy or a body
    of the part's file. `FingerprintPart` takes an optional `stockBodyIndex`, and `planInputsOf`,
    `stockSent`, `notQueued` and the new `stockOf` read the stock through `effectiveStock`, so a body
    is sent and fingerprinted in place of the policy. A part with no stock body fingerprints as
    before.
  - **Breaking:** `canRetry` is false for a part failed for good (`isPermanentPlanFailure`, new in
    `/inputs`): its body or stock body lost to its file, a part outside its stock, or a stock body
    Toolpath refused or can't use. Sending the same inputs again would fail again; its words say what to change.

### Minor Changes

- Plan a part from another body of its own file (Engine API 1.35, experimental there), in
  `@toolpath/quoting/inputs`. Additive: no caller breaks.

  - `BodyStock` (`{ mode: 'body', bodyIndex }`) is that stock, and `PlanStock` is it or a policy.
    `effectiveStock({ policy, bodyIndex })` is the stock a part is planned from: the body where it
    has one, else its policy, which is kept to come back to.
  - `echoesStock` and `stockEdited` take a `PlanStock`: a body is echoed only by the same body.
    Every policy they took before reads as it did.
  - `STOCK_BODY_REFUSALS` words Toolpath's refusals of a stock body by code, and
    `planFailureWords(error, bodyIndex)` words a part that stands outside its stock body as
    `STOCK_BODY_MISFIT`. It words the failures no run of the same inputs gets past with what to
    change: the part's body or its stock body lost to its file (`body_mismatch:`, `body_not_found:`)
    as `PART_BODY_LOST` or `STOCK_BODY_LOST`, a stock body that is the part's own (`own_body:`), and
    one Toolpath can't use (`stock_body_unusable:`) as `STOCK_BODY_UNUSABLE`.
  - `materialFreeRegions(envelope, { plan, report })` reads the regions a stock body leaves at their
    final surface from a calculation's stock envelope; none for any other stock, and none unless the
    plan's region space (`planSpec.preparationId`) is the report's (`preparationId`, Engine API
    1.41). Pass them to `@toolpath/plan`'s `planDetails` or `classifyFaces` as `materialFree`.

### Patch Changes

- Updated dependencies [2f42534]
  - @toolpath/plan@1.0.0

## 0.4.3

### Patch Changes

- Updated dependencies [652f050]
  - @toolpath/tool-support@1.0.0

## 0.4.2

### Patch Changes

- Updated dependencies [71a75cb]
  - @toolpath/plan@0.6.0

## 0.4.1

### Patch Changes

- 2b77996: Build with tsdown instead of tsup, which is no longer maintained. Entry points, exports and types are unchanged. Published JavaScript now keeps source comments, and internal chunk file names differ.
- Updated dependencies [2b77996]
  - @toolpath/plan@0.5.1

## 0.4.0

### Minor Changes

- 8aad03d: Move the stock, the tool crib and units out of `@toolpath/plan` into two new `@toolpath/quoting`
  entries. `@toolpath/plan` now has no dependencies.

  **Breaking for `@toolpath/plan`.** It no longer exports the stock (`StockOption`, `parseStock`,
  `sameStock`, `stockRequest`, `stockPlacement`, `fixedBoxCheck` and the rest of `stock`), the tool
  crib (`ToolCrib`, `startingLibrary`, `addLibrary` and the rest of `tool-crib`) or units (`Units`,
  `formatLength`, `toInput`, `fromInput` and the rest of `units`). To migrate, import the same names
  from the new entries; nothing else changes:

  - stock and tool crib: `@toolpath/quoting/inputs`
  - units: `@toolpath/quoting/units`

  `@toolpath/quoting` now depends on `@toolpath/tool-support`, for the inch.

- 8aad03d: Breaking: the `@toolpath/quoting/plan` entry is removed. It held the quoting app's own Plan page
  data and rules, which no other app uses: `PlanDraft`, `PartInputsHeld`, `InputField`, `Intent`,
  `StockState`, `StockProfileInput`, `StockProfileSummary`, `intentOf`, `sameIntent`, `rebaseIntent`
  and `intentSessionRules`. To migrate, keep these in the app. Plan mode itself stays in
  `@toolpath/plan`: an app's draft extends its `Constraints`, and its session and details are
  `nextSession` and `planDetails`.

### Patch Changes

- Updated dependencies [8aad03d]
- Updated dependencies [9dba80a]
- Updated dependencies [8aad03d]
- Updated dependencies [8aad03d]
- Updated dependencies [2241cea]
  - @toolpath/plan@0.5.0

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
