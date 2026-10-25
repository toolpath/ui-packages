import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ConfigError } from '../errors.js'

export const RECEIPT_PATH = '.toolpath/dev-config.json'

/**
 * Synchronization state, not configuration: which files and blocks the
 * standard manages, the bytes it last generated for each (the three-way merge
 * base), and the release identity those bytes came from.
 */
export interface Receipt {
  schemaVersion: 1
  package: { name: string; version: string }
  release: { repository: string; sourceSha: string; workflow: string }
  /** Managed files: the whole file, or named blocks inside it. */
  files: Record<
    string,
    { kind: 'file'; base: string } | { kind: 'blocks'; blocks: Record<string, string> }
  >
  /** Managed `package.json` entries and the values last written. */
  manifest: {
    scripts: Record<string, string>
    devDependencies: Record<string, string>
    packageManager?: string
  }
}

export const readReceipt = (root: string): Receipt | undefined => {
  const file = join(root, RECEIPT_PATH)
  if (!existsSync(file)) {
    return undefined
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(file, 'utf8'))
  } catch (error) {
    throw new ConfigError(
      `${RECEIPT_PATH} is not valid JSON (${(error as Error).message}). Restore it from Git, or delete it and run \`toolpath-dev init\` again.`,
    )
  }
  const receipt = parsed as Partial<Receipt>
  if (receipt.schemaVersion !== 1) {
    throw new ConfigError(
      `${RECEIPT_PATH} has schema version ${String(receipt.schemaVersion)}, which this release does not read. Install the @toolpath/dev-config release that wrote it, or a newer one.`,
    )
  }
  if (!receipt.package || !receipt.release || !receipt.files || !receipt.manifest) {
    throw new ConfigError(
      `${RECEIPT_PATH} is incomplete. Restore it from Git rather than editing it.`,
    )
  }
  return receipt as Receipt
}

export const serializeReceipt = (receipt: Receipt): string =>
  `${JSON.stringify(receipt, null, 2)}\n`
