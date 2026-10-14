import type { ToolForm } from '@toolpath/tool-support'
import { FLAT_TIP_DEG } from './geometry.js'

/*
 * Which tool forms may cut which kind of feature.
 *
 * Ported from the tool catalog's hand-edited sheet
 * (toolpath-template `apps/catalog/app/shared/feature-defaults.csv`, read by
 * `feature-defaults.ts` `defaultsFor`), keeping only its `feature`, `when` and
 * `tool types` columns. **This is a gate on geometry and type, not a
 * recommendation**: it says which forms have the shape to cut a feature at
 * all, so a tool list can hide the rest. Which one to use, how many flutes and
 * which brand stay the catalog's to say. The forms are in the sheet's order,
 * its first the one a list leads with.
 */

/** A row's condition, as the sheet names it. */
type FeatureFormsWhen = 'filleted' | 'flat bottom'

/** One row of {@link FEATURE_TOOL_FORMS}. */
interface FeatureToolForms {
  /** The Engine's `FeatureType`, matched case- and separator-insensitively. */
  readonly feature: string
  /** Blank is always. Rows are first-match-wins, so a conditional row comes before the plain one. */
  readonly when?: FeatureFormsWhen
  readonly forms: readonly ToolForm[]
}

/**
 * The table itself. Exported for the tests only: the package's public entry
 * gives {@link formsFor}, so the table's shape stays free to change.
 */
export const FEATURE_TOOL_FORMS = [
  {
    feature: 'ThroughHole',
    forms: ['drill', 'flat end mill', 'bull nose end mill', 'ball end mill'],
  },
  {
    feature: 'BlindHole',
    when: 'flat bottom',
    forms: ['flat end mill', 'bull nose end mill', 'drill'],
  },
  {
    feature: 'BlindHole',
    when: 'filleted',
    forms: ['drill', 'bull nose end mill', 'flat end mill'],
  },
  {
    feature: 'BlindHole',
    forms: ['drill', 'flat end mill', 'bull nose end mill', 'ball end mill'],
  },
  { feature: 'ThroughPocket', forms: ['flat end mill', 'bull nose end mill', 'ball end mill'] },
  {
    feature: 'Pocket',
    when: 'filleted',
    forms: ['bull nose end mill', 'flat end mill', 'ball end mill'],
  },
  { feature: 'Pocket', forms: ['flat end mill', 'bull nose end mill'] },
  {
    feature: 'OpenPocket',
    when: 'filleted',
    forms: ['bull nose end mill', 'flat end mill', 'ball end mill'],
  },
  { feature: 'OpenPocket', forms: ['flat end mill', 'bull nose end mill'] },
  { feature: 'Profile', forms: ['flat end mill', 'bull nose end mill'] },
  {
    feature: 'Boss',
    when: 'filleted',
    forms: ['bull nose end mill', 'flat end mill', 'ball end mill'],
  },
  { feature: 'Boss', forms: ['flat end mill', 'bull nose end mill'] },
  { feature: 'Face', forms: ['flat end mill', 'bull nose end mill', 'ball end mill', 'face mill'] },
  { feature: 'Sink', forms: ['chamfer mill', 'counter sink', 'spot drill', 'ball end mill'] },
  {
    feature: 'Chamfer',
    forms: ['chamfer mill', 'ball end mill', 'bull nose end mill', 'flat end mill'],
  },
  { feature: 'Fillet', forms: ['ball end mill', 'bull nose end mill', 'flat end mill'] },
  { feature: 'ContourSurface', forms: ['ball end mill', 'bull nose end mill', 'flat end mill'] },
  { feature: 'FilletedPocket', forms: ['bull nose end mill', 'flat end mill', 'ball end mill'] },
  { feature: 'Thread', forms: ['tap right hand', 'drill'] },
  {
    feature: 'FilletedOpenPocket',
    forms: ['bull nose end mill', 'flat end mill', 'ball end mill'],
  },
  {
    feature: 'FilletedBlindHole',
    forms: ['drill', 'bull nose end mill', 'flat end mill', 'ball end mill'],
  },
  { feature: 'Wall', forms: ['flat end mill', 'bull nose end mill'] },
  {
    feature: 'SlantedFace',
    forms: ['ball end mill', 'bull nose end mill', 'flat end mill', 'tapered mill'],
  },
  { feature: 'InnerFillet', forms: ['ball end mill', 'bull nose end mill', 'flat end mill'] },
  {
    feature: 'OuterFillet',
    forms: ['radius mill', 'ball end mill', 'bull nose end mill', 'flat end mill'],
  },
  { feature: 'SyntheticHole', forms: ['flat end mill', 'bull nose end mill', 'ball end mill'] },
  { feature: 'FilletedBoss', forms: ['bull nose end mill', 'flat end mill', 'ball end mill'] },
  { feature: 'UndercutTslot', forms: ['slot mill'] },
  { feature: 'UndercutDovetail', forms: ['dovetail mill'] },
  { feature: 'UndercutFilletedTslot', forms: ['slot mill'] },
  { feature: 'BackSink', forms: ['chamfer mill'] },
  { feature: 'BackChamfer', forms: ['chamfer mill'] },
  { feature: 'UndercutWall', forms: ['lollipop mill', 'slot mill'] },
  { feature: 'USlot', forms: ['ball end mill', 'bull nose end mill'] },
  { feature: 'UndercutFilletedDovetail', forms: ['dovetail mill'] },
  { feature: 'TaperedThroughHole', forms: ['tapered mill', 'drill'] },
  { feature: 'ThreadedBlindHole', forms: ['tap right hand', 'drill'] },
  { feature: 'ThreadedThroughHole', forms: ['tap right hand', 'drill'] },
] as const satisfies readonly FeatureToolForms[]

/**
 * `BlindHole`, `blind_hole` and `Blind Hole` are one name: the SDK's
 * `FeatureType` is Pascal case, the report's features snake case.
 *
 * The catalog's own `featureKey` (toolpath-template
 * `apps/catalog/app/shared/feature-defaults.ts`), which keys its sheet the
 * same way: change one and the other must follow.
 */
const featureKey = (name: string): string => name.toLowerCase().replace(/[^a-z0-9]/g, '')

/**
 * The figures a row's condition reads, under `FeatureSheet`'s names, so a
 * sheet can be passed as it is. Millimetres and degrees.
 */
export interface FeatureFormFacts {
  /** `facts.filletRadius`: above zero is filleted. */
  readonly filletRadius?: number
  /** A hole's `facts.fullConeDeg`: within `FLAT_TIP_DEG` of 180 is a flat bottom, as `isDrilled` reads it. */
  readonly tipAngle?: number
}

const holds = (when: FeatureFormsWhen | undefined, facts: FeatureFormFacts): boolean => {
  if (when === 'filleted') return (facts.filletRadius ?? 0) > 0
  if (when === 'flat bottom') return (facts.tipAngle ?? 0) >= 180 - FLAT_TIP_DEG
  return true
}

/**
 * The tool forms that may cut a feature of this type, in the order a list
 * leads with them: the first row for the type whose condition holds. Null for
 * a type the table does not know, so the caller shows every tool rather than
 * none.
 */
export const formsFor = (
  featureType: string,
  facts: FeatureFormFacts = {},
): readonly ToolForm[] | null => {
  const key = featureKey(featureType)
  const rows: readonly FeatureToolForms[] = FEATURE_TOOL_FORMS
  return (
    rows.find((row) => featureKey(row.feature) === key && holds(row.when, facts))?.forms ?? null
  )
}
