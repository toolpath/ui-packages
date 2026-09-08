---
'@toolpath/tool-support': minor
---

Refuse anything but a tap in a square-drive collet.

`Collet` gains an optional `squareSize`, and `holderTakesTool` reads it: a tap collet's bore
carries a square, so a shank-diameter test alone would seat an end mill of that size in something
that holds it by nothing. A collet that states no square is unchanged, and a tap in a plain round
collet still fits. `holderTakesTool`'s tool argument now also accepts `form`, optionally.

`TAP_FORMS` and `isTapForm` are exported alongside `MILLING_FORMS`.
