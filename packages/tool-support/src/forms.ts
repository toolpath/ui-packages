/**
 * What a tool *is*, in the words a CAM library uses.
 *
 * A scrape hands over a coarse kind — `endmill`, `drill`, `tap` — and that is
 * the right seam for it: it is what a vendor's family table says. But a shop
 * choosing a tool for a filleted pocket is not choosing "an endmill", it is
 * choosing a bull nose, and the difference is one number the vendor did state:
 * the corner radius. So the finer name is derived where a dataset is built, and
 * carried on every tool as its `form`.
 *
 * The vocabulary is Fusion's own library, so a tool exported there lands on the
 * type it already has. This list is the single source: icons draw from it,
 * filter panels offer it, and a drawing decides from it whether it has an
 * honest picture to draw.
 */

/** One form, and the group a control offers it under. */
export interface ToolFormEntry {
  readonly value: string
  readonly label: string
  readonly group: 'Milling' | 'Hole making'
}

export const TOOL_FORMS = [
  { value: 'ball end mill', label: 'Ball end mill', group: 'Milling' },
  { value: 'bull nose end mill', label: 'Bull nose end mill', group: 'Milling' },
  { value: 'flat end mill', label: 'Flat end mill', group: 'Milling' },
  { value: 'face mill', label: 'Face mill', group: 'Milling' },
  { value: 'tapered mill', label: 'Tapered mill', group: 'Milling' },
  { value: 'radius mill', label: 'Radius mill', group: 'Milling' },
  { value: 'chamfer mill', label: 'Engrave/chamfer mill', group: 'Milling' },
  { value: 'dovetail mill', label: 'Dovetail mill', group: 'Milling' },
  { value: 'lollipop mill', label: 'Lollipop mill', group: 'Milling' },
  { value: 'slot mill', label: 'Slot mill', group: 'Milling' },
  { value: 'thread mill', label: 'Thread mill', group: 'Milling' },
  { value: 'circle segment barrel', label: 'Circle segment barrel', group: 'Milling' },
  { value: 'circle segment lens', label: 'Circle segment lens', group: 'Milling' },
  { value: 'circle segment oval', label: 'Circle segment oval', group: 'Milling' },
  { value: 'circle segment taper', label: 'Circle segment taper', group: 'Milling' },
  { value: 'boring bar', label: 'Boring bar', group: 'Hole making' },
  { value: 'counter bore', label: 'Counter bore', group: 'Hole making' },
  { value: 'drill', label: 'Drill', group: 'Hole making' },
  { value: 'center drill', label: 'Center drill', group: 'Hole making' },
  { value: 'spot drill', label: 'Spot drill', group: 'Hole making' },
  { value: 'reamer', label: 'Reamer', group: 'Hole making' },
  { value: 'counter sink', label: 'Counter sink', group: 'Hole making' },
  { value: 'tap left hand', label: 'Tap left hand', group: 'Hole making' },
  { value: 'tap right hand', label: 'Tap right hand', group: 'Hole making' },
] as const satisfies readonly ToolFormEntry[]

/**
 * A form, or `other`.
 *
 * `other` is in the union rather than beside it because it is a real answer: a
 * vendor publishes tools this vocabulary has no word for, and a dataset that
 * had to pick the nearest wrong form would be worse than one that says it does
 * not know. What draws or suggests from a form has to handle it.
 */
export type ToolForm = (typeof TOOL_FORMS)[number]['value'] | 'other'

/** The forms that mill — the ones a flute-count suggestion makes sense for. */
export const MILLING_FORMS: ReadonlySet<ToolForm> = new Set(
  TOOL_FORMS.filter((form) => form.group === 'Milling').map((form) => form.value),
)

export const isToolForm = (value: string): value is ToolForm =>
  value === 'other' || TOOL_FORMS.some((form) => form.value === value)

/**
 * The forms that cut a thread with a square-driven tool — the taps.
 *
 * Derived from {@link TOOL_FORMS} by the vocabulary's own naming, the way
 * {@link MILLING_FORMS} is derived from its `group`. A rostered pair of strings
 * beside the list would be a second copy of the vocabulary to disagree with it.
 * `'tapered mill'` is not matched: the prefix is `'tap '` with the space.
 *
 * `'Hole making'` is the wrong axis here — it holds drills, reamers and boring
 * bars — which is why this cannot be a `group` filter.
 */
export const TAP_FORMS: ReadonlySet<ToolForm> = new Set(
  TOOL_FORMS.filter((form) => form.value.startsWith('tap ')).map((form) => form.value),
)

/** Whether a form is a tap, and therefore driven by a square. */
export const isTapForm = (form: string): boolean => TAP_FORMS.has(form as ToolForm)
