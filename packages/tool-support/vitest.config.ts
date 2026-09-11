import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Nothing here touches a DOM, and nothing here is allowed to: the package
    // is what a Node ingest, a server route and a React renderer all import.
    // `tests/boundary.test.ts` is the check; this is the same claim stated in
    // the environment the suite runs in.
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
})
