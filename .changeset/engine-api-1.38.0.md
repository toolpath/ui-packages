---
'@toolpath/api': minor
---

Regenerate the TypeScript SDK for Engine API 1.38.0.

### Engine API 1.38.0

The toolpath file names its links as the kernel does.

**Toolpaths** (`GET /v1/plans/{planId}/toolpaths`):

- The file at `toolpathUrl` gains `sections`, the path in order: each the points from `start` up
  to `end` (exclusive), each after the first starting with a copy of the point before it, and its
  `kind`, one of `Cutting`, `Approach`, `LeadIn`, `ConnectionNotClearanceArea`,
  `ConnectionClearanceArea`, `LeadOut` or `Retract`. Kinds may be added in any release; read an
  unknown one as a link. A file written before this release has none.
- `segments` is deprecated: the same ranges, with every link (approach, connection, retract) a
  `RapidMove`. It is removed in 2.0.0.

**Operations**:

- Deploy workers, then the API.

This release is additive to the contract.

### Engine API 1.37.0

A calculated plan can now be taken into another CAM system: the toolpaths read carries a CAM export
of the job. It is experimental.

**Toolpaths** (`GET /v1/plans/{planId}/toolpaths`):

- `camExportUrl` (new, experimental) is a short-lived URL for a zip another CAM system rebuilds the
  job from in its own operations: `job.json` with the tools, the features, the setups, and each
  action as its intent, tool, heights, feeds and strategy, a refused action with its reason; the
  part and the faces each action machines as STEP; and each calculated action's
  toolpath. Its format may change in any release. It is null for a plan calculated before this
  release, and where the export is unavailable.

**Operations**:

- Deploy migrations, then workers, then the API.

This release is additive to the contract.

### Engine API 1.36.0

tp-kernel 0.30.0. A stud's modeled thread is now read and machined as a hole's is, and feature
datasheets gain new readings. Every change to the contract is additive.

**Feature datasheets** (`GET /v1/parts/{id}/features`, and turned features on `GET /v1/parts/{id}`):

- A circular wall carries `threading` where its stud is to receive a thread: an external thread,
  milled. A `ThreadSpec` gains `side`, `Internal` or `External` (absent: internal), and
  `maxMajorDiameter` (absent: its `minMajorDiameter`). A thread read before this release is always
  a hole's.
- A surface carries `minCurvatureDiameter`, the widest ball whose tip follows every bend of it, and
  `minCurvatureDiameterAt`, where that is read, in part coordinates. Both are absent on features
  read before this release.
- A turned axial hole carries `isThrough`, the same flag as `through`. It is absent on turned
  features read before this release, so `through` remains the field to read.
- A turned external thread cut out on import (below) now has a `threadSpec`, as does a cut-out
  thread no catalog thread fits, which is threaded to its spec as modeled. A thread the outline
  shows as a run of teeth still has none.
- The facts unions are named components, `FeatureFacts` and `TurnedFeatureFacts`. Their shapes are
  unchanged. The TypeScript SDK names its types after the components, so `FeatureDatasheetFacts`
  becomes `FeatureFacts` and `TurningDatasheetFacts` becomes `TurnedFeatureFacts`, with their
  `FromJSON` and `ToJSON` helpers; `FeatureDatasheet['facts']` and `TurningDatasheet['facts']` name
  the same types in both.

**Parts and plans** (no change of shape):

- A part is faceted differently, so its mesh, its regions' areas and what is measured off them move
  slightly. Region indices and feature tags may change when a part is analyzed again: as always,
  state `doneRegions` and tags from a report read under the same `kernelVersion`.
- A modeled external thread is cut out when a part is analyzed, where it comes out cleanly, leaving
  the stud at its major diameter: the mesh shows a plain stud, its circular wall carries the thread,
  and a plan owes it a thread milling pass, from the tool crib's `tap` family. One that does not come
  out cleanly stays modeled, as before. With that family off, every stud is
  planned without its thread. A part report stored before this release carries no stud threading
  until the part is analyzed again.
- Where a thread covers only part of a cylinder, each stretch is a feature of its own: a hole tapped
  at its mouth and drilled deeper is a threaded hole over a plain one.
- A thread is cut from the end of its cylinder that nothing stands in front of. A stretch under more
  of its own cylinder is planned from its other end, or not at all.
- A plan may now cover regions it used to leave out, in a further setup where they need one.
- A narrow 3D surface — a chamfer-like strip, or a band narrower than the ball's radius — is
  finished in a pass of its own.
- A plan's estimated times can move slightly. Most are unchanged; where they move, they rise.
- `turnability` rises on a part whose modeled external thread is cut out, its stud now reading as
  a plain cylinder at the thread's major diameter.
- `PlanIssueFeature.rejections` and a tool's `outsideCrib.reasons` now give, for a `Thread` pass,
  why no threading tool could be made: `ThreadNotOnGrid`, `ThreadTapered`,
  `ThreadEntryObstructed`, `ThreadLeadTooLong` or `TeethLengthTooLong`.
- Analyzing and planning a large part takes less time.
