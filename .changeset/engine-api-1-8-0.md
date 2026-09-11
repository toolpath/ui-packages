---
'@toolpath/api': minor
---

Regenerate the TypeScript SDK for Engine API 1.8.0 (from 1.3.3).

Display fast path: a part can be tessellated for a viewer without being analyzed.

- `parts.createPartMesh` (`POST /v1/parts/{id}/mesh`) queues the tessellation and answers `202`
  with a job id; it honours `Idempotency-Key` like the other triggers.
- `parts.getPartMesh` (`GET /v1/parts/{id}/mesh`) returns a `PartMeshResponse`: a 15-minute URL
  for the binary glTF (GLB), its point and triangle counts, and the job that produced it. Each run
  replaces the previous mesh; pass `jobId` to insist on a specific run. A part with no display mesh
  yet is `404 mesh_not_found`. This mesh is faceted from the uploaded file as-is, so it is not the
  analysis mesh `parts.getPart` describes: its counts differ and region triangle ranges do not
  apply to it.

Quoting pipeline (Engine API 1.4–1.6): plans are addressable resources under a part.

- `parts.createPlan`, `parts.listPlans`, and `parts.createToolpaths` live on the existing `parts`
  namespace. `plans.getPlan`, `plans.getToolpaths`, `plans.getMachiningTime`, and
  `plans.recalculateToolpaths` live on a new `plans` namespace of `createToolpathClient`.
- `plans.getToolpaths` and `plans.getMachiningTime` answer `409` with a `PipelineReadinessProblem`
  — a problem document that also names the plan's current level — while the plan is not yet
  toolpathed.
- New components: `PartMeshJobResponse`, `PartMeshResponse`, `QueuePartJobResponse`, `PlanSummary`, `PlanListResponse`, `PlanResponse`,
  `PlanSetup`, `PlanAction`, `PlanIssue`, `ToolpathsResponse`, `ToolpathSetup`, `ToolpathAction`,
  `MachiningTimeResponse`, `MachiningTimeSetup`, `MachiningTimeAction`, and
  `PipelineReadinessProblem`.

Jobs and keys (Engine API 1.7):

- `JobDetail` gains `updatedAt` and `durationMs`.
- Every operation now states what it is billed as, and `403` is documented on every authenticated
  operation: a key with no access to the operation's area is refused with `product_mismatch`, and
  a key granted read access only is refused on a write with `read_only_key`.
- `FaceFacts.needsSidemill` is deprecated (tp-kernel 0.11.0 no longer states it separately; read
  `!isFacing`). It stays on the type until the next API major.

**Removed fields — a consumer that reads them will not compile.** `PartResponse` loses
`downloadMs`, `recognitionMs`, `enrichmentMs`, and `totalMs`; `HolderResponse` loses `downloadMs`,
`importMs`, and `totalMs`. Read a run's duration from `jobs.getJob(...).durationMs` instead. No
other existing field changed name, type, or requiredness.
