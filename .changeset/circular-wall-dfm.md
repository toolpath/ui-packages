---
'@toolpath/dfm': minor
---

Read the circular walls Engine API 1.34.0 reports: the outside of a whole cylinder standing along
its machining direction. One that stands on a floor, a stud or round boss, is machined as a boss,
and the `boss` subject names it; any other, such as a turned part's outline, is machined as a wall,
and the `wall` subject names it. Before, the `wall` subject named every circular wall.

`FeatureSheet` carries `standsOnAFloor`, read from the datasheet's `facts.standsOnAFloor`.
`FactsKind` includes `CircularWall`, the `boss` and `wall` subjects list it, `type:circular_wall`
names the type alone, and the pass length is offered for it. A circular wall has no floor fillet
reading: the Engine reports the blend at a stud's foot as a feature of its own.
