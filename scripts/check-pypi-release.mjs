import { appendFile } from 'node:fs/promises'
import { readSdkVersion } from './lib.mjs'

// The Python SDK ships under @toolpath/api's version. It needs publishing whenever PyPI does not
// have that version yet, whether this run published to npm or an earlier one already did.
const attempts = 3
const timeoutMs = 15_000

const askPyPI = async (url) => {
  for (let attempt = 1; ; attempt += 1) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) })
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
const response = await askPyPI(`https://pypi.org/pypi/toolpath/${version}/json`)
if (response.status !== 200 && response.status !== 404) {
  throw new Error(`PyPI answered ${response.status} for toolpath ${version}`)
}

const required = response.status === 404
if (process.env.GITHUB_OUTPUT) {
  await appendFile(process.env.GITHUB_OUTPUT, `required=${required}\n`)
}

process.stdout.write(
  required
    ? `PyPI does not have toolpath ${version}; it will be published.\n`
    : `PyPI already has toolpath ${version}.\n`,
)
