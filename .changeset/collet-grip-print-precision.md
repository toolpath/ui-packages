---
'@toolpath/tool-support': patch
---

Grip a shank at the size the collet is named for.

`gripsShank`'s tolerance was `1e-6` mm, sized for a conversion's last bit. A clamping
band is not a computed measurement, though — it is a figure a vendor printed to three or
four decimal places — so four of the 764 collets in the scraped catalog refused the
shank they are sold for:

- Kennametal `25ER0312`, a 5/16 in ER25, prints `CCCX` as `0.312` in and `7.938` mm in
  one row. 7.938 mm is 0.3125 in exactly, so the inch cell is that value at three places
  and the band stopped 0.0127 mm below a 5/16 shank.
- `32ERSS0281`, `32ERSS0406` and `32ERSS0719` print the nominal and the band as the same
  four-decimal inch value rounded in opposite directions, and missed by 0.00254 mm.

The tolerance is now one thousandth of an inch — the coarsest last place these catalogs
print, so it is the width of the artifact rather than a figure picked to clear it. It
sits 2x above the widest of those and 2.5x below the narrowest capacity a vendor
undersizes on purpose, `40ERSS0312` at 0.0635 mm. All ten sealed ER40 rows of that shape
stay refused. No collet that matched a shank before stops matching one.
