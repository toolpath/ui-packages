---
'@toolpath/tool-scraper': minor
---

Cover Kennametal's whole ER collet catalog: standard, coolant-through and tap.

- `kennametal --collets` walks the three ER collet category trees and prints every family they
  link to, with the configured CSV that claims its code or `(not configured)`.
- `COLLET_FAMILIES` grows from 2 families to 14 — 443 parts where there were 120 — and every
  toolholding family may now record its `familyCode`, so a re-scrape needs no browser.
- `ColletRecord` gains `clampingLength`/`clampingLengthMm` (`L9`, the bore depth that is
  `@toolpath/tool-support`'s `Collet.clampLength`), `squareSize` (`S10`) and `tapRange`.
- A tap collet publishes no `CCCN`/`CCCX`; its `D1` is an exact clamping diameter and becomes a
  zero-width capacity, the shape a sealed collet already had.
- `checkCollet` allows a designation to sit up to `NOMINAL_SLACK` outside the size it measures —
  Kennametal's sealed ER40 inch collets are named for a fraction they clamp under — and refuses a
  square size that is not smaller than what it clamps.
