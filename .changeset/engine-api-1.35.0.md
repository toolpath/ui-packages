---
'@toolpath/api': minor
---

Regenerate the TypeScript SDK for Engine API 1.35.0.

### Engine API 1.35.0

A part can now be cut from another body of its own file — a casting, a forging, what an earlier
operation left — and a file's bodies are grouped into shapes and served as a mesh. Everything on
files and body stock is experimental.

**Breaking, experimental** (`Files`, new in 1.32.0):

- `FileBody.role` is removed, and so is the `stock` role. A file carries no roles: a body that is
  not made a part is simply not one, and the body a part is cut from is stated as that part's
  stock (below).
- `POST /v1/files/{id}/parts` takes `bodies` as the indices of the bodies to make parts of — each
  named once, at most 100 to a call — where it took `{ index, role }` entries. An entry in the old
  shape is `400 invalid_request`.

**Files**:

- **Shapes.** When a file is inspected, separate copies of one shape, in any position and
  orientation, are grouped into one shape. Bodies are matched on their volume, surface area, face
  count, mass distribution and handedness, not their exact geometry, so some different bodies
  cannot be told apart: two plates with the same hole pattern rotated differently on a symmetric
  plate, or a part and its mirror image where the part is close to symmetric. Check the grouping
  before quoting from it. Each `FileBody` has a `shape`: the `index` of the first body it is a copy
  of, its own when it is the first. `GET /v1/files/{id}` also returns `shapes`, one `FileShape` per
  distinct shape: its first body as `index`, every body that is it as `bodies`, and the `count` a
  quote multiplies by. Today each body counts one; a body an assembly places more than once is
  listed, and counted, once.
- `POST /v1/files/{id}/parts` answers each part with the `shape` its body is — the same `FileShape`
  `GET /v1/files/{id}` lists — so a client can make one part of a shape and quote it by the shape's
  `count`. Any body can be made a part, a copy of another included.
- `GET /v1/files/{id}/mesh` (new) returns a short-lived URL for a binary glTF (GLB) of every body,
  one node per body: node `body-<index>` is the body at `bodies[index]`, named by index only.
  Meshing is best-effort, so a file can be listed without one: it is `409 file_not_inspected` before
  an inspection has succeeded and `404 mesh_not_found` when the inspection stored no mesh.
  `GET /v1/files/{id}` says which with `hasMesh`. Reading the mesh is unmetered, like the rest of a
  file.

**Stock from a body** (`POST /v1/parts/{id}/plans`, `POST /v1/parts/{id}/toolpaths`,
`POST /v1/plans/{planId}/toolpaths`):

- `stock` takes a fifth, experimental mode, `BodyStock`: `{ mode: "body", bodyIndex }`, another body
  of the part's own file. It is taken where it lies, never sized or squared up. It is
  `400 stock_body_requires_file` for a part not made from a file, `400 unknown_body` for an index
  the file has no body at, and `400 own_body` for the part's own body; none of these is metered. A
  recalculation that names no stock keeps it, like any saved stock.
- Regions of the part the stock body already leaves at their final surface are skipped, as done
  regions are: no setup machines them and no pass or issue is spent on them.
- `stock.resolved` on the plan reads takes a third, experimental shape, `StockBody`:
  `{ shape: "body", bodyIndex, materialFreeRegions }` — which body the plan was cut from, and the
  region indices it skipped as material-free. No figure is reported: the body is the figure.
- `trimmedFeatures` on a plan also describes what a region the stock body leaves material-free left
  of a part feature, as it does for done regions and stated features, and a `setupPlan` sent back
  may name such a feature. A plan cut from a stock body that leaves any region material-free has
  `trimmedFeatures`, empty where nothing was trimmed; it is null only for a plan that skips no
  region and whose `setupPlan` names no feature.
- A part that stands outside its stock body fails the job before anything is planned, its `error`
  beginning `part_outside_initial_stock:` and naming the stock body by its index, in thin air and
  held in a vise alike. A stock body that misses the part entirely fails the same way, rather than
  leaving nothing to machine. A stock body the file no longer holds as it was when the part was
  made fails it as `body_mismatch:` (or `body_not_found:`), naming it as the stock body: plan again
  with a stock body from the file as it now reads.

**Job failures**: three new errors, each failing the job at once, begin:

- `own_body:` — the stock body and the part resolve to the same body of the file. The API refuses
  the part's own index as its stock, but each is resolved again by its fingerprint when the job runs.
- `stock_body_missing:` — the job names a body of the part's file as its stock but carries no stock
  body. The API never sends such a job; it is a malformed message.
- `stock_body_unusable:` — the stock body could not be faceted into the mesh it is cut from. It is
  named by its index in the file; plan again with another stock.

**Operations**:

- Deploy migrations, then workers, then the API. A worker from before this release does not know
  body stock: given a plan from a stock body, it fails the job only after its retries — the plan
  already metered — where a current worker plans it.
- Rolling the API back once a plan has been cut from a stock body makes reading that plan fail with
  `500`: an earlier API does not know its `stock.resolved` shape.

Apart from the experimental breaks above, this release is additive to the contract.

### Engine API 1.34.1

Plans are made by the kernel's planner in one step, behind the same requests and responses. No field
or shape changes. A plan made with the same settings chooses the same setups; its tools, passes and
estimated times can move. The descriptions of `setupPlan`, `trimmedFeatures`, `TrimmedFeature`,
`PlanIssueFeature.cause` and `PlanIssue.unattributedRegionCount` change to say how.

**Stated plans** (`setupPlan` on **Create a plan** and **Calculate a plan's toolpaths**):

- A feature a `setupPlan` names is machined where it is named whatever it needs. One no tool in the
  crib cuts is planned all the same, its passes left `unmachined`, where the job failed as
  `refused_user_plan:` because the feature was not offered.
- A feature a `setupPlan` names keeps its regions from every other feature, in every direction. A
  feature that shares one is planned as what is left of it, under a tag of its own, which the plan's
  `setupPlan`, `featureTags`, `unmachined` and issues may name. The plan's `trimmedFeatures` lists
  it with the part feature it was cut from, and a `setupPlan` sent back may name it, so a plan read,
  edited and sent back plans the same, that tag included.
- A plan whose `setupPlan` names a feature has `trimmedFeatures`, empty where nothing was trimmed,
  where it was null without done regions.
- A refused statement's `refused_user_plan:` clause may be worded differently. The form is
  unchanged: a count, then one clause per refused statement, separated by `;`, each naming the
  setup and the feature by the tag that was sent.

**Plans** (experimental) and estimates move:

- A plan's tools are made for the features it machines, rather than for every feature measured, so
  fewer are made. A pass can be given a smaller, shorter or slower tool than before, and the passes
  with it, their order and their estimated times move. Most plans' times are unchanged; where they
  move, they more often rise than fall.
- A plan measures only the features it needs: one that a pocket of another direction would take
  over, or one another reading from a direction the plan needs covers whole, is not measured.
  Planning takes less time, most of all in thin air. With done regions, the setups can come in
  another order, and a region can be machined from another direction.
- An issue may no longer name a feature the plan did not measure: a region only it holds counts in
  `unattributedRegionCount`, where the issue named the feature with `cause` `Revoked`.
- With `fallbackTools`, a fallback tool is made for each pass the crib leaves owed, rather than for
  the whole of each such feature. A feature only a fallback tool cuts is planned only where it
  machines a region no other feature can with the crib alone, judged for each direction the plan
  may start in. An issue can name such a feature with the new `cause` `FallbackNotNeeded`.

### Engine API 1.34.0

The outside of a whole cylinder — a stud, a round boss, a turned part's outline — is a feature type
of its own, `CircularWall`. Toolpath files hold fewer segments, a file the kernel cannot read fails
at once, and analysis selects more directions. Plans and estimates move. Parts and plans made from
this release report `kernelVersion` 0.29.0, so feature tags and region indices read under an earlier
one no longer apply.

This release makes two breaking changes to stable surface without a major: a feature that read as a
`boss` or a `wall` can now read as a `circular_wall`, and a turning reading that failed reports a
`code` of `unsupported` or `internal` where it reported `geometry`.

**Part features** (`GET /v1/parts/{id}`, `GET /v1/parts/{id}/features`):

- `CircularWall` is a new `FeatureType` value, and `circular_wall` a new feature `featureType`: the
  outside of a whole cylinder standing along the direction the feature is machined from. Its
  datasheet's `facts` are the new `CircularWallFacts`: `kind`, `cd`, `diameter`, `standsOnAFloor`,
  and `wallLength`, absent where no outline could be read. It is machined as a boss where it stands
  on a floor, and as a wall where it does not.
- **A breaking change without a major.** Such a feature read as a `boss` where it stands on a
  floor and a `wall` where it does not, with that kind's facts. A round boss with a blend at its
  foot read as a `filleted_boss`; it now reads as a `circular_wall`, its blend a feature of its own
  beside it. Features enriched before this release keep the type they stored. It is made in a minor
  because `featureType` has always been documented as open-ended, so a client already meets types it
  does not know, and the clients we know of keep working with it. A client that read `boss` as
  "stands on a floor" should read `standsOnAFloor`, and one that matches types by substring will
  find `wall` in `circular_wall`, a stud standing on a floor included.
- An island is part of the pocket of the floor it stands on, unless its foot disagrees with that
  floor's blends — sharp beside filleted, or two radii. A face with islands and no walls of its own
  becomes an `open_pocket` or `filleted_open_pocket` round them.
- **Analysis selects more directions.** A plane that is at least a twelfth of the part's area is
  faced from its own normal, and so is the floor of an inside corner that a blend rounds.
  - Every part keeps the directions it had, and some gain one: a cube now reads six directions, not
    four.
  - A part that gains a direction may split its regions differently, so its regions and feature
    tags move with it. Done regions read under an earlier release already fail as
    `stale_regions:`.
  - Every direction is measured, so planning takes a little longer on a part that gains one.
  - A part still takes up to 12 added directions: the limit counts only directions added with
    **Analyze a part**.
- A direction added with **Analyze a part** within 0.1° of the exact opposite of a direction the part
  has is added as that exact opposite, where it was added as sent. Read it back off
  `candidateDirections` rather than matching the direction sent. The descriptions of the request's
  `directions` and the part's `addedDirections` say so.
- **More features report pinch points.** A surface whose widest reaching tool is a bullnose or a
  flat, not only a ball, reports `pinchPoints` on that tool's axis, level with its corner's center.
  A hole reports one, on its axis at the top of its wall, and a dovetail one per run of its
  overhangs' foot. `PinchPoint.center` is still read off `point`, as before. The descriptions of
  `PinchPoint.point` and `FeatureDatasheet.pinchPoints` change to say so.
- A profile's clearance is measured round the outline its pass follows, rather than through the
  part at the pass's height. What the outline hides from a tool coming down past it, such as a
  notch in a lower stage or a side hole, no longer narrows it; what stands above that height does.
  A profile that runs along no wall, such as a cone's, is now measured where its measurement
  failed.

**Plans** (experimental) and estimates move:

- A feature is planned once a tool meets its first owed pass: a hole an undersized drill pre-drills
  and a tap threads, with no tool to finish it, is planned and pre-drilled, where it was refused.
- A pass leaves the stock it is given on the floors under it and the walls beside it, and a rough
  drill stops short of a blind hole's floor by the feature's `axialStockToLeave`.
- Whole-part roughing, facing passes, spot drilling, bevel finishing and time estimates are fixed.

**Toolpaths** (experimental; `toolpathUrl` and `refusedReason` on **Get a plan**):

- A toolpath file holds fewer `segments`: a path no longer splits, nor repeats a point, where only
  the feed or the rapid flag changes. Its shape and its four kinds — `Cutting`, `LeadIn`, `LeadOut`
  and `RapidMove` — are unchanged, and each segment after the first still starts on a copy of the
  last point before it, so a reader walking each segment's moves misses none.
- A refused action's `refusedReason` begins `refused_pass:`, `timed_out:`, `invalid_argument:` or,
  for a fault in the calculation, `internal:`, where it began `geometry:`, and still `unsupported:`
  for a pass nothing can cut yet. Actions calculated before this release keep the reason they
  stored.

**Turning** (`turning` on `GET /v1/parts/{id}`):

- **A breaking change without a major.** A `TurningSpinFailed` reading's `code` is `unsupported` or
  `internal` where it was `geometry`: the value an existing kind of failure reports changes. Reports
  made before this release keep the code they stored. It is made in a minor because no client we
  know of branches on this code. A client that does should treat `internal`, and any code it does
  not know, as it treated `geometry`.

**Job failures**:

- A job on a part, or an inspection, whose file the kernel cannot read now fails at once, its
  `error` beginning `unreadable_file:`, where it was retried and then failed with a geometry error.
- A fault of the kernel's own is still retried, and the `error` the job fails with names `internal:`
  where it named `geometry:`. A holder file the kernel cannot read is still retried too, and names
  `parse:`.
- As before, read the code an `error` begins with, and treat its wording as free to change.

### Engine API 1.33.3

The API reference and guides now describe the job event stream as the way to wait for background work. Operations answering 202 point to Stream job updates, listed before Get a job. Examples use the SDK wait helpers or bounded readers for curl, browser fetch, and Python. Operation paths include their `/v1` prefix.

The waiting guide distinguishes permanent execution deadlines (default 300 seconds), DLQ recovery after exhausted deliveries, and the 24-hour queued limit. Recovery latency depends on healthy consumers and infrastructure.

### Engine API 1.33.2

Jobs whose queue deliveries are exhausted now reach a final status through a DLQ consumer in the worker parent process. Jobs still queued after 24 hours fail with `job_dispatch_failed`. Recovery waits for healthy workers and database access; it does not infer failed attempts from elapsed leases.

The job stream no longer closes after five minutes. Its database listener uses TCP keepalive to detect lost connections and reconnect. With operating-system keepalive defaults, a silently dropped database connection can take on the order of ten minutes to detect; until then, open streams receive keepalive comments but no updates.

Job execution retains its 300-second default hard deadline, which is service configuration rather than something clients set. A deadline kill fails permanently without another attempt.

### Engine API 1.33.1

Operations that queue work now return 503 `job_dispatch_failed` when a transient queue send fails, and discard the still-queued job so the same Idempotency-Key can be retried safely. Deterministic dispatch refusals return 500. An admitted job that cannot be sent is reported failed to Portal. When the Idempotency-Key is a UUID, planning retries use a deterministic plan ID so an ambiguously accepted send cannot leave the returned plan missing; other keys get a new plan ID on each retry.

### Engine API 1.33.0

A failed job is now final, and a job says how many retries it has left.

- **`failed` never changes.** A job is `queued` until a worker starts it, then `running` until it
  finishes, including while it waits to be retried after a failed attempt. `succeeded` and `failed`
  are final: a job in either state never changes again. Before, an attempt that would be retried
  showed `failed`, with its `error`, until the retry moved the job back to `running`.
- **`retriesRemaining`** is new on **Get a job** (`GET /v1/jobs/{id}`) and on each `job` event of
  **Stream job updates** (`GET /v1/jobs/{id}/events`): how many more times the job will be attempted
  if its current attempt fails. It counts down to 0 on the last attempt and is `null` before the
  first. A failed job keeps the count it stopped at, which is above 0 when no retry could have
  fixed the failure.
- **Stream job updates** closes after sending `succeeded` or `failed`, including for a job that is
  already final when the stream opens. It used to close on `succeeded` only, and held a failed job's
  stream open for up to five minutes. A stream that closes before a final status should still be
  reopened.
- `error` is set on a `failed` job only. A job that succeeds on a retry no longer carries the error
  of the attempt that failed.

This is a breaking change made in a minor release, without a major version. It is made because a
client could not tell a failed attempt that would be retried from a job's last failure, so the only
safe reading of `failed` was to wait. The status values and the SDK's status enum are unchanged, but
`failed` no longer moves: a client that waited on a failed job in case a retry moved it back to
`running` can show the failure as soon as it arrives. Such a client must not open the stream again
as soon as it closes: a failed job's stream sends `failed` and closes at once, so reopening it in a
loop spends the key's rate limit. `retriesRemaining` is additive.

While this release rolls out, a job running across it may still behave the old way once. A job
whose attempt failed just before the rollout shows `failed` and is not retried, though it had
retries left. A job that just reached `succeeded` or `failed` can be moved back to `running` and
run again, then reaches a final status as before.

### Engine API 1.32.0

A CAD file can now hold more than one solid body — a part beside its stock, or several parts. Upload
it as a **file**, inspect it to list its bodies, and make parts of the ones to machine. Every new
operation and field is experimental.

**Files** (new, experimental; the `Files` tag):

- `POST /v1/files?filename=` creates a file and returns a short-lived upload URL, as **Upload a
  part** does. The filename is required, and must end in an extension a reader is chosen for —
  `.step`/`.stp`, `.x_t`/`.x_b`, `.sldprt`, `.catpart`, `.prt`, `.igs`/`.iges`, `.ipt`, `.par`,
  `.sat`/`.sab`, or `.3dm` — or it is `400 invalid_request`.
- `PATCH /v1/files/{id}` queues an inspection and returns a job; it is `409 file_not_uploaded` until
  the file is uploaded, and honours `Idempotency-Key`. A file is inspected once: once its bodies are
  listed they never change, and a further inspection is `409 file_already_inspected`, though a retry
  with the original `Idempotency-Key` still answers with its job. A failed inspection lists nothing,
  and can be run again. One inspection of a file runs at a time: another, while one is queued or
  running, is `409 file_inspection_in_progress`.
- `GET /v1/files/{id}` returns the file and its `bodies`, each a `FileBody`: its `index`, its `name`
  where the file gives one, its `faceCount`, a `boundingBox` it fits in, and the `role` it was last
  given. `bodies` is empty until an inspection has succeeded, and an `index` names the same body for
  the life of the file.
- `POST /v1/files/{id}/parts` takes `bodies`, each an `index` and a `role` of `part`, `stock` or
  `ignore` — at most 100 to a call — records the roles, and makes a part of each `part` body. A body
  that is already a part returns that part, with `created: false`, so one body of a file is only
  ever one part and is never billed as two. It is `409 file_not_inspected` before an inspection has succeeded and
  `400 unknown_body` for an index the file has no body at. The `stock` role is recorded and not yet
  used by planning.
- A file is `410 file_expired` past the retention window, like a part, on every file operation but
  its creation.
- Creating, inspecting and reading files, and making parts of them, are unmetered. A part made from
  a file is an ordinary part from then on, metered as any other.

**Parts**:

- `POST /v1/parts` takes a new, optional and experimental `bodyIndex` query parameter, an integer
  from 0: which solid body of the uploaded file the part is. A multi-body file uploaded without one
  fails analysis as `multiple_bodies:`, listing its bodies on the job (below); upload it again with
  `bodyIndex` set to the `index` of the body to machine, and the part is that body from then on —
  analyzed, measured, meshed, planned and cut exactly as a single-body file is. `0` on a file of one
  body names that body, and makes the same part as an upload without `bodyIndex`; an index past the
  file's last body fails as `body_not_found:`. A body is chosen by index, not by name: names can
  repeat, and some formats have the kernel name a body the file leaves unnamed. The first job to
  load the file records how many bodies it holds and the chosen body's name and box, and every job
  after it checks them, as for a part made from a file: should a later kernel read the file's bodies
  differently, the part fails as `body_mismatch:` rather than becoming another body.
- `GET /v1/parts/{id}`: `fileId` and `bodyIndex` are new, optional and experimental: the file a
  part was made from and which of its bodies it is, or the `bodyIndex` it was uploaded with. Both
  are absent on a part uploaded with neither. Once the file is deleted or pruned past the retention
  window, `fileId` is absent and `bodyIndex` stays.

**Jobs** (`GET /v1/jobs`, `GET /v1/jobs/{id}`):

- `fileUuid` is new and experimental, beside `partUuid` and `holderUuid`: the file an inspection job
  ran on, or null on every other job. An inspection job's `partUuid` and `holderUuid` are both null,
  and its `productType` is `inspect-file`. `GET /v1/jobs` lists those inspection jobs too, once an
  organization uses files, so a client reading `partUuid` or `holderUuid` off every listed job must
  allow both to be null.
- `bodies` is new, optional and experimental on `JobDetail` (and so on each `job` event of
  `GET /v1/jobs/{id}/events`): the solid bodies of the part's file, each its `index`, `name`
  where the file gives one, `faceCount` and `boundingBox` — the fields of a `FileBody`. It is
  listed only on a job that failed `multiple_bodies:` or `body_not_found:`, for choosing the
  `bodyIndex` to upload again with, and absent on every other job. Body names appear only here,
  never in `error`.

**Job failures**: a job on a part, or an inspection, now fails at once, rather than being retried,
when the file cannot give it what it needs. Its `error` begins:

- `multiple_bodies:` — the part was uploaded with no `bodyIndex` and its file holds more than one
  solid body. The job lists them in `bodies`: upload the file again with `bodyIndex` set to the
  `index` of the body to machine, or upload it as a file and make a part of that body.
- `no_solid_bodies:` — the file holds no solid body. An inspection fails the same way.
- `body_mismatch:` — the file's bodies changed since the part's body was recorded, when the part
  was made from a file or, for a part uploaded with `bodyIndex`, when its first job loaded the file:
  it holds another number of bodies, or the body at the part's index no longer carries its name and
  box, and no one other body of the file does. Make the part again: from the file uploaded again as a
  file, or by uploading the part again with `bodyIndex`.
- `body_not_found:` — the file has no body at the part's index. The job lists the bodies it does
  have in `bodies`.
- `unsupported:` — the kernel will not take the file: a format it does not read, or a file it reads
  but cannot analyze, such as one with a modeled internal thread that will not come out. The
  kernel's own first line, as it gives it.

A geometry error is none of these: it can depend on the machine as much as the file, so the job is
retried. For now, a file the kernel cannot read at all is reported as such a geometry error: it is
retried, then fails as before.

**Behaviour change on existing part jobs**: the changes above also reach parts uploaded with
`POST /v1/parts` as before, with no `bodyIndex`:

- A multi-body file now fails at once as `multiple_bodies:`, listing its bodies in `bodies`. It
  used to be retried until the queue gave up, then failed with the kernel's own text, which named
  the file's bodies.
- A file with no solid body now fails at once as `no_solid_bodies:`.
- A file the kernel will not take now fails at once as `unsupported:`, where it was retried first.
  A file the kernel cannot read is unchanged: it is still retried, then fails with a geometry error.
- These failures' `error` no longer begins `Error: `, and keeps only the first line of the kernel's
  reason.
- The job's final `status` is still `failed`. Matching on the text of `error` is not supported:
  read the code it begins with, and treat its wording as free to change.

### Engine API 1.31.1

`PartFeature.axis` is deprecated. Since Engine API 1.0.3 it has held the direction the feature was
extracted from, the same value as `machiningDirection`, so read that instead.

**Get a part** (`GET /v1/parts/{id}`):

- Each feature's `axis` is marked `deprecated` and will be removed in the next API major. Until then
  it is still present on every feature and still equals `machiningDirection`.

This release is additive to the contract: no field or shape changes, only the deprecation and its
description.

### Engine API 1.31.0

Parts and plans made from this release report `kernelVersion` 0.28.0, so feature tags and region
indices read under an earlier one no longer apply. An `OutOfPlay` plan issue now names the features
holding its regions, and says why none was in play.

**Plans** and estimates move:

- Whole-part roughing (`Rough`, `AdaptiveRough`) roughs contour surfaces, fillets and chamfers in
  three dimensions, and filleted pockets, open pockets and bosses unless the tool's corner matches
  the fillet.
- Turned feature extraction, roughing and undercutting passes, hole cycles, wall finishes and time
  estimates are fixed.
- `intent`: new plans no longer report `Rough3d`; they report `AdaptiveRough` in its place. The
  value stays in the enum for plans made before this release.

**Fixed stock the part stands outside** (`stock` on `POST /v1/parts/{id}/plans`,
`POST /v1/parts/{id}/toolpaths` and `POST /v1/plans/{planId}/toolpaths`):

- The job fails with `error` beginning `part_outside_initial_stock:`, naming the direction the
  stock is squared up in, where it began `invalid_argument:` and said how far the part stands
  outside. In thin air, that is the plan's first direction.
- Held in a `syntheticVise`, the stock is gripped only in the directions the part fits it squared
  up in, and the plan starts in one of those. Where the part fits it in none, the job fails with
  `error` beginning `part_outside_initial_stock:`, naming every direction. So does a `setupPlan`
  whose first setup is stated in a direction the part does not fit it in, which failed as
  `invalid_argument:` before.

**Plan issues** (experimental; `issues` on **Get a plan**, `GET /v1/plans/{planId}`):

- `PlanIssue.features` is new and optional, an array of `PlanIssueFeature`. An `OutOfPlay` issue
  lists each feature whose regions meet the issue's, by `featureTag`, with `cause`, `owed` and
  `rejections`. The cause says why it was never in play: refused by the tools (`ToolsRefused`),
  excluded by the planner (`Revoked`, `RefusesEveryTool`, `MeasurementFailed`), or one the plan's
  reading of it would not measure (`Unmeasured`). An `Unseen` issue lists none, and an `Incomplete`
  issue carries no `features`.
- `owed` lists the passes no tool of the plan meets (`Rough`, `Finish`, `Thread`). `rejections`
  lists, for `ToolsRefused`, why no tool was invented for those passes, each reason once: the tool
  crib's reasons, or with `fallbackTools`, the reasons no fallback tool could be made, reach lifted.
  It is always empty for a `Thread` pass, and empty when the crib lists no tool head and
  `fallbackTools` is off.
- `cause` and `rejections` are strings, not enums: values may be added in any release.
- `PlanIssue.unattributedRegionCount` is new and optional, present wherever `features` is: how many
  of the issue's regions no feature in `features` holds. A sliver held only by an edge break's dead
  stop counts here.
- Both are absent on every issue of a plan whose features could not be read, which states its
  issues without them, and on plans made before this release.

**List plans** (experimental; `GET /v1/parts/{id}/plans`):

- Each summary's `issues` are now the new `PlanIssueSummary` component, `kind`, `area` and
  `regionCount` as before, and carry neither field: a plan's features are read from the plan.

This release is additive to the contract.

### Engine API 1.30.0

Turning is stable: a part's `turning` reading, its turned features, and their datasheets, but for
four of their fields. Parts and holders can be uploaded in four more CAD formats, and a done region
is now left out of every feature a plan machines. Plans move. Parts and plans made from this release
report `kernelVersion` 0.27.0, so feature tags and region indices read under an earlier one no
longer apply.

**Turning** (`turning` on `GET /v1/parts/{id}`) is no longer experimental:

- `turning`, the `Turning` union and every component inside it — `TurningTurned`, `TurningNoAxis`,
  `TurningBelowThreshold`, `TurningSpinFailed`, `TurningNotRequested`, `TurningFrame`,
  `AxisSource`, `OutlinePoint`, `TurnedFeature`, and `TurningDatasheet` with its facts and enums —
  are no longer marked `x-toolpath-experimental`, and change only as the rest of the API does. As
  with milled features, which features a part holds and what they measure may move in any release.
- `TurningDatasheet.slopeSpans`, `radialReachMinusZ`, `radialReachPlusZ` and `axialReach` stay
  experimental, and so does `SlopeSpan`.
- `TurningDatasheet.approach` is new and optional: the end the feature is cut from, the same as its
  feature's own `approach`. It is absent on reports made before this release.

**CAD formats** (`POST /v1/parts`, `POST /v1/holders`):

- Inventor parts (`.ipt`), Solid Edge parts (`.par`), ACIS (`.sat`, `.sab`) and Rhino (`.3dm`) are
  read, beside STEP, Parasolid, SolidWorks, CATIA V5, NX and Creo, and IGES. As before, `filename`
  must carry the file's extension, which picks the reader.

**Done regions** (experimental; `doneRegions` on `POST /v1/parts/{id}/plans`,
`POST /v1/parts/{id}/toolpaths` and `POST /v1/plans/{planId}/toolpaths`):

- No feature a plan machines holds a done region. A part feature that holds one is planned as what
  is left of it, read again under a `featureTag` of its own, and one whose regions are all done is
  not planned. Until now such a feature was machined whole, its done regions with it, apart from a
  direction's top.
- A `setupPlan` may still name such a feature by its part-report tag: what is left of it is stated
  in its place, in the same setup. A profile so named states its walls as they now stand. One whose
  regions are all done states nothing, where it used to be machined.
- So a plan's `setupPlan`, `featureTags` and `unmachined` can name tags `GET /v1/parts/{id}` does
  not list. `trimmedFeatures` is new on **Get a plan** (`GET /v1/plans/{planId}`): each such
  feature, with its `featureType`, `machiningDirection` and `regionIdxs`, and `fromFeatureTag`, the
  part feature it was cut from. It is empty where the done regions trimmed no feature, and null for
  a plan with none and for plans made before this release.

**Plans** and estimates move: feature extraction, wall outlines, setup order, roughing passes, and
pass time estimates all change.
