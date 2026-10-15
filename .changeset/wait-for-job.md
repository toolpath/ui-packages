---
'@toolpath/api': minor
---

Add `waitForJob`, which waits for a job on the Engine API's job event stream
(`GET /v1/jobs/{id}/events`) instead of polling `getJob`. It resolves with the job when it succeeds,
rejects with the new `JobFailedError` when it fails, and rejects if the stream ends first: a lost
connection, or the server closing it because the job expired or could not be read. An error
response rejects with `ResponseError`, its body already read so the connection is freed and the
problem details stay readable on `error.response`. It takes `onUpdate` and `signal` options.
