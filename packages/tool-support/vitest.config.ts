import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Nothing here touches a DOM, and nothing here is allowed to: the package
    // is what a Node ingest, a server route and a React renderer all import.
    // `tests/boundary.test.ts` is the check; this is the same claim stated in
    // the environment the suite runs in.
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // The Mastercam exporter's tests encode a 79-table SQLite database and hand
    // the bytes to SQLite, which is real CPU work rather than the microseconds
    // most of this suite spends. A GitHub runner does that work 20 to 30 times
    // slower than a development machine: `export-mastercam`'s determinism case
    // is 195 ms here and over 5382 ms there, and `sqlite-encoder`'s two heavy
    // cases are 94 ms and 58 ms here against 2090 ms and 1759 ms there.
    //
    // Vitest's 5 s default is therefore not a budget anyone chose for this
    // suite — it is a line the slowest case sits on, passing or failing by
    // which runner it drew. Nothing here asserts how long an export takes, so
    // the timeout is only a guard against a test that hangs, and 30 s is long
    // enough that a slow runner never trips it and short enough that a hang
    // still ends the run.
    testTimeout: 30_000,
  },
})
