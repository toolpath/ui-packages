---
'@toolpath/tool-support': minor
---

Add `@toolpath/tool-support/export/mastercam`, which writes a Mastercam
`.TOOLDB` tool library as bytes — tools, holders and the assemblies that set
their stickout. Mastercam's schema is pinned in `mastercam/` and adopted from a
reference library by `pnpm mastercam:adopt`.

A tool carries every holder it is set up in, so one tool row can be the
`MainTool` of several assemblies, each with its own holder, stickout and
carousel position.

A form Mastercam's legacy tool types have no code for is coerced onto one whose
silhouette matches, or skipped; either way it is reported as an `ExportNote`
rather than guessed at.

Includes a dependency-free SQLite file encoder, since the package takes no
runtime dependency and the format is a SQLite database.
