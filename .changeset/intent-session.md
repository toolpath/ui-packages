---
'@toolpath/quoting': minor
---

`@toolpath/quoting/plan` adds `quotingPlan`, the Plan page session with the app's rules in place:
`start(saved, held)`, `update(session, event, rules)`, `hasEdits(session)` and `read(saved)`, and the
types `IntentSession`, `IntentEvent` and `IntentRules`. An app gives only what it reads of the part
and whether the plan is locked; it no longer passes `sameIntent` and `rebaseIntent` itself.
`DraftAction`, `DraftFacts` and `PlanRules` are exported from it too.
