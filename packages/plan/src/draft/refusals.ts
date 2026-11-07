/*
  Why an edit is refused, as a `kind` and its facts: the app says it in its own words.
  `constraints` and `actions` both give these; `constraints` exports `MAX_DEPTH`.
*/

/** How deep a group may sit below its setup (FLD7). */
export const MAX_DEPTH = 6

/** A group a refusal or a check is about: its id, and its name as the draft holds it. */
export interface GroupRef {
  id: string
  name: string
}

/**
 * Why an edit can't be made.
 *
 * - `groupGone`: the group is no longer in the draft.
 * - `tooDeep`: the group would sit more than `max` below its setup.
 * - `tooManySetups`: the plan holds `max` setups already.
 * - `idTaken`: the id for a new group is another group's.
 * - `notAnAction`: the action is not on the list, or not for this draft.
 * - `noTool`: no tool can cut the feature, so an assignment of it machines nothing.
 * - `needsSaved`: the edit needs the plan as saved.
 * - `notEmpty`: starting from Toolpath's plan needs a draft with no groups.
 * - `notWholeMove`: a group moves a whole number of places.
 * - `directionTaken`: `group` is cut from that direction already.
 * - `directionIsSetup`: the group is cut from `setup`'s direction, a setup already.
 * - `noGroupFacing`: no group in `group` is cut from that direction.
 * - `otherWay`: a row stays in groups cut from its own direction.
 * - `intoItself`: a group can't go inside itself.
 * - `hasOrientations`: the setup holds orientations; move or delete them first.
 * - `orientationOutsideSetup`: only a group inside a setup can be an orientation.
 * - `orientationNeedsAxes`: only a 3+1 or 3+2 setup has orientations.
 * - `holdOnlySetup`: only a setup has a hold.
 */
export type Refusal =
  | { kind: 'groupGone' }
  | { kind: 'tooDeep'; max: number }
  | { kind: 'tooManySetups'; max: number }
  | { kind: 'idTaken' }
  | { kind: 'notAnAction' }
  | { kind: 'noTool' }
  | { kind: 'needsSaved' }
  | { kind: 'notEmpty' }
  | { kind: 'notWholeMove' }
  | { kind: 'directionTaken'; group: GroupRef }
  | { kind: 'directionIsSetup'; setup: GroupRef }
  | { kind: 'noGroupFacing'; group: GroupRef }
  | { kind: 'otherWay' }
  | { kind: 'intoItself' }
  | { kind: 'hasOrientations' }
  | { kind: 'orientationOutsideSetup' }
  | { kind: 'orientationNeedsAxes' }
  | { kind: 'holdOnlySetup' }

/** An edit that can't be made, and why. */
export interface Refused {
  refused: Refusal
}

/** A group as a refusal names it. */
export const groupRef = (group: GroupRef): GroupRef => ({ id: group.id, name: group.name })

export const GONE: Refusal = { kind: 'groupGone' }
export const TOO_DEEP: Refusal = { kind: 'tooDeep', max: MAX_DEPTH }
