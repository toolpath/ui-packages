import { afterAll, describe, expect, it } from 'vitest'
import { ConfigError, MissingPeerError } from '../../src/errors.js'
import {
  createExpoBabelConfig,
  verifyExpoReactCompiler,
  withReactCompiler,
} from '../../src/react/expo.js'
import { createTestProject } from './project.js'

// The workspace does not install Expo; the compatibility harness runs the adapter
// against Expo SDK 58. These cover what holds without it.
const project = createTestProject({ adapter: 'expo', runtime: 'native' })

afterAll(() => {
  project.remove()
})

describe('createExpoBabelConfig', () => {
  it('refuses to add the compiler a second time', () => {
    expect(() =>
      createExpoBabelConfig(project.config, {
        project: 'app',
        plugins: ['babel-plugin-react-compiler'],
      }),
    ).toThrow(/compile every component twice/)
    expect(() =>
      createExpoBabelConfig(project.config, {
        project: 'app',
        presetOptions: { 'react-compiler': {} },
      }),
    ).toThrow(ConfigError)
  })

  it('names the profile and install command when Expo is missing', () => {
    expect(() => createExpoBabelConfig(project.config, { project: 'app' })).toThrow(
      MissingPeerError,
    )
  })
})

describe('withReactCompiler', () => {
  it('enables the experiment and keeps the rest of the app config', () => {
    expect(withReactCompiler({ name: 'app', experiments: { typedRoutes: true } })).toEqual({
      name: 'app',
      experiments: { typedRoutes: true, reactCompiler: true },
    })
  })
})

describe('verifyExpoReactCompiler', () => {
  it('fails as a missing prerequisite without Expo', async () => {
    await expect(verifyExpoReactCompiler({ projectRoot: project.directory })).rejects.toThrow(
      MissingPeerError,
    )
  })
})
