import { appendFile } from 'node:fs/promises'
import { setTimeout } from 'node:timers/promises'
import { readSdkVersion } from './lib.mjs'

// The Python SDK ships under @toolpath/api's version, as a wheel on the GitHub release
// `python-sdk-v<version>`. It needs releasing whenever that release does not exist yet, whether
// this run published to npm or an earlier one already did.
const attempts = 3
const timeoutMs = 15_000
const repository = process.env.GITHUB_REPOSITORY ?? 'toolpath/ui-packages'

const askGitHub = async (url) => {
  const headers = process.env.GH_TOKEN ? { Authorization: `Bearer ${process.env.GH_TOKEN}` } : {}
  for (let attempt = 1; ; attempt += 1) {
    if (attempt > 1) {
      await setTimeout(attempt * 2_000)
    }
    try {
      const response = await fetch(url, { headers, signal: AbortSignal.timeout(timeoutMs) })
      if (response.status < 500 || attempt === attempts) {
        return response
      }
    } catch (error) {
      if (attempt === attempts) {
        throw error
      }
    }
  }
}

const version = await readSdkVersion()
const tag = `python-sdk-v${version}`
const response = await askGitHub(`https://api.github.com/repos/${repository}/releases/tags/${tag}`)
if (response.status !== 200 && response.status !== 404) {
  throw new Error(`GitHub answered ${response.status} for release ${tag}`)
}

const required = response.status === 404
if (process.env.GITHUB_OUTPUT) {
  await appendFile(process.env.GITHUB_OUTPUT, `required=${required}\ntag=${tag}\n`)
}

process.stdout.write(
  required ? `Release ${tag} does not exist; it will be created.\n` : `Release ${tag} exists.\n`,
)
