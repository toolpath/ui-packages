import { join } from 'node:path'
import type { ResolvedProject } from '../config/resolve.js'
import { ConfigError } from '../errors.js'
import { verifyBabelReactCompiler } from './babel.js'
import {
  assertCompiledOutput,
  compileModule,
  compilerOptionsFor,
  PROBE_COMPONENT,
  type CompilerEvidence,
} from './compiler.js'
import { verifyExpoReactCompiler } from './expo.js'
import { verifyViteReactCompiler } from './vite.js'

/**
 * Runs the verification that matches a project's declared adapter against the
 * project's real build configuration, so an installed compiler that the build
 * never runs fails instead of passing quietly.
 */
export const verifyReactProject = async (project: ResolvedProject): Promise<CompilerEvidence> => {
  const react = project.react
  if (!react) {
    throw new ConfigError(`Project "${project.name}" declares no react profile.`)
  }
  switch (react.adapter) {
    case 'vite-legacy':
    case 'vite-modern':
    case 'react-router':
      return verifyViteReactCompiler({ root: project.directory })
    case 'babel':
      return verifyBabelReactCompiler({ root: project.directory })
    case 'expo':
      return verifyExpoReactCompiler({ projectRoot: project.directory })
    case 'library-esbuild': {
      // Whether the build config uses the plugin is a doctor check; this proves the
      // plugin's compiler step runs with the project's own Babel and compiler.
      const compiled = await compileModule(PROBE_COMPONENT, {
        filename: join(project.directory, 'toolpath-react-compiler-probe.tsx'),
        directory: project.directory,
        options: compilerOptionsFor(react.minimumVersion),
        sourceMaps: false,
      })
      return assertCompiledOutput(
        compiled.code,
        project.name,
        'Install babel-plugin-react-compiler and @babel/core as exact dev dependencies.',
      )
    }
  }
}
