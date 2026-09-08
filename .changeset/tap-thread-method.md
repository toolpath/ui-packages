---
'@toolpath/tool-support': minor
'@toolpath/tool-scraper': minor
---

Record whether a tap cuts its thread or forms it.

`Tool` takes an optional `threadMethod`, `'cutting' | 'forming'`, beside `form`
rather than as new `TOOL_FORMS` values — the form vocabulary stays Fusion's, and
Fusion has no form-tap type. `ToolRecord.threadMethod` carries the same value on
a tap and `null` on every other kind; `toolRecord` refuses a tap without one and
a non-tap with one.

Every tap family now states it as a cited fact: Kennametal's three from its
`newTapType` facet, EMUGE's `FG01` from the category it titles `Machine taps`.
And EMUGE's cold-forming taps are scraped for the first time —
`emuge_form_taps.csv`, category `FG02`, 1,432 parts — so `forming` is a value the
catalog actually holds rather than one only the type admits.
