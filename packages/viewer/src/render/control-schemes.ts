/** A named CAD navigation preset a consumer may pass to `<Viewer controls>`. */
export const CONTROL_SCHEME_OPTIONS = [
  { value: 'toolpath', label: 'Toolpath' },
  { value: 'fusion', label: 'Fusion' },
  { value: 'alias', label: 'Alias' },
  { value: 'inventor', label: 'Inventor' },
  { value: 'solidworks', label: 'SolidWorks' },
  { value: 'tinkercad', label: 'Tinkercad' },
  { value: 'powermill', label: 'PowerMill' },
  { value: 'onshape', label: 'Onshape' },
] as const

/** The public values accepted by `<Viewer controls>` and `CadCameraControls`. */
export type ControlScheme = (typeof CONTROL_SCHEME_OPTIONS)[number]['value']

export type ControlSchemeOption = (typeof CONTROL_SCHEME_OPTIONS)[number]

type PointerAction = 'none' | 'rotate' | 'truck' | 'zoom'

type WheelAction = 'none' | 'zoom' | 'dolly'

export interface ControlSchemeMapping {
  readonly mouse: {
    readonly left: PointerAction
    readonly middle: PointerAction
    readonly right: PointerAction
    readonly wheel: WheelAction
  }
  readonly touches: {
    readonly one: 'rotate'
    readonly two: 'rotate' | 'truck' | 'dolly-truck'
    readonly three: 'truck'
  }
  /** Fusion and Inventor distinguish a trackpad scroll from a pinch wheel event. */
  readonly usesCadWheel: boolean
  /** These presets track pointer and trackpad movement with no damping. */
  readonly immediate: boolean
}

interface ControlModifiers {
  readonly shift: boolean
  readonly ctrl: boolean
}

export interface ControlSchemeEnvironment {
  readonly orthographic: boolean
  readonly modifiers: ControlModifiers
}

const DEFAULT_TOUCHES: ControlSchemeMapping['touches'] = {
  one: 'rotate',
  two: 'dolly-truck',
  three: 'truck',
}

const wheelFor = (orthographic: boolean): WheelAction => (orthographic ? 'zoom' : 'dolly')

const mapping = (
  environment: ControlSchemeEnvironment,
  mouse: Partial<ControlSchemeMapping['mouse']>,
  options: Pick<ControlSchemeMapping, 'usesCadWheel' | 'immediate'>,
  touches: ControlSchemeMapping['touches'] = DEFAULT_TOUCHES,
): ControlSchemeMapping => ({
  mouse: {
    left: 'none',
    middle: 'none',
    right: 'none',
    wheel: wheelFor(environment.orthographic),
    ...mouse,
  },
  touches,
  ...options,
})

/**
 * Resolves the pointer, touch, and wheel actions for a named CAD preset.
 *
 * This is deliberately data-only: `ExtendedCameraControls` owns the DOM
 * listeners and translates these names to camera-controls actions, while this
 * function is the single, testable record of Toolpath's navigation parity.
 */
export const resolveControlScheme = (
  scheme: ControlScheme,
  environment: ControlSchemeEnvironment,
): ControlSchemeMapping => {
  const { shift, ctrl } = environment.modifiers

  switch (scheme) {
    case 'fusion':
    case 'inventor': {
      const rotating = shift
      return mapping(
        environment,
        { middle: rotating ? 'rotate' : 'truck', wheel: 'none' },
        { usesCadWheel: true, immediate: true },
        {
          one: 'rotate',
          two: rotating ? 'rotate' : 'truck',
          three: 'truck',
        },
      )
    }
    case 'solidworks':
      // This order matches the legacy viewer: Shift wins when both are held.
      return mapping(
        environment,
        { middle: shift ? 'zoom' : ctrl ? 'truck' : 'rotate' },
        { usesCadWheel: false, immediate: false },
      )
    case 'alias':
      return mapping(
        environment,
        { left: 'rotate', middle: 'truck' },
        { usesCadWheel: false, immediate: false },
      )
    case 'tinkercad':
      return mapping(
        environment,
        { right: shift ? 'truck' : 'rotate' },
        { usesCadWheel: false, immediate: false },
      )
    case 'powermill':
      return mapping(
        environment,
        { middle: shift ? 'truck' : 'rotate' },
        { usesCadWheel: false, immediate: false },
      )
    case 'onshape':
      return mapping(
        environment,
        { middle: 'truck', right: 'rotate' },
        { usesCadWheel: false, immediate: false },
      )
    case 'toolpath':
      return mapping(
        environment,
        { left: 'rotate', right: 'truck' },
        { usesCadWheel: false, immediate: false },
      )
  }
}
