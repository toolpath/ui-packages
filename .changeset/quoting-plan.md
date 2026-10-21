---
'@toolpath/quoting': minor
---

`@toolpath/quoting/plan` is the quoting app's plan draft: `PlanDraft` is
`@toolpath/plan`'s `Constraints` with the kernel the pins were made by, the save's fields and the
part's inputs held until Apply (`PartInputsHeld`, `Intent`). `StockState`, `StockProfileInput` and
`StockProfileSummary` are a part's saved stock and the shop's stock profiles. `intentSessionRules`
(with `intentOf`, `sameIntent` and `rebaseIntent`) is what the Plan page's `planSession` needs for
the inputs. The package now
depends on `@toolpath/plan`; the root entry and `/model` are unchanged and import nothing.
