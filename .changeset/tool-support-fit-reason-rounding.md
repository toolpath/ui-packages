---
'@toolpath/tool-support': patch
---

Round the lengths in a `fitAgainst` failure's `reason` to the micron, trailing zeros dropped: a tool read from inches says `⌀15 mm`, not `⌀14.99999999999989 mm`. The comparisons still use the stated values.
