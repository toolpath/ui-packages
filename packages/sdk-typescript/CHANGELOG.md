# @toolpath/api

## 0.4.0

### Minor Changes

- 3a92bc7: Regenerate the TypeScript SDK for Engine API 1.2.0.
- b9cdb0e: Regenerate the TypeScript SDK for Engine API 1.3.0.

  Tool holder import: upload a holder's CAD file, derive its collision envelope, and export it as an
  Autodesk Fusion tool library.
  - Five new endpoints — `POST /v1/holders`, `PATCH /v1/holders/{id}`, `GET /v1/holders/{id}`,
    `GET /v1/holders/{id}/fusion`, and `GET /v1/holder-libraries/fusion`.
  - A job can now name a holder as well as a part, so `holderUuid` and `importId` join `partUuid` and
    `reportId` on job responses, and `GET /v1/jobs` gains a `holderId` filter beside `partId`.
  - `PATCH /v1/parts/{id}` now answers `409 idempotency_key_reused` when an `Idempotency-Key` was
    already spent on a different part or a different product. Retrying the same request still replays
    the original job; what changed is that reusing a key across operations no longer returns a job id
    belonging to something else.

  This release is additive. No existing response changes shape: a job that names a part still carries
  its `partUuid` and `reportId`, and a client that never creates a holder never receives a holder job.
  `partUuid` is declared nullable so one schema can describe either subject, which widens the
  generated SDK's type to `string | null` — TypeScript consumers that dereference it will want a null
  check, or can read the new `holderUuid` to tell the two subjects apart.

### Patch Changes

- a90e28e: Regenerate the TypeScript SDK for Engine API 1.3.1.

  Part results now carry `turnability`: whether the part belongs on a lathe, read from the imported
  part on every analyze run.
  - `GET /v1/parts/{id}` gains a `turnability` field — either a `TurningAxis` (the axis's `direction`
    and `location`, the `areaFraction` of the surface one turning setup could finish, and the
    `volumeFraction` of the envelope of revolution the part keeps), or `NoAxis` when the kernel found
    no axis worth turning about, or `null` when no reading was taken.
  - `null` and `NoAxis` are different answers. `NoAxis` is a result; `null` means the reading is
    absent — every part result produced before this release, and any run where the reading failed.
  - The field does not depend on `featureDetails`. Unlike `directionZBounds`, it is populated on runs
    that skip feature enrichment.

  This release is additive. No existing response changes shape.

## 0.3.0

### Minor Changes

- 56499f3: Regenerate the TypeScript SDK for Engine API 1.1.0.

## 0.2.5

### Patch Changes

- 26c00ca: Regenerate the TypeScript SDK for Engine API 1.0.4.

## 0.2.4

### Patch Changes

- 2dc3546: Update published package repository links after the repository rename.

## 0.2.3

### Patch Changes

- 584e061: Regenerate the TypeScript SDK for Engine API 1.0.3.

## 0.2.2

### Patch Changes

- 1b75dd9: Regenerate the TypeScript SDK for Engine API 1.0.2.

## 0.2.1

### Patch Changes

- 1927f4e: Regenerate the TypeScript SDK for Engine API 1.0.1.

## 0.2.0

### Minor Changes

- 4fe5c56: Expose Engine API region split origins in generated TypeScript types.
