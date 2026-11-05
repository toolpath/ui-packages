import type { BrokenRule } from './broken-rules.js'
import type { DfmRule } from './dfm-rules.js'
import type { Measurement } from './feature-details.js'
import type { DfmFeature } from './geometry.js'

/*
 * The data the DFM views read: the rule list's, the feature panel's and the
 * pickers'. Plain data, so a view in any renderer can build the same rows.
 * `@toolpath/ui`'s views take them; where a view also takes something to
 * render (a row's label, say), its own type adds that field to these.
 */

/** One thing a picker offers: the value it sets, and the words it shows. */
export interface Choice {
  value: string
  label: string
}

/** Choices under a heading of their own, or under none: a picker's first group has none. */
export interface ChoiceGroup {
  heading?: string
  choices: readonly Choice[]
}

/** What a picker offers: its groups, and — for a short list — the last item, which lists the rest. */
export interface Choices {
  groups: readonly ChoiceGroup[]
  more?: string
}

/** What a view needs to name a feature: its tag, its type, and the way it is machined from. */
export type FeatureIdentity = Pick<DfmFeature, 'tag' | 'featureType' | 'machiningDirection'>

/**
 * One feature a face could have meant, as its row says it: the data, named
 * apart from `@toolpath/ui`'s `CandidateRow`, which extends it with what the
 * row renders beside it: a label, a detail, a note and an action.
 */
export interface CandidateRowData {
  readonly feature: FeatureIdentity
  /** The dot before it: the colour it is painted, or its direction's. Left out, a gap keeps the rows aligned. */
  readonly color?: string
  /** How many rules it breaks: `2 rules`. */
  readonly ruleCount?: number
  readonly required?: boolean
}

/** When comparing faces, which face this list is: its letter, and how to stop comparing it. */
export interface ComparedFaceList {
  readonly index: number
  /** The face being read: its letter is filled. */
  readonly active: boolean
  readonly onStop?: () => void
}

/** One compared face: the feature it is read as, and what that feature is and measures. */
export interface ComparedFace {
  /** Null for a face no feature owns. */
  readonly feature: FeatureIdentity | null
  /** Its machining direction's colour, as the part shows it. */
  readonly directionColor: string
  /** Whether it is required. Left out on every face, the Required row goes. */
  readonly required?: boolean
  readonly rules: readonly BrokenRule[]
  readonly measurements: readonly Measurement[]
}

/**
 * One face being inspected: the features it could mean, and the one being
 * read. The data, named apart from `@toolpath/ui`'s `InspectedFace`, whose
 * rows are its own `CandidateRow`s.
 */
export interface InspectedFaceData {
  /** The face clicked; null for a feature chosen from a list, which has no candidates to show. */
  readonly region: number | null
  /** In the app's order: the first is what a click meant first. */
  readonly rows: readonly CandidateRowData[]
  readonly selected: string | null
}

/**
 * The rules the list shows, and how to change them. The app owns them —
 * where they are kept, and what they start as — so the list works on any
 * store and ships no rules of its own.
 */
export interface DfmRules {
  rules: readonly DfmRule[]
  /** Adds a rule at the end of the list. */
  add: (rule: DfmRule) => void
  /** Replaces the rule with the same id. */
  update: (rule: DfmRule) => void
  remove: (id: string) => void
  /** Puts an imported set in place of the list. */
  replace: (rules: readonly DfmRule[]) => void
}

/** The feature, or group of holes, the pointer is over in a list; null for none. */
export type Hovered = string | readonly string[] | null
