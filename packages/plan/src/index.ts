/**
 * `@toolpath/plan` — plan mode for Toolpath, with no React, no DOM and no database. Two layers:
 *
 * - The constraints (`plan-draft`): what a person asks for — setups and the folders inside them,
 *   the features pinned to each, and the faces ignored. Every edit is a function from one draft to
 *   the next, or a refusal with its reason; `draft-action` lists them all as one closed list.
 *   `statementOf` turns the constraints into Toolpath's `setupPlan`.
 * - The plan (`engine-plan`): what Toolpath planned from them — setups, each with its direction and
 *   its actions, and what it could not reach.
 *
 * `coverage` reads what a draft and a plan leave of each face: ignored, pinned, open, machined or
 * not machined.
 * `plan-session` holds a page's edits until Apply: Undo, Redo, Discard and the history.
 * An app keeps its own fields beside the constraints: `applyDraftAction` takes any draft that holds
 * them, and hands its other fields back unchanged.
 */
export * from './coverage'
export * from './direction-analysis'
export * from './draft-action'
export * from './engine-plan'
export * from './folder-sort'
export * from './ignore'
export * from './not-machined'
export * from './pin'
export * from './plan-checks'
export * from './plan-draft'
export * from './plan-session'
export * from './plan-view'
export * from './readings'
export * from './results-view'
export * from './same-json'
