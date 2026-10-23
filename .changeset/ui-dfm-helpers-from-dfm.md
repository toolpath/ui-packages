---
'@toolpath/ui': minor
---

The DFM views import their logic from `@toolpath/dfm`, and `@toolpath/ui` no longer depends on
`@toolpath/tool-support` directly. `storageFolds` and `FoldStore` now come from `@toolpath/dfm`, and
`storageFolds` takes a third argument, `{ shutAtFirst }`, for sections that start shut until someone
opens them.
