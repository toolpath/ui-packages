import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    // Real popup and keyboard interactions share the same completion budget as app suites.
    testTimeout: 30_000,
    reporters: process.env.CI ? ['default', 'json'] : ['default'],
    outputFile: { json: '.turbo/vitest-results.json' },
    include: ['tests/**/*.test.{ts,tsx}'],
    setupFiles: ['./tests/setup.ts'],
  },
})
