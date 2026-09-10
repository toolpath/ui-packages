---
'@toolpath/api': minor
---

Regenerate the TypeScript SDK for Engine API 1.10.0.

Reference documentation is reorganized around the part pipeline, the billing annotation is split
into product and metered, and machining plans and toolpath calculation are marked as early access.

- **Product and metered are now separate.** Each operation declares its product area in
  `x-toolpath-product` (`core`, `dfm`, or `quoting`) and whether the call is billed in
  `x-toolpath-metered` (boolean). This replaces the single `x-toolpath-billing` field, whose
  `unmetered` value conflated "free" with "core area". Every operation now has a product; only the
  compute calls are metered.
- **Plan and toolpath reads move into their product (access change).** Reading a plan or its
  toolpaths/machining time now belongs to the `dfm`/`quoting` product rather than the free core
  area, so it requires that product's read grant. A key with only core access that previously read
  these will now receive `403 product_mismatch`; grant it DFM/Quoting read in the Portal. Nothing
  is newly billed — these reads remain free.
- Operations are grouped and ordered by pipeline stage: `Parts` (upload, tessellate, and analyze),
  `Features`, `Plans`, `Toolpaths`, then `Tool holders` and `Jobs`, queue endpoints before reads.
  This is documentation grouping only; paths, request and response shapes, operation ids, and (apart
  from the read-access change above) key access are unchanged.
- Operation summaries were standardized to a `verb + resource` form (for example
  `Queue part processing` → `Analyze a part`, `Create a plan and calculate its toolpaths` →
  `Calculate toolpaths`). `POST /v1/plans/{planId}/toolpaths` is renamed from "Recalculate
  toolpaths" to "Calculate a plan's toolpaths" (operation id unchanged). Every read states which
  pipeline step must run first to produce its data.
- The plan and toolpath operations carry an `x-toolpath-experimental` extension and an early-access
  notice; they are available now but still gaining functionality, and breaking changes continue to
  follow the API major version.

Apart from the plan/toolpath read-access change noted above, this release is additive: no existing
response changes shape, and no key is newly billed.
