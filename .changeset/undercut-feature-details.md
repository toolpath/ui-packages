---
'@toolpath/dfm': minor
---

`featureMeasurements` gives T-slots and dovetails their own rows: undercut width (a T-slot's groove
height), floor and opening widths, undercut depth and dovetail angle, and under milling the max
cutting diameter (with a dovetail's angle and the corner radius), the max
shaft diameter and the L/D to the top of the part over the cutting diameter. A closed T-slot's head
is no wider than the opening it comes down through, and the shaft leaves the head reaching the
back of the groove. They no longer read their cutter band as walls, so they have no minimum radius,
max tool diameter or feature L/D rows. `featureSheet` carries the figures as `undercut`
(`FeatureUndercut`), and marks one the Engine could not measure.
