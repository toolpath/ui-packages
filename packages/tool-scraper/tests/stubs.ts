/**
 * The two things every suite here needs: a {@link Fetcher} that is not the
 * network, and a console that collects instead of printing.
 *
 * `Fetcher.json` is generic, so an object literal cannot satisfy it directly —
 * every suite wrote the same `as unknown as Fetcher` narrowing, and one of the
 * copies drifted into documenting the copying. The narrowing lives here now;
 * what each suite still writes is the part that is its own, the answers.
 */

import type { Fetcher } from '../src/fetch.js'
import type { Console_ } from '../src/node/cli.js'

/** The methods a stub supplies, narrowed to what a {@link Fetcher} promises. */
export function asFetcher(parts: Record<string, unknown>): Fetcher {
  return parts as unknown as Fetcher
}

/** A fetcher whose every method refuses, for the paths that need none. */
export function stub(overrides: Record<string, unknown> = {}): Fetcher {
  return asFetcher({
    bytes: () => Promise.reject(new Error('unused')),
    text: () => Promise.reject(new Error('unused')),
    json: () => Promise.reject(new Error('unused')),
    postJson: () => Promise.reject(new Error('unused')),
    ...overrides,
  })
}

/** Collects what the CLI printed, in place of stdout. */
export function recorder(): {
  io: Console_
  out: string[]
  err: string[]
  all: () => string
} {
  const out: string[] = []
  const err: string[] = []
  const io: Console_ = {
    log: (m) => out.push(m),
    error: (m) => err.push(m),
  }
  return { io, out, err, all: () => [...out, ...err].join('\n') }
}

/**
 * The politeness delay, observed instead of waited out.
 *
 * `scrape.pause` resolves on a `setTimeout`, so a timer that fires at once
 * takes the wait out of the suite without taking the code path out: the loop
 * still awaits every pause it would make, in the same order, and what it asked
 * to wait for is recorded rather than slept through.
 *
 * **This is the only way the pacing is asserted.** Passing `delayMs: 0` — what
 * every scrape test does, and rightly, when the subject is the parsing — makes
 * `pause` return without touching a timer at all, so a dropped `await pause()`
 * is invisible to it. A test that means to check the pacing has to leave the
 * delay at its default and read the record.
 *
 * The delays are recorded rather than counted because 400 ms is the number
 * `REQUEST_DELAY_MS` states and a loop that paced itself by one millisecond
 * would satisfy a count.
 */
export function recordPauses(): { waits: number[]; restore: () => void } {
  const waits: number[] = []
  const real = globalThis.setTimeout

  globalThis.setTimeout = ((fn: () => void, ms?: number) => {
    waits.push(ms ?? 0)
    fn()
    return 0
  }) as unknown as typeof globalThis.setTimeout

  return {
    waits,
    restore: () => {
      globalThis.setTimeout = real
    },
  }
}
