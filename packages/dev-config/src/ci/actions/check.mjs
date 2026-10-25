// The check action: runs one declared stage (or the standards contract) or one
// declared `project:suite` with the consumer's installed `toolpath-dev`, then
// proves from the receipts it wrote that everything it was responsible for ran
// and passed. It accepts identifiers, never commands.
import { spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import {
  STANDARDS_STAGES,
  createSummary,
  isStageId,
  isSuiteId,
  renderMarkdown,
  suiteReceiptId,
  verifyReceipts,
} from '../result-policy.mjs'
import { error, input, readReceiptDirectory, setOutput, summary } from './runtime.mjs'
import { locateCli, parseConfigPath } from './setup.mjs'

/**
 * What one invocation runs, validated: `standards`, one stage, or one suite.
 * @param {{ stage: string, suite: string }} selection
 * @returns {{ args: Array<string>, expected: Array<string>, key: string, title: string }}
 */
export const selectWork = ({ stage, suite }) => {
  if ((stage === '') === (suite === '')) {
    throw new Error(
      'give exactly one of `stage` (standards, format, lint, types, unit) or `suite` (<project>:<suite>)',
    )
  }
  if (stage === 'standards') {
    return {
      args: ['--stage', 'standards'],
      expected: [...STANDARDS_STAGES],
      key: 'standards',
      title: 'standards',
    }
  }
  if (stage !== '') {
    if (!isStageId(stage)) {
      throw new Error(`stage "${stage}" is not standards, format, lint, types or unit`)
    }
    return { args: ['--stage', stage], expected: [stage], key: stage, title: stage }
  }
  if (!isSuiteId(suite)) {
    throw new Error(`suite "${suite}" is not a <project>:<suite> identifier from dev.config.mjs`)
  }
  return {
    args: ['--suite', suite],
    expected: [suiteReceiptId(suite)],
    key: suite.replace(/[^a-z0-9._-]/gi, '-'),
    title: suite,
  }
}

export const main = () => {
  try {
    const work = selectWork({ stage: input('stage'), suite: input('suite') })
    const directory = resolve(
      process.env.GITHUB_WORKSPACE ?? process.cwd(),
      input('working-directory') || '.',
    )
    const config = parseConfigPath(input('config'))
    const temp = process.env.RUNNER_TEMP ?? join(directory, '.toolpath')
    const receiptDirectory = resolve(
      input('receipt-dir') || join(temp, 'toolpath-dev', 'receipts', work.key),
    )
    const reportDirectory = join(temp, 'toolpath-dev', 'reports', work.key)
    mkdirSync(receiptDirectory, { recursive: true })
    mkdirSync(reportDirectory, { recursive: true })
    setOutput('directory', directory)
    setOutput('receipt-dir', receiptDirectory)
    setOutput('report-dir', reportDirectory)
    // Unique within the run even when two jobs check the same identifier.
    setOutput(
      'artifact-key',
      `${process.env.GITHUB_JOB ?? 'job'}-${work.key}-${randomUUID().slice(0, 8)}`,
    )

    const cli = locateCli(directory)
    const args = [
      cli,
      'ci',
      ...work.args,
      '--receipt-dir',
      receiptDirectory,
      '--report-dir',
      reportDirectory,
      ...(config === undefined ? [] : ['--config', config]),
    ]
    const result = spawnSync(process.execPath, args, {
      cwd: directory,
      stdio: 'inherit',
      env: { ...process.env, CI: 'true' },
    })
    if (result.error) {
      throw new Error(`could not start toolpath-dev: ${result.error.message}`)
    }

    const receipts = readReceiptDirectory(receiptDirectory)
    const verdict = verifyReceipts(receipts, work.expected)
    if (result.status !== 0 && verdict.ok) {
      verdict.ok = false
      verdict.errors.push(
        `toolpath-dev ci exited with ${result.status ?? result.signal ?? 'an unknown status'}`,
      )
    }
    const recorded = work.expected.flatMap((id) => {
      const receipt = receipts.get(id)
      return typeof receipt === 'object' && receipt !== null && 'status' in receipt
        ? [/** @type {import('../result-policy.mjs').Receipt} */ (receipt)]
        : []
    })
    summary(renderMarkdown(`dev-config ${work.title}`, verdict, recorded))
    if (!verdict.ok) {
      for (const message of verdict.errors) {
        error(message)
      }
      process.exitCode = 1
      return
    }
    setOutput('receipt', JSON.stringify(createSummary(recorded)))
  } catch (failure) {
    error(`dev-config-check: ${failure instanceof Error ? failure.message : String(failure)}`)
    process.exitCode = 2
  }
}
