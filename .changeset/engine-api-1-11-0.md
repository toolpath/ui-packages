---
'@toolpath/api': minor
---

Regenerate the TypeScript SDK for Engine API 1.11.0 (from 1.9.0).

- `PartMeshResponse` gains `faceTriangleCounts`: how many of the display mesh's triangles each
  face of the body became, in mesh order. Every face is one contiguous span, so the counts
  partition the mesh and sum to `meshTriangleCount`. A viewer draws the edges between faces from
  them. `null` for a mesh tessellated before the Engine kept face spans; queue a new tessellation
  with `parts.createPartMesh` to get them.
- `parts.getPartThumbnail` (`GET /v1/parts/{id}/thumbnail`, Engine API 1.9.0 on the server)
  serves a part's rendered PNG thumbnail as image bytes, with the API key the client already
  holds. `404 part_thumbnail_not_found` when the analysis produced none; `410 part_expired` past
  the retention window.
