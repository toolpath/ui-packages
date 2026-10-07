/**
 * How the feature panel looks where two apps want it to differ. Every field
 * left out takes the first value, which is the CAD viewer's look.
 */
export interface FeaturePanelLook {
  /**
   * A broken rule: `sentence` — the rule written out, the figure that broke it
   * in grey; or `result` — a short label, the figure in the rule's colour, and
   * the line it crossed, faded.
   */
  rules?: 'sentence' | 'result'
  /** The chosen candidate: `grey` and bold, or an `info` blue border and tint. */
  selected?: 'grey' | 'info'
  /** Secondary text: `pale` grey, or a `strong` grey that reads at full contrast. */
  muted?: 'pale' | 'strong'
}

export type ResolvedLook = Required<FeaturePanelLook>

export const resolveLook = (look: FeaturePanelLook | undefined): ResolvedLook => ({
  rules: look?.rules ?? 'sentence',
  selected: look?.selected ?? 'grey',
  muted: look?.muted ?? 'pale',
})

/** Labels and secondary words: a field's name, a count. */
export const secondaryText = (look: ResolvedLook): string =>
  look.muted === 'strong' ? 'text-gray dark:text-zinc-300' : 'text-gray-400 dark:text-zinc-400'

/** The quietest words: "from +Z" after a feature's name, the ⓘ. */
export const faintText = (look: ResolvedLook): string =>
  look.muted === 'strong' ? 'text-gray dark:text-zinc-300' : 'text-gray-300 dark:text-zinc-500'
