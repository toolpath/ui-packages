import { defineConfig } from '@playwright/test'

// Isolated worktrees can test without reusing another checkout's preview server.
const port = process.env.VIEWER_TEST_PORT ?? '4173'
const baseURL = `http://127.0.0.1:${port}`

export default defineConfig({
  testDir: './tests',
  use: {
    baseURL,
    browserName: 'chromium',
    // Pinned, because the assertions below click into a 3D canvas. Where a
    // direction arrow lands depends on how the part is framed, which depends on
    // the canvas shape — at another aspect ratio the same fraction of the
    // canvas is somewhere else on the part.
    viewport: { width: 1280, height: 720 },
  },
  webServer: {
    command: `pnpm exec vite ${process.env.VIEWER_TEST_DEV ? '' : 'preview '}--host 127.0.0.1 --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer:
      !process.env.CI && !process.env.VIEWER_TEST_PORT && !process.env.VIEWER_TEST_DEV,
  },
})
