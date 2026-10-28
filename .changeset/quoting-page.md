---
'@toolpath/quoting': minor
---

`@toolpath/quoting/plan` adds `quotingPage(inputs)`: `@toolpath/plan`'s `planPage` made from the
quoting app's Plan page session. The app gives the plan as saved and its session (`loaded`),
Toolpath's plan, whether a newer one is on its way (`planSettled`), the part, and its analysis. It
lays the session's edits over the plan as saved, and names Toolpath's setups by their folders only
while no edits are held, the plan has not changed since, and no newer plan is on its way. Types:
`QuotingPageInputs` and `QuotingPlanLoaded`.
