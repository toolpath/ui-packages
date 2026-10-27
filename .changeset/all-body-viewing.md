---
'@toolpath/viewer': minor
'@toolpath/dfm': minor
'@toolpath/ui': minor
---

Support complete multi-body scenes: `PartCollection` with body-scoped picking and shared section bounds, `usePartCollection` to load every body's mesh and swap in each analysis mesh as it arrives, and combined DFM results with body identities. `useFileMesh` (experimental) draws a file's bodies from its mesh (`GET /v1/files/{id}/mesh`, Engine API 1.35.0) before any is a part, and `displayMeshModel` makes a model of a part's display mesh.
