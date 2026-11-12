/*
  Why Toolpath could not plan a part cut from a body of its file, or one whose body its file no
  longer holds, in words to show with what to do: plain strings, with no package behind them, so
  `canRetry` in `/model` reads them too.
*/

/**
 * Why Toolpath could not plan a part cut from a body of its file that does not hold it: the job
 * failed `part_outside_initial_stock:` (`planFailureWords`), said in words of its own.
 */
export const STOCK_BODY_MISFIT =
  'This part doesn’t fit inside its stock body. Choose another body as its stock, or remove it as stock.'

/** A stock body that is the part's own: refused (`own_body`), or the job failed `own_body:`. */
const OWN_BODY =
  'A part can’t be cut from its own body. Choose another body of its file as its stock.'

/**
 * Toolpath's refusals of a stock body, by their code (Engine API 1.35, 400), in words to show: a
 * plan refused for one is recorded failed with them, and `refusalClauses` says them as they are.
 */
export const STOCK_BODY_REFUSALS: Readonly<Record<string, string>> = {
  stock_body_requires_file:
    'Only a part made from an uploaded file can be cut from another body of that file.',
  unknown_body: 'The file has no such body. Choose another body as this part’s stock.',
  own_body: OWN_BODY,
}

/**
 * Why Toolpath could not plan a part whose own body its file no longer holds as it did when the
 * part was made, as a later kernel release reads it: the job failed `body_mismatch:` or
 * `body_not_found:` for the part (Engine API 1.32). Only making the part again gets past it.
 */
export const PART_BODY_LOST =
  'Toolpath now reads this part’s file differently and can’t find the part in it. Upload the file again to make the part again.'

/**
 * Why Toolpath could not plan a part whose stock body its file no longer holds as it did when it
 * was chosen: the job failed `body_mismatch:` or `body_not_found:` naming the stock body (Engine
 * API 1.35). Only another stock gets past it.
 */
export const STOCK_BODY_LOST =
  'Toolpath now reads this part’s file differently and can’t find its stock body in it. Choose its stock body again, or remove it as stock.'

/**
 * Why Toolpath could not plan a part from a stock body it could not facet to cut the part from: the
 * job failed `stock_body_unusable:` (Engine API 1.35). Only another stock gets past it.
 */
export const STOCK_BODY_UNUSABLE =
  'Toolpath can’t cut this part from its stock body. Choose another body as its stock, or remove it as stock.'

/** The code a job's `error` begins with (`body_mismatch: …`), or null for none. */
const failureCode = (error: string): string | null => /^([a-z_]+):/.exec(error)?.[1] ?? null

/**
 * A failed plan's words as the part keeps them: for a part cut from a body of its file
 * (`bodyIndex`), a part outside its initial stock is {@link STOCK_BODY_MISFIT}. A body lost to the
 * file is {@link STOCK_BODY_LOST} where Toolpath names the stock body, else {@link PART_BODY_LOST};
 * a stock body that is the part's own, or one Toolpath can't use, is said with what to choose
 * instead. Anything else as Toolpath said it.
 */
export const planFailureWords = (error: string | null, bodyIndex: number | null): string | null => {
  if (error === null) {
    return null
  }
  switch (failureCode(error)) {
    case 'part_outside_initial_stock':
      return bodyIndex === null ? error : STOCK_BODY_MISFIT
    case 'body_mismatch':
    case 'body_not_found':
      // Toolpath says "stock body" where the stock body is the one lost, and never of the part's own.
      return bodyIndex !== null && error.includes('stock body') ? STOCK_BODY_LOST : PART_BODY_LOST
    case 'own_body':
      return OWN_BODY
    case 'stock_body_unusable':
      return STOCK_BODY_UNUSABLE
    default:
      return error
  }
}

/** The failures no run of the same inputs gets past, in their words (`planFailureWords`). */
const PERMANENT_FAILURES: ReadonlyArray<string> = [
  PART_BODY_LOST,
  STOCK_BODY_LOST,
  STOCK_BODY_UNUSABLE,
  STOCK_BODY_MISFIT,
  ...Object.values(STOCK_BODY_REFUSALS),
]

/** Their codes, for an error kept as Toolpath gave it, before it was worded. */
const PERMANENT_CODES: ReadonlyArray<string> = [
  'body_mismatch',
  'body_not_found',
  'own_body',
  'stock_body_unusable',
  'unknown_body',
  'stock_body_requires_file',
  'part_outside_initial_stock',
]

/**
 * Whether a failed plan failed for good: its part's body or its stock body lost to the file, a part
 * that doesn't fit its stock, or a stock body Toolpath refused or can't use — its own, one the file
 * has no such body for, or any for a part not made from a file. Sending the same inputs again can
 * only fail again, so offer no Try again: the words say what to change, and changing the stock asks
 * for a run of its own. Takes the error as the part keeps it (`planFailureWords`) or as Toolpath
 * gave it, as one kept before it was worded is.
 */
export const isPermanentPlanFailure = (error: string | null): boolean => {
  if (error === null) {
    return false
  }
  const code = failureCode(error)
  return PERMANENT_FAILURES.includes(error) || (code !== null && PERMANENT_CODES.includes(code))
}
