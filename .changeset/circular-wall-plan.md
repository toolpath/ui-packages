---
'@toolpath/plan': patch
---

`groupFaces` ranks `circular_wall`, which Engine API 1.34.0 reports for a stud, a round boss or a
turned part's outline, with the bosses, as the viewer does. Among features that include equally
many faces still ungathered, a circular wall goes before a chamfer, fillet or wall, as a stud did
when it read as a `boss`. Unranked, it went after chamfers and fillets.
