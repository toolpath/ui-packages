import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { TestCounts } from '../cli/suites.js'
import {
  RECEIPT_KIND,
  receiptFileName,
  type Receipt,
  type ReceiptPackage,
  type SuiteResult,
} from './result-policy.mjs'

export type { Receipt } from './result-policy.mjs'

interface PackageIdentity {
  name: string
  version: string
  sourceSha?: string | null
  channel?: string
}

/**
 * The running package's identity for receipts: its build's release metadata,
 * or its manifest when run from source (tests, a local checkout).
 */
const receiptPackage = (): ReceiptPackage => {
  const release = new URL('../release.json', import.meta.url)
  const manifest = new URL('../../package.json', import.meta.url)
  const source: PackageIdentity = existsSync(release)
    ? (JSON.parse(readFileSync(release, 'utf8')) as PackageIdentity)
    : (JSON.parse(readFileSync(manifest, 'utf8')) as PackageIdentity)
  return {
    name: source.name,
    version: source.version,
    sourceSha: source.sourceSha ?? null,
    channel: source.channel ?? 'development',
  }
}

export interface ReceiptInput {
  id: string
  status: Receipt['status']
  durationMs: number
  tests?: TestCounts
  suites?: Array<SuiteResult>
  message?: string
}

const MESSAGE_LIMIT = 500

/** A one-line, bounded failure summary; receipts never carry logs or file contents. */
const receiptMessage = (message: string): string => {
  const line = message.split('\n').find((candidate) => candidate.trim() !== '') ?? ''
  return line.length > MESSAGE_LIMIT ? `${line.slice(0, MESSAGE_LIMIT - 1)}…` : line
}

export const createReceipt = (
  input: ReceiptInput,
  identity: ReceiptPackage = receiptPackage(),
): Receipt => ({
  schemaVersion: 1,
  kind: RECEIPT_KIND,
  id: input.id,
  status: input.status,
  durationMs: Math.round(input.durationMs),
  ...(input.tests === undefined ? {} : { tests: input.tests }),
  ...(input.suites === undefined ? {} : { suites: input.suites }),
  ...(input.message === undefined || input.message === ''
    ? {}
    : { message: receiptMessage(input.message) }),
  package: identity,
})

/** Writes a receipt as `<directory>/<id>.json`; returns its path. */
export const writeReceipt = (directory: string, receipt: Receipt): string => {
  mkdirSync(directory, { recursive: true })
  const file = join(directory, receiptFileName(receipt.id))
  writeFileSync(file, `${JSON.stringify(receipt, null, 2)}\n`)
  return file
}
