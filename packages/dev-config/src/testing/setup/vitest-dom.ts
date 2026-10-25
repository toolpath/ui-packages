// Shared lifecycle for DOM Vitest suites: real timers after each test, React
// Testing Library cleanup (explicit, because test APIs are imported rather than
// global), and jest-dom matchers when the profile installed them.
import { afterEach, vi } from 'vitest'

const NOT_INSTALLED =
  /Cannot find (module|package)|Failed to (load|resolve) (url|import)|ERR_MODULE_NOT_FOUND/

/** Imports an optional peer, or nothing when it is not installed; any other failure propagates. */
const optional = async <T>(specifier: string): Promise<T | undefined> => {
  try {
    return (await import(specifier)) as T
  } catch (error) {
    if (
      error instanceof Error &&
      NOT_INSTALLED.test(`${(error as { code?: string }).code ?? ''} ${error.message}`)
    ) {
      return undefined
    }
    throw error
  }
}

await optional('@testing-library/jest-dom/vitest')
const testingLibrary = await optional<{ cleanup: () => void }>('@testing-library/react')

afterEach(() => {
  testingLibrary?.cleanup()
  vi.useRealTimers()
})
