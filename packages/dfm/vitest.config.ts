import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // jsdom, for the rule list's tests. The model suites are pure and do not
    // need it, but one environment is simpler than a per-file split.
    environment: 'jsdom',
    include: ['tests/**/*.test.{ts,tsx}'],
    setupFiles: ['./tests/setup.ts'],
  },
})
