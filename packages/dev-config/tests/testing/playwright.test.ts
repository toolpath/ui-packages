import { createServer } from 'node:net'
import { join } from 'node:path'
import { afterAll, describe, expect, it, vi } from 'vitest'
import { runSuite } from '../../src/cli/suites.js'
import { resolveConfig } from '../../src/config/resolve.js'
import { ConfigError } from '../../src/errors.js'
import { createPlaywrightConfig } from '../../src/testing/playwright.js'
import { createSuiteProject, type SuiteProject } from './project.js'

const projects: Array<SuiteProject> = []
const browserProject = (files: Record<string, string> = {}): SuiteProject => {
  const project = createSuiteProject(
    {
      kind: 'application',
      runtime: 'dom',
      noUnitTests: { reason: 'Only the browser suite is under test here' },
      suites: { browser: { runner: 'playwright', config: 'playwright.config.mjs' } },
    },
    files,
  )
  projects.push(project)
  return project
}

afterAll(() => {
  for (const project of projects) {
    project.remove()
  }
})

describe('createPlaywrightConfig', () => {
  it('sets the failure-first, no-retry policy', () => {
    vi.stubEnv('CI', '')
    vi.stubEnv('TOOLPATH_DEV_REPORT', '')
    const project = browserProject()
    const config = createPlaywrightConfig(project.config, {
      project: 'app',
      suite: 'browser',
      webServer: { command: 'npm run preview', url: 'http://127.0.0.1:4173' },
    })
    expect(config).toMatchObject({
      testDir: project.directory,
      testMatch: ['**/*.spec.{ts,tsx,mts,cts,js,jsx,mjs,cjs}'],
      forbidOnly: true,
      retries: 0,
      workers: 2,
      timeout: 30_000,
      expect: { timeout: 5_000 },
      reporter: [['line']],
      use: {
        headless: true,
        screenshot: 'only-on-failure',
        trace: 'retain-on-failure',
        video: 'off',
        baseURL: 'http://127.0.0.1:4173',
      },
      projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
    })
    expect(config.webServer).toEqual([
      expect.objectContaining({
        url: 'http://127.0.0.1:4173',
        reuseExistingServer: false,
        cwd: project.directory,
      }),
    ])
  })

  it('reuses a local server only when asked, and never in CI', () => {
    const project = browserProject()
    const options = {
      project: 'app',
      suite: 'browser',
      webServer: { command: 'npm run dev', url: 'http://127.0.0.1:5173', reuseLocalServer: true },
    }
    vi.stubEnv('CI', '')
    expect(createPlaywrightConfig(project.config, options).webServer).toEqual([
      expect.objectContaining({ reuseExistingServer: true }),
    ])
    vi.stubEnv('CI', 'true')
    const ci = createPlaywrightConfig(project.config, options)
    expect(ci.webServer).toEqual([expect.objectContaining({ reuseExistingServer: false })])
    expect(ci.workers).toBe(1)
  })

  it('writes the JSON report when toolpath-dev asks for one', () => {
    vi.stubEnv('TOOLPATH_DEV_REPORT', '/tmp/report.json')
    const project = browserProject()
    expect(
      createPlaywrightConfig(project.config, { project: 'app', suite: 'browser' }).reporter,
    ).toEqual([['dot'], ['json', { outputFile: '/tmp/report.json' }]])
  })

  it('keeps the artifact policy out of the extension slot', () => {
    const project = browserProject()
    expect(() =>
      createPlaywrightConfig(project.config, {
        project: 'app',
        suite: 'browser',
        extend: { use: { video: 'on' } as Record<string, unknown> },
      }),
    ).toThrow(ConfigError)
  })
})

const freePort = async (): Promise<number> =>
  new Promise((resolvePort, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      const port = typeof address === 'object' && address !== null ? address.port : 0
      server.close(() => {
        resolvePort(port)
      })
    })
  })

const playwrightConfig = (port: number): string => `import config from './dev.config.mjs'
import { createPlaywrightConfig } from '@toolpath/dev-config/playwright'

export default createPlaywrightConfig(config, {
  project: 'app',
  suite: 'browser',
  webServer: { command: 'node server.mjs ${String(port)}', url: 'http://127.0.0.1:${String(port)}/health' },
})
`

const SERVER = `import { createServer } from 'node:http'

createServer((_request, response) => {
  response.writeHead(200, { 'content-type': 'application/json' })
  response.end(JSON.stringify({ ok: true }))
}).listen(Number(process.argv[2]), '127.0.0.1')
`

describe('a Playwright suite run by toolpath-dev', () => {
  it('starts the managed server, runs the API test, and proves it ran', async () => {
    vi.stubEnv('CI', '')
    const port = await freePort()
    const project = browserProject({
      'server.mjs': SERVER,
      'playwright.config.mjs': playwrightConfig(port),
      'tests/health.spec.mjs': `import { expect, test } from '@playwright/test'

test('serves its health check', async ({ request }) => {
  const response = await request.get('/health')
  expect(response.status()).toBe(200)
  expect(await response.json()).toEqual({ ok: true })
})
`,
    })
    const [resolvedProject] = resolveConfig(project.config).projects
    const suite = resolvedProject?.suites[0]
    if (!resolvedProject || !suite) {
      throw new Error('the project did not resolve')
    }
    const outcome = await runSuite(resolvedProject, suite, {
      reportDir: join(project.directory, 'reports'),
    })
    expect(outcome.log).not.toContain('Error')
    expect(outcome).toMatchObject({ status: 'passed', tests: { passed: 1, failed: 0 } })
  }, 60_000)

  it('fails a focused test instead of running it alone', async () => {
    const port = await freePort()
    const project = browserProject({
      'server.mjs': SERVER,
      'playwright.config.mjs': playwrightConfig(port),
      'tests/focused.spec.mjs': `import { expect, test } from '@playwright/test'

test.only('focused', async ({ request }) => {
  expect((await request.get('/health')).ok()).toBe(true)
})
`,
    })
    const [resolvedProject] = resolveConfig(project.config).projects
    const suite = resolvedProject?.suites[0]
    if (!resolvedProject || !suite) {
      throw new Error('the project did not resolve')
    }
    const outcome = await runSuite(resolvedProject, suite, {
      reportDir: join(project.directory, 'reports'),
    })
    expect(outcome.status).toBe('failed')
    expect(outcome.log).toMatch(/forbid-only|focused with '\.only'/i)
  }, 60_000)
})
