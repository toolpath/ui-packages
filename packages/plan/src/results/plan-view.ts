import { tagKey, unlistedTrimmedFeatures } from '../faces/coverage'
import {
  featureTypeLabel,
  notMachinedOf,
  trimmedFeatureLabel,
  type EnginePlan,
  type EnginePlanSetup,
  type PlanDirection,
  type TrimmedFeature,
  type WithTrimmedFeatures,
} from './plan'
import { notFinishedIn } from './leftovers'

/*
  Toolpath's plan in the kernel's own shape (`planView`): setups in machining order, each machined
  from one direction or, for a 3+2 setup, several, each direction taking its features. Its rows and
  group views are the ones the constraints' tree (`draftView`) lists too.
*/

/** One feature a direction takes: its tag, and its type and label from the part's analysis. */
export interface PlanFeatureRow {
  tag: string
  label: string
  /** The Engine's feature type (`blind_hole`, `open_pocket`), which its icon is drawn from. */
  type?: string
  /** A hole's bore, once its sheet is in: what holes of a type are grouped by. */
  bore?: FeatureBore
  /** A feature a statement trimmed (`TrimmedFeature`), which the part's report does not list. */
  trimmed?: true
}

/** A hole's bore: its diameter in millimetres, and as the page says it (`⌀6.35 mm`). */
export interface FeatureBore {
  diameter: number
  label: string
}

/** One direction of a setup — the way the tool points — with the features cut from it. */
export interface PlanOrientationView {
  id: string
  direction: PlanDirection
  /** Its place among the part's candidate directions, which is its colour; -1 when not one. */
  directionIndex: number
  features: Array<PlanFeatureRow>
}

/**
 * A group as the tree shows it — a setup at the top, the groups inside it below. Its one
 * orientation is the direction it is cut from and the rows in it.
 */
export interface PlanSetupView {
  id: string
  name: string
  /** A setup's hold: `3 axis` from one direction, `3+1` / `3+2` turning the part to tilts. */
  process: '3axis' | '3+1' | '3+2'
  orientations: Array<PlanOrientationView>
  /** 0 for a setup. */
  depth: number
  /** The setup it is in (itself for a setup), and the group it is in, if any. */
  setupId: string
  parentId: string | null
  /** A tilt of its own inside an indexed setup. */
  orientation: boolean
  /** Whether it faces its own direction — a setup or orientation — rather than following. */
  isFrame: boolean
  groups: Array<PlanSetupView>
}

/** A setup of Toolpath's plan, as `planView` lays it out: its rows, and what it left uncut. */
export interface PlannedSetupView extends PlanSetupView {
  /** Features the setup was meant to machine that no pass in it does. */
  notMachined: Array<PlanFeatureRow>
  /**
   * Of those, the ones a pass in it does cut, but short: roughed, and owed a finish no pass gives
   * (`notFinishedIn`). The rest are not machined at all.
   */
  notFinished: Array<string>
  operations: number
}

/**
 * What a flat plan's setup is given of a group view's place: at the top, with no groups inside.
 */
type Placement = Pick<
  PlanSetupView,
  'depth' | 'setupId' | 'parentId' | 'orientation' | 'isFrame' | 'groups'
>

/** A group view with the shape a flat plan's setup has: no groups inside, at the top. */
const flatView = <T extends Omit<PlanSetupView, keyof Placement>>(view: T): T & Placement => ({
  ...view,
  depth: 0,
  setupId: view.id,
  parentId: null,
  orientation: false,
  isFrame: true,
  groups: [],
})

/**
 * What the view needs to know about the part: which candidate a direction is, and what a tag is.
 */
export interface PlanPart {
  directionIndex: (direction: PlanDirection) => number
  featureLabel: (tag: string) => string
  /** The Engine's type for a tag, when the part's analysis has read it. */
  featureType?: (tag: string) => string | undefined
  /** A hole's bore, once its sheet is in. */
  featureBore?: (tag: string) => FeatureBore | undefined
}

/** A plan's trimmed features, by tag (lower case). */
export type TrimmedByTag = ReadonlyMap<string, TrimmedFeature>

/**
 * A plan's trimmed features by tag (lower case), but any whose tag the part's report lists — one
 * the part has a type for (`featureType`) — as `planFeaturesOf` leaves them out. None with no plan.
 */
export const trimmedByTag = (
  plan: WithTrimmedFeatures,
  part: Pick<PlanPart, 'featureType'>,
): TrimmedByTag =>
  new Map(
    unlistedTrimmedFeatures(plan, (key) => part.featureType?.(key) !== undefined).map((feature) => [
      tagKey(feature.featureTag),
      feature,
    ]),
  )

/**
 * The report feature a trimmed feature borrows from — its datasheet, bore, rules and type: the one
 * it was cut from (`fromFeatureTag`), where trimming left its type as it was (`typeOf` gives the
 * report's type for a tag). Null for one cut from no single feature, or whose type the trimming
 * changed: that one is read by its own type alone.
 */
export const trimmedOrigin = (
  feature: Pick<TrimmedFeature, 'featureType' | 'fromFeatureTag'>,
  typeOf: (tag: string) => string | undefined,
): string | null => {
  const origin = feature.fromFeatureTag
  return origin !== null && typeOf(origin) === feature.featureType ? origin : null
}

/**
 * A tag's row, as the part reads it. A trimmed tag reads as what it was trimmed from, with its own
 * type (`trimmedFeatureLabel`), or as its own type where the part has no type for that feature
 * (`featureType`); and with that feature's bore where it borrows from it (`trimmedOrigin`).
 */
export const featureRow = (
  part: Pick<PlanPart, 'featureLabel' | 'featureType' | 'featureBore'>,
  trimmedFeatures: TrimmedByTag,
  tag: string,
): PlanFeatureRow => {
  const trimmedFeature = trimmedFeatures.get(tagKey(tag))
  if (trimmedFeature) {
    const typeOf = (each: string) => part.featureType?.(each)
    const origin = trimmedOrigin(trimmedFeature, typeOf)
    const bore = origin ? part.featureBore?.(origin) : undefined
    // A part that reads types and has none for the origin does not list it: no label of its own.
    const unknown = (from: string) => part.featureType !== undefined && typeOf(from) === undefined
    return {
      tag,
      label: trimmedFeatureLabel(trimmedFeature, (from) =>
        unknown(from) ? featureTypeLabel(trimmedFeature.featureType) : part.featureLabel(from),
      ),
      type: trimmedFeature.featureType,
      trimmed: true,
      ...(bore ? { bore } : {}),
    }
  }
  const bore = part.featureBore?.(tag)
  return {
    tag,
    label: part.featureLabel(tag),
    type: part.featureType?.(tag),
    ...(bore ? { bore } : {}),
  }
}

/** Each tag once, in the order first met. */
export const unique = (tags: Iterable<string>): Array<string> => [...new Set(tags)]

/**
 * The plan's setups, each with every direction it is machined from.
 *
 * The plan's own statement (`setupPlan`) says both, and is what a plan is edited from. An Engine
 * that does not serve one (before API 1.19) gives each setup only its first direction, so the
 * features are read off its passes instead: every tag an action cuts, in machining order.
 *
 * A tag the plan's statements trimmed (`trimmedFeatures`) is a row of its own, marked `trimmed`:
 * `Pocket (trimmed)`, from the label of the feature it was trimmed from.
 */
export const planView = (
  plan: Pick<EnginePlan, 'setups' | 'setupPlan' | 'trimmedFeatures'>,
  part: PlanPart,
): Array<PlannedSetupView> => {
  const trimmedFeatures = trimmedByTag(plan, part)
  const reading: SetupReading = {
    directionIndex: (direction) => part.directionIndex(direction),
    row: (tag) => featureRow(part, trimmedFeatures, tag),
  }
  return plan.setups.map((setup, index) =>
    plannedSetupView(setup, index, plannedDirections(plan, setup, index), reading),
  )
}

/** What a planned setup's view reads of the part: each direction's place, and each tag's row. */
interface SetupReading {
  directionIndex: (direction: PlanDirection) => number
  row: (tag: string) => PlanFeatureRow
}

/** One direction a planned setup is machined from, and the tags it takes. */
interface PlannedDirection {
  direction: PlanDirection
  tags: Array<string>
}

/**
 * The directions of the plan's setup at `index`: as the plan states them, or — with no statement —
 * the setup's first direction, taking every tag its actions cut.
 */
const plannedDirections = (
  plan: Pick<EnginePlan, 'setupPlan'>,
  setup: EnginePlanSetup,
  index: number,
): Array<PlannedDirection> => {
  const stated = plan.setupPlan?.setups[index]?.orientations
  if (stated) {
    return stated.map((orientation) => ({
      direction: orientation.direction,
      tags: unique(orientation.features),
    }))
  }
  if (!setup.direction) {
    return []
  }
  return [
    {
      direction: setup.direction,
      tags: unique(setup.actions.flatMap((action) => action.featureTags)),
    },
  ]
}

/** A setup of the plan, `index` in machining order, as the tree shows it. */
const plannedSetupView = (
  setup: EnginePlanSetup,
  index: number,
  directions: ReadonlyArray<PlannedDirection>,
  { directionIndex, row }: SetupReading,
): PlannedSetupView =>
  flatView({
    id: `setup-${setup.idx}`,
    name: `Setup ${index + 1}`,
    process: directions.length > 1 ? '3+2' : '3axis',
    orientations: directions.map(({ direction, tags }, at) => ({
      id: `setup-${setup.idx}-${at}`,
      direction,
      directionIndex: directionIndex(direction),
      features: tags.map(row),
    })),
    notMachined: unique(notMachinedOf(setup)).map(row),
    notFinished: notFinishedIn(setup),
    operations: setup.actions.length,
  })
