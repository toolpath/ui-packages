/**
 * `@toolpath/quoting/model` — the quote flow, with no React, no DOM and no database: where a part,
 * a quote, a revision and a payment stand, and what moving a part between stages means. Each
 * state is read from facts the app keeps, the stored stage among them; nothing here stores anything.
 */
export * from './artifact-state'
export * from './expiry'
export * from './part-stage'
export * from './part-state'
export * from './pay-state'
export * from './quote-parts'
export * from './quote-status'
export * from './revision-state'
