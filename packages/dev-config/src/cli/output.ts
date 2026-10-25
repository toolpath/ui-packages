/**
 * CLI output policy: a passing command prints one line per stage at most; a
 * failing one prints the diagnostic immediately and in full. `--json` replaces
 * prose with one JSON document on stdout.
 */
export interface Output {
  json: boolean
  verbose: boolean
  /** A one-line stage result (suppressed in JSON mode). */
  line: (text: string) => void
  /** Detail only shown with `--verbose`. */
  detail: (text: string) => void
  /** Failure diagnostics; always shown, to stderr. */
  failure: (text: string) => void
  /** Records a structured value for the JSON document. */
  record: (key: string, value: unknown) => void
  /** Writes the JSON document when in JSON mode. */
  flush: () => void
}

export const createOutput = ({ json, verbose }: { json: boolean; verbose: boolean }): Output => {
  const document: Record<string, unknown> = {}
  return {
    json,
    verbose,
    line: (text) => {
      if (!json) {
        process.stdout.write(`${text}\n`)
      }
    },
    detail: (text) => {
      if (verbose && !json) {
        process.stdout.write(`${text}\n`)
      }
    },
    failure: (text) => {
      process.stderr.write(text.endsWith('\n') ? text : `${text}\n`)
    },
    record: (key, value) => {
      document[key] = value
    },
    flush: () => {
      if (json) {
        process.stdout.write(`${JSON.stringify(document, null, 2)}\n`)
      }
    },
  }
}

export const seconds = (milliseconds: number): string => `${(milliseconds / 1000).toFixed(1)}s`

export const plural = (count: number, singular: string, pluralForm = `${singular}s`): string =>
  `${count} ${count === 1 ? singular : pluralForm}`
