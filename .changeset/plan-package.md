---
'@toolpath/plan': minor
---

Add `@toolpath/plan`: plan mode for any app that plans parts with Toolpath. It holds the plan a
person states and the plan Toolpath makes from it, as logic, data types and functions only, with no
React and no DOM; its one dependency is `@toolpath/tool-support`, for the inch. An app keeps its own fields beside the constraints:
`applyDraftAction` hands them back unchanged.

- The draft: `Constraints`, `DraftSetup`, `DraftFolder` and the edits over them, such as `addFolder`,
  `moveFolder`, `pinInto`, `unpinFeature`, `setSetupProcess` and `withIgnored`. An edit that
  cannot be made (`setSetupProcess`, `setToolOrientation`, `moveFolder`, `moveFeature`,
  `pinInto`, `pinFrom`) returns `{ refused }` with the reason. Nothing throws.
- What Toolpath is told and what it planned: `statementOf` (a draft as the job's `setupPlan`),
  `EnginePlan`, `planFromResults` and `foldersFromPlan`.
- One menu of edits: `DraftAction` lists every edit a person can make, each making the plan
  Toolpath's own app makes for the same click — the picks among a click's readings and starting
  from Toolpath's plan included. `applyDraftAction` carries out any of them (`{ draft, facts }`, with
  the folder to open where the app opens one, or `{ refused }`), and `actionsFor` says which a
  folder, a feature, faces or the part can take.
- The Plan page's helpers: pins and ignore (`pinEdit`, `folderClick`, `ignoreEdit`, `ignoreClick`,
  `readingsFor`), the tree and the drag (`draftView`, `planView`, `resultsView`, `gapAt`), paint
  (`planPaint`, `planHatch`) and the checks before Apply (`planChecks`, `confirmChecks`).
- Undo, Redo and Discard: `planSession` moves a `PlanSession` on by one event (`act`, `edit`,
  `undo`, `redo`, `discard`, `applied`, `read`), so a React page holds its edits with one
  `useReducer`. `startSession`, `isHeld`, `canUndo`, `canRedo` and `HISTORY` go with it. Setups,
  folders, pins and ignored faces change only through actions; `edit` changes the app's own fields.
- Faces: `classifyFaces` reads each face as ignored, pinned, open, machined or not machined.
- The other inputs to a plan: `StockOption` with `parseStock` and `stockRequest`, `ToolCrib`, and
  `Units` with its formatting.
