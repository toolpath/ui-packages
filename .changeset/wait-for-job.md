---
'@toolpath/api': minor
---

Add `waitForJob`, which waits for a job on the Engine API's job event stream
(`GET /v1/jobs/{id}/events`) instead of polling `getJob`. It resolves with the job when it succeeds,
rejects with the new `JobFailedError` when it fails, rejects if the stream's connection is lost
first, and takes `onUpdate` and `signal` options.
