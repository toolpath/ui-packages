import { spawn } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { dirname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

export const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// The Python SDK is generated from the same contract as @toolpath/api and ships under its version.
export const readSdkVersion = async () => {
  const manifest = await readFile(
    join(repositoryRoot, 'packages/sdk-typescript/package.json'),
    'utf8',
  )
  const { version } = JSON.parse(manifest)
  if (!version) {
    throw new Error('packages/sdk-typescript/package.json does not declare a version')
  }
  return version
}

export const assertInsideRepository = (path) => {
  const resolvedPath = resolve(path)
  const rootPrefix = `${repositoryRoot}${sep}`
  if (resolvedPath !== repositoryRoot && !resolvedPath.startsWith(rootPrefix)) {
    throw new Error(`Path is outside the repository: ${resolvedPath}`)
  }
  return resolvedPath
}

export const run = async (command, args, cwd = repositoryRoot, options = {}) => {
  if (!options.quiet) {
    process.stdout.write(`\n> ${command} ${args.join(' ')}\n`)
  }

  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, {
      cwd,
      env: process.env,
      stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    })

    let stdout = ''
    let stderr = ''
    if (options.capture) {
      child.stdout.on('data', (chunk) => {
        stdout += chunk
      })
      child.stderr.on('data', (chunk) => {
        stderr += chunk
      })
    }

    child.once('error', rejectRun)
    child.once('exit', (code, signal) => {
      if (code === 0) {
        resolveRun({ stdout: stdout.trim(), stderr: stderr.trim() })
        return
      }

      rejectRun(
        new Error(
          signal
            ? `${command} was terminated by ${signal}`
            : `${command} exited with status ${code ?? 'unknown'}${stderr ? `\n${stderr}` : ''}`,
        ),
      )
    })
  })
}
