// The CI receipt and aggregation policy, shared verbatim by the packaged CLI
// (`toolpath-dev ci` writes receipts) and the dependency-free result action
// (`.github/actions/dev-config-result`), which imports this file from its own
// checkout so it runs even when the consumer's install failed. Plain JavaScript
// with JSDoc types: no build step, no dependencies, no TypeScript runtime.

export const RECEIPT_KIND = 'toolpath-dev/ci-receipt'
export const SUMMARY_KIND = 'toolpath-dev/ci-summary'

/** The standards stages, in the order the CI contract runs them. */
export const STANDARDS_STAGES = /** @type {const} */ (['format', 'lint', 'types', 'unit'])

/**
 * @typedef {{ passed: number, failed: number, skipped: number }} TestCounts
 *
 * @typedef {object} SuiteResult
 * @property {string} id `project:suite`
 * @property {string} status
 * @property {TestCounts} tests
 *
 * @typedef {object} ReceiptPackage
 * @property {string} name
 * @property {string} version
 * @property {string | null} sourceSha
 * @property {string} channel
 *
 * @typedef {object} Receipt One stage or suite, written by `toolpath-dev ci --receipt-dir`.
 * @property {1} schemaVersion
 * @property {typeof RECEIPT_KIND} kind
 * @property {string} id `format`, `lint`, `types`, `unit`, or `suite:<project>:<suite>`
 * @property {'passed' | 'failed' | 'error'} status
 * @property {number} durationMs
 * @property {TestCounts} [tests] Unit and suite receipts: what the runner reports executed.
 * @property {Array<SuiteResult>} [suites] The unit receipt: each ordinary suite.
 * @property {string} [message] A one-line failure summary; never secrets or file contents.
 * @property {ReceiptPackage} package
 *
 * @typedef {object} PlannedSuite
 * @property {string} suite
 *
 * @typedef {object} ExternalSuite
 * @property {string} suite
 * @property {string} job
 *
 * @typedef {object} ManualSuite
 * @property {string} suite
 * @property {string} reason
 *
 * @typedef {object} PlanInventory The parts of `toolpath-dev ci --plan` the verifier reads.
 * @property {1} schemaVersion
 * @property {{ stages: Array<string>, unitSuites: Array<string> }} standards
 * @property {Array<PlannedSuite>} suites
 * @property {Array<ExternalSuite>} external
 * @property {Array<ManualSuite>} manual
 * @property {Array<string>} receipts
 *
 * @typedef {object} Summary What a verified job hands to the caller's aggregate `quality` job.
 * @property {1} schemaVersion
 * @property {typeof SUMMARY_KIND} kind
 * @property {boolean} verified
 * @property {Array<{ id: string, status: string, tests?: TestCounts }>} receipts
 * @property {Array<ExternalSuite>} external
 * @property {Array<ManualSuite>} manual
 *
 * @typedef {{ kind: 'standards', job: string } | { kind: 'suite', job: string, suite: string }} RequiredJob
 *
 * @typedef {{ ok: boolean, errors: Array<string>, notes: Array<string> }} Verdict
 */

/** @param {unknown} value @returns {value is Record<string, unknown>} */
const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value)

/** @param {unknown} value @returns {value is number} */
const isCount = (value) => typeof value === 'number' && Number.isInteger(value) && value >= 0

/** @param {unknown} value @returns {value is TestCounts} */
const isCounts = (value) =>
  isRecord(value) && isCount(value.passed) && isCount(value.failed) && isCount(value.skipped)

/** @param {unknown} value @returns {value is Array<string>} */
const isStringArray = (value) =>
  Array.isArray(value) && value.every((entry) => typeof entry === 'string')

const SUITE_ID = /^[a-z0-9][a-z0-9._-]*:[a-z0-9][a-z0-9._-]*$/
const JOB_ID = /^[A-Za-z_][A-Za-z0-9_-]*$/

/** @param {string} id */
export const isStageId = (id) =>
  /** @type {ReadonlyArray<string>} */ (STANDARDS_STAGES).includes(id)

/** @param {string} id */
export const isSuiteId = (id) => SUITE_ID.test(id)

/** The receipt id of a suite. @param {string} suite */
export const suiteReceiptId = (suite) => `suite:${suite}`

/**
 * The file a receipt is stored in, inside a receipt directory.
 * @param {string} id
 */
export const receiptFileName = (id) => `${id.replace(/[^a-zA-Z0-9._-]/g, '__')}.json`

/**
 * Parses JSON from an untrusted source (an action input, a job output, a file).
 * Never evaluates it, never throws.
 * @param {unknown} text
 * @returns {{ ok: true, value: unknown } | { ok: false, error: string }}
 */
export const parseJson = (text) => {
  if (typeof text !== 'string' || text.trim() === '') {
    return { ok: false, error: 'is empty' }
  }
  try {
    return { ok: true, value: JSON.parse(text) }
  } catch (error) {
    return {
      ok: false,
      error: `is not valid JSON (${error instanceof Error ? error.message : String(error)})`,
    }
  }
}

/**
 * Problems with one receipt as evidence that `expectedId` passed. A unit or
 * suite receipt also needs executed tests: zero tests is not a pass.
 * @param {unknown} value
 * @param {string} expectedId
 * @returns {Array<string>}
 */
export const receiptProblems = (value, expectedId) => {
  if (!isRecord(value)) {
    return [`${expectedId}: the receipt is not an object`]
  }
  /** @type {Array<string>} */
  const problems = []
  if (value.schemaVersion !== 1 || value.kind !== RECEIPT_KIND) {
    problems.push(
      `${expectedId}: the receipt has an unknown schema (${String(value.kind)} v${String(value.schemaVersion)})`,
    )
    return problems
  }
  if (value.id !== expectedId) {
    problems.push(`${expectedId}: the receipt is for "${String(value.id)}"`)
  }
  if (
    typeof value.durationMs !== 'number' ||
    !isRecord(value.package) ||
    typeof value.package.version !== 'string'
  ) {
    problems.push(`${expectedId}: the receipt is incomplete`)
  }
  if (value.status !== 'passed') {
    const message =
      typeof value.message === 'string' && value.message !== '' ? `: ${value.message}` : ''
    problems.push(`${expectedId}: ${String(value.status)}${message}`)
    return problems
  }
  if (expectedId === 'unit') {
    if (!Array.isArray(value.suites)) {
      problems.push('unit: the receipt lists no suites')
      return problems
    }
    for (const suite of value.suites) {
      if (!isRecord(suite) || typeof suite.id !== 'string' || !isCounts(suite.tests)) {
        problems.push('unit: a suite entry is malformed')
        continue
      }
      if (suite.status !== 'passed' || suite.tests.failed > 0) {
        problems.push(`unit: ${suite.id} did not pass`)
      } else if (suite.tests.passed === 0) {
        problems.push(`unit: ${suite.id} executed no tests`)
      }
    }
  }
  if (expectedId.startsWith('suite:')) {
    if (!isCounts(value.tests)) {
      problems.push(`${expectedId}: the receipt records no test counts`)
    } else if (value.tests.failed > 0) {
      problems.push(`${expectedId}: ${value.tests.failed} tests failed`)
    } else if (value.tests.passed === 0) {
      problems.push(`${expectedId}: no tests executed; a required suite must run tests`)
    }
  }
  return problems
}

/**
 * Validates a plan document's inventory (from `toolpath-dev ci --plan`).
 * @param {unknown} value
 * @returns {{ ok: true, plan: PlanInventory } | { ok: false, error: string }}
 */
export const readPlan = (value) => {
  if (
    !isRecord(value) ||
    value.schemaVersion !== 1 ||
    !isRecord(value.standards) ||
    !isStringArray(value.standards.stages) ||
    !isStringArray(value.standards.unitSuites) ||
    !Array.isArray(value.suites) ||
    !Array.isArray(value.external) ||
    !Array.isArray(value.manual) ||
    !isStringArray(value.receipts)
  ) {
    return { ok: false, error: 'the CI plan is malformed' }
  }
  const suites = value.suites.filter((entry) => isRecord(entry) && typeof entry.suite === 'string')
  const external = value.external.filter(
    (entry) => isRecord(entry) && typeof entry.suite === 'string' && typeof entry.job === 'string',
  )
  const manual = value.manual.filter(
    (entry) =>
      isRecord(entry) && typeof entry.suite === 'string' && typeof entry.reason === 'string',
  )
  if (
    suites.length !== value.suites.length ||
    external.length !== value.external.length ||
    manual.length !== value.manual.length
  ) {
    return { ok: false, error: 'the CI plan has malformed suite entries' }
  }
  return { ok: true, plan: /** @type {PlanInventory} */ (value) }
}

/**
 * The `needs` context, serialized by `toJSON(needs)`.
 * @param {unknown} text
 * @returns {{ ok: true, needs: Record<string, { result: string, outputs: Record<string, string> }> } | { ok: false, error: string }}
 */
export const readNeeds = (text) => {
  const parsed = parseJson(text)
  if (!parsed.ok) {
    return { ok: false, error: `needs ${parsed.error}` }
  }
  if (!isRecord(parsed.value)) {
    return { ok: false, error: 'needs is not an object' }
  }
  /** @type {Record<string, { result: string, outputs: Record<string, string> }>} */
  const needs = {}
  for (const [job, entry] of Object.entries(parsed.value)) {
    if (!isRecord(entry) || typeof entry.result !== 'string') {
      return { ok: false, error: `needs.${job} has no result` }
    }
    const outputs = isRecord(entry.outputs) ? entry.outputs : {}
    /** @type {Record<string, string>} */
    const strings = {}
    for (const [key, output] of Object.entries(outputs)) {
      if (typeof output === 'string') {
        strings[key] = output
      }
    }
    needs[job] = { result: entry.result, outputs: strings }
  }
  return { ok: true, needs }
}

/**
 * The generated inventory of required predecessor jobs, from the caller's
 * `quality` job. Each job appears once.
 * @param {unknown} text
 * @returns {{ ok: true, required: Array<RequiredJob> } | { ok: false, error: string }}
 */
export const readRequiredJobs = (text) => {
  const parsed = parseJson(text)
  if (!parsed.ok) {
    return { ok: false, error: `the required job inventory ${parsed.error}` }
  }
  if (!Array.isArray(parsed.value) || parsed.value.length === 0) {
    return { ok: false, error: 'the required job inventory must be a nonempty array' }
  }
  /** @type {Array<RequiredJob>} */
  const required = []
  const seen = new Set()
  for (const entry of parsed.value) {
    if (!isRecord(entry) || typeof entry.job !== 'string' || !JOB_ID.test(entry.job)) {
      return { ok: false, error: 'the required job inventory has an entry without a valid job ID' }
    }
    if (seen.has(entry.job)) {
      return { ok: false, error: `the required job inventory lists ${entry.job} twice` }
    }
    seen.add(entry.job)
    if (entry.kind === 'standards') {
      required.push({ kind: 'standards', job: entry.job })
    } else if (
      entry.kind === 'suite' &&
      typeof entry.suite === 'string' &&
      isSuiteId(entry.suite)
    ) {
      required.push({ kind: 'suite', job: entry.job, suite: entry.suite })
    } else {
      return {
        ok: false,
        error: `the required job inventory entry for ${entry.job} has an unknown kind`,
      }
    }
  }
  return { ok: true, required }
}

/**
 * Validates a summary a job published as its `receipt` output.
 * @param {unknown} text
 * @returns {{ ok: true, summary: Summary } | { ok: false, error: string }}
 */
export const readSummary = (text) => {
  const parsed = parseJson(text)
  if (!parsed.ok) {
    return { ok: false, error: `its receipt output ${parsed.error}` }
  }
  const value = parsed.value
  if (
    !isRecord(value) ||
    value.schemaVersion !== 1 ||
    value.kind !== SUMMARY_KIND ||
    typeof value.verified !== 'boolean' ||
    !Array.isArray(value.receipts) ||
    !Array.isArray(value.external) ||
    !Array.isArray(value.manual)
  ) {
    return { ok: false, error: 'its receipt output is malformed' }
  }
  for (const receipt of value.receipts) {
    if (
      !isRecord(receipt) ||
      typeof receipt.id !== 'string' ||
      typeof receipt.status !== 'string'
    ) {
      return { ok: false, error: 'its receipt output has a malformed entry' }
    }
  }
  return { ok: true, summary: /** @type {Summary} */ (value) }
}

/**
 * The summary a verified job publishes.
 * @param {Array<Receipt>} receipts
 * @param {{ external?: Array<ExternalSuite>, manual?: Array<ManualSuite> }} [context]
 * @returns {Summary}
 */
export const createSummary = (receipts, { external = [], manual = [] } = {}) => ({
  schemaVersion: 1,
  kind: SUMMARY_KIND,
  verified: true,
  receipts: receipts.map((receipt) => ({
    id: receipt.id,
    status: receipt.status,
    ...(receipt.tests ? { tests: receipt.tests } : {}),
  })),
  external,
  manual,
})

/**
 * Verifies a stage or suite run by the shared check action: every receipt the
 * run is responsible for exists and passed.
 * @param {Map<string, unknown>} receipts receipts found, by id
 * @param {Array<string>} expected
 * @returns {Verdict}
 */
export const verifyReceipts = (receipts, expected) => {
  /** @type {Array<string>} */
  const errors = []
  if (expected.length === 0) {
    errors.push('no stage or suite was expected; refusing to report success for nothing')
  }
  for (const id of expected) {
    if (!receipts.has(id)) {
      errors.push(`${id}: no receipt was recorded, so there is no evidence it ran`)
      continue
    }
    errors.push(...receiptProblems(receipts.get(id), id))
  }
  return { ok: errors.length === 0, errors, notes: [] }
}

/**
 * Verifies the central reusable workflow's run: the standards job (which also
 * computes the plan) succeeded, the suites job ran exactly when the plan has
 * central suites, and every receipt the plan requires exists and passed.
 * @param {{ needs: unknown, plan: unknown, receipts: Map<string, unknown> }} input
 * @returns {Verdict & { summary?: Summary }}
 */
export const verifyWorkflow = ({ needs: needsText, plan: planText, receipts }) => {
  /** @type {Array<string>} */
  const errors = []
  /** @type {Array<string>} */
  const notes = []
  const needs = readNeeds(needsText)
  if (!needs.ok) {
    return { ok: false, errors: [needs.error], notes }
  }
  const parsedPlan = parseJson(planText)
  if (!parsedPlan.ok) {
    return {
      ok: false,
      errors: [`the CI plan ${parsedPlan.error}; the standards job did not produce one`],
      notes,
    }
  }
  const planResult = readPlan(parsedPlan.value)
  if (!planResult.ok) {
    return { ok: false, errors: [planResult.error], notes }
  }
  const plan = planResult.plan
  // The standards job also produces the plan; the suites job runs exactly when
  // the plan has central suites. Skipping is expected only in that case.
  /** @type {Record<string, string>} */
  const expectedResults = {
    standards: 'success',
    suites: plan.suites.length > 0 ? 'success' : 'skipped',
  }
  for (const [job, expected] of Object.entries(expectedResults)) {
    const actual = needs.needs[job]?.result
    if (actual === undefined) {
      errors.push(`job ${job} is missing from needs`)
    } else if (actual !== expected) {
      errors.push(
        expected === 'skipped'
          ? `job ${job} ran (${actual}) although the plan has no central suites`
          : `job ${job} finished with ${actual}`,
      )
    }
  }
  for (const job of Object.keys(needs.needs)) {
    if (!(job in expectedResults)) {
      errors.push(`job ${job} is not part of the reusable workflow's inventory`)
    }
  }
  const required = [...plan.receipts]
  const expectedReceipts = [
    ...plan.standards.stages,
    ...plan.suites.map((entry) => suiteReceiptId(entry.suite)),
  ]
  if (required.join('\n') !== expectedReceipts.join('\n')) {
    errors.push('the plan receipt inventory does not match its stages and suites')
  }
  /** @type {Array<Receipt>} */
  const passed = []
  for (const id of required) {
    if (!receipts.has(id)) {
      errors.push(`${id}: no receipt was recorded, so there is no evidence it ran`)
      continue
    }
    const receipt = receipts.get(id)
    const problems = receiptProblems(receipt, id)
    errors.push(...problems)
    if (problems.length === 0) {
      passed.push(/** @type {Receipt} */ (receipt))
    }
  }
  for (const id of receipts.keys()) {
    if (!required.includes(id)) {
      errors.push(`${id}: a receipt the plan does not require; the plan and the run disagree`)
    }
  }
  const unit = /** @type {Partial<Receipt> | undefined} */ (receipts.get('unit'))
  if (unit?.status === 'passed' && Array.isArray(unit.suites)) {
    const ran = unit.suites
      .map((suite) => suite.id)
      .sort()
      .join(', ')
    const planned = [...plan.standards.unitSuites].sort().join(', ')
    if (ran !== planned) {
      errors.push(`unit: ran [${ran}] but the plan declares [${planned}]`)
    }
  }
  for (const entry of plan.external) {
    notes.push(`${entry.suite} runs in the caller job ${entry.job}`)
  }
  for (const entry of plan.manual) {
    notes.push(`${entry.suite} is manual and not part of this gate: ${entry.reason}`)
  }
  if (errors.length > 0) {
    return { ok: false, errors, notes }
  }
  return {
    ok: true,
    errors,
    notes,
    summary: createSummary(passed, { external: plan.external, manual: plan.manual }),
  }
}

/**
 * The caller's aggregate `quality` job: every required predecessor succeeded
 * and published a verified receipt for what it is responsible for. A cancelled,
 * failed, skipped, missing, or unknown job fails, and so does a suite the central
 * plan delegates to a caller job that the inventory does not wire up.
 * @param {{ needs: unknown, required: unknown }} input
 * @returns {Verdict}
 */
export const verifyAggregate = ({ needs: needsText, required: requiredText }) => {
  /** @type {Array<string>} */
  const errors = []
  /** @type {Array<string>} */
  const notes = []
  const needs = readNeeds(needsText)
  if (!needs.ok) {
    return { ok: false, errors: [needs.error], notes }
  }
  const inventory = readRequiredJobs(requiredText)
  if (!inventory.ok) {
    return { ok: false, errors: [inventory.error], notes }
  }
  const requiredJobs = new Set(inventory.required.map((entry) => entry.job))
  for (const job of Object.keys(needs.needs)) {
    if (!requiredJobs.has(job)) {
      errors.push(
        `job ${job} is in needs but not in the required inventory; run \`toolpath-dev sync\``,
      )
    }
  }
  /** @type {Array<ExternalSuite>} */
  const delegated = []
  for (const entry of inventory.required) {
    const need = needs.needs[entry.job]
    if (!need) {
      errors.push(`job ${entry.job} is required but missing from needs`)
      continue
    }
    if (need.result !== 'success') {
      errors.push(`job ${entry.job} finished with ${need.result}`)
      continue
    }
    const summary = readSummary(need.outputs.receipt)
    if (!summary.ok) {
      errors.push(`job ${entry.job}: ${summary.error}`)
      continue
    }
    if (!summary.summary.verified) {
      errors.push(`job ${entry.job} did not verify its receipts`)
      continue
    }
    const failed = summary.summary.receipts.filter((receipt) => receipt.status !== 'passed')
    for (const receipt of failed) {
      errors.push(`job ${entry.job}: ${receipt.id} ${receipt.status}`)
    }
    if (entry.kind === 'standards') {
      const ids = summary.summary.receipts.map((receipt) => receipt.id)
      for (const stage of STANDARDS_STAGES) {
        if (!ids.includes(stage)) {
          errors.push(`job ${entry.job}: no ${stage} receipt`)
        }
      }
      delegated.push(...summary.summary.external)
      for (const manual of summary.summary.manual) {
        notes.push(`${manual.suite} is manual and not part of this gate: ${manual.reason}`)
      }
    } else {
      const id = suiteReceiptId(entry.suite)
      const receipt = summary.summary.receipts.find((candidate) => candidate.id === id)
      if (!receipt) {
        errors.push(`job ${entry.job}: no receipt for ${entry.suite}`)
      } else if (!receipt.tests || receipt.tests.passed === 0) {
        errors.push(`job ${entry.job}: ${entry.suite} executed no tests`)
      }
    }
  }
  for (const entry of delegated) {
    const wired = inventory.required.find(
      (candidate) => candidate.kind === 'suite' && candidate.suite === entry.suite,
    )
    if (!wired) {
      errors.push(
        `${entry.suite} is delegated to a caller job (${entry.job}) that the quality job does not require; run \`toolpath-dev sync\``,
      )
    } else if (wired.job !== entry.job) {
      errors.push(
        `${entry.suite} is delegated to job ${entry.job} but the inventory names ${wired.job}`,
      )
    }
  }
  return { ok: errors.length === 0, errors, notes }
}

/**
 * A short Markdown summary for `$GITHUB_STEP_SUMMARY`.
 * @param {string} title
 * @param {Verdict} verdict
 * @param {Array<{ id: string, status: string, tests?: TestCounts }>} [receipts]
 */
export const renderMarkdown = (title, verdict, receipts = []) => {
  const lines = [`### ${title}: ${verdict.ok ? 'passed' : 'failed'}`, '']
  if (receipts.length > 0) {
    lines.push('| Stage or suite | Status | Tests |', '| --- | --- | --- |')
    for (const receipt of receipts) {
      const tests = receipt.tests
        ? `${receipt.tests.passed} passed, ${receipt.tests.failed} failed, ${receipt.tests.skipped} skipped`
        : ''
      lines.push(`| \`${receipt.id}\` | ${receipt.status} | ${tests} |`)
    }
    lines.push('')
  }
  for (const error of verdict.errors) {
    lines.push(`- ✗ ${error}`)
  }
  for (const note of verdict.notes) {
    lines.push(`- ${note}`)
  }
  return `${lines.join('\n')}\n`
}
