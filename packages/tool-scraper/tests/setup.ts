/**
 * No test in this suite reaches a vendor.
 *
 * Every transport here goes through a `Fetcher` the caller passes in, and
 * every test that exercises one passes a stub. This makes the *absence* of
 * that stub loud instead of slow: without it, a test that forgets would
 * quietly page a vendor's whole catalog and pass, and the only symptom is a
 * suite that takes thirty seconds.
 *
 * Which happened in the Python while porting Destiny Tool onto the shared
 * fetch, when four tests kept patching the module they used to call directly.
 *
 * Live-network tests belong behind an environment variable and out of CI —
 * reaching three vendors' endpoints on every pull request is slow and impolite.
 */

import { beforeEach, vi } from 'vitest'

beforeEach(() => {
  vi.stubGlobal('fetch', (input: unknown) => {
    const url = typeof input === 'string' ? input : String(input)
    throw new Error(
      `a test tried to reach ${url} — pass a stub Fetcher, or stub the ` +
        `vendor function above it`,
    )
  })
})
