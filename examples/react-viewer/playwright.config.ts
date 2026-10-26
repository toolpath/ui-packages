import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    browserName: 'chromium',
    // Pinned, because the assertions below click into a 3D canvas. Where a
    // direction arrow lands depends on how the part is framed, which depends on
    // the canvas shape — at another aspect ratio the same fraction of the
    // canvas is somewhere else on the part.
    viewport: { width: 1280, height: 720 },
  },
  webServer: {
    command: 'pnpm exec vite preview --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
  },
})
