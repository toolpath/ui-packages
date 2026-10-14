---
'@toolpath/tool-support': minor
---

Add `rankFits(fits, forms, demand)`, the order a tool list for one feature reads in, with `fitClass` and `leavesCornerRadius`. `fitClass` classes a `ToolFit` as `'fits'`, `'corner-only'` (every failure is a `'sharp-corner'` one) or `'fails'`, and `rankFits` keeps that class order: fits and failures by the form's place in `forms`, then — where the demand states a floor fillet — the corner radius closest under it first and one over it after, then cutting diameter largest first; corner-only misses by the radius they leave, smallest first. Ties keep the input order.
