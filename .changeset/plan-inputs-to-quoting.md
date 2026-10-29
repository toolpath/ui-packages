---
'@toolpath/plan': minor
'@toolpath/quoting': minor
---

Move the stock, the tool crib and units out of `@toolpath/plan` into two new `@toolpath/quoting`
entries. `@toolpath/plan` now has no dependencies.

**Breaking for `@toolpath/plan`.** It no longer exports the stock (`StockOption`, `parseStock`,
`sameStock`, `stockRequest`, `stockPlacement`, `fixedBoxCheck` and the rest of `stock`), the tool
crib (`ToolCrib`, `startingLibrary`, `addLibrary` and the rest of `tool-crib`) or units (`Units`,
`formatLength`, `toInput`, `fromInput` and the rest of `units`). To migrate, import the same names
from the new entries; nothing else changes:

- stock and tool crib: `@toolpath/quoting/inputs`
- units: `@toolpath/quoting/units`

`@toolpath/quoting` now depends on `@toolpath/tool-support`, for the inch.
