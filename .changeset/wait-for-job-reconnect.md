---
'@toolpath/api': minor
---

`waitForJob` and Python's `wait_for_job` take an optional `reconnect`. With it they open the job's event stream again when it ends early, when the connection fails, and on a 429, after its `Retry-After`, or a 5xx, waiting 1, 2, 4, then every 8 seconds by default and starting over after a stream that sent the job. A refused key (401, 403) or an unreachable job (404, 410) still rejects at once, and `giveUpAfterMs` (`give_up_after` in Python) gives up once that long passes without word of the job. Without `reconnect` both behave as before.
