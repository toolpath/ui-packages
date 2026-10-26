---
'@toolpath/ui': minor
---

The DFM views import their logic from `@toolpath/dfm`, and `@toolpath/ui` no longer depends on
`@toolpath/tool-support` directly. `storageFolds` and `FoldStore` now come from `@toolpath/dfm`, and
`storageFolds` takes a third argument, `{ shutAtFirst }`, for sections that start shut until someone
opens them.

`RuleList` dims exactly the rules it sinks to the bottom, `ruleListOrder`'s quiet ones. A rule
broken only by readings a plan can do without, and the rule just added, are no longer dimmed.
