---
'@toolpath/viewer': minor
---

`KnownFeatureType` includes `circular_wall`, which Engine API 1.34.0 reports for the outside of a
whole cylinder standing along its machining direction: a stud, a round boss or a turned part's
outline. `FEATURE_TYPE_RANKS` ranks it with the bosses, so a click on a face it shares with a
chamfer, fillet or wall selects the circular wall. Unranked, it went after chamfers and fillets.
