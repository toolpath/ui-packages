import { availableParallelism } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BUILT_IN_EXCLUDED_DIRECTORIES } from '../config/files.js'
import type { DevConfig } from '../config/types.js'
import { ConfigError } from '../errors.js'
import {
  DEFAULT_UNIT_TIMEOUT_MS,
  UNIT_TEST_PATTERNS,
  unitWorkerCeiling,
} from '../policy/conventions.js'
import { nestedRoots, selectSuite, type SuiteSelection } from './select.js'

/**
 * Packages under `node_modules` that Jest must still transform, as jest-expo 58
 * lists them. A config that sets `transformIgnorePatterns` replaces the preset's,
 * so the list is restated here and extended rather than dropped.
 */
export const EXPO_TRANSFORMED_PACKAGES = [
  '.pnpm',
  'react-native',
  '@react-native',
  '@react-native-community',
  'expo',
  '@expo',
  '@expo-google-fonts',
  'react-navigation',
  '@react-navigation',
  '@sentry/react-native',
  'native-base',
  'standard-navigation',
]

export interface JestExpoExtension {
  /** Project-relative or absolute files run after the test framework is installed. */
  setupFilesAfterEnv?: Array<string>
  /** Module aliases, as Jest's `moduleNameMapper` (tsconfig `paths` are mapped by jest-expo). */
  moduleNameMapper?: Record<string, string>
  /** More `node_modules` packages that ship untranspiled code and must be transformed. */
  transformPackages?: Array<string>
  /** Longer bounds for suites that legitimately need them, in milliseconds. */
  timeouts?: { test?: number }
}

export interface JestExpoOptions extends SuiteSelection {
  extend?: JestExpoExtension
}

/** The Jest options this factory sets, structurally (assignable to Jest's `Config`). */
export interface JestExpoConfig {
  rootDir: string
  displayName: string
  preset: 'jest-expo'
  testMatch: Array<string>
  testPathIgnorePatterns: Array<string>
  transformIgnorePatterns: Array<string>
  setupFilesAfterEnv: Array<string>
  moduleNameMapper?: Record<string, string>
  clearMocks: true
  restoreMocks: true
  testTimeout: number
  maxWorkers: number
  passWithNoTests: false
  watchman: false
}

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const setupFile = join(dirname(fileURLToPath(import.meta.url)), 'setup', 'jest-expo.cjs')

/**
 * A Jest config for one declared native suite on the tested Expo line
 * (jest-expo 58, Jest 30, React Native 0.88): the jest-expo preset and its
 * React Native environment, `*.test.*` discovery, mock and timer lifecycle,
 * bounded workers, and no retries. Unlike the bare preset, an empty suite
 * fails. Import it from `jest.config.mjs`, or from CommonJS with
 * `module.exports = import('@toolpath/dev-config/jest-expo').then(…)`.
 */
export const createJestExpoConfig = (
  config: DevConfig,
  options: JestExpoOptions,
): JestExpoConfig => {
  const { resolved, project, suite } = selectSuite(config, options, 'jest-expo')
  if (project.runtime !== 'native' && project.runtime !== 'universal') {
    throw new ConfigError(
      `${suite.id}: jest-expo suites test runtime 'native' (or 'universal') projects.`,
    )
  }
  const extend = options.extend ?? {}
  const packages = [...EXPO_TRANSFORMED_PACKAGES, ...(extend.transformPackages ?? [])].map(
    (name) => (name === '.pnpm' ? '\\.pnpm' : escapeRegExp(name)),
  )
  const nested = nestedRoots(resolved, project).map((root) => `<rootDir>/${escapeRegExp(root)}/`)
  return {
    rootDir: project.directory,
    displayName: suite.id,
    preset: 'jest-expo',
    testMatch: UNIT_TEST_PATTERNS.map((pattern) => `<rootDir>/${pattern}`),
    // Anchored at <rootDir>: Jest matches absolute paths, and an ancestor named
    // `build` or `dist` must not hide every test.
    testPathIgnorePatterns: [
      `<rootDir>/(?:.*/)?(?:${BUILT_IN_EXCLUDED_DIRECTORIES.map(escapeRegExp).join('|')})/`,
      '\\.spec\\.[cm]?[jt]sx?$',
      ...nested,
    ],
    transformIgnorePatterns: [
      `/node_modules/(?!(${packages.join('|')}))`,
      '/node_modules/react-native-reanimated/plugin/',
      '/node_modules/@react-native/babel-preset/',
    ],
    setupFilesAfterEnv: [setupFile, ...(extend.setupFilesAfterEnv ?? [])],
    ...(extend.moduleNameMapper === undefined ? {} : { moduleNameMapper: extend.moduleNameMapper }),
    clearMocks: true,
    restoreMocks: true,
    testTimeout: Math.max(
      DEFAULT_UNIT_TIMEOUT_MS,
      extend.timeouts?.test ?? DEFAULT_UNIT_TIMEOUT_MS,
    ),
    maxWorkers: unitWorkerCeiling(availableParallelism()),
    passWithNoTests: false,
    watchman: false,
  }
}
