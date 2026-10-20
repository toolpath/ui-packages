---
'@toolpath/quoting': minor
---

Add `@toolpath/quoting`: the quote flow from the quoting app, on the root entry and again as
`/model`. Part state, stages and moves (`partStateOf`, `PART_STAGES`, `moveFor`), what each stage
needs (`partArtifactsOf`), quote status (`quoteStatus`), the parts an offer holds
(`documentParts`), revision state (`revisionStateOf`), expiry (`isQuoteExpired`) and the payment
page's status (`payStatusOf`), as plain rules over plain data. Logic only — no React, no DOM and
no CSS: views over these rules belong in `@toolpath/ui`.
