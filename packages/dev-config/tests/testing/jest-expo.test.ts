import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { afterAll, describe, expect, it } from 'vitest'
import { ConfigError } from '../../src/errors.js'
import { createJestExpoConfig } from '../../src/testing/jest-expo.js'
import { createSuiteProject, type SuiteProject } from './project.js'

const projects: Array<SuiteProject> = []
const nativeProject = (runtime: 'native' | 'dom' = 'native'): SuiteProject => {
  const project = createSuiteProject({
    kind: 'application',
    runtime,
    suites: { unit: { runner: 'jest-expo', config: 'jest.config.mjs' } },
  })
  projects.push(project)
  return project
}

afterAll(() => {
  for (const project of projects) {
    project.remove()
  }
})

/** Whether Jest would leave `path` untransformed under these patterns. */
const ignored = (patterns: Array<string>, path: string): boolean =>
  patterns.some((pattern) => new RegExp(pattern).test(path))

describe('createJestExpoConfig', () => {
  it('uses the jest-expo preset with *.test.* discovery, lifecycle cleanup, and no empty pass', () => {
    const project = nativeProject()
    const config = createJestExpoConfig(project.config, { project: 'app', suite: 'unit' })
    expect(config).toMatchObject({
      rootDir: project.directory,
      displayName: 'app:unit',
      preset: 'jest-expo',
      clearMocks: true,
      restoreMocks: true,
      testTimeout: 5_000,
      passWithNoTests: false,
    })
    expect(config.testMatch).toContain('<rootDir>/**/*.test.{ts,tsx,mts,cts,js,jsx,mjs,cjs}')
    expect(config.testPathIgnorePatterns).toContain('\\.spec\\.[cm]?[jt]sx?$')
    expect(config.maxWorkers).toBeGreaterThanOrEqual(1)
    expect(config.maxWorkers).toBeLessThanOrEqual(4)
  })

  it("keeps jest-expo's transform exceptions, including under pnpm, and extends them", () => {
    const project = nativeProject()
    const { transformIgnorePatterns } = createJestExpoConfig(project.config, {
      project: 'app',
      suite: 'unit',
      extend: { transformPackages: ['@acme/untranspiled'] },
    })
    expect(ignored(transformIgnorePatterns, '/repo/node_modules/react-native/index.js')).toBe(false)
    expect(ignored(transformIgnorePatterns, '/repo/node_modules/expo-router/build/index.js')).toBe(
      false,
    )
    expect(ignored(transformIgnorePatterns, '/repo/node_modules/@acme/untranspiled/index.js')).toBe(
      false,
    )
    expect(ignored(transformIgnorePatterns, '/repo/node_modules/lodash/index.js')).toBe(true)
    expect(
      ignored(
        transformIgnorePatterns,
        '/repo/node_modules/.pnpm/expo@58.0.19/node_modules/expo/index.js',
      ),
    ).toBe(false)
    expect(
      ignored(
        transformIgnorePatterns,
        '/repo/node_modules/.pnpm/lodash@4.18.1/node_modules/lodash/index.js',
      ),
    ).toBe(true)
    expect(
      ignored(
        transformIgnorePatterns,
        '/repo/node_modules/@react-native/babel-preset/src/index.js',
      ),
    ).toBe(true)
  })

  it('ships a CommonJS setup file that returns timers to real time after each test', () => {
    const project = nativeProject()
    const [setup] = createJestExpoConfig(project.config, {
      project: 'app',
      suite: 'unit',
    }).setupFilesAfterEnv
    expect(setup).toMatch(/setup[\\/]jest-expo\.cjs$/)
    // The source checkout runs the factory from src/, so the built file sits under dist/.
    const built = (setup ?? '').replace(/[\\/]src[\\/]/, '/dist/')
    expect(existsSync(built)).toBe(true)
    const callbacks: Array<() => void> = []
    let realTimers = 0
    const scope = globalThis as unknown as Record<string, unknown>
    scope.afterEach = (callback: () => void) => {
      callbacks.push(callback)
    }
    scope.jest = {
      useRealTimers: () => {
        realTimers += 1
      },
    }
    try {
      createRequire(import.meta.url)(built)
      for (const callback of callbacks) {
        callback()
      }
    } finally {
      delete scope.afterEach
      delete scope.jest
    }
    expect(realTimers).toBe(1)
  })

  it('is for native projects', () => {
    const project = nativeProject('dom')
    expect(() => createJestExpoConfig(project.config, { project: 'app', suite: 'unit' })).toThrow(
      ConfigError,
    )
  })
})
