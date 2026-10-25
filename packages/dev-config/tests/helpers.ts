import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach } from 'vitest'

const directories: Array<string> = []

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

/**
 * A temporary directory holding `files`, removed after the test. Its real path,
 * because resolvers return real paths and macOS's temporary directory is a symlink.
 */
export const temporaryDirectory = (files: Record<string, string>): string => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'toolpath-dev-config-')))
  directories.push(root)
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    writeFileSync(join(root, path), content)
  }
  return root
}
