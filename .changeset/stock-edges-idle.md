---
'@toolpath/viewer': patch
---

Build a large stock mesh's outline in slices between frames, so showing in-process stock no longer freezes the page. `<Stock>` used to build its 15° outline with one `EdgesGeometry` call the first time a mesh was shown; stock cut by a fine tool holds hundreds of thousands of triangles, and that call blocked the main thread for 450–600 ms each time a new action's stock appeared. Meshes over 20,000 triangles now build the same lines — `EdgesGeometry`'s own walk, keys and output order — in 4 ms slices, and the outline joins the stock once built; smaller meshes build at once as before. A disposed stock stops its build. `createStock` takes an optional `onEdges` callback, called when a sliced outline is added, which `<Stock>` uses to redraw.
