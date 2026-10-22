/*
  The refusals `plan-draft` and `draft-action` both give, worded once. Internal: `index.ts` does not
  export this module; `plan-draft` exports `MAX_DEPTH`.
*/

/** How deep a folder may sit below its setup (FLD7). */
export const MAX_DEPTH = 6

/** The refusal of an edit to a folder the draft no longer holds. */
export const GONE = 'That folder is gone.'

/** The refusal of an edit that would put a folder deeper than `MAX_DEPTH`. */
export const TOO_DEEP = `Folders sit at most ${MAX_DEPTH} below their setup.`
