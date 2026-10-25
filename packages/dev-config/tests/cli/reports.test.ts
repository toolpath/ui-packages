import { describe, expect, it } from 'vitest'
import { checkPrerequisites, countsFromReport, junitCounts } from '../../src/cli/suites.js'
import type { ResolvedSuite } from '../../src/config/resolve.js'

describe('test reports', () => {
  it('counts Vitest and Jest JSON, including a file that failed to load', () => {
    expect(
      countsFromReport(
        'vitest-json',
        JSON.stringify({
          numPassedTests: 3,
          numFailedTests: 1,
          numPendingTests: 2,
          numTodoTests: 1,
        }),
      ),
    ).toEqual({
      passed: 3,
      failed: 1,
      skipped: 3,
    })
    expect(
      countsFromReport(
        'jest-json',
        JSON.stringify({
          numPassedTests: 0,
          numFailedTests: 0,
          numFailedTestSuites: 1,
          success: false,
        }),
      ),
    ).toEqual({
      passed: 0,
      failed: 1,
      skipped: 0,
    })
  })

  it('counts Playwright JSON, where flaky passes and top-level errors fail', () => {
    expect(
      countsFromReport(
        'playwright-json',
        JSON.stringify({
          stats: { expected: 4, unexpected: 1, flaky: 1, skipped: 2 },
          errors: [{}],
        }),
      ),
    ).toEqual({
      passed: 5,
      failed: 2,
      skipped: 2,
    })
  })

  it('totals JUnit suites and ignores comments and CDATA', () => {
    const xml = `<?xml version="1.0"?>
<!-- <testsuite tests="100"> -->
<testsuites>
  <testsuite name="a" tests="3" failures="1" errors="0" skipped="1"><testcase name="x"><![CDATA[<testsuite tests="9">]]></testcase></testsuite>
  <testsuite name="b" tests="2" failures="0" errors="1" skipped="0"></testsuite>
</testsuites>`
    expect(junitCounts(xml)).toEqual({ passed: 2, failed: 2, skipped: 1 })
  })
})

describe('suite prerequisites', () => {
  const suite = (prerequisites: ResolvedSuite['prerequisites']): ResolvedSuite => ({
    id: 'app:device',
    project: 'app',
    name: 'device',
    runner: 'command',
    ordinary: false,
    ci: 'required',
    browsers: [],
    prerequisites,
  })

  it('names each missing variable and executable before running anything', () => {
    expect(() => {
      checkPrerequisites(
        suite({ env: ['DEVICE_TOKEN'], commands: ['definitely-not-installed-tool'] }),
        { PATH: '/nonexistent' },
      )
    }).toThrow(
      /environment variable DEVICE_TOKEN is not set[\s\S]*definitely-not-installed-tool is not on PATH/,
    )
    expect(() => {
      checkPrerequisites(suite({ env: ['DEVICE_TOKEN'], commands: [] }), { DEVICE_TOKEN: 'set' })
    }).not.toThrow()
  })
})
