---
'@toolpath/ui': patch
---

`Table` with `grouped` and `virtualized={false}` renders each group's header and empty state as rows of their own, as it does when virtualized. It handed them to the row function as if they were rows of `data`, so a row function that read a field of its item threw. Without virtualization there is no pinned group header above the rows, since nothing moves it as the table scrolls.
