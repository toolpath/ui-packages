---
'@toolpath/quoting': minor
---

`@toolpath/quoting/pipeline` is the quoting app's rules for sending a part to Toolpath and following
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
