---
'@toolpath/dfm': minor
---

Add turning rules: `TURNING_RULES` gives `RuleList`, the rule helpers and the rule-set file a turned part's subjects and measures, and `turnedStretches` and `checkTurnedPart` check a part's turned features against them. Milling stays the default everywhere. An exported rule set now records which process it is for, so its JSON (and the LLM prompt's example) gains a `"process"` field, and `DfmMetric.kinds` and `DfmSubject.kinds` now admit turned kinds too. `FeaturePanel`, `CandidateList` and `FeatureDetails` take the same `vocabulary`, to name a turned feature by the ends it is cut from and head its considerations "Turning considerations"; `RuleVocabulary` gains `considerationsTitle`, and its `featureLabel` takes just a feature's type and direction.
